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

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Payment processing and management
 */

/**
 * @swagger
 * /api/payment/stripe-payment:
 *   post:
 *     summary: Process Stripe payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment processed
 */
router.post("/stripe-payment", validatePayment, processStripePayment);

/**
 * @swagger
 * /api/payment/paypal-payment:
 *   post:
 *     summary: Process PayPal payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment initiated
 */
router.post("/paypal-payment", validatePayment, processPaypalPayment);

/**
 * @swagger
 * /api/payment/success:
 *   get:
 *     summary: Payment success callback
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Payment executed successfully
 */
router.get("/success", executePaypalPayment);

router.get("/cancel", (req, res) => res.render("cancel"));
router.get("/error", (req, res) => {
  res.render("error", { error: "An error occurred during payment processing" });
});

/**
 * @swagger
 * /api/payment/methods:
 *   get:
 *     summary: Get payment methods
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of payment methods
 *   post:
 *     summary: Create payment method
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Payment method created
 */
router.get("/methods", PaymentController.getPaymentMethods);
router.post("/methods", LegacyPaymentController.createPaymentMethod);

/**
 * @swagger
 * /api/payment/methods/{id}:
 *   put:
 *     summary: Update payment method
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment method updated
 *   delete:
 *     summary: Delete payment method
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment method deleted
 */
router.put("/methods/:id", PaymentController.updatePaymentMethod);
router.delete("/methods/:id", PaymentController.deletePaymentMethod);

/**
 * @swagger
 * /api/payment/failed:
 *   get:
 *     summary: Get failed payments
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: List of failed payments
 */
router.get("/failed", PaymentController.getFailedPayments);

/**
 * @swagger
 * /api/payment/failed/{id}/retry:
 *   post:
 *     summary: Retry failed payment
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment retry initiated
 */
router.post("/failed/:id/retry", PaymentController.retryFailedPayment);

/**
 * @swagger
 * /api/payment/summary:
 *   get:
 *     summary: Get payment summary
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Payment summary data
 */
router.get("/summary", PaymentController.getSummary);

module.exports = router;





