const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');

const migrateUserData = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');

        // Get all users
        const allUsers = await User.find({});
        console.log(`📊 Found ${allUsers.length} users to migrate\n`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of allUsers) {
            try {
                let needsUpdate = false;
                const updates = {};

                // 1. Generate subscriberId if missing
                if (!user.subscriberId) {
                    updates.subscriberId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                    needsUpdate = true;
                }

                // 2. Set name field from firstName + lastName
                if (!user.name && (user.firstName || user.lastName)) {
                    updates.name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    needsUpdate = true;
                }

                // 3. Fix subscriptionStatus
                if (!user.subscriptionStatus || user.subscriptionStatus === 'inactive') {
                    if (user.subscription && user.subscription !== 'None') {
                        // Has subscription plan
                        if (user.subscriptionEndDate) {
                            const now = new Date();
                            if (user.subscriptionEndDate > now) {
                                updates.subscriptionStatus = 'active';
                            } else {
                                updates.subscriptionStatus = 'expired';
                            }
                        } else {
                            // No end date - assume active
                            updates.subscriptionStatus = 'active';
                        }
                    } else {
                        updates.subscriptionStatus = 'none';
                    }
                    needsUpdate = true;
                }

                // 4. Set nextBillingDate if has active subscription
                if (!user.nextBillingDate && user.subscriptionStatus === 'active' && user.subscriptionEndDate) {
                    updates.nextBillingDate = user.subscriptionEndDate;
                    needsUpdate = true;
                }

                // 5. Calculate billing dates for active subscriptions
                if (user.subscriptionStartDate && !user.lastBillingDate) {
                    updates.lastBillingDate = user.subscriptionStartDate;
                    needsUpdate = true;
                }

                // 6. Initialize totalSpent and lifetimeValue if not set
                if (user.totalSpent === undefined) {
                    updates.totalSpent = 0;
                    needsUpdate = true;
                }
                if (user.lifetimeValue === undefined) {
                    updates.lifetimeValue = 0;
                    needsUpdate = true;
                }

                // 7. Ensure address object exists
                if (!user.address) {
                    updates.address = {
                        country: null,
                        streetAddress: null,
                        flatSuiteUnit: null,
                        townCity: null,
                        stateCounty: null,
                        postcodeZip: null
                    };
                    needsUpdate = true;
                }

                // Apply updates if needed
                if (needsUpdate) {
                    await User.updateOne({ _id: user._id }, { $set: updates });
                    migratedCount++;
                    console.log(`✅ Migrated: ${user.email}`);

                    // Show what was updated
                    const updateFields = Object.keys(updates);
                    if (updateFields.length > 0) {
                        console.log(`   Updated fields: ${updateFields.join(', ')}`);
                    }
                } else {
                    skippedCount++;
                }

            } catch (error) {
                errorCount++;
                console.error(`❌ Error migrating ${user.email}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📊 Migration Summary:');
        console.log('='.repeat(80));
        console.log(`   Total users processed: ${allUsers.length}`);
        console.log(`   Successfully migrated: ${migratedCount}`);
        console.log(`   Skipped (already valid): ${skippedCount}`);
        console.log(`   Errors: ${errorCount}`);

        // Show updated statistics
        console.log('\n📈 Updated subscription status distribution:');
        const statusStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscriptionStatus',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        statusStats.forEach(stat => {
            console.log(`   ${stat._id || 'null'}: ${stat.count} users`);
        });

        // Show subscription plan distribution
        console.log('\n📊 Subscription plan distribution:');
        const planStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        planStats.forEach(stat => {
            console.log(`   ${stat._id || 'null'}: ${stat.count} users`);
        });

        // Show users with missing subscriberId
        const missingSubscriberId = await User.countDocuments({ subscriberId: { $exists: false } });
        console.log(`\n🔍 Users without subscriberId: ${missingSubscriberId}`);

        // Show users with active subscriptions
        const activeSubscriptions = await User.countDocuments({
            subscriptionStatus: 'active',
            subscription: { $ne: 'None' }
        });
        console.log(`✅ Active subscriptions: ${activeSubscriptions}`);

        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrateUserData();
