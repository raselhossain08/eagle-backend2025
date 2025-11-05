const validatePayment = (req, res, next) => {
  const { amount, stripeToken, email, name } = req.body;

  if (!amount || amount <= 0) {
    return res
      .status(400)
      .json({
        status: "failure",
        error: "Amount is required and must be greater than 0",
      });
  }

  if (req.path.includes("stripe") && (!stripeToken || !email || !name)) {
    return res
      .status(400)
      .json({
        status: "failure",
        error: "Stripe payment requires token, email, and name",
      });
  }

  if (req.path.includes("paypal") && !amount) {
    return res
      .status(400)
      .json({ status: "failure", error: "Paypal payment requires amount" });
  }

  next();
};

module.exports = validatePayment;
