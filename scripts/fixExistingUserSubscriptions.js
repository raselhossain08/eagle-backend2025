require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

async function fixExistingUserSubscriptions() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Find all users with subscriptionPlanId
        const users = await User.find({
            subscriptionPlanId: { $exists: true, $ne: null },
            isDeleted: { $ne: true }
        });

        console.log(`📊 Found ${users.length} users with subscription plans\n`);

        if (users.length === 0) {
            console.log('✅ No users need updating!');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔄 UPDATING USER SUBSCRIPTIONS TO MATCH PLAN DISPLAY NAMES');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        let updateCount = 0;
        let skipCount = 0;

        for (const user of users) {
            // Get the actual plan
            const plan = await MembershipPlan.findById(user.subscriptionPlanId).lean();

            if (!plan) {
                console.log(`⚠️  User ${user.email}: Plan not found for ID ${user.subscriptionPlanId}`);
                skipCount++;
                continue;
            }

            const currentSubscription = user.subscription;
            const correctSubscription = plan.displayName || plan.name;

            if (currentSubscription === correctSubscription) {
                console.log(`✅ User ${user.email}: Already correct ("${currentSubscription}")`);
                skipCount++;
            } else {
                console.log(`🔄 User ${user.email}:`);
                console.log(`   Old: "${currentSubscription}"`);
                console.log(`   New: "${correctSubscription}"`);

                // Update using updateOne to bypass validation
                await User.updateOne(
                    { _id: user._id },
                    { $set: { subscription: correctSubscription } }
                );

                console.log(`   ✅ Updated!`);
                updateCount++;
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 SUMMARY:');
        console.log(`   ✅ Updated: ${updateCount} users`);
        console.log(`   ⏭️  Skipped: ${skipCount} users (already correct)`);
        console.log(`   📦 Total: ${users.length} users processed`);

        // Verify the updates
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 VERIFICATION:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const verifyUsers = await User.find({
            subscriptionPlanId: { $exists: true, $ne: null },
            isDeleted: { $ne: true }
        }).select('email subscription subscriptionPlanId').lean();

        for (const user of verifyUsers) {
            const plan = await MembershipPlan.findById(user.subscriptionPlanId).lean();
            if (plan) {
                const match = user.subscription === plan.displayName;
                console.log(`${match ? '✅' : '❌'} ${user.email}: "${user.subscription}" ${match ? '= ' : '≠ '}"${plan.displayName}"`);
            }
        }

        console.log('\n✅ All done! Users will now show exact plan names in subscription management.');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixExistingUserSubscriptions();
