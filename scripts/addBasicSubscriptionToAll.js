require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function addSubscriptionToUsers() {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');

        // Get Basic plan (free plan)
        const db = mongoose.connection.db;
        const plansCollection = db.collection('plans');
        const basicPlan = await plansCollection.findOne({
            name: 'basic',
            isActive: true
        });

        if (!basicPlan) {
            console.log('❌ Basic plan not found in database.');
            process.exit(1);
        }

        console.log(`📋 Using Basic Plan: ${basicPlan.displayName} (${basicPlan._id})\n`);

        // Find all users without subscriptionPlanId and undefined/null subscription
        const usersToUpdate = await User.find({
            $or: [
                { subscriptionPlanId: { $exists: false } },
                { subscriptionPlanId: null }
            ],
            $or: [
                { subscription: { $exists: false } },
                { subscription: null },
                { subscription: 'None' },
                { subscription: undefined }
            ]
        });

        console.log(`👥 Found ${usersToUpdate.length} users without subscription\n`);
        console.log('Adding Basic subscription to all users...\n');

        let updatedCount = 0;
        let errorCount = 0;

        const currentDate = new Date();
        const startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const endDate = new Date(currentDate.getTime() + 335 * 24 * 60 * 60 * 1000); // ~11 months from now (365-30)

        for (const user of usersToUpdate) {
            try {
                const updates = {
                    subscription: 'basic',
                    subscriptionPlanId: basicPlan._id,
                    subscriptionStatus: 'active',
                    subscriptionStartDate: startDate,
                    subscriptionEndDate: endDate,
                    nextBillingDate: endDate,
                    lastBillingDate: startDate,
                    billingCycle: 'annual' // Annual free basic plan
                };

                await User.updateOne({ _id: user._id }, { $set: updates });
                updatedCount++;

                if (updatedCount <= 5) {
                    console.log(`✅ Updated: ${user.email}`);
                    console.log(`   Plan: Basic (Free)`);
                    console.log(`   Status: active`);
                    console.log(`   End Date: ${endDate.toISOString()}`);
                    console.log('');
                }

                // Show progress every 10 users
                if (updatedCount % 10 === 0) {
                    console.log(`   Progress: ${updatedCount}/${usersToUpdate.length} users updated...`);
                }

            } catch (error) {
                errorCount++;
                console.error(`❌ Error updating ${user.email}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📊 Update Summary:');
        console.log('='.repeat(80));
        console.log(`   Total users to update: ${usersToUpdate.length}`);
        console.log(`   Successfully updated: ${updatedCount}`);
        console.log(`   Errors: ${errorCount}`);

        // Show final statistics
        console.log('\n📈 Final Database Statistics:');

        const totalUsers = await User.countDocuments();
        console.log(`   Total users: ${totalUsers}`);

        const totalWithPlanId = await User.countDocuments({
            subscriptionPlanId: { $exists: true, $ne: null }
        });
        console.log(`   ✅ Users with plan reference: ${totalWithPlanId}`);

        const activeSubscriptions = await User.countDocuments({
            subscriptionStatus: 'active'
        });
        console.log(`   ✅ Active subscriptions: ${activeSubscriptions}`);

        const basicSubscriptions = await User.countDocuments({
            subscription: 'basic'
        });
        console.log(`   ✅ Basic plan users: ${basicSubscriptions}`);

        const diamondSubscriptions = await User.countDocuments({
            subscription: { $regex: /^diamond$/i }
        });
        console.log(`   ✅ Diamond plan users: ${diamondSubscriptions}`);

        const infinitySubscriptions = await User.countDocuments({
            subscription: { $regex: /^infinity$/i }
        });
        console.log(`   ✅ Infinity plan users: ${infinitySubscriptions}`);

        const withoutPlanId = await User.countDocuments({
            $or: [
                { subscriptionPlanId: { $exists: false } },
                { subscriptionPlanId: null }
            ]
        });
        console.log(`   ⚠️  Users still without plan reference: ${withoutPlanId}`);

        console.log('\n🎉 Update completed successfully!');
        console.log(`\n📝 All ${updatedCount} users now have Basic (Free) subscription with 1-year validity!`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
}

addSubscriptionToUsers();
