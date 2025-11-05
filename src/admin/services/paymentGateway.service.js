const SystemSettings = require('../models/systemSettings.model');
const crypto = require('crypto');

// Encryption helper (basic implementation - you should use a proper encryption library in production)
const ENCRYPTION_KEY = process.env.GATEWAY_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

class PaymentGatewayService {
    /**
     * Encrypt sensitive data
     */
    static encrypt(text) {
        if (!text) return null;
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    /**
     * Decrypt sensitive data
     */
    static decrypt(text) {
        if (!text) return null;
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    /**
     * Get payment gateway settings (decrypted)
     */
    static async getGatewaySettings(gateway = null) {
        const settings = await SystemSettings.findOne()
            .select('+configuration.paymentGateways.stripe.publishableKey')
            .select('+configuration.paymentGateways.stripe.secretKey')
            .select('+configuration.paymentGateways.stripe.webhookSecret')
            .select('+configuration.paymentGateways.paypal.clientId')
            .select('+configuration.paymentGateways.paypal.clientSecret')
            .select('+configuration.paymentGateways.paypal.webhookId');

        if (!settings) {
            throw new Error('System settings not found');
        }

        const gateways = settings.configuration.paymentGateways;

        // Decrypt all credentials
        const decryptedGateways = {
            stripe: {
                enabled: gateways.stripe.enabled,
                mode: gateways.stripe.mode,
                publishableKey: gateways.stripe.publishableKey,
                secretKey: gateways.stripe.secretKey ? this.decrypt(gateways.stripe.secretKey) : null,
                webhookSecret: gateways.stripe.webhookSecret ? this.decrypt(gateways.stripe.webhookSecret) : null
            },
            paypal: {
                enabled: gateways.paypal.enabled,
                mode: gateways.paypal.mode,
                clientId: gateways.paypal.clientId,
                clientSecret: gateways.paypal.clientSecret ? this.decrypt(gateways.paypal.clientSecret) : null,
                webhookId: gateways.paypal.webhookId
            }
        };

        // Return specific gateway or all
        return gateway ? decryptedGateways[gateway] : decryptedGateways;
    }

    /**
     * Get Stripe configuration
     */
    static async getStripeConfig() {
        const settings = await this.getGatewaySettings('stripe');

        // Fallback to environment variables if not configured in database
        if (!settings.enabled || !settings.secretKey) {
            return {
                enabled: !!process.env.STRIPE_SECRET_KEY,
                mode: process.env.STRIPE_MODE || 'test',
                publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
                secretKey: process.env.STRIPE_SECRET_KEY,
                webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                source: 'environment'
            };
        }

        return {
            ...settings,
            source: 'database'
        };
    }

    /**
     * Get PayPal configuration
     */
    static async getPayPalConfig() {
        const settings = await this.getGatewaySettings('paypal');

        // Fallback to environment variables if not configured in database
        if (!settings.enabled || !settings.clientId) {
            return {
                enabled: !!process.env.PAYPAL_CLIENT_ID,
                mode: process.env.PAYPAL_MODE || 'sandbox',
                clientId: process.env.PAYPAL_CLIENT_ID,
                clientSecret: process.env.PAYPAL_CLIENT_SECRET,
                webhookId: process.env.PAYPAL_WEBHOOK_ID,
                source: 'environment'
            };
        }

        return {
            ...settings,
            source: 'database'
        };
    }

    /**
     * Update Stripe settings
     */
    static async updateStripeSettings(data) {
        const settings = await SystemSettings.findOne();
        if (!settings) {
            throw new Error('System settings not found');
        }

        const updateData = {
            'configuration.paymentGateways.stripe.enabled': data.enabled || false,
            'configuration.paymentGateways.stripe.mode': data.mode || 'test',
        };

        if (data.publishableKey) {
            updateData['configuration.paymentGateways.stripe.publishableKey'] = data.publishableKey;
        }

        if (data.secretKey) {
            updateData['configuration.paymentGateways.stripe.secretKey'] = this.encrypt(data.secretKey);
        }

        if (data.webhookSecret) {
            updateData['configuration.paymentGateways.stripe.webhookSecret'] = this.encrypt(data.webhookSecret);
        }

        await SystemSettings.findByIdAndUpdate(settings._id, { $set: updateData }, { new: true });

        return {
            success: true,
            message: 'Stripe settings updated successfully',
            enabled: data.enabled || false,
            mode: data.mode || 'test'
        };
    }

    /**
     * Update PayPal settings
     */
    static async updatePayPalSettings(data) {
        const settings = await SystemSettings.findOne();
        if (!settings) {
            throw new Error('System settings not found');
        }

        const updateData = {
            'configuration.paymentGateways.paypal.enabled': data.enabled || false,
            'configuration.paymentGateways.paypal.mode': data.mode || 'sandbox',
        };

        if (data.clientId) {
            updateData['configuration.paymentGateways.paypal.clientId'] = data.clientId;
        }

        if (data.clientSecret) {
            updateData['configuration.paymentGateways.paypal.clientSecret'] = this.encrypt(data.clientSecret);
        }

        if (data.webhookId) {
            updateData['configuration.paymentGateways.paypal.webhookId'] = data.webhookId;
        }

        await SystemSettings.findByIdAndUpdate(settings._id, { $set: updateData }, { new: true });

        return {
            success: true,
            message: 'PayPal settings updated successfully',
            enabled: data.enabled || false,
            mode: data.mode || 'sandbox'
        };
    }

    /**
     * Test Stripe connection
     */
    static async testStripeConnection(secretKey = null) {
        try {
            const stripe = require('stripe');
            const key = secretKey || (await this.getStripeConfig()).secretKey;

            if (!key) {
                throw new Error('Stripe secret key not configured');
            }

            const stripeClient = stripe(key);
            const balance = await stripeClient.balance.retrieve();

            return {
                success: true,
                message: 'Stripe connection successful',
                balance: balance.available[0]
            };
        } catch (error) {
            return {
                success: false,
                message: `Stripe connection failed: ${error.message}`
            };
        }
    }

    /**
     * Test PayPal connection
     */
    static async testPayPalConnection(clientId = null, clientSecret = null) {
        try {
            const config = await this.getPayPalConfig();
            const id = clientId || config.clientId;
            const secret = clientSecret || config.clientSecret;

            if (!id || !secret) {
                throw new Error('PayPal credentials not configured');
            }

            const auth = Buffer.from(`${id}:${secret}`).toString('base64');
            const response = await fetch(
                `https://api${config.mode === 'sandbox' ? '-m.sandbox' : ''}.paypal.com/v1/oauth2/token`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'grant_type=client_credentials'
                }
            );

            if (!response.ok) {
                throw new Error('PayPal authentication failed');
            }

            return {
                success: true,
                message: 'PayPal connection successful',
                mode: config.mode
            };
        } catch (error) {
            return {
                success: false,
                message: `PayPal connection failed: ${error.message}`
            };
        }
    }

    /**
     * Get gateway status (for admin dashboard)
     */
    static async getGatewayStatus() {
        const stripe = await this.getStripeConfig();
        const paypal = await this.getPayPalConfig();

        return {
            stripe: {
                enabled: stripe.enabled,
                mode: stripe.mode,
                configured: !!stripe.secretKey,
                source: stripe.source
            },
            paypal: {
                enabled: paypal.enabled,
                mode: paypal.mode,
                configured: !!paypal.clientId && !!paypal.clientSecret,
                source: paypal.source
            }
        };
    }
}

module.exports = PaymentGatewayService;
