require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testDiscountVerify() {
    console.log('🧪 Testing Discount Verification Endpoints\n');
    console.log('='.repeat(60));

    try {
        // Test 1: POST request with code in body
        console.log('\n1️⃣ Testing POST /api/payments/discounts/public/verify');
        console.log('Request body: { code: "WELCOME10", amount: 100 }');

        const postResponse = await axios.post(
            `${BASE_URL}/api/payments/discounts/public/verify`,
            {
                code: 'WELCOME10',
                amount: 100,
                planId: null,
                billingCycle: 'monthly'
            }
        ).catch(err => ({ error: err.response?.data || err.message }));

        if (postResponse.error) {
            console.log('❌ POST Request Failed:', JSON.stringify(postResponse.error, null, 2));
        } else {
            console.log('✅ POST Request Success:', JSON.stringify(postResponse.data, null, 2));
        }

        console.log('\n' + '-'.repeat(60));

        // Test 2: GET request with code in params
        console.log('\n2️⃣ Testing GET /api/payments/discounts/public/verify/WELCOME10');
        console.log('Query params: amount=100&billingCycle=monthly');

        const getResponse = await axios.get(
            `${BASE_URL}/api/payments/discounts/public/verify/WELCOME10`,
            {
                params: {
                    amount: 100,
                    billingCycle: 'monthly'
                }
            }
        ).catch(err => ({ error: err.response?.data || err.message }));

        if (getResponse.error) {
            console.log('❌ GET Request Failed:', JSON.stringify(getResponse.error, null, 2));
        } else {
            console.log('✅ GET Request Success:', JSON.stringify(getResponse.data, null, 2));
        }

        console.log('\n' + '-'.repeat(60));

        // Test 3: Alternative path
        console.log('\n3️⃣ Testing GET /api/discounts/public/verify/TEST123');

        const altResponse = await axios.get(
            `${BASE_URL}/api/discounts/public/verify/TEST123`,
            {
                params: {
                    amount: 50
                }
            }
        ).catch(err => ({ error: err.response?.data || err.message }));

        if (altResponse.error) {
            console.log('❌ Alternative Path Failed:', JSON.stringify(altResponse.error, null, 2));
        } else {
            console.log('✅ Alternative Path Success:', JSON.stringify(altResponse.data, null, 2));
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Discount verification endpoint testing completed!');

    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
    }
}

// Run the test
testDiscountVerify();
