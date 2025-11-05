const PaymentGatewayService = require('../../admin/services/paymentGateway.service');

/**
 * Dynamic Payment Gateway Configuration
 * This utility provides a unified interface to get payment gateway configurations
 * It checks database settings first, then falls back to environment variables
 */

let stripeClient = null;
let paypalClient = null;
let cachedConfig = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class DynamicPaymentConfig {
    /**
     * Get Stripe client instance
     */
    static async getStripeClient() {
        try {
            const config = await PaymentGatewayService.getStripeConfig();

            if (!config.secretKey) {
                console.warn('Stripe not configured. Please configure in admin dashboard or set STRIPE_SECRET_KEY environment variable.');
                return null;
            }

            // Create new client if config changed or not initialized
            if (!stripeClient || stripeClient._config !== config.secretKey) {
                const stripe = require('stripe');
                stripeClient = stripe(config.secretKey);
                stripeClient._config = config.secretKey;
                console.log(`Stripe initialized in ${config.mode} mode (source: ${config.source})`);
            }

            return stripeClient;
        } catch (error) {
            console.error('Error getting Stripe client:', error);

            // Fallback to environment variable
            if (process.env.STRIPE_SECRET_KEY) {
                const stripe = require('stripe');
                return stripe(process.env.STRIPE_SECRET_KEY);
            }

            return null;
        }
    }

    /**
     * Get PayPal configuration
     */
    static async getPayPalConfig() {
        try {
            const config = await PaymentGatewayService.getPayPalConfig();

            if (!config.clientId || !config.clientSecret) {
                console.warn('PayPal not configured. Please configure in admin dashboard or set PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET environment variables.');
                return null;
            }

            console.log(`PayPal configured in ${config.mode} mode (source: ${config.source})`);

            return {
                mode: config.mode,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                webhookId: config.webhookId
            };
        } catch (error) {
            console.error('Error getting PayPal config:', error);

            // Fallback to environment variables
            if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
                return {
                    mode: process.env.PAYPAL_MODE || 'sandbox',
                    client_id: process.env.PAYPAL_CLIENT_ID,
                    client_secret: process.env.PAYPAL_CLIENT_SECRET,
                    webhookId: process.env.PAYPAL_WEBHOOK_ID
                };
            }

            return null;
        }
    }

    /**
     * Get PayPal SDK client
     */
    static async getPayPalClient() {
        try {
            const config = await this.getPayPalConfig();

            if (!config) {
                return null;
            }

            const paypal = require('paypal-rest-sdk');
            paypal.configure(config);

            return paypal;
        } catch (error) {
            console.error('Error getting PayPal client:', error);
            return null;
        }
    }

    /**
     * Get all gateway configurations (cached)
     */
    static async getAllConfigs(forceRefresh = false) {
        const now = Date.now();

        // Return cached config if still valid
        if (!forceRefresh && cachedConfig && (now - lastCacheTime) < CACHE_DURATION) {
            return cachedConfig;
        }

        try {
            const [stripeConfig, paypalConfig] = await Promise.all([
                PaymentGatewayService.getStripeConfig(),
                PaymentGatewayService.getPayPalConfig()
            ]);

            cachedConfig = {
                stripe: {
                    enabled: stripeConfig.enabled && !!stripeConfig.secretKey,
                    mode: stripeConfig.mode,
                    publishableKey: stripeConfig.publishableKey,
                    source: stripeConfig.source
                },
                paypal: {
                    enabled: paypalConfig.enabled && !!paypalConfig.clientId && !!paypalConfig.clientSecret,
                    mode: paypalConfig.mode,
                    source: paypalConfig.source
                }
            };

            lastCacheTime = now;
            return cachedConfig;
        } catch (error) {
            console.error('Error getting gateway configs:', error);

            // Return environment-based config as fallback
            return {
                stripe: {
                    enabled: !!process.env.STRIPE_SECRET_KEY,
                    mode: process.env.STRIPE_MODE || 'test',
                    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
                    source: 'environment'
                },
                paypal: {
                    enabled: !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET,
                    mode: process.env.PAYPAL_MODE || 'sandbox',
                    source: 'environment'
                }
            };
        }
    }

    /**
     * Clear cache (call this after updating gateway settings)
     */
    static clearCache() {
        cachedConfig = null;
        lastCacheTime = 0;
        stripeClient = null;
        paypalClient = null;
        console.log('Payment gateway config cache cleared');
    }

    /**
     * Check if a gateway is enabled
     */
    static async isGatewayEnabled(gateway) {
        const configs = await this.getAllConfigs();
        return configs[gateway]?.enabled || false;
    }
}

module.exports = DynamicPaymentConfig;
