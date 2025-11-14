require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function normalizeSubscriptions() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Find all users with lowercase subscription names
        const usersToUpdate = await User.find({
            subscription: { $regex: /^[a-z]/ }  // starts with lowercase
        });

        console.log(`📊 Found ${usersToUpdate.length} users with lowercase subscription names\n`);

        if (usersToUpdate.length === 0) {
            console.log('✅ All subscriptions are already normalized!');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Normalize each subscription
        const updates = [];
        for (const user of usersToUpdate) {
            const oldSubscription = user.subscription;
            // Capitalize first letter
            const newSubscription = oldSubscription.charAt(0).toUpperCase() + oldSubscription.slice(1);

            console.log(`🔄 Updating user ${user.email}:`);
            console.log(`   Old: "${oldSubscription}" → New: "${newSubscription}"`);

            // Use updateOne to bypass validation
            const update = User.updateOne(
                { _id: user._id },
                { $set: { subscription: newSubscription } }
            );
            updates.push(update);
        }

        await Promise.all(updates);

        console.log(`\n✅ Successfully normalized ${updates.length} subscriptions!`);

        // Verify the update
        const afterStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📋 Updated Subscription Distribution:');
        afterStats.forEach(stat => {
            const subName = stat._id || 'undefined/null';
            console.log(`   ${subName}: ${stat.count} users`);
        });

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

normalizeSubscriptions();
