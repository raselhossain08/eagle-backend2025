const paypal = require("paypal-rest-sdk");
const stripe = require("stripe");

const paypalConfig = {
  mode: process.env.PAYPAL_MODE || "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
};

// Only configure PayPal if credentials are available
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  paypal.configure(paypalConfig);
}

// Only initialize Stripe if API key is available
let stripeConfig = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);
}

module.exports = { paypal, stripeConfig };
