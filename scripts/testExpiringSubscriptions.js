require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

async function testExpiringSubscriptions() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        const days = 60;
        const currentDate = new Date();
        const futureDate = new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);

        console.log(`🔍 Searching for subscriptions expiring within ${days} days...`);
        console.log(`   Current date: ${currentDate.toISOString()}`);
        console.log(`   Future date: ${futureDate.toISOString()}\n`);

        const expiringUsers = await User.find({
            subscriptionStatus: 'active',
            subscriptionEndDate: {
                $exists: true,
                $ne: null,
                $gte: currentDate,
                $lte: futureDate
            }
        })
            .populate('subscriptionPlanId', 'name displayName pricing planType')
            .select('email name subscription subscriptionStatus subscriptionStartDate subscriptionEndDate nextBillingDate subscriptionPlanId')
            .sort({ subscriptionEndDate: 1 });

        console.log(`📊 Found ${expiringUsers.length} subscriptions expiring within ${days} days\n`);

        if (expiringUsers.length > 0) {
            console.log('📋 Details:');
            expiringUsers.forEach((user, index) => {
                const daysUntilExpiry = Math.ceil((user.subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24));
                console.log(`\n${index + 1}. ${user.email}`);
                console.log(`   Subscription: ${user.subscription}`);
                console.log(`   Status: ${user.subscriptionStatus}`);
                console.log(`   Plan: ${user.subscriptionPlanId?.displayName || user.subscriptionPlanId?.name || 'N/A'}`);
                console.log(`   Start Date: ${user.subscriptionStartDate?.toISOString() || 'N/A'}`);
                console.log(`   End Date: ${user.subscriptionEndDate?.toISOString()}`);
                console.log(`   Days until expiry: ${daysUntilExpiry}`);
                console.log(`   Next Billing: ${user.nextBillingDate?.toISOString() || 'N/A'}`);
            });
        }

        // Also check statistics
        console.log('\n\n📈 Overall Statistics:');
        const activeSubscriptions = await User.countDocuments({ subscriptionStatus: 'active' });
        const withEndDate = await User.countDocuments({
            subscriptionStatus: 'active',
            subscriptionEndDate: { $exists: true, $ne: null }
        });
        const withPlanRef = await User.countDocuments({
            subscriptionStatus: 'active',
            subscriptionPlanId: { $exists: true, $ne: null }
        });

        console.log(`   Total active subscriptions: ${activeSubscriptions}`);
        console.log(`   Active with end date: ${withEndDate}`);
        console.log(`   Active with plan reference: ${withPlanRef}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testExpiringSubscriptions();
