const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');

const checkSubscriptions = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database:', dbUri.split('@')[1]?.split('/')[0] || 'localhost');
        console.log('   Database:', mongoose.connection.name);

        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('   Collections:', collections.map(c => c.name).join(', '));
        console.log('');        // Check total users
        const totalUsers = await User.countDocuments();
        console.log(`📊 Total users: ${totalUsers}\n`);

        // Check users with subscriptions (not "None")
        const usersWithSubscriptions = await User.find({
            subscription: { $ne: 'None', $ne: null }
        })
            .select('firstName lastName email subscription subscriptionStatus subscriptionEndDate subscriptionStartDate isActive')
            .limit(20);

        console.log(`📋 Users with subscriptions: ${usersWithSubscriptions.length}\n`);

        if (usersWithSubscriptions.length > 0) {
            console.log('Subscription Details:');
            console.log('='.repeat(120));
            usersWithSubscriptions.forEach((user, index) => {
                console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`   Subscription: ${user.subscription} | Status: ${user.subscriptionStatus} | Active: ${user.isActive}`);
                console.log(`   Start: ${user.subscriptionStartDate || 'N/A'}`);
                console.log(`   End: ${user.subscriptionEndDate || 'N/A'}`);

                if (user.subscriptionEndDate) {
                    const daysRemaining = Math.ceil((user.subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24));
                    console.log(`   Days Remaining: ${daysRemaining}`);
                }
                console.log('-'.repeat(120));
            });
        } else {
            console.log('❌ No users found with subscriptions other than "None"\n');

            // Check all subscription values
            const allSubscriptions = await User.aggregate([
                {
                    $group: {
                        _id: '$subscription',
                        count: { $sum: 1 },
                        statuses: { $addToSet: '$subscriptionStatus' }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            console.log('📊 Subscription breakdown:');
            allSubscriptions.forEach(sub => {
                console.log(`   ${sub._id || 'null'}: ${sub.count} users, statuses: ${sub.statuses.join(', ')}`);
            });
        }

        // Check active subscriptions
        console.log('\n🔍 Active subscription check:');
        const activeSubscriptions = await User.countDocuments({
            subscription: { $ne: 'None', $ne: null },
            subscriptionStatus: 'active',
            isActive: true
        });
        console.log(`   Active subscriptions: ${activeSubscriptions}`);

        // Check subscriptions with end dates
        const withEndDates = await User.countDocuments({
            subscription: { $ne: 'None', $ne: null },
            subscriptionEndDate: { $ne: null, $exists: true }
        });
        console.log(`   Subscriptions with end dates: ${withEndDates}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkSubscriptions();
