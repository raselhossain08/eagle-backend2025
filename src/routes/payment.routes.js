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
const validatePayment = require("../middlewares/validatePayment");
// Legacy / compatibility controllers
const { PaymentController } = require("../payment/controllers/paymentProcessors.controller");

/**
 * @swagger
 * tags:
 *   - name: Payment (Legacy)
 *     description: Legacy payment processing endpoints
 */

router.post("/stripe-payment", validatePayment, processStripePayment);
router.post("/paypal-payment", validatePayment, processPaypalPayment);
router.get("/success", executePaypalPayment);
router.get("/cancel", (req, res) => res.render("cancel"));
router.get("/error", (req, res) => {
  res.render("error", { error: "An error occurred during payment processing" });
});

// Legacy endpoints (kept for backward compatibility)
router.get("/summary", PaymentController.getSummary);
router.get("/methods", PaymentController.getPaymentMethods);
router.get("/failed", PaymentController.getFailedPayments);
router.put("/methods/:id", PaymentController.updatePaymentMethod);
router.delete("/methods/:id", PaymentController.deletePaymentMethod);
router.post("/failed/:id/retry", PaymentController.retryFailedPayment);

// Payment processors endpoints
router.get("/processors/providers", PaymentController.getAllProviders);
router.get("/processors/:provider/status", PaymentController.getProviderStatus);
router.post("/processors/:provider/test", PaymentController.testProvider);

module.exports = router;
