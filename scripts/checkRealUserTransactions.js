/**
 * Check Real Users and Their Transactions
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');
const Transaction = require('../src/transaction/models/transaction.model');

async function checkRealData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle');
        console.log('✅ Connected to MongoDB\n');

        // Check all users
        const totalUsers = await User.countDocuments();
        console.log(`👥 Total Users: ${totalUsers}\n`);

        // Get users with different roles
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('📊 Users by Role:');
        usersByRole.forEach(r => console.log(`   ${r._id}: ${r.count}`));

        // Get sample users (non-admin)
        const regularUsers = await User.find({
            role: { $nin: ['admin', 'super_admin', 'moderator'] }
        }).select('email firstName lastName role subscription subscriptionStatus').limit(5);

        console.log('\n👤 Sample Regular Users:');
        regularUsers.forEach((u, i) => {
            console.log(`   ${i + 1}. ${u.email} (${u.role}) - ${u.subscription || 'no subscription'}`);
        });

        // Check existing transactions
        const totalTxns = await Transaction.countDocuments();
        console.log(`\n💳 Total Existing Transactions: ${totalTxns}`);

        if (totalTxns > 0) {
            // Get transactions by user
            const txnsByUser = await Transaction.aggregate([
                {
                    $group: {
                        _id: '$userId',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount.gross' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);

            console.log('\n📈 Top Users with Transactions:');
            for (const txn of txnsByUser) {
                const user = await User.findById(txn._id).select('email role');
                console.log(`   ${user?.email || 'Unknown'} (${user?.role || 'N/A'}): ${txn.count} transactions, $${txn.totalAmount.toFixed(2)}`);
            }

            // Show recent transactions
            const recentTxns = await Transaction.find()
                .sort({ 'timeline.initiatedAt': -1 })
                .limit(5)
                .populate('userId', 'email role');

            console.log('\n📝 Recent Transactions:');
            recentTxns.forEach((txn, i) => {
                console.log(`   ${i + 1}. $${txn.amount.gross} - ${txn.status} - ${txn.userId?.email || 'Unknown'} (${txn.userId?.role || 'N/A'})`);
            });
        }

        // Check for transactions without proper user association
        const orphanTxns = await Transaction.countDocuments({ userId: null });
        if (orphanTxns > 0) {
            console.log(`\n⚠️  Found ${orphanTxns} transactions without user association`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

checkRealData();
