const PaymentSettings = require('../models/PaymentSettings');

/**
 * Dynamic Payment Gateway Configuration
 * This utility provides a unified interface to get payment gateway configurations
 * It checks database settings first, then falls back to environment variables
 */

let cachedConfig = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class DynamicPaymentConfig {
    /**
     * Get Stripe client instance
     */
    static async getStripeClient() {
        try {
            const settings = await PaymentSettings.getSettings();

            // Use database settings if available
            if (settings?.stripe?.secretKey) {
                const stripe = require('stripe');
                return stripe(settings.stripe.secretKey);
            }

            // Fallback to environment variable
            if (process.env.STRIPE_SECRET_KEY) {
                const stripe = require('stripe');
                return stripe(process.env.STRIPE_SECRET_KEY);
            }

            console.warn('Stripe not configured. Please configure in admin dashboard.');
            return null;
        } catch (error) {
            console.error('Error getting Stripe client:', error);

            // Last resort fallback
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
            const settings = await PaymentSettings.getSettings();

            // Use database settings if available
            if (settings?.paypal?.clientId && settings?.paypal?.clientSecret) {
                return {
                    mode: settings.paypal.mode || 'sandbox',
                    client_id: settings.paypal.clientId,
                    client_secret: settings.paypal.clientSecret,
                    source: 'database'
                };
            }

            // Fallback to environment variables
            if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
                return {
                    mode: process.env.PAYPAL_MODE || 'sandbox',
                    client_id: process.env.PAYPAL_CLIENT_ID,
                    client_secret: process.env.PAYPAL_CLIENT_SECRET,
                    source: 'environment'
                };
            }

            console.warn('PayPal not configured. Please configure in admin dashboard.');
            return null;
        } catch (error) {
            console.error('Error getting PayPal config:', error);

            // Last resort fallback
            if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
                return {
                    mode: process.env.PAYPAL_MODE || 'sandbox',
                    client_id: process.env.PAYPAL_CLIENT_ID,
                    client_secret: process.env.PAYPAL_CLIENT_SECRET,
                    source: 'environment'
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
        try {
            // Check cache first
            const now = Date.now();
            if (!forceRefresh && cachedConfig && (now - lastCacheTime) < CACHE_DURATION) {
                return cachedConfig;
            }

            const settings = await PaymentSettings.getSettings();

            const configs = {
                stripe: {
                    enabled: settings?.stripe?.enabled && !!settings?.stripe?.secretKey,
                    mode: settings?.stripe?.mode || 'test',
                    publishableKey: settings?.stripe?.publishableKey,
                    source: settings?.stripe?.secretKey ? 'database' : 'environment'
                },
                paypal: {
                    enabled: settings?.paypal?.enabled && !!settings?.paypal?.clientId,
                    mode: settings?.paypal?.mode || 'sandbox',
                    source: settings?.paypal?.clientId ? 'database' : 'environment'
                }
            };

            // Update cache
            cachedConfig = configs;
            lastCacheTime = now;

            return configs;
        } catch (error) {
            console.error('Error getting payment configs:', error);

            // Fallback to environment variables
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
    }

    /**
     * Clear cache (call this after updating gateway settings)
     */
    static clearCache() {
        cachedConfig = null;
        lastCacheTime = 0;
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
