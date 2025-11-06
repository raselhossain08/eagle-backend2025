require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function checkAllUsers() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        const totalUsers = await User.countDocuments();
        console.log(`📊 Total users in database: ${totalUsers}\n`);

        // Check subscription status distribution
        const subscriptionStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log('📋 Subscription Distribution:');
        subscriptionStats.forEach(stat => {
            const subName = stat._id || 'undefined/null';
            console.log(`   ${subName}: ${stat.count} users`);
        });

        // Check users with subscriptionPlanId
        const withPlanId = await User.countDocuments({
            subscriptionPlanId: { $exists: true, $ne: null }
        });
        console.log(`\n✅ Users with subscriptionPlanId: ${withPlanId}`);

        // Check users WITHOUT subscriptionPlanId but have subscription
        const withoutPlanId = await User.countDocuments({
            subscription: { $exists: true, $ne: null, $ne: 'None' },
            subscriptionPlanId: { $exists: false }
        });
        console.log(`⚠️  Users with subscription but NO subscriptionPlanId: ${withoutPlanId}`);

        // Check status distribution
        const statusStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscriptionStatus',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📋 Subscription Status Distribution:');
        statusStats.forEach(stat => {
            const status = stat._id || 'undefined/null';
            console.log(`   ${status}: ${stat.count} users`);
        });

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAllUsers();
