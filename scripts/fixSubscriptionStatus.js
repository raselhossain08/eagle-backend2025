const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');

const fixSubscriptionStatus = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database');
        console.log('');

        // Find all users with invalid or missing subscription status
        const usersToFix = await User.find({
            $or: [
                { subscriptionStatus: { $exists: false } },
                { subscriptionStatus: null },
                { subscriptionStatus: 'inactive' }, // Legacy status
                { subscription: 'None', subscriptionStatus: { $ne: 'none' } }
            ]
        });

        console.log(`📊 Found ${usersToFix.length} users to fix\n`);

        if (usersToFix.length === 0) {
            console.log('✅ No users need fixing!');
            process.exit(0);
        }

        let fixedCount = 0;
        let errorCount = 0;

        for (const user of usersToFix) {
            try {
                // Determine correct status
                let newStatus = 'none';

                if (user.subscription && user.subscription !== 'None') {
                    // User has a subscription plan
                    if (user.subscriptionEndDate) {
                        const now = new Date();
                        if (user.subscriptionEndDate > now) {
                            newStatus = 'active';
                        } else {
                            newStatus = 'expired';
                        }
                    } else {
                        // No end date - could be lifetime or needs review
                        newStatus = 'active'; // Assume active if no end date
                    }
                }

                // Update user
                await User.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            subscriptionStatus: newStatus
                        }
                    }
                );

                fixedCount++;
                console.log(`✅ Fixed: ${user.email} - ${user.subscriptionStatus || 'null'} → ${newStatus}`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Error fixing ${user.email}:`, error.message);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   Total users processed: ${usersToFix.length}`);
        console.log(`   Successfully fixed: ${fixedCount}`);
        console.log(`   Errors: ${errorCount}`);

        // Show updated stats
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$subscriptionStatus',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📈 Updated subscription status distribution:');
        stats.forEach(stat => {
            console.log(`   ${stat._id || 'null'}: ${stat.count} users`);
        });

        console.log('\n🎉 Migration completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

fixSubscriptionStatus();
