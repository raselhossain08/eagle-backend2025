require('dotenv').config();
const mongoose = require('mongoose');

async function checkUndefinedUsers() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Find users with undefined subscription
        const undefinedUsers = await usersCollection.find({
            subscriptionPlanId: { $exists: false }
        }).limit(5).toArray();

        console.log(`📋 Found ${undefinedUsers.length} sample users without subscriptionPlanId:\n`);

        undefinedUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email}`);
            console.log(`   subscription: ${JSON.stringify(user.subscription)}`);
            console.log(`   subscriptionStatus: ${user.subscriptionStatus}`);
            console.log(`   subscriptionPlanId: ${user.subscriptionPlanId}`);
            console.log('');
        });

        // Count all users without planId
        const totalWithoutPlan = await usersCollection.countDocuments({
            subscriptionPlanId: { $exists: false }
        });
        console.log(`📊 Total users without subscriptionPlanId: ${totalWithoutPlan}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkUndefinedUsers();
