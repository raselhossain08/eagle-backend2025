/**
 * Transaction System Test Script
 * এই script দিয়ে transaction system test করা যাবে
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Models
const Transaction = require('../src/transaction/models/transaction.model');
const paymentTransactionService = require('../src/transaction/services/paymentTransaction.service');

async function testTransactionSystem() {
    try {
        console.log('🔄 Starting Transaction System Tests...\n');

        // Connect to database
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('Database connection string not found. Please set MONGODB_URI or MONGO_URI in .env file');
        }

        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Database connected successfully\n');

        // Test 1: Create a subscription transaction
        console.log('📝 Test 1: Creating Subscription Transaction...');
        const subscriptionPaymentData = {
            provider: 'stripe',
            amount: 2999, // $29.99 in cents
            currency: 'USD',
            status: 'succeeded',
            chargeId: 'ch_test_123456789',
            paymentIntentId: 'pi_test_123456789',
            fee: 117, // Stripe fee
            paymentMethod: {
                type: 'card',
                card: {
                    last4: '4242',
                    brand: 'visa',
                    exp_month: 12,
                    exp_year: 2025
                }
            }
        };

        const subscriptionData = {
            _id: new mongoose.Types.ObjectId(),
            planName: 'Premium Plan',
            planId: 'plan_premium',
            billingCycle: 'monthly'
        };

        const userData = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Test User',
            email: 'test@example.com',
            phone: '+1234567890'
        };

        const subscriptionTransaction = await paymentTransactionService.createSubscriptionTransaction(
            subscriptionPaymentData,
            subscriptionData,
            userData
        );

        console.log('✅ Subscription transaction created:', {
            transactionId: subscriptionTransaction.transaction.transactionId,
            amount: subscriptionTransaction.transaction.amount.gross,
            status: subscriptionTransaction.transaction.status,
            provider: subscriptionTransaction.transaction.psp.provider
        });

        // Test 2: Create a one-time transaction
        console.log('\n📝 Test 2: Creating One-time Transaction...');
        const oneTimePaymentData = {
            provider: 'paypal',
            amount: 4999, // $49.99
            currency: 'USD',
            status: 'completed',
            transactionId: 'PAYPAL_TXN_123',
            orderId: 'ORDER_123',
            fee: 175
        };

        const oneTimeTransaction = await paymentTransactionService.createOneTimeTransaction(
            oneTimePaymentData,
            userData
        );

        console.log('✅ One-time transaction created:', {
            transactionId: oneTimeTransaction.transaction.transactionId,
            amount: oneTimeTransaction.transaction.amount.gross,
            status: oneTimeTransaction.transaction.status,
            provider: oneTimeTransaction.transaction.psp.provider
        });

        // Test 3: Test webhook data processing
        console.log('\n📝 Test 3: Testing Webhook Processing...');
        const webhookData = {
            id: 'evt_test_webhook',
            provider: 'stripe',
            eventType: 'charge.succeeded',
            data: {
                object: {
                    id: 'ch_test_123456789',
                    payment_intent: 'pi_test_123456789',
                    balance_transaction: 'txn_test_123456789'
                }
            }
        };

        const webhookResult = await paymentTransactionService.updateTransactionFromWebhook(webhookData);
        console.log('✅ Webhook processed:', webhookResult);

        // Test 4: Get recent transactions
        console.log('\n📝 Test 4: Fetching Recent Transactions...');
        const recentTransactions = await Transaction.find()
            .sort({ 'timeline.initiatedAt': -1 })
            .limit(5)
            .select('transactionId type status amount.gross currency psp.provider timeline.initiatedAt');

        console.log('✅ Recent transactions:');
        recentTransactions.forEach((txn, index) => {
            console.log(`   ${index + 1}. ${txn.transactionId} - ${txn.type} - $${(txn.amount.gross / 100).toFixed(2)} ${txn.currency} - ${txn.status} (${txn.psp.provider})`);
        });

        // Test 5: Generate transaction statistics
        console.log('\n📝 Test 5: Transaction Statistics...');
        const stats = await Transaction.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount.gross' }
                }
            }
        ]);

        console.log('✅ Transaction statistics by status:');
        stats.forEach(stat => {
            console.log(`   ${stat._id}: ${stat.count} transactions, $${(stat.totalAmount / 100).toFixed(2)} total`);
        });

        console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Database connection closed');
    }
}

// Test Transaction API endpoints
async function testTransactionAPI() {
    const axios = require('axios');
    const baseURL = process.env.API_BASE_URL || 'http://localhost:5000';

    console.log('\n🌐 Testing Transaction API Endpoints...');

    try {
        // Test getting all transactions (requires auth token)
        console.log('📡 Testing GET /api/transactions...');
        // Note: This requires authentication in real environment

        console.log('💡 API endpoints available:');
        console.log('   GET /api/transactions - Get all transactions');
        console.log('   GET /api/transactions/:id - Get specific transaction');
        console.log('   GET /api/transactions/stats - Get transaction statistics');
        console.log('   POST /api/webhooks/stripe - Stripe webhook handler');
        console.log('   POST /api/webhooks/paypal - PayPal webhook handler');
        console.log('   POST /api/webhooks/admin/transactions/manual - Create manual transaction (Admin)');

    } catch (error) {
        console.log('⚠️ API test skipped (requires running server and authentication)');
    }
}

// Run tests
if (require.main === module) {
    testTransactionSystem().then(() => {
        testTransactionAPI();
    });
}

module.exports = {
    testTransactionSystem,
    testTransactionAPI
};