/**
 * Test Transaction API Endpoint
 * This script tests the transaction stats API endpoint directly
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testTransactionAPI() {
    try {
        console.log('🧪 Testing Transaction Stats API...\n');

        // Test the admin stats endpoint
        console.log('📡 Calling: GET /api/transactions/admin/stats');
        const response = await axios.get(`${API_URL}/transactions/admin/stats`, {
            timeout: 10000
        });

        console.log('\n✅ Response Status:', response.status);
        console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));

        if (response.data.stats) {
            const stats = response.data.stats;
            console.log('\n📊 Transaction Statistics Summary:');
            console.log(`   Total Transactions: ${stats.totalTransactions}`);
            console.log(`   Total Amount: $${stats.totalAmount?.toFixed(2) || 0}`);
            console.log(`   Success Rate: ${stats.successRate}%`);
            console.log(`   Daily Breakdown Records: ${stats.byPeriod?.length || 0}`);

            if (stats.byPeriod && stats.byPeriod.length > 0) {
                console.log('\n📅 Sample Daily Data (first 5):');
                stats.byPeriod.slice(0, 5).forEach(day => {
                    console.log(`   ${day.date}: ${day.count} txns, $${day.totalAmount?.toFixed(2)}`);
                });
            }
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('\n❌ Connection Refused!');
            console.error('💡 Make sure the backend server is running on http://localhost:5000');
            console.error('💡 Run: npm start (or node index.js) in eagle-backend2025');
        } else if (error.response) {
            console.error('\n❌ API Error Response:');
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        } else {
            console.error('\n❌ Error:', error.message);
        }
    }
}

// Run the test
testTransactionAPI();
