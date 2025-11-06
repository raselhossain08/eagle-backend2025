require('dotenv').config();
const axios = require('axios');

async function testSubscriptionAPI() {
    try {
        console.log('🔍 Testing /api/subscription endpoint...\n');

        // First, login to get token
        console.log('1. Logging in to get auth token...');
        const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'test@eagle.com',
            password: 'Test@1234'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful\n');

        // Test subscription endpoint
        console.log('2. Fetching subscriptions...');
        const response = await axios.get('http://localhost:5000/api/subscription?page=1&limit=20&sortBy=createdAt&sortOrder=desc', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ API Response received\n');
        console.log('📊 Response Status:', response.status);
        console.log('📋 Response Data:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.data && response.data.data.length > 0) {
            console.log('\n📝 Sample Subscriber Data (First 3):');
            response.data.data.slice(0, 3).forEach((sub, index) => {
                console.log(`\n${index + 1}. ${sub.email}`);
                console.log(`   Name: ${sub.name}`);
                console.log(`   Plan: ${sub.currentPlan} (${sub.planType})`);
                console.log(`   Status: ${sub.subscriptionStatus}`);
                console.log(`   Billing: ${sub.billingCycle}`);
                console.log(`   MRR: $${sub.mrr}`);
                console.log(`   Next Billing: ${sub.nextBillingDate}`);
            });
        }

        console.log('\n✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.log('\n⚠️  Authentication failed. Please check if test@eagle.com account exists.');
            console.log('   Try creating it or use another existing account.');
        }
    }
}

testSubscriptionAPI();
