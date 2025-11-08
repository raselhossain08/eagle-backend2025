/**
 * Check Transaction Data
 * This script checks if there's any transaction data in the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import Transaction model
const Transaction = require('../src/transaction/models/transaction.model');

async function checkTransactionData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle');
        console.log('✅ Connected to MongoDB');

        // Count total transactions
        const totalCount = await Transaction.countDocuments();
        console.log('\n📊 Total Transactions:', totalCount);

        if (totalCount === 0) {
            console.log('\n⚠️  No transactions found in database!');
            console.log('💡 You need to create some test transactions or have real payment data');
            return;
        }

        // Get sample transactions
        const sampleTransactions = await Transaction.find()
            .limit(5)
            .sort({ 'timeline.initiatedAt': -1 })
            .lean();

        console.log('\n📝 Sample Transactions (latest 5):');
        sampleTransactions.forEach((txn, index) => {
            console.log(`\n${index + 1}. Transaction ID: ${txn._id}`);
            console.log(`   Status: ${txn.status}`);
            console.log(`   Amount: $${txn.amount?.gross || 0}`);
            console.log(`   Date: ${txn.timeline?.initiatedAt || 'N/A'}`);
            console.log(`   User ID: ${txn.userId || 'N/A'}`);
        });

        // Get statistics
        const stats = await Transaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalAmount: { $sum: '$amount.gross' },
                    succeededCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] }
                    },
                    failedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    }
                }
            }
        ]);

        if (stats.length > 0) {
            console.log('\n📈 Transaction Statistics:');
            console.log(`   Total Count: ${stats[0].totalTransactions}`);
            console.log(`   Total Amount: $${stats[0].totalAmount.toFixed(2)}`);
            console.log(`   Succeeded: ${stats[0].succeededCount}`);
            console.log(`   Failed: ${stats[0].failedCount}`);
        }

        // Check daily breakdown
        const dailyStats = await Transaction.aggregate([
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$timeline.initiatedAt'
                        }
                    },
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount.gross' }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 7 }
        ]);

        console.log('\n📅 Daily Transaction Breakdown (last 7 days):');
        dailyStats.forEach((day) => {
            console.log(`   ${day._id}: ${day.count} transactions, $${day.totalAmount.toFixed(2)}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run the check
checkTransactionData();
