const express = require("express");
const router = express.Router();
const {
  processStripePayment,
} = require("../controllers/payment/stripePayment");
const {
  processPaypalPayment,
} = require("../controllers/payment/paypalPayment");
const {
  executePaypalPayment,
} = require("../controllers/payment/paypalExecute");
const validatePayment = require("../../middlewares/validatePayment");
const { PaymentController } = require("../controllers/paymentProcessors.controller");
const LegacyPaymentController = require("../controllers/payment.controller");

router.post("/stripe-payment", validatePayment, processStripePayment);
router.post("/paypal-payment", validatePayment, processPaypalPayment);
router.get("/success", executePaypalPayment);
router.get("/cancel", (req, res) => res.render("cancel"));
router.get("/error", (req, res) => {
  res.render("error", { error: "An error occurred during payment processing" });
});

// Use comprehensive controller for basic payment management
router.get("/methods", PaymentController.getPaymentMethods);
router.get("/failed", PaymentController.getFailedPayments);
router.get("/summary", PaymentController.getSummary);
router.put("/methods/:id", PaymentController.updatePaymentMethod);
router.delete("/methods/:id", PaymentController.deletePaymentMethod);
router.post("/failed/:id/retry", PaymentController.retryFailedPayment);
router.post("/methods", LegacyPaymentController.createPaymentMethod);

module.exports = router;





