#!/usr/bin/env node

/**
 * Payment Gateway Configuration Checker
 * This script verifies that payment gateways are properly configured
 */

const mongoose = require('mongoose');
require('dotenv').config();

const checkPaymentConfig = async () => {
    console.log('🔍 Checking Payment Gateway Configuration...\n');

    try {
        // Connect to database
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('❌ MongoDB URI not found in environment variables');
            process.exit(1);
        }

        console.log('📡 Connecting to database...');
        await mongoose.connect(mongoUri);
        console.log('✅ Database connected\n');

        // Check PaymentSettings collection
        const PaymentSettings = mongoose.model('PaymentSettings', new mongoose.Schema({
            paypal: {
                enabled: Boolean,
                mode: String,
                clientId: String,
                clientSecret: String
            },
            stripe: {
                enabled: Boolean,
                mode: String,
                publishableKey: String,
                secretKey: String
            }
        }));

        const settings = await PaymentSettings.findOne();

        console.log('═══════════════════════════════════════');
        console.log('        DATABASE SETTINGS');
        console.log('═══════════════════════════════════════');

        if (settings) {
            console.log('\n💳 PayPal Configuration:');
            console.log(`   Enabled: ${settings.paypal?.enabled ? '✅ YES' : '❌ NO'}`);
            console.log(`   Mode: ${settings.paypal?.mode || 'Not set'}`);
            console.log(`   Client ID: ${settings.paypal?.clientId ? '✅ Configured' : '❌ Not configured'}`);
            console.log(`   Client Secret: ${settings.paypal?.clientSecret ? '✅ Configured' : '❌ Not configured'}`);

            console.log('\n💳 Stripe Configuration:');
            console.log(`   Enabled: ${settings.stripe?.enabled ? '✅ YES' : '❌ NO'}`);
            console.log(`   Mode: ${settings.stripe?.mode || 'Not set'}`);
            console.log(`   Publishable Key: ${settings.stripe?.publishableKey ? '✅ Configured' : '❌ Not configured'}`);
            console.log(`   Secret Key: ${settings.stripe?.secretKey ? '✅ Configured' : '❌ Not configured'}`);
        } else {
            console.log('\n⚠️  No payment settings found in database');
            console.log('   Settings will be created when you configure them in the admin dashboard');
        }

        console.log('\n═══════════════════════════════════════');
        console.log('     ENVIRONMENT VARIABLES (Fallback)');
        console.log('═══════════════════════════════════════');

        console.log('\n💳 PayPal Environment Variables:');
        console.log(`   PAYPAL_MODE: ${process.env.PAYPAL_MODE || '❌ Not set'}`);
        console.log(`   PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
        console.log(`   PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);

        console.log('\n💳 Stripe Environment Variables:');
        console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
        console.log(`   STRIPE_PUBLISHABLE_KEY: ${process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Not set'}`);

        console.log('\n═══════════════════════════════════════');
        console.log('           RECOMMENDATIONS');
        console.log('═══════════════════════════════════════\n');

        const dbConfigured = settings?.paypal?.clientId || settings?.stripe?.secretKey;
        const envConfigured = process.env.PAYPAL_CLIENT_ID || process.env.STRIPE_SECRET_KEY;

        if (dbConfigured) {
            console.log('✅ Database configuration is active');
            console.log('   Payment gateways will use database settings');
        } else if (envConfigured) {
            console.log('⚠️  Using environment variables as fallback');
            console.log('   Consider configuring in admin dashboard for easier management');
        } else {
            console.log('❌ No payment gateway configuration found!');
            console.log('   Please configure payment gateways in one of these ways:');
            console.log('   1. Admin Dashboard: http://localhost:3000/settings/payment-processors');
            console.log('   2. Environment Variables: Add to .env file');
        }

        console.log('\n📚 For more information, see PAYMENT_INTEGRATION_GUIDE.md\n');

        await mongoose.disconnect();
        console.log('✅ Check complete\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

checkPaymentConfig();
