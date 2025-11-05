const paypal = require("paypal-rest-sdk");
const stripe = require("stripe");

const paypalConfig = {
  mode: process.env.PAYPAL_MODE || "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
};

paypal.configure(paypalConfig);

const stripeConfig = stripe(process.env.STRIPE_SECRET_KEY);

module.exports = { paypal, stripeConfig };
