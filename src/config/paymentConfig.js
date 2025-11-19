const paypal = require("paypal-rest-sdk");
const stripe = require("stripe");
const PaymentSettings = require('../models/PaymentSettings');

let stripeConfig = null;
let paypalConfigured = false;

/**
 * Initialize payment gateways with database settings or environment variables
 */
async function initializePaymentGateways() {
  try {
    // Try to get settings from database first
    const settings = await PaymentSettings.getSettings();

    // Configure PayPal
    if (settings?.paypal?.clientId && settings?.paypal?.clientSecret) {
      const paypalConfig = {
        mode: settings.paypal.mode || "sandbox",
        client_id: settings.paypal.clientId,
        client_secret: settings.paypal.clientSecret,
      };
      paypal.configure(paypalConfig);
      paypalConfigured = true;
      console.log(`✅ PayPal configured from database (${settings.paypal.mode} mode)`);
    } else if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      const paypalConfig = {
        mode: process.env.PAYPAL_MODE || "sandbox",
        client_id: process.env.PAYPAL_CLIENT_ID,
        client_secret: process.env.PAYPAL_CLIENT_SECRET,
      };
      paypal.configure(paypalConfig);
      paypalConfigured = true;
      console.log(`✅ PayPal configured from environment variables`);
    } else {
      console.warn('⚠️ PayPal not configured - no credentials found');
    }

    // Configure Stripe
    if (settings?.stripe?.secretKey) {
      stripeConfig = stripe(settings.stripe.secretKey);
      console.log(`✅ Stripe configured from database (${settings.stripe.mode} mode)`);
    } else if (process.env.STRIPE_SECRET_KEY) {
      stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);
      console.log(`✅ Stripe configured from environment variables`);
    } else {
      console.warn('⚠️ Stripe not configured - no credentials found');
    }
  } catch (error) {
    console.error('Error initializing payment gateways:', error);
    // Fallback to environment variables
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      const paypalConfig = {
        mode: process.env.PAYPAL_MODE || "sandbox",
        client_id: process.env.PAYPAL_CLIENT_ID,
        client_secret: process.env.PAYPAL_CLIENT_SECRET,
      };
      paypal.configure(paypalConfig);
      paypalConfigured = true;
    }
    if (process.env.STRIPE_SECRET_KEY) {
      stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);
    }
  }
}

// Function to reconfigure payment gateways (call after settings update)
async function reconfigurePaymentGateways() {
  console.log('🔄 Reconfiguring payment gateways...');
  await initializePaymentGateways();
}

module.exports = {
  paypal,
  stripeConfig,
  initializePaymentGateways,
  reconfigurePaymentGateways,
  getStripeConfig: () => stripeConfig,
  isPayPalConfigured: () => paypalConfigured
};
