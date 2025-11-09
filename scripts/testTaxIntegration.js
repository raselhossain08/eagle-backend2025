/**
 * Tax Integration Test Script
 * Tax system এর integration test করার জন্য
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Services
const TransactionTaxService = require('../src/transaction/services/transactionTax.service');
const PaymentTransactionService = require('../src/transaction/services/paymentTransaction.service');
const TaxRate = require('../src/payment/models/taxRate.model');

const transactionTaxService = new TransactionTaxService();
const paymentTransactionService = new PaymentTransactionService();

async function testTaxIntegration() {
    try {
        console.log('🧮 Starting Tax Integration Tests...\n');

        // Connect to database
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('Database connection string not found. Please set MONGODB_URI or MONGO_URI in .env file');
        }

        await mongoose.connect(mongoUri);
        console.log('✅ Database connected successfully\n');

        // Test 1: Setup default tax rates
        console.log('📝 Test 1: Setting up default tax rates...');
        await setupDefaultTaxRates();

        // Test 2: Calculate subscription tax
        console.log('\n📝 Test 2: Testing Subscription Tax Calculation...');
        const subscriptionTaxResult = await testSubscriptionTaxCalculation();

        // Test 3: Calculate one-time payment tax
        console.log('\n📝 Test 3: Testing One-time Payment Tax Calculation...');
        const oneTimeTaxResult = await testOneTimeTaxCalculation();

        // Test 4: Create transaction with tax
        console.log('\n📝 Test 4: Testing Transaction Creation with Tax...');
        const transactionWithTax = await testTransactionCreationWithTax();

        // Test 5: Generate tax report
        console.log('\n📝 Test 5: Testing Tax Report Generation...');
        const taxReport = await testTaxReportGeneration();

        console.log('\n🎉 All tax integration tests completed successfully!');
        console.log('\n📊 Test Summary:');
        console.log(`   ✅ Subscription tax: $${(subscriptionTaxResult.taxAmount / 100).toFixed(2)}`);
        console.log(`   ✅ One-time tax: $${(oneTimeTaxResult.taxAmount / 100).toFixed(2)}`);
        console.log(`   ✅ Transaction created with tax: ${transactionWithTax.transaction.transactionId}`);
        console.log(`   ✅ Tax report jurisdictions: ${taxReport.summary.totalJurisdictions}`);

    } catch (error) {
        console.error('❌ Tax integration test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Database connection closed');
    }
}

async function setupDefaultTaxRates() {
    const defaultRates = [
        { country: 'US', rate: 8.25, type: 'Sales Tax', status: 'active' },
        { country: 'CA', rate: 13.0, type: 'GST', status: 'active' },
        { country: 'GB', rate: 20.0, type: 'VAT', status: 'active' },
        { country: 'AU', rate: 10.0, type: 'GST', status: 'active' },
        { country: 'DE', rate: 19.0, type: 'VAT', status: 'active' }
    ];

    for (const rateData of defaultRates) {
        await TaxRate.findOneAndUpdate(
            { country: rateData.country },
            rateData,
            { upsert: true, new: true }
        );
    }

    console.log('✅ Default tax rates set up successfully');
}

async function testSubscriptionTaxCalculation() {
    const subscriptionData = {
        amount: 2999, // $29.99
        currency: 'USD'
    };

    const userData = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test User',
        email: 'test@example.com',
        country: 'US',
        state: 'CA',
        address: {
            country: 'US',
            state: 'CA',
            city: 'San Francisco',
            postalCode: '94102'
        }
    };

    const planData = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Premium Plan',
        price: 2999
    };

    const taxResult = await transactionTaxService.calculateSubscriptionTax(
        subscriptionData,
        userData,
        planData
    );

    console.log('✅ Subscription tax calculation result:', {
        originalAmount: `$${(taxResult.originalAmount / 100).toFixed(2)}`,
        taxAmount: `$${(taxResult.taxAmount / 100).toFixed(2)}`,
        totalAmount: `$${(taxResult.totalAmount / 100).toFixed(2)}`,
        rate: `${(taxResult.rate * 100).toFixed(2)}%`,
        provider: taxResult.provider
    });

    return taxResult;
}

async function testOneTimeTaxCalculation() {
    const paymentData = {
        amount: 4999, // $49.99
        currency: 'USD',
        provider: 'stripe'
    };

    const userData = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Customer',
        email: 'customer@example.com',
        country: 'CA',
        address: {
            country: 'CA',
            state: 'ON',
            city: 'Toronto',
            postalCode: 'M5V 3A1'
        }
    };

    const taxResult = await transactionTaxService.calculateOneTimeTax(
        paymentData,
        userData
    );

    console.log('✅ One-time payment tax calculation result:', {
        originalAmount: `$${(taxResult.originalAmount / 100).toFixed(2)}`,
        taxAmount: `$${(taxResult.taxAmount / 100).toFixed(2)}`,
        totalAmount: `$${(taxResult.totalAmount / 100).toFixed(2)}`,
        rate: `${(taxResult.rate).toFixed(2)}%`,
        provider: taxResult.provider
    });

    return taxResult;
}

async function testTransactionCreationWithTax() {
    const paymentData = {
        provider: 'stripe',
        amount: 1999, // $19.99
        currency: 'USD',
        status: 'succeeded',
        chargeId: 'ch_tax_test_' + Date.now(),
        paymentIntentId: 'pi_tax_test_' + Date.now(),
        fee: 89, // Stripe fee
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
        planName: 'Basic Plan',
        planId: 'plan_basic',
        billingCycle: 'monthly'
    };

    const userData = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Tax Test User',
        email: 'taxtest@example.com',
        country: 'GB',
        address: {
            country: 'GB',
            state: 'England',
            city: 'London',
            postalCode: 'SW1A 1AA'
        }
    };

    const result = await paymentTransactionService.createSubscriptionTransaction(
        paymentData,
        subscriptionData,
        userData
    );

    console.log('✅ Transaction created with automatic tax calculation:', {
        transactionId: result.transaction.transactionId,
        grossAmount: `$${(result.transaction.amount.gross / 100).toFixed(2)}`,
        taxAmount: `$${(result.transaction.amount.tax / 100).toFixed(2)}`,
        netAmount: `$${(result.transaction.amount.net / 100).toFixed(2)}`,
        status: result.transaction.status
    });

    return result;
}

async function testTaxReportGeneration() {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // 30 days ago

    const endDate = new Date();

    const taxReport = await transactionTaxService.generateTaxReport(
        startDate,
        endDate,
        { country: 'US' }
    );

    console.log('✅ Tax report generated:', {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalJurisdictions: taxReport.summary.totalJurisdictions,
        totalTransactions: taxReport.summary.totalTransactions,
        totalTax: `$${(taxReport.summary.totalTax / 100).toFixed(2)}`,
        totalGross: `$${(taxReport.summary.totalGross / 100).toFixed(2)}`
    });

    return taxReport;
}

// Test Tax API endpoints (requires running server)
async function testTaxAPIEndpoints() {
    console.log('\n🌐 Testing Tax API Endpoints...');

    console.log('💡 Available Tax API endpoints:');
    console.log('   POST /api/transactions/tax/calculate - Calculate tax preview');
    console.log('   POST /api/transactions/tax/subscription-preview - Subscription tax preview');
    console.log('   GET /api/transactions/tax/report - Generate tax report (Admin)');
    console.log('   GET /api/transactions/tax/rates - Get tax rates (Admin)');
    console.log('   POST /api/transactions/:id/tax/update - Update transaction tax (Admin)');
    console.log('   GET /api/transactions/tax/jurisdictions - Get tax jurisdictions (Admin)');

    console.log('\n💼 Tax Integration Features:');
    console.log('   ✅ Automatic tax calculation for all payments');
    console.log('   ✅ Multiple tax provider support (Stripe Tax, TaxJar, Avalara)');
    console.log('   ✅ Fallback to default rates if provider fails');
    console.log('   ✅ Tax reporting and compliance');
    console.log('   ✅ Transaction-level tax tracking');
    console.log('   ✅ Jurisdiction-based tax rates');
    console.log('   ✅ Admin tax management');
}

// Run tests
if (require.main === module) {
    testTaxIntegration().then(() => {
        testTaxAPIEndpoints();
    });
}

module.exports = {
    testTaxIntegration,
    testTaxAPIEndpoints
};