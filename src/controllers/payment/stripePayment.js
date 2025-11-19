const { getStripeConfig } = require("../../config/paymentConfig");


exports.processStripePayment = async (req, res) => {
  try {
    const { amount, stripeToken, email, name } = req.body;

    const stripeConfig = getStripeConfig();

    if (!stripeConfig) {
      return res.status(503).json({
        status: "failure",
        error: "Stripe is not configured. Please configure Stripe in the admin settings."
      });
    }

    const customer = await stripeConfig.customers.create({
      email,
      name,
      source: stripeToken,
    });

    const charge = await stripeConfig.charges.create({
      amount: amount * 100, // Convert to cents
      currency: "usd",
      customer: customer.id,
      description: "Payment for product/service",
    });

    res.json({ status: "success", charge });
  } catch (error) {
    res.status(400).json({ status: "failure", error: error.message });
  }
};
