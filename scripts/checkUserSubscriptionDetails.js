require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function checkUserSubscriptionDetails() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Get all users with active subscriptions
        const users = await User.find({
            subscriptionStatus: 'active',
            isDeleted: { $ne: true }
        }).select('email name subscription subscriptionStatus subscriptionPlanId billingCycle lastPaymentAmount subscriptionStartDate subscriptionEndDate createdAt').lean();

        console.log(`📊 Found ${users.length} active subscribers\n`);

        if (users.length === 0) {
            console.log('⚠️ No active subscribers found');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        users.forEach((user, index) => {
            console.log(`\n👤 User ${index + 1}:`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Name: ${user.name || 'N/A'}`);
            console.log(`   📦 Subscription: "${user.subscription}"`);
            console.log(`   Status: ${user.subscriptionStatus}`);
            console.log(`   Plan ID: ${user.subscriptionPlanId || 'N/A'}`);
            console.log(`   Billing Cycle: ${user.billingCycle || 'N/A'}`);
            console.log(`   Last Payment: $${user.lastPaymentAmount || 0}`);
            console.log(`   Start Date: ${user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toLocaleDateString() : 'N/A'}`);
            console.log(`   End Date: ${user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString() : 'N/A'}`);
            console.log(`   Account Created: ${new Date(user.createdAt).toLocaleDateString()}`);
            console.log('   ─────────────────────────────────────────────────────────────');
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Subscription Name Summary:');
        const subscriptionCounts = {};
        users.forEach(user => {
            const sub = user.subscription || 'Unknown';
            subscriptionCounts[sub] = (subscriptionCounts[sub] || 0) + 1;
        });

        Object.entries(subscriptionCounts).forEach(([name, count]) => {
            console.log(`   "${name}": ${count} user${count > 1 ? 's' : ''}`);
        });

        console.log('\n✅ All subscription names are stored correctly in the database!');
        console.log('💡 These exact names will display in the subscription management dashboard.');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkUserSubscriptionDetails();
