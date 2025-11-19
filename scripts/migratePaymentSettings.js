require('dotenv').config();
const mongoose = require('mongoose');
const PaymentSettings = require('../src/models/PaymentSettings');

const migratePaymentSettings = async () => {
    try {
        console.log('🔄 Starting payment settings migration...\n');

        // Connect to database
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI not found in environment variables');
        }

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Read PayPal credentials from .env
        const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
        const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
        const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

        // Read Stripe credentials from .env
        const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
        const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

        console.log('📋 Environment Variables Found:');
        console.log('━'.repeat(60));
        console.log('PayPal:');
        console.log(`  Mode: ${paypalMode}`);
        console.log(`  Client ID: ${paypalClientId ? '✓ Found' : '✗ Missing'}`);
        console.log(`  Client Secret: ${paypalClientSecret ? '✓ Found' : '✗ Missing'}`);
        console.log('\nStripe:');
        console.log(`  Publishable Key: ${stripePublishableKey ? '✓ Found' : '✗ Missing'}`);
        console.log(`  Secret Key: ${stripeSecretKey ? '✓ Found' : '✗ Missing'}`);
        console.log(`  Webhook Secret: ${stripeWebhookSecret ? '✓ Found (Optional)' : '○ Not set (Optional)'}`);
        console.log('━'.repeat(60));
        console.log();

        // Check if credentials exist
        const hasPayPalCreds = paypalClientId && paypalClientSecret;
        const hasStripeCreds = stripePublishableKey && stripeSecretKey;

        if (!hasPayPalCreds && !hasStripeCreds) {
            console.log('⚠️  No payment credentials found in .env file');
            console.log('Please add your PayPal and/or Stripe credentials to .env first');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Determine Stripe mode from secret key prefix
        let stripeMode = 'test';
        if (stripeSecretKey.startsWith('sk_live') || stripeSecretKey.startsWith('rk_live')) {
            stripeMode = 'live';
        }

        // Prepare settings object
        const settingsData = {
            paypal: {
                enabled: Boolean(hasPayPalCreds),
                mode: String(paypalMode).toLowerCase(),
                clientId: String(paypalClientId),
                clientSecret: String(paypalClientSecret),
                apiUrl: paypalMode === 'live'
                    ? 'https://api.paypal.com'
                    : 'https://api.sandbox.paypal.com'
            },
            stripe: {
                enabled: Boolean(hasStripeCreds),
                mode: stripeMode,
                publishableKey: String(stripePublishableKey),
                secretKey: String(stripeSecretKey),
                webhookSecret: String(stripeWebhookSecret || '')
            }
        };        // Check if settings already exist
        let existingSettings = await PaymentSettings.findOne();

        if (existingSettings) {
            console.log('📝 Existing settings found in database');
            console.log('Current database state:');
            console.log(`  PayPal Enabled: ${existingSettings.paypal.enabled}`);
            console.log(`  Stripe Enabled: ${existingSettings.stripe.enabled}`);
            console.log();

            // Update existing settings using dot notation
            existingSettings.set('paypal.enabled', settingsData.paypal.enabled);
            existingSettings.set('paypal.mode', settingsData.paypal.mode);
            existingSettings.set('paypal.clientId', settingsData.paypal.clientId);
            existingSettings.set('paypal.clientSecret', settingsData.paypal.clientSecret);
            existingSettings.set('paypal.apiUrl', settingsData.paypal.apiUrl);

            existingSettings.set('stripe.enabled', settingsData.stripe.enabled);
            existingSettings.set('stripe.mode', settingsData.stripe.mode);
            existingSettings.set('stripe.publishableKey', settingsData.stripe.publishableKey);
            existingSettings.set('stripe.secretKey', settingsData.stripe.secretKey);
            existingSettings.set('stripe.webhookSecret', settingsData.stripe.webhookSecret);

            existingSettings.lastUpdated = new Date();
            await existingSettings.save();

            console.log('✅ Settings updated successfully!');
        } else {
            // Create new settings
            const newSettings = new PaymentSettings(settingsData);
            await newSettings.save();
            console.log('✅ Settings created successfully!');
        }

        console.log();
        console.log('📊 Migration Summary:');
        console.log('━'.repeat(60));
        console.log('PayPal:');
        console.log(`  Status: ${hasPayPalCreds ? '✅ Enabled' : '○ Disabled'}`);
        console.log(`  Mode: ${settingsData.paypal.mode}`);
        console.log(`  Client ID: ${paypalClientId.substring(0, 20)}...`);

        console.log('\nStripe:');
        console.log(`  Status: ${hasStripeCreds ? '✅ Enabled' : '○ Disabled'}`);
        console.log(`  Mode: ${settingsData.stripe.mode}`);
        console.log(`  Publishable Key: ${stripePublishableKey.substring(0, 20)}...`);
        console.log('━'.repeat(60));
        console.log();

        console.log('✨ Migration completed successfully!');
        console.log('🔄 Payment gateways will use database settings on next server restart');
        console.log();
        console.log('Next steps:');
        console.log('1. Restart your backend server to apply the changes');
        console.log('2. Visit http://localhost:3000/settings/payment-processors to verify');
        console.log('3. Test connections from the dashboard UI');

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error.stack);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Run migration
migratePaymentSettings();
