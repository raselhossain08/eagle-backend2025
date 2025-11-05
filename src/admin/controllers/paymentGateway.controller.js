const PaymentGatewayService = require('../services/paymentGateway.service');

class PaymentGatewayController {
    /**
     * @route   GET /api/admin/payment-gateways/status
     * @desc    Get status of all payment gateways
     * @access  Admin
     */
    static async getGatewayStatus(req, res) {
        try {
            const status = await PaymentGatewayService.getGatewayStatus();

            res.status(200).json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('Get gateway status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get gateway status',
                error: error.message
            });
        }
    }

    /**
     * @route   GET /api/admin/payment-gateways/stripe
     * @desc    Get Stripe configuration (without secrets)
     * @access  Admin
     */
    static async getStripeConfig(req, res) {
        try {
            const config = await PaymentGatewayService.getStripeConfig();

            // Don't send secret keys in response
            res.status(200).json({
                success: true,
                data: {
                    enabled: config.enabled,
                    mode: config.mode,
                    publishableKey: config.publishableKey,
                    hasSecretKey: !!config.secretKey,
                    hasWebhookSecret: !!config.webhookSecret,
                    source: config.source
                }
            });
        } catch (error) {
            console.error('Get Stripe config error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get Stripe configuration',
                error: error.message
            });
        }
    }

    /**
     * @route   GET /api/admin/payment-gateways/paypal
     * @desc    Get PayPal configuration (without secrets)
     * @access  Admin
     */
    static async getPayPalConfig(req, res) {
        try {
            const config = await PaymentGatewayService.getPayPalConfig();

            // Don't send secret keys in response
            res.status(200).json({
                success: true,
                data: {
                    enabled: config.enabled,
                    mode: config.mode,
                    clientId: config.clientId,
                    hasClientSecret: !!config.clientSecret,
                    webhookId: config.webhookId,
                    source: config.source
                }
            });
        } catch (error) {
            console.error('Get PayPal config error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get PayPal configuration',
                error: error.message
            });
        }
    }

    /**
     * @route   PUT /api/admin/payment-gateways/stripe
     * @desc    Update Stripe configuration
     * @access  Admin
     */
    static async updateStripeConfig(req, res) {
        try {
            const { enabled, mode, publishableKey, secretKey, webhookSecret } = req.body;

            // Validate input
            if (enabled && !secretKey && !publishableKey) {
                return res.status(400).json({
                    success: false,
                    message: 'Publishable key and secret key are required when enabling Stripe'
                });
            }

            if (mode && !['test', 'live'].includes(mode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Mode must be either "test" or "live"'
                });
            }

            const result = await PaymentGatewayService.updateStripeSettings({
                enabled,
                mode,
                publishableKey,
                secretKey,
                webhookSecret
            });

            // Clear cache to force reload of new configuration
            const DynamicPaymentConfig = require('../../config/dynamicPaymentConfig');
            DynamicPaymentConfig.clearCache();

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    enabled: result.enabled,
                    mode: result.mode
                }
            });
        } catch (error) {
            console.error('Update Stripe config error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update Stripe configuration',
                error: error.message
            });
        }
    }

    /**
     * @route   PUT /api/admin/payment-gateways/paypal
     * @desc    Update PayPal configuration
     * @access  Admin
     */
    static async updatePayPalConfig(req, res) {
        try {
            const { enabled, mode, clientId, clientSecret, webhookId } = req.body;

            // Validate input
            if (enabled && !clientId && !clientSecret) {
                return res.status(400).json({
                    success: false,
                    message: 'Client ID and client secret are required when enabling PayPal'
                });
            }

            if (mode && !['sandbox', 'live'].includes(mode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Mode must be either "sandbox" or "live"'
                });
            }

            const result = await PaymentGatewayService.updatePayPalSettings({
                enabled,
                mode,
                clientId,
                clientSecret,
                webhookId
            });

            // Clear cache to force reload of new configuration
            const DynamicPaymentConfig = require('../../config/dynamicPaymentConfig');
            DynamicPaymentConfig.clearCache();

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    enabled: result.enabled,
                    mode: result.mode
                }
            });
        } catch (error) {
            console.error('Update PayPal config error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update PayPal configuration',
                error: error.message
            });
        }
    }

    /**
     * @route   POST /api/admin/payment-gateways/stripe/test
     * @desc    Test Stripe connection
     * @access  Admin
     */
    static async testStripeConnection(req, res) {
        try {
            const { secretKey } = req.body; // Optional: test with new key before saving

            const result = await PaymentGatewayService.testStripeConnection(secretKey);

            res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Test Stripe connection error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to test Stripe connection',
                error: error.message
            });
        }
    }

    /**
     * @route   POST /api/admin/payment-gateways/paypal/test
     * @desc    Test PayPal connection
     * @access  Admin
     */
    static async testPayPalConnection(req, res) {
        try {
            const { clientId, clientSecret } = req.body; // Optional: test with new credentials before saving

            const result = await PaymentGatewayService.testPayPalConnection(clientId, clientSecret);

            res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Test PayPal connection error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to test PayPal connection',
                error: error.message
            });
        }
    }
}

module.exports = PaymentGatewayController;
