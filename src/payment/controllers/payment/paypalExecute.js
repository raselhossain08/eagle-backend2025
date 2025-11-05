const { paypal } = require("../../../config/paymentConfig");

exports.executePaypalPayment = (req, res) => {
  const { paymentId, PayerID } = req.query;
  const amount = req.query.amount || "10.00";

  const execute_payment_json = {
    payer_id: PayerID,
    transactions: [
      {
        amount: { currency: "USD", total: amount },
      },
    ],
  };

  paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
    if (error) {
      res.render("error", { error: error.message });
    } else {
      res.render("success", { payment });
    }
  });
};





