const PaymentSettings = require('../models/PaymentSettings');

// Get public payment settings (publishable keys only - no auth required)
exports.getPublicPaymentSettings = async (req, res) => {
    try {
        const settings = await PaymentSettings.getSettings();

        // Return only public/publishable keys (safe for frontend)
        const publicSettings = {
            paypal: {
                enabled: settings.paypal.enabled,
                mode: settings.paypal.mode,
                clientId: settings.paypal.clientId || '', // PayPal client ID is public
                configured: !!(settings.paypal.clientId && settings.paypal.clientSecret)
            },
            stripe: {
                enabled: settings.stripe.enabled,
                mode: settings.stripe.mode,
                publishableKey: settings.stripe.publishableKey || '', // Only publishable key (public)
                configured: !!settings.stripe.publishableKey
            }
        };

        res.status(200).json({
            success: true,
            data: publicSettings
        });
    } catch (error) {
        console.error('Get Public Payment Settings Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment settings',
            error: error.message
        });
    }
};

// Get payment settings (admin only - full credentials)
exports.getPaymentSettings = async (req, res) => {
    try {
        const settings = await PaymentSettings.getSettings();

        // Return full credentials for admin to edit (since this is admin-only endpoint)
        const responseSettings = {
            paypal: {
                enabled: settings.paypal.enabled,
                mode: settings.paypal.mode,
                clientId: settings.paypal.clientId || '',
                clientSecret: settings.paypal.clientSecret || '',
                apiUrl: settings.paypal.apiUrl,
                configured: !!(settings.paypal.clientId && settings.paypal.clientSecret)
            },
            stripe: {
                enabled: settings.stripe.enabled,
                mode: settings.stripe.mode,
                publishableKey: settings.stripe.publishableKey || '',
                secretKey: settings.stripe.secretKey || '',
                webhookSecret: settings.stripe.webhookSecret || '',
                configured: !!(settings.stripe.publishableKey && settings.stripe.secretKey)
            },
            lastUpdated: settings.lastUpdated
        };

        res.status(200).json({
            success: true,
            data: responseSettings
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

        // Reconfigure payment services dynamically
        const paymentConfig = require('../config/paymentConfig');
        await paymentConfig.reconfigurePaymentGateways();

        // Clear cache in dynamic config
        const DynamicPaymentConfig = require('../config/dynamicPaymentConfig');
        DynamicPaymentConfig.clearCache();

        console.log('✅ Payment gateways reconfigured successfully');

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

            // Test Stripe connection with a lightweight API call
            const stripe = require('stripe')(settings.stripe.secretKey);

            try {
                // Use balance retrieve - attempt with any key type
                const balance = await stripe.balance.retrieve();

                return res.status(200).json({
                    success: true,
                    message: 'Stripe connection successful',
                    data: {
                        mode: settings.stripe.mode,
                        currency: balance.available?.[0]?.currency || 'usd',
                        status: 'connected'
                    }
                });
            } catch (stripeError) {
                return res.status(400).json({
                    success: false,
                    message: `Stripe API Error: ${stripeError.message}`,
                    error: stripeError.message
                });
            }
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
