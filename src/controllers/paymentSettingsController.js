const PaymentSettings = require('../models/PaymentSettings');

// Get payment settings
exports.getPaymentSettings = async (req, res) => {
    try {
        const settings = await PaymentSettings.getSettings();

        // Don't send full secrets to frontend
        const sanitizedSettings = {
            paypal: {
                enabled: settings.paypal.enabled,
                mode: settings.paypal.mode,
                clientId: settings.paypal.clientId ? '***' + settings.paypal.clientId.slice(-4) : '',
                clientSecret: settings.paypal.clientSecret ? '***' + settings.paypal.clientSecret.slice(-4) : '',
                apiUrl: settings.paypal.apiUrl,
                configured: !!(settings.paypal.clientId && settings.paypal.clientSecret)
            },
            stripe: {
                enabled: settings.stripe.enabled,
                mode: settings.stripe.mode,
                publishableKey: settings.stripe.publishableKey ? '***' + settings.stripe.publishableKey.slice(-4) : '',
                secretKey: settings.stripe.secretKey ? '***' + settings.stripe.secretKey.slice(-4) : '',
                webhookSecret: settings.stripe.webhookSecret ? '***' + settings.stripe.webhookSecret.slice(-4) : '',
                configured: !!(settings.stripe.publishableKey && settings.stripe.secretKey)
            },
            lastUpdated: settings.lastUpdated
        };

        res.status(200).json({
            success: true,
            data: sanitizedSettings
        });
    } catch (error) {
        console.error('Get Payment Settings Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment settings',
            error: error.message
        });
    }
};

// Update payment settings
exports.updatePaymentSettings = async (req, res) => {
    try {
        const { paypal, stripe } = req.body;
        const userId = req.user?._id;

        const updates = {};

        // Update PayPal settings
        if (paypal) {
            updates.paypal = {};
            if (typeof paypal.enabled !== 'undefined') updates.paypal.enabled = paypal.enabled;
            if (paypal.mode) updates.paypal.mode = paypal.mode;
            if (paypal.clientId) updates.paypal.clientId = paypal.clientId;
            if (paypal.clientSecret) updates.paypal.clientSecret = paypal.clientSecret;

            // Set API URL based on mode
            if (paypal.mode === 'live') {
                updates.paypal.apiUrl = 'https://api-m.paypal.com';
            } else {
                updates.paypal.apiUrl = 'https://api-m.sandbox.paypal.com';
            }
        }

        // Update Stripe settings
        if (stripe) {
            updates.stripe = {};
            if (typeof stripe.enabled !== 'undefined') updates.stripe.enabled = stripe.enabled;
            if (stripe.mode) updates.stripe.mode = stripe.mode;
            if (stripe.publishableKey) updates.stripe.publishableKey = stripe.publishableKey;
            if (stripe.secretKey) updates.stripe.secretKey = stripe.secretKey;
            if (stripe.webhookSecret) updates.stripe.webhookSecret = stripe.webhookSecret;
        }

        const settings = await PaymentSettings.updateSettings(updates, userId);

        // Update environment variables dynamically (optional - for immediate use)
        if (paypal) {
            if (paypal.mode) process.env.PAYPAL_MODE = paypal.mode;
            if (paypal.clientId) process.env.PAYPAL_CLIENT_ID = paypal.clientId;
            if (paypal.clientSecret) process.env.PAYPAL_CLIENT_SECRET = paypal.clientSecret;
            if (updates.paypal?.apiUrl) process.env.PAYPAL_API = updates.paypal.apiUrl;
        }

        if (stripe) {
            if (stripe.secretKey) process.env.STRIPE_SECRET_KEY = stripe.secretKey;
            if (stripe.publishableKey) process.env.STRIPE_PUBLISHABLE_KEY = stripe.publishableKey;
        }

        // Reconfigure payment services
        if (paypal && (paypal.clientId || paypal.clientSecret || paypal.mode)) {
            const paypalSdk = require('paypal-rest-sdk');
            paypalSdk.configure({
                mode: settings.paypal.mode,
                client_id: settings.paypal.clientId,
                client_secret: settings.paypal.clientSecret
            });
        }

        // Return sanitized settings
        const sanitizedSettings = {
            paypal: {
                enabled: settings.paypal.enabled,
                mode: settings.paypal.mode,
                configured: !!(settings.paypal.clientId && settings.paypal.clientSecret)
            },
            stripe: {
                enabled: settings.stripe.enabled,
                mode: settings.stripe.mode,
                configured: !!(settings.stripe.publishableKey && settings.stripe.secretKey)
            },
            lastUpdated: settings.lastUpdated
        };

        res.status(200).json({
            success: true,
            message: 'Payment settings updated successfully',
            data: sanitizedSettings
        });
    } catch (error) {
        console.error('Update Payment Settings Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment settings',
            error: error.message
        });
    }
};

// Test payment connection
exports.testPaymentConnection = async (req, res) => {
    try {
        const { provider } = req.params; // 'paypal' or 'stripe'
        const settings = await PaymentSettings.getSettings();

        if (provider === 'paypal') {
            if (!settings.paypal.clientId || !settings.paypal.clientSecret) {
                return res.status(400).json({
                    success: false,
                    message: 'PayPal credentials not configured'
                });
            }

            // Test PayPal connection by getting an access token
            const axios = require('axios');
            const auth = Buffer.from(`${settings.paypal.clientId}:${settings.paypal.clientSecret}`).toString('base64');

            const response = await axios.post(
                `${settings.paypal.apiUrl}/v1/oauth2/token`,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return res.status(200).json({
                success: true,
                message: 'PayPal connection successful',
                data: {
                    mode: settings.paypal.mode,
                    status: 'connected'
                }
            });

        } else if (provider === 'stripe') {
            if (!settings.stripe.secretKey) {
                return res.status(400).json({
                    success: false,
                    message: 'Stripe credentials not configured'
                });
            }

            // Test Stripe connection
            const stripe = require('stripe')(settings.stripe.secretKey);
            const account = await stripe.accounts.retrieve();

            return res.status(200).json({
                success: true,
                message: 'Stripe connection successful',
                data: {
                    mode: settings.stripe.mode,
                    accountId: account.id,
                    status: 'connected'
                }
            });

        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment provider'
            });
        }

    } catch (error) {
        console.error('Test Payment Connection Error:', error);
        res.status(500).json({
            success: false,
            message: `Connection test failed: ${error.message}`,
            error: error.response?.data || error.message
        });
    }
};
