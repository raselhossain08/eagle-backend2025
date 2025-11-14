/**
 * Fix users with $0 lastPaymentAmount by looking up their plan's price
 * Run with: node scripts/fixZeroPaymentAmounts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Product pricing fallback
const PRICING_FALLBACK = {
    'Basic': { monthly: 37, yearly: 370 },
    'Basic Package': { monthly: 37, yearly: 370 },
    'Diamond': { monthly: 67, yearly: 670 },
    'Diamond Package': { monthly: 67, yearly: 670 },
    'Infinity': { monthly: 99, yearly: 999 },
    'Infinity Package': { monthly: 99, yearly: 999 },
    'Script': { monthly: 29, yearly: 299 },
    'Investment Advising': { monthly: 987, yearly: 987 },
    'Trading Tutor': { monthly: 987, yearly: 987 },
    'Eagle Ultimate': { monthly: 2497, yearly: 2497 },
};

async function fixZeroPaymentAmounts() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all users with active subscriptions but $0 payment amount
        const usersWithZeroPayment = await User.find({
            subscriptionStatus: 'active',
            subscription: { $ne: 'None' },
            $or: [
                { lastPaymentAmount: 0 },
                { lastPaymentAmount: null },
                { lastPaymentAmount: { $exists: false } }
            ]
        }).lean();

        console.log(`📊 Found ${usersWithZeroPayment.length} users with $0 payment amounts\n`);

        if (usersWithZeroPayment.length === 0) {
            console.log('✅ No users need fixing!');
            return;
        }

        let fixed = 0;
        let skipped = 0;

        for (const user of usersWithZeroPayment) {
            console.log(`\n👤 Processing: ${user.email}`);
            console.log(`   Subscription: ${user.subscription}`);
            console.log(`   Billing Cycle: ${user.billingCycle || 'monthly'}`);
            console.log(`   Current Payment: $${user.lastPaymentAmount || 0}`);

            let newPaymentAmount = null;

            // Try to get price from MembershipPlan if subscriptionPlanId exists
            if (user.subscriptionPlanId) {
                try {
                    const plan = await MembershipPlan.findById(user.subscriptionPlanId).lean();
                    if (plan && plan.pricing) {
                        const billingCycle = user.billingCycle || 'monthly';
                        if (billingCycle === 'yearly' && plan.pricing.annual) {
                            newPaymentAmount = plan.pricing.annual.price;
                        } else if (plan.pricing.monthly) {
                            newPaymentAmount = plan.pricing.monthly.price;
                        }
                        console.log(`   ✅ Found price in plan: $${newPaymentAmount}`);
                    }
                } catch (err) {
                    console.log(`   ⚠️  Could not fetch plan: ${err.message}`);
                }
            }

            // Fallback to hardcoded pricing
            if (!newPaymentAmount && user.subscription) {
                const billingCycle = user.billingCycle || 'monthly';
                const pricing = PRICING_FALLBACK[user.subscription];
                if (pricing) {
                    newPaymentAmount = pricing[billingCycle];
                    console.log(`   ✅ Using fallback pricing: $${newPaymentAmount}`);
                }
            }

            if (newPaymentAmount) {
                // Update the user
                await User.findByIdAndUpdate(user._id, {
                    lastPaymentAmount: newPaymentAmount
                });
                console.log(`   ✅ Updated payment amount to: $${newPaymentAmount}`);
                fixed++;
            } else {
                console.log(`   ⚠️  Could not determine price - skipping`);
                skipped++;
            }
        }

        console.log('\n\n📊 SUMMARY');
        console.log('═══════════════════════════════════════');
        console.log(`✅ Fixed: ${fixed} users`);
        console.log(`⚠️  Skipped: ${skipped} users`);
        console.log(`📦 Total: ${usersWithZeroPayment.length} users`);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed.');
        process.exit(0);
    }
}

// Run the script
fixZeroPaymentAmounts();
