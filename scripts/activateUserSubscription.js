/**
 * Script to activate a user's subscription to a specific plan
 * Usage: node scripts/activateUserSubscription.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-platform';

async function activateSubscription() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get user by email
        const userEmail = 'hn@example.com'; // Change this to the user's email
        const user = await User.findOne({ email: userEmail });

        if (!user) {
            console.error(`❌ User not found with email: ${userEmail}`);
            process.exit(1);
        }

        console.log('📋 Current User Info:');
        console.log(`   Name: ${user.name || user.email}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current Subscription: ${user.subscription || 'None'}`);
        console.log(`   Status: ${user.subscriptionStatus || 'none'}\n`);

        // Get Basic plan
        const planName = 'Basic'; // Change this to desired plan
        const plan = await MembershipPlan.findOne({
            $or: [
                { name: planName },
                { displayName: planName }
            ]
        });

        if (!plan) {
            console.error(`❌ Plan not found: ${planName}`);
            console.log('Available plans:');
            const allPlans = await MembershipPlan.find({});
            allPlans.forEach(p => {
                console.log(`   - ${p.displayName || p.name} (${p._id})`);
            });
            process.exit(1);
        }

        console.log('📦 Plan Details:');
        console.log(`   Plan: ${plan.displayName || plan.name}`);
        console.log(`   Plan ID: ${plan._id}`);
        console.log(`   Monthly Price: $${plan.pricing.monthly?.price || 0}`);
        console.log(`   Annual Price: $${plan.pricing.annual?.price || 0}\n`);

        // Choose billing cycle
        const billingCycle = 'monthly'; // Options: 'monthly', 'annual', 'oneTime'

        // Calculate price based on billing cycle
        let price = 0;
        let subscriptionEndDate = new Date();

        if (billingCycle === 'monthly' && plan.pricing.monthly) {
            price = plan.pricing.monthly.price;
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
        } else if (billingCycle === 'annual' && plan.pricing.annual) {
            price = plan.pricing.annual.price;
            subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
        } else if (billingCycle === 'oneTime' && plan.pricing.oneTime) {
            price = plan.pricing.oneTime.price;
            subscriptionEndDate = null; // Lifetime
        }

        // Update user subscription
        user.subscription = plan.displayName || plan.name;
        user.subscriptionPlanId = plan._id;
        user.subscriptionStatus = 'active';
        user.billingCycle = billingCycle;
        user.subscriptionStartDate = new Date();
        user.subscriptionEndDate = subscriptionEndDate;
        user.nextBillingDate = subscriptionEndDate;
        user.lastBillingDate = new Date();
        user.lastPaymentAmount = price;

        // Save the user
        await user.save();

        console.log('✅ Subscription Activated Successfully!\n');
        console.log('📊 Updated Subscription Info:');
        console.log(`   Plan: ${user.subscription}`);
        console.log(`   Status: ${user.subscriptionStatus}`);
        console.log(`   Billing Cycle: ${user.billingCycle}`);
        console.log(`   Price: $${price}`);
        console.log(`   Start Date: ${user.subscriptionStartDate}`);
        console.log(`   End Date: ${user.subscriptionEndDate || 'Lifetime'}`);
        console.log(`   Next Billing: ${user.nextBillingDate || 'N/A'}\n`);

        console.log('🔄 You can now refresh your dashboard to see the updated subscription.');

    } catch (error) {
        console.error('❌ Error activating subscription:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the script
activateSubscription();
