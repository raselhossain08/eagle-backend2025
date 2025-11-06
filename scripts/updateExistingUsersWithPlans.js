const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

const updateExistingUsers = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');

        // Get all plans from database using raw collection (bypass Mongoose schema)
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

        // Create plan mapping by name (case-insensitive)
        const planMap = new Map();
        allPlans.forEach(plan => {
            const normalizedName = plan.name.toLowerCase().trim();
            planMap.set(normalizedName, plan);

            // Also map by displayName
            if (plan.displayName) {
                const normalizedDisplayName = plan.displayName.toLowerCase().trim();
                planMap.set(normalizedDisplayName, plan);
            }

            // Map common variations for subscription plans
            if (normalizedName === 'basic' || plan.category === 'basic' && plan.planType === 'subscription') {
                planMap.set('basic', plan);
            } else if (normalizedName === 'diamond' || plan.category === 'diamond') {
                planMap.set('diamond', plan);
            } else if (normalizedName === 'infinity' || plan.category === 'infinity') {
                planMap.set('infinity', plan);
            }

            // Map script plans
            if (plan.planType === 'script') {
                planMap.set('script', plan);
                planMap.set('script plan', plan);
            }
        });

        // Get all users with subscription plans
        const usersWithSubscriptions = await User.find({
            subscription: { $ne: 'None', $ne: null, $exists: true }
        });

        console.log(`👥 Found ${usersWithSubscriptions.length} users with subscriptions\n`);
        console.log('Starting update process...\n');

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of usersWithSubscriptions) {
            try {
                const updates = {};
                let needsUpdate = false;

                // Normalize subscription name
                const subscriptionName = user.subscription?.toString().toLowerCase().trim();

                // Find matching plan
                const matchingPlan = planMap.get(subscriptionName);

                if (matchingPlan) {
                    // Update subscriptionPlanId if not set or different
                    if (!user.subscriptionPlanId || user.subscriptionPlanId.toString() !== matchingPlan._id.toString()) {
                        updates.subscriptionPlanId = matchingPlan._id;
                        needsUpdate = true;
                    }

                    // Set proper subscription status
                    if (!user.subscriptionStatus || user.subscriptionStatus === 'none' || user.subscriptionStatus === 'inactive') {
                        if (user.subscriptionEndDate) {
                            const now = new Date();
                            if (user.subscriptionEndDate > now) {
                                updates.subscriptionStatus = 'active';
                            } else {
                                updates.subscriptionStatus = 'expired';
                            }
                        } else {
                            // No end date - assume active for now
                            updates.subscriptionStatus = 'active';
                        }
                        needsUpdate = true;
                    }

                    // Set billing dates if active subscription
                    if (user.subscriptionStatus === 'active' || updates.subscriptionStatus === 'active') {
                        const currentDate = new Date();

                        // Set start date if missing
                        if (!user.subscriptionStartDate) {
                            updates.subscriptionStartDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
                            needsUpdate = true;
                        }

                        // Set end date if missing (based on billing cycle)
                        if (!user.subscriptionEndDate) {
                            const billingCycle = user.billingCycle || 'monthly';
                            const daysToAdd = billingCycle === 'yearly' ? 365 : billingCycle === 'quarterly' ? 90 : 30;
                            updates.subscriptionEndDate = new Date(currentDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                            needsUpdate = true;
                        }

                        // Set next billing date
                        if (!user.nextBillingDate && user.subscriptionEndDate) {
                            updates.nextBillingDate = user.subscriptionEndDate;
                            needsUpdate = true;
                        }

                        // Set last billing date
                        if (!user.lastBillingDate && user.subscriptionStartDate) {
                            updates.lastBillingDate = user.subscriptionStartDate;
                            needsUpdate = true;
                        }
                    }

                    // Ensure billingCycle is set
                    if (!user.billingCycle) {
                        updates.billingCycle = 'monthly';
                        needsUpdate = true;
                    }

                } else {
                    console.log(`⚠️  No matching plan found for user ${user.email} with subscription: ${user.subscription}`);
                    skippedCount++;
                    continue;
                }

                // Apply updates if needed
                if (needsUpdate) {
                    await User.updateOne({ _id: user._id }, { $set: updates });
                    updatedCount++;

                    const updateFields = Object.keys(updates);
                    console.log(`✅ Updated: ${user.email}`);
                    console.log(`   Subscription: ${user.subscription}`);
                    console.log(`   Plan ID: ${matchingPlan.name} (${matchingPlan._id})`);
                    console.log(`   Updated fields: ${updateFields.join(', ')}`);
                    console.log('');
                } else {
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
        console.log(`   Total users with subscriptions: ${usersWithSubscriptions.length}`);
        console.log(`   Successfully updated: ${updatedCount}`);
        console.log(`   Skipped (already valid or no plan match): ${skippedCount}`);
        console.log(`   Errors: ${errorCount}`);

        // Show final statistics
        console.log('\n📈 Updated subscription statistics:');

        const statusStats = await User.aggregate([
            {
                $match: { subscription: { $ne: 'None' } }
            },
            {
                $group: {
                    _id: {
                        subscription: '$subscription',
                        status: '$subscriptionStatus'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.subscription': 1 } }
        ]);

        statusStats.forEach(stat => {
            console.log(`   ${stat._id.subscription} (${stat._id.status}): ${stat.count} users`);
        });

        // Show users with plan references
        const usersWithPlanRef = await User.countDocuments({
            subscriptionPlanId: { $exists: true, $ne: null }
        });
        console.log(`\n✅ Users with plan reference (subscriptionPlanId): ${usersWithPlanRef}`);

        // Show active subscriptions
        const activeSubscriptions = await User.countDocuments({
            subscriptionStatus: 'active',
            subscription: { $ne: 'None' }
        });
        console.log(`✅ Active subscriptions: ${activeSubscriptions}`);

        // Show users ready for renewal tracking
        const readyForRenewal = await User.countDocuments({
            subscriptionStatus: 'active',
            subscriptionEndDate: { $exists: true, $ne: null },
            nextBillingDate: { $exists: true, $ne: null }
        });
        console.log(`✅ Users ready for renewal tracking: ${readyForRenewal}`);

        console.log('\n🎉 Update completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
};

updateExistingUsers();
