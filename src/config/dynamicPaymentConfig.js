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
            // ONLY use environment variable - no database lookup
            if (!process.env.STRIPE_SECRET_KEY) {
                console.warn('Stripe not configured. Please set STRIPE_SECRET_KEY environment variable.');
                return null;
            }

            // Create new client if not initialized
            if (!stripeClient) {
                const stripe = require('stripe');
                stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
                console.log('Stripe initialized from environment variables (test mode)');
            }

            return stripeClient;
        } catch (error) {
            console.error('Error getting Stripe client:', error);
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
        // ONLY use environment variables - no database lookup
        return {
            stripe: {
                enabled: !!process.env.STRIPE_SECRET_KEY,
                mode: 'test',
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
