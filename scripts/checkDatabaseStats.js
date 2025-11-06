require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabaseStats() {
    try {
        console.log('\n🔍 Connecting to database...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Import models
        const User = require('../src/models/user.model');
        const Subscriber = require('../src/subscription/models/enhancedSubscriber.model');
        const Subscription = require('../src/subscription/models/subscription.model');

        // Count documents
        const [userCount, subscriberCount, subscriptionCount] = await Promise.all([
            User.countDocuments(),
            Subscriber.countDocuments(),
            Subscription.countDocuments()
        ]);

        console.log('='.repeat(60));
        console.log('📊 DATABASE STATISTICS');
        console.log('='.repeat(60));
        console.log(`Users collection:         ${userCount} documents`);
        console.log(`Subscribers collection:   ${subscriberCount} documents`);
        console.log(`Subscriptions collection: ${subscriptionCount} documents`);
        console.log('='.repeat(60));

        // Get sample users
        console.log('\n👥 SAMPLE USERS (first 5)');
        console.log('-'.repeat(60));
        const sampleUsers = await User.find()
            .limit(5)
            .select('firstName lastName email subscription role createdAt')
            .sort({ createdAt: -1 });

        if (sampleUsers.length === 0) {
            console.log('❌ No users found in database');
        } else {
            sampleUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Role: ${user.role} | Subscription: ${user.subscription}`);
                console.log(`   Created: ${user.createdAt}`);
                console.log('');
            });
        }

        // Get sample subscribers
        console.log('📋 SAMPLE SUBSCRIBERS (first 5)');
        console.log('-'.repeat(60));
        const sampleSubscribers = await Subscriber.find()
            .limit(5)
            .select('contact.firstName contact.lastName contact.email status plan_id amount createdAt')
            .sort({ createdAt: -1 });

        if (sampleSubscribers.length === 0) {
            console.log('❌ No subscribers found in database');
        } else {
            sampleSubscribers.forEach((sub, index) => {
                console.log(`${index + 1}. ${sub.contact?.firstName || 'N/A'} ${sub.contact?.lastName || 'N/A'}`);
                console.log(`   Email: ${sub.contact?.email || 'N/A'}`);
                console.log(`   Status: ${sub.status} | Plan: ${sub.plan_id || 'N/A'}`);
                console.log(`   Amount: $${sub.amount || 0}`);
                console.log(`   Created: ${sub.createdAt}`);
                console.log('');
            });
        }

        // Get sample subscriptions
        console.log('💳 SAMPLE SUBSCRIPTIONS (first 5)');
        console.log('-'.repeat(60));
        const sampleSubscriptions = await Subscription.find()
            .limit(5)
            .select('userId plan status billingCycle mrr createdAt')
            .sort({ createdAt: -1 })
            .populate('userId', 'firstName lastName email');

        if (sampleSubscriptions.length === 0) {
            console.log('❌ No subscriptions found in database');
        } else {
            sampleSubscriptions.forEach((subscription, index) => {
                const userName = subscription.userId
                    ? `${subscription.userId.firstName} ${subscription.userId.lastName}`
                    : 'Unknown User';
                console.log(`${index + 1}. ${userName}`);
                console.log(`   Plan: ${subscription.plan} | Status: ${subscription.status}`);
                console.log(`   Billing: ${subscription.billingCycle} | MRR: $${subscription.mrr || 0}`);
                console.log(`   Created: ${subscription.createdAt}`);
                console.log('');
            });
        }

        // Analysis
        console.log('='.repeat(60));
        console.log('🔍 ANALYSIS');
        console.log('='.repeat(60));

        if (userCount > 0 && subscriberCount === 0) {
            console.log('⚠️  You have Users but NO Subscribers');
            console.log('   → Analytics will show 0 because it uses Subscriber model');
            console.log('   → Consider: Use User model for analytics instead');
        } else if (userCount === 0 && subscriberCount > 0) {
            console.log('⚠️  You have Subscribers but NO Users');
            console.log('   → Authentication might not work properly');
            console.log('   → Consider: Sync Subscriber → User');
        } else if (userCount > 0 && subscriberCount > 0) {
            console.log('ℹ️  You have both Users and Subscribers');
            console.log(`   → Users: ${userCount} | Subscribers: ${subscriberCount}`);
            if (userCount !== subscriberCount) {
                console.log(`   → Mismatch: ${Math.abs(userCount - subscriberCount)} difference`);
                console.log('   → Recommendation: Decide which model to use as primary');
            }
        } else {
            console.log('❌ No data found in either collection');
            console.log('   → Create test data first');
        }

        console.log('='.repeat(60));
        console.log('\n✅ Database check complete!\n');

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the check
checkDatabaseStats();
