require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

async function verifySubscriptionPlans() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Get all users with active subscriptions
        const users = await User.find({
            subscriptionStatus: 'active',
            isDeleted: { $ne: true }
        }).select('email name subscription subscriptionPlanId').lean();

        console.log(`📊 Found ${users.length} active subscribers\n`);

        // Get all plan IDs
        const planIds = users.map(u => u.subscriptionPlanId).filter(Boolean);
        const uniquePlanIds = [...new Set(planIds.map(id => id.toString()))];

        // Fetch plans
        const plans = await MembershipPlan.find({
            _id: { $in: uniquePlanIds }
        }).lean();

        console.log(`📋 Found ${plans.length} unique plan(s)\n`);

        // Display plan details
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 MEMBERSHIP PLANS IN DATABASE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        plans.forEach((plan, index) => {
            console.log(`Plan ${index + 1}:`);
            console.log(`   ID: ${plan._id}`);
            console.log(`   Name: "${plan.name}"`);
            console.log(`   Display Name: "${plan.displayName || plan.name}"`);
            console.log(`   Type: ${plan.planType || 'N/A'}`);
            console.log(`   Category: ${plan.category || 'N/A'}`);
            console.log('   ─────────────────────────────────────────────────────────────\n');
        });

        // Check if user subscription names match plan names
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 VERIFICATION: User Subscription vs Plan Name');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        users.forEach((user, index) => {
            const plan = plans.find(p => p._id.toString() === user.subscriptionPlanId?.toString());
            const planName = plan ? (plan.displayName || plan.name) : 'N/A';
            const match = user.subscription === planName;

            console.log(`User ${index + 1}: ${user.email}`);
            console.log(`   User.subscription field: "${user.subscription}"`);
            console.log(`   Linked plan name: "${planName}"`);
            console.log(`   ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
            console.log('   ─────────────────────────────────────────────────────────────\n');
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n💡 SUMMARY:');
        console.log('   The "subscription" field shows what will display in the dashboard.');
        console.log('   After a new purchase, this should match the actual plan name.');
        console.log('   Current users have: ' + [...new Set(users.map(u => u.subscription))].join(', '));

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifySubscriptionPlans();
