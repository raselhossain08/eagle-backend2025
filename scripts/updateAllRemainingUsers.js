require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function updateAllRemainingUsers() {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');

        // Get all plans from database using raw collection
        const db = mongoose.connection.db;
        const plansCollection = db.collection('plans');
        const allPlans = await plansCollection.find({ isActive: true }).toArray();

        console.log(`📋 Found ${allPlans.length} active plans in database\n`);

        if (allPlans.length === 0) {
            console.log('❌ No plans found in database. Please add plans first.');
            process.exit(1);
        }

        // Display available plans
        console.log('Available Plans:');
        allPlans.forEach((plan, index) => {
            const price = plan.pricing?.monthly?.price || plan.pricing?.annual?.price || plan.pricing?.oneTime?.price || 0;
            console.log(`   ${index + 1}. ${plan.name} (${plan.displayName}) - $${price} - Type: ${plan.planType}`);
        });
        console.log('');

        // Create plan mapping by name (case-insensitive and more variations)
        const planMap = new Map();
        allPlans.forEach(plan => {
            const normalizedName = plan.name.toLowerCase().trim();
            planMap.set(normalizedName, plan);

            // Map by displayName
            if (plan.displayName) {
                const normalizedDisplayName = plan.displayName.toLowerCase().trim();
                planMap.set(normalizedDisplayName, plan);
            }

            // Map common variations
            if (normalizedName === 'basic' || plan.category === 'basic' && plan.planType === 'subscription') {
                planMap.set('basic', plan);
                planMap.set('Basic', plan);
                planMap.set('BASIC', plan);
            } else if (normalizedName === 'diamond' || plan.category === 'diamond') {
                planMap.set('diamond', plan);
                planMap.set('Diamond', plan);
                planMap.set('DIAMOND', plan);
            } else if (normalizedName === 'infinity' || plan.category === 'infinity') {
                planMap.set('infinity', plan);
                planMap.set('Infinity', plan);
                planMap.set('INFINITY', plan);
            }

            // Map script plans
            if (plan.planType === 'script') {
                planMap.set('script', plan);
                planMap.set('Script', plan);
            }
        });

        // Get ALL users without subscriptionPlanId but have subscription (not None/null)
        const usersToUpdate = await User.find({
            $or: [
                { subscriptionPlanId: { $exists: false } },
                { subscriptionPlanId: null }
            ],
            subscription: { $exists: true, $ne: null, $ne: 'None' }
        });

        console.log(`👥 Found ${usersToUpdate.length} users to update\n`);
        console.log('Starting update process...\n');

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of usersToUpdate) {
            try {
                const updates = {};
                let needsUpdate = false;

                // Get subscription value
                let subscriptionName = user.subscription;

                // Handle [object Object] case - try to extract meaningful data
                if (typeof subscriptionName === 'object' && subscriptionName !== null) {
                    // Try common object properties
                    subscriptionName = subscriptionName.name ||
                        subscriptionName.plan ||
                        subscriptionName.type ||
                        subscriptionName.toString();
                }

                // Convert to string and normalize
                subscriptionName = String(subscriptionName).toLowerCase().trim();

                // Skip if still [object Object] or invalid
                if (subscriptionName.includes('[object') || subscriptionName === 'undefined' || subscriptionName === 'null' || subscriptionName === 'none') {
                    console.log(`⚠️  Skipping user ${user.email} - Invalid subscription: ${subscriptionName}`);
                    skippedCount++;
                    continue;
                }

                // Find matching plan
                const matchingPlan = planMap.get(subscriptionName);

                if (matchingPlan) {
                    // Update subscriptionPlanId
                    updates.subscriptionPlanId = matchingPlan._id;
                    needsUpdate = true;

                    // Set proper subscription status
                    if (user.subscriptionEndDate) {
                        const now = new Date();
                        if (user.subscriptionEndDate > now) {
                            updates.subscriptionStatus = 'active';
                        } else {
                            updates.subscriptionStatus = 'expired';
                        }
                    } else {
                        // No end date - set as active and create dates
                        updates.subscriptionStatus = 'active';

                        const currentDate = new Date();
                        updates.subscriptionStartDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

                        const billingCycle = user.billingCycle || 'monthly';
                        const daysToAdd = billingCycle === 'yearly' ? 365 : billingCycle === 'quarterly' ? 90 : 30;
                        updates.subscriptionEndDate = new Date(currentDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

                        updates.nextBillingDate = updates.subscriptionEndDate;
                        updates.lastBillingDate = updates.subscriptionStartDate;
                    }

                    // Set billing dates if missing
                    if (updates.subscriptionStatus === 'active' || user.subscriptionStatus === 'active') {
                        const currentDate = new Date();

                        if (!user.subscriptionStartDate && !updates.subscriptionStartDate) {
                            updates.subscriptionStartDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
                        }

                        if (!user.subscriptionEndDate && !updates.subscriptionEndDate) {
                            const billingCycle = user.billingCycle || 'monthly';
                            const daysToAdd = billingCycle === 'yearly' ? 365 : billingCycle === 'quarterly' ? 90 : 30;
                            updates.subscriptionEndDate = new Date(currentDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                        }

                        if (!user.nextBillingDate && (user.subscriptionEndDate || updates.subscriptionEndDate)) {
                            updates.nextBillingDate = updates.subscriptionEndDate || user.subscriptionEndDate;
                        }

                        if (!user.lastBillingDate && (user.subscriptionStartDate || updates.subscriptionStartDate)) {
                            updates.lastBillingDate = updates.subscriptionStartDate || user.subscriptionStartDate;
                        }
                    }

                    // Ensure billingCycle is set
                    if (!user.billingCycle) {
                        updates.billingCycle = 'monthly';
                    }

                    // Apply updates
                    if (needsUpdate) {
                        await User.updateOne({ _id: user._id }, { $set: updates });
                        updatedCount++;

                        const updateFields = Object.keys(updates);
                        console.log(`✅ Updated: ${user.email}`);
                        console.log(`   Subscription: ${user.subscription}`);
                        console.log(`   Plan ID: ${matchingPlan.displayName || matchingPlan.name} (${matchingPlan._id})`);
                        console.log(`   Updated fields: ${updateFields.join(', ')}`);
                        console.log('');
                    }

                } else {
                    console.log(`⚠️  No matching plan found for user ${user.email} with subscription: ${subscriptionName}`);
                    skippedCount++;
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
        console.log(`   Skipped (no plan match or invalid): ${skippedCount}`);
        console.log(`   Errors: ${errorCount}`);

        // Show final statistics
        console.log('\n📈 Final Database Statistics:');

        const totalWithPlanId = await User.countDocuments({
            subscriptionPlanId: { $exists: true, $ne: null }
        });
        console.log(`   ✅ Users with plan reference (subscriptionPlanId): ${totalWithPlanId}`);

        const activeSubscriptions = await User.countDocuments({
            subscriptionStatus: 'active'
        });
        console.log(`   ✅ Active subscriptions: ${activeSubscriptions}`);

        const readyForRenewal = await User.countDocuments({
            subscriptionStatus: 'active',
            subscriptionEndDate: { $exists: true, $ne: null },
            nextBillingDate: { $exists: true, $ne: null }
        });
        console.log(`   ✅ Users ready for renewal tracking: ${readyForRenewal}`);

        const withoutPlanId = await User.countDocuments({
            subscription: { $exists: true, $ne: null, $ne: 'None' },
            $or: [
                { subscriptionPlanId: { $exists: false } },
                { subscriptionPlanId: null }
            ]
        });
        console.log(`   ⚠️  Users still without plan reference: ${withoutPlanId}`);

        console.log('\n🎉 Update completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
}

updateAllRemainingUsers();
