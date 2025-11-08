/**
 * Test Admin Stats Endpoint
 * Directly test the getGlobalStats function
 */

const mongoose = require('mongoose');
require('dotenv').config();
const transactionService = require('../src/transaction/services/transaction.service');

async function testAdminStats() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle');
        console.log('✅ Connected to MongoDB\n');

        console.log('📊 Testing getTransactionStats service...\n');

        const result = await transactionService.getTransactionStats({});

        console.log('✅ Result:', JSON.stringify(result, null, 2));

        if (result.stats) {
            console.log('\n📈 Summary:');
            console.log(`   Total Transactions: ${result.stats.totalTransactions}`);
            console.log(`   Total Amount: $${result.stats.totalAmount?.toFixed(2)}`);
            console.log(`   Success Rate: ${result.stats.successRate}%`);
            console.log(`   Daily Breakdown: ${result.stats.byPeriod?.length || 0} records`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testAdminStats();
