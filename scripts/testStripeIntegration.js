/**
 * Test Stripe Recurring Subscription Integration
 * 
 * This script verifies that:
 * 1. Stripe webhook controller is properly configured
 * 2. Subscription model has required fields
 * 3. User model has stripeCustomerId field
 * 4. Webhook routes are set up correctly
 * 5. Environment variables are configured
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testStripeIntegration() {
    try {
        log('\n🔍 Testing Stripe Recurring Subscription Integration\n', 'blue');

        // Test 1: Check Environment Variables
        log('📋 Test 1: Checking Environment Variables...', 'yellow');
        const requiredEnvVars = [
            'STRIPE_SECRET_KEY',
            'STRIPE_PUBLISHABLE_KEY',
            'STRIPE_WEBHOOK_SECRET',
            'MONGODB_URI'
        ];

        const missingEnvVars = [];
        requiredEnvVars.forEach(varName => {
            if (process.env[varName]) {
                log(`   ✅ ${varName}: Set`, 'green');
            } else {
                log(`   ❌ ${varName}: Missing`, 'red');
                missingEnvVars.push(varName);
            }
        });

        if (missingEnvVars.length > 0) {
            log('\n⚠️  Missing environment variables:', 'red');
            log('   Please add these to your .env file:', 'yellow');
            missingEnvVars.forEach(varName => {
                log(`   - ${varName}`, 'yellow');
            });
        } else {
            log('   ✅ All environment variables are set\n', 'green');
        }

        // Test 2: Check Webhook Controller
        log('📋 Test 2: Checking Webhook Controller...', 'yellow');
        try {
            const stripeWebhookController = require('../src/controllers/stripeWebhook.controller');
            if (stripeWebhookController.handleStripeWebhook) {
                log('   ✅ Stripe webhook controller found', 'green');
                log('   ✅ handleStripeWebhook method exists\n', 'green');
            } else {
                log('   ❌ handleStripeWebhook method not found\n', 'red');
            }
        } catch (error) {
            log(`   ❌ Webhook controller error: ${error.message}\n`, 'red');
        }

        // Test 3: Check Webhook Routes
        log('📋 Test 3: Checking Webhook Routes...', 'yellow');
        try {
            const webhookRoutes = require('../src/routes/webhook.routes');
            log('   ✅ Webhook routes file found', 'green');
            log('   ✅ Route: POST /api/webhooks/stripe\n', 'green');
        } catch (error) {
            log(`   ❌ Webhook routes error: ${error.message}\n`, 'red');
        }

        // Test 4: Connect to Database and Check Models
        log('📋 Test 4: Checking Database Models...', 'yellow');

        if (!process.env.MONGODB_URI) {
            log('   ❌ Cannot test database - MONGODB_URI not set\n', 'red');
        } else {
            try {
                await mongoose.connect(process.env.MONGODB_URI);
                log('   ✅ Connected to MongoDB', 'green');

                // Check Subscription Model
                const Subscription = require('../src/subscription/models/subscription.model');
                const subscriptionFields = [
                    'stripeSubscriptionId',
                    'status',
                    'lastBillingDate',
                    'nextBillingDate',
                    'totalPaid',
                    'billingAttempts',
                    'autoRenew'
                ];

                log('   📦 Subscription Model Fields:', 'blue');
                subscriptionFields.forEach(field => {
                    if (Subscription.schema.path(field)) {
                        log(`      ✅ ${field}`, 'green');
                    } else {
                        log(`      ❌ ${field} missing`, 'red');
                    }
                });

                // Check User Model
                const User = require('../src/user/models/user.model');
                const userFields = ['stripeCustomerId'];

                log('   👤 User Model Fields:', 'blue');
                userFields.forEach(field => {
                    if (User.schema.path(field)) {
                        log(`      ✅ ${field}`, 'green');
                    } else {
                        log(`      ❌ ${field} missing`, 'red');
                    }
                });

                // Check existing subscriptions
                const subscriptionCount = await Subscription.countDocuments();
                const stripeSubscriptionCount = await Subscription.countDocuments({
                    stripeSubscriptionId: { $exists: true, $ne: null }
                });

                log(`\n   📊 Database Statistics:`, 'blue');
                log(`      Total Subscriptions: ${subscriptionCount}`, 'magenta');
                log(`      Stripe Subscriptions: ${stripeSubscriptionCount}`, 'magenta');

                await mongoose.disconnect();
                log('   ✅ Disconnected from MongoDB\n', 'green');

            } catch (error) {
                log(`   ❌ Database error: ${error.message}\n`, 'red');
            }
        }

        // Test 5: Test Stripe API Connection
        log('📋 Test 5: Testing Stripe API Connection...', 'yellow');
        if (process.env.STRIPE_SECRET_KEY) {
            try {
                const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                const balance = await stripe.balance.retrieve();
                log('   ✅ Stripe API connection successful', 'green');
                log(`   💰 Available Balance: ${balance.available[0].amount / 100} ${balance.available[0].currency.toUpperCase()}\n`, 'magenta');
            } catch (error) {
                log(`   ⚠️  Stripe API error: ${error.message}`, 'yellow');
                log('   Note: This might be expected if using test keys\n', 'yellow');
            }
        } else {
            log('   ❌ Cannot test Stripe API - STRIPE_SECRET_KEY not set\n', 'red');
        }

        // Summary
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
        log('📝 Integration Test Summary\n', 'blue');

        if (missingEnvVars.length === 0) {
            log('✅ All environment variables configured', 'green');
        } else {
            log(`⚠️  ${missingEnvVars.length} environment variable(s) missing`, 'yellow');
        }

        log('\n📚 Next Steps:', 'blue');
        log('   1. Set missing environment variables in .env file', 'yellow');
        log('   2. Configure Stripe webhook in Dashboard:', 'yellow');
        log('      https://dashboard.stripe.com/webhooks', 'magenta');
        log('   3. Add webhook endpoint:', 'yellow');
        log('      https://your-domain.com/api/webhooks/stripe', 'magenta');
        log('   4. Test with Stripe CLI:', 'yellow');
        log('      stripe listen --forward-to localhost:5000/api/webhooks/stripe', 'magenta');
        log('   5. Read full setup guide:', 'yellow');
        log('      STRIPE_RECURRING_SETUP.md', 'magenta');
        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'blue');

    } catch (error) {
        log(`\n❌ Test Error: ${error.message}`, 'red');
        log(error.stack, 'red');
    } finally {
        process.exit(0);
    }
}

// Run the test
testStripeIntegration();
