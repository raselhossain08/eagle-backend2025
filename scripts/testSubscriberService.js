require('dotenv').config();
const mongoose = require('mongoose');
const subscriberService = require('../src/subscription/services/subscriber.service');

async function testSubscriberService() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        console.log('🔍 Testing subscriber service with updated fields...\n');

        // Test with pagination
        const filters = {};
        const pagination = {
            page: 1,
            limit: 5,
            sort: '-createdAt'
        };

        const result = await subscriberService.getSubscribers(filters, pagination);

        console.log('📊 Result Summary:');
        console.log(`   Total subscribers: ${result.pagination.total}`);
        console.log(`   Page: ${result.pagination.page} of ${result.pagination.totalPages}`);
        console.log(`   Showing: ${result.data.length} subscribers\n`);

        console.log('📋 Sample Subscriber Data:\n');
        result.data.forEach((sub, index) => {
            console.log(`${index + 1}. ${sub.email}`);
            console.log(`   ID: ${sub._id}`);
            console.log(`   Subscriber ID: ${sub.subscriberId || 'N/A'}`);
            console.log(`   Name: ${sub.name}`);
            console.log(`   Subscription: ${sub.subscription}`);
            console.log(`   Status: ${sub.subscriptionStatus}`);
            console.log(`   Plan: ${sub.currentPlan} (ID: ${sub.currentPlanId || 'N/A'})`);
            console.log(`   Plan Type: ${sub.planType}`);
            console.log(`   Plan Category: ${sub.planCategory}`);
            console.log(`   Billing Cycle: ${sub.billingCycle}`);
            console.log(`   MRR: $${sub.mrr}`);
            console.log(`   Total Spent: $${sub.totalSpent}`);
            console.log(`   Lifetime Value: $${sub.lifetimeValue}`);
            console.log(`   Start Date: ${sub.subscriptionStartDate}`);
            console.log(`   End Date: ${sub.subscriptionEndDate}`);
            console.log(`   Next Billing: ${sub.nextBillingDate}`);
            console.log(`   Last Billing: ${sub.lastBillingDate}`);
            console.log(`   Created: ${sub.createdAt}`);
            console.log(`   Active: ${sub.isActive}`);
            console.log('');
        });

        console.log('✅ Test completed successfully!');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

testSubscriberService();
