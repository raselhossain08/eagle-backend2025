require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function fixAllSubscriptions() {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');

        // Get Basic plan
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

        // Get all users without subscriptionPlanId using raw collection
        const usersCollection = db.collection('users');
        const usersToUpdate = await usersCollection.find({
            subscriptionPlanId: { $exists: false }
        }).toArray();

        console.log(`👥 Found ${usersToUpdate.length} users without subscriptionPlanId\n`);
        console.log('Starting update process...\n');

        let updatedCount = 0;
        let errorCount = 0;

        const currentDate = new Date();

        for (const user of usersToUpdate) {
            try {
                let updates = {};

                // Check if subscription is an object
                if (typeof user.subscription === 'object' && user.subscription !== null) {
                    const subPlan = user.subscription.plan;

                    // Determine which plan to assign based on object data
                    if (subPlan === 'free' || !subPlan) {
                        updates.subscription = 'basic';
                    } else if (subPlan.toLowerCase().includes('diamond')) {
                        updates.subscription = 'diamond';
                    } else if (subPlan.toLowerCase().includes('infinity')) {
                        updates.subscription = 'infinity';
                    } else {
                        updates.subscription = 'basic';
                    }
                } else if (!user.subscription || user.subscription === 'None') {
                    updates.subscription = 'basic';
                }

                // Set plan reference
                updates.subscriptionPlanId = new mongoose.Types.ObjectId(basicPlan._id);

                // Set subscription status
                updates.subscriptionStatus = 'active';

                // Set dates
                const startDate = user.subscription?.startDate ?
                    new Date(user.subscription.startDate) :
                    new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);

                updates.subscriptionStartDate = startDate;
                updates.subscriptionEndDate = new Date(currentDate.getTime() + 335 * 24 * 60 * 60 * 1000); // ~11 months
                updates.nextBillingDate = updates.subscriptionEndDate;
                updates.lastBillingDate = startDate;
                updates.billingCycle = 'annual';

                // Update using raw collection
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: updates }
                );

                updatedCount++;

                // Show first 5 updates
                if (updatedCount <= 5) {
                    console.log(`✅ Updated: ${user.email}`);
                    console.log(`   Old subscription: ${JSON.stringify(user.subscription)}`);
                    console.log(`   New subscription: ${updates.subscription}`);
                    console.log(`   Plan: Basic (Free)`);
                    console.log(`   Status: active`);
                    console.log('');
                }

                // Show progress every 20 users
                if (updatedCount % 20 === 0) {
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

        // Show final statistics using raw queries
        console.log('\n📈 Final Database Statistics:');

        const totalUsers = await usersCollection.countDocuments();
        console.log(`   Total users: ${totalUsers}`);

        const totalWithPlanId = await usersCollection.countDocuments({
            subscriptionPlanId: { $exists: true, $ne: null }
        });
        console.log(`   ✅ Users with plan reference: ${totalWithPlanId}`);

        const activeSubscriptions = await usersCollection.countDocuments({
            subscriptionStatus: 'active'
        });
        console.log(`   ✅ Active subscriptions: ${activeSubscriptions}`);

        const basicSubscriptions = await usersCollection.countDocuments({
            subscription: 'basic'
        });
        console.log(`   ✅ Basic plan users: ${basicSubscriptions}`);

        const withoutPlanId = await usersCollection.countDocuments({
            subscriptionPlanId: { $exists: false }
        });
        console.log(`   ⚠️  Users still without plan reference: ${withoutPlanId}`);

        console.log('\n🎉 Update completed successfully!');
        console.log(`📝 All ${updatedCount} users now have proper subscription data!`);

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Update failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

fixAllSubscriptions();
