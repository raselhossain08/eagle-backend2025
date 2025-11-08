/**
 * Create Test Transactions
 * This script creates sample transaction data for testing the dashboard
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Transaction = require('../src/transaction/models/transaction.model');
const User = require('../src/user/models/user.model');

async function createTestTransactions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle');
        console.log('✅ Connected to MongoDB');

        // First, delete existing test transactions to avoid duplicates
        const deleteResult = await Transaction.deleteMany({});
        console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing transactions`);

        // Find user with role 'super_admin'
        let testUser = await User.findOne({ role: 'super_admin' });

        if (!testUser) {
            console.log('⚠️  No super_admin found. Checking database for available users...');
            const allUsers = await User.find({}).select('email role').limit(5);
            console.log('Available users:', allUsers.map(u => ({ email: u.email, role: u.role })));

            // Fallback to any user
            testUser = await User.findOne();
        }

        if (!testUser) {
            console.log('❌ No users found in database!');
            return;
        }

        console.log(`\n👤 Using user: ${testUser.email} (${testUser._id})`);
        console.log(`   Role: ${testUser.role}`);        // Create transactions for the last 30 days
        const transactions = [];
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            // Random number of transactions per day (0-5)
            const dailyTxnCount = Math.floor(Math.random() * 6);

            for (let j = 0; j < dailyTxnCount; j++) {
                const amount = [29.99, 49.99, 99.99, 149.99][Math.floor(Math.random() * 4)];
                const fee = amount * 0.029 + 0.30; // Stripe-like fee structure
                const net = amount - fee;

                const status = Math.random() > 0.1 ? 'succeeded' : 'failed'; // 90% success rate

                const txnDate = new Date(date);
                txnDate.setHours(Math.floor(Math.random() * 24));
                txnDate.setMinutes(Math.floor(Math.random() * 60));

                const txnId = `txn_${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

                transactions.push({
                    transactionId: txnId,
                    userId: testUser._id,
                    type: 'charge',
                    status: status,
                    amount: {
                        gross: amount,
                        fee: fee,
                        net: net,
                        tax: 0,
                        discount: 0
                    },
                    currency: 'USD',
                    psp: {
                        provider: 'stripe',
                        reference: {
                            paymentIntentId: `pi_${Math.random().toString(36).substr(2, 16)}`,
                            chargeId: `ch_${Math.random().toString(36).substr(2, 16)}`
                        }
                    },
                    paymentMethod: {
                        type: 'card',
                        card: {
                            last4: '4242',
                            brand: 'visa',
                            expMonth: 12,
                            expYear: 2025,
                            funding: 'credit',
                            country: 'US'
                        }
                    },
                    timeline: {
                        initiatedAt: txnDate,
                        completedAt: status === 'succeeded' ? new Date(txnDate.getTime() + 2000) : null
                    },
                    metadata: {
                        planId: 'pro-monthly',
                        planName: 'Pro Monthly',
                        description: 'Monthly subscription payment'
                    }
                });
            }
        }

        console.log(`\n📝 Creating ${transactions.length} test transactions...`);

        // Insert all transactions
        if (transactions.length > 0) {
            await Transaction.insertMany(transactions);
            console.log('✅ Test transactions created successfully!');

            // Show summary
            const stats = await Transaction.aggregate([
                {
                    $group: {
                        _id: null,
                        totalTransactions: { $sum: 1 },
                        totalAmount: { $sum: '$amount.gross' },
                        succeededCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] }
                        }
                    }
                }
            ]);

            console.log('\n📊 Database Summary:');
            console.log(`   Total Transactions: ${stats[0].totalTransactions}`);
            console.log(`   Total Revenue: $${stats[0].totalAmount.toFixed(2)}`);
            console.log(`   Successful: ${stats[0].succeededCount}`);
            console.log(`   Success Rate: ${((stats[0].succeededCount / stats[0].totalTransactions) * 100).toFixed(1)}%`);

            // Show daily breakdown
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
                { $limit: 10 }
            ]);

            console.log('\n📅 Daily Breakdown (last 10 days with data):');
            dailyStats.forEach((day) => {
                console.log(`   ${day._id}: ${day.count} transactions, $${day.totalAmount.toFixed(2)}`);
            });

        } else {
            console.log('⚠️  No transactions to create');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run the script
createTestTransactions();
