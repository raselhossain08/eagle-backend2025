const { paypal, isPayPalConfigured } = require("../../config/paymentConfig");

exports.processPaypalPayment = (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res
      .status(400)
      .json({ status: "failure", error: "Amount is required." });
  }

  if (!isPayPalConfigured()) {
    return res.status(503).json({
      status: "failure",
      error: "PayPal is not configured. Please configure PayPal in the admin settings."
    });
  }

  const create_payment_json = {
    intent: "sale", // for old REST SDK
    payer: { payment_method: "paypal" },
    redirect_urls: {
      return_url: `${process.env.APP_URL}/paypal/success`,
      cancel_url: `${process.env.APP_URL}/paypal/cancel`,
    },
    transactions: [
      {
        item_list: {
          items: [
            {
              name: "Product",
              sku: "001",
              price: amount,
              currency: "USD",
              quantity: 1,
            },
          ],
        },
        amount: { currency: "USD", total: amount },
        description: "Payment for product/service",
      },
    ],
  };

  paypal.payment.create(create_payment_json, (error, payment) => {
    if (error) {
      console.error("❌ PayPal Create Error:", error.response || error.message);
      return res.status(500).json({
        status: "failure",
        error: error.response
          ? error.response.message
          : error.message || "Unknown error",
      });
    }

    const approvalUrl = payment.links.find(
      (link) => link.rel === "approval_url"
    );

    if (!approvalUrl) {
      return res.status(500).json({
        status: "failure",
        error: "Approval URL not found in PayPal response.",
      });
    }

    res.json({ status: "success", redirect: approvalUrl.href });
  });
};
