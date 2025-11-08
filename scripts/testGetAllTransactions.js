/**
 * Test getUserTransactions with null userId
 */

const mongoose = require('mongoose');
require('dotenv').config();
const transactionService = require('../src/transaction/services/transaction.service');

async function testGetAllTransactions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle');
        console.log('✅ Connected to MongoDB\n');

        console.log('🧪 Testing getUserTransactions with userId = null...\n');

        const result = await transactionService.getUserTransactions(null, { limit: 5 });

        console.log('✅ Success!');
        console.log('📊 Total Transactions:', result.data.pagination.count);
        console.log('📦 Returned:', result.data.transactions.length);
        console.log('\n📝 Sample Transactions:');
        result.data.transactions.forEach((txn, i) => {
            console.log(`   ${i + 1}. $${txn.amount.gross} - ${txn.status} - ${txn.timeline.initiatedAt}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

testGetAllTransactions();
