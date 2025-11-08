/**
 * Test the actual API endpoint
 */

const axios = require('axios');

async function testAPI() {
    try {
        console.log('🧪 Testing GET /api/transactions endpoint...\n');

        const response = await axios.get('http://localhost:5000/api/transactions', {
            headers: {
                'Authorization': 'Bearer your-token-here', // Replace with actual token
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });

        console.log('✅ Status:', response.status);
        console.log('📦 Data:', JSON.stringify(response.data, null, 2));

        if (response.data.transactions) {
            console.log('\n📊 Total transactions returned:', response.data.transactions.length);
            console.log('📈 Total count:', response.data.pagination.count);
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Backend server is not running!');
            console.error('💡 Start the backend server first');
        } else if (error.response) {
            console.error('❌ API Error:', error.response.status);
            console.error('📦 Response:', error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

testAPI();
