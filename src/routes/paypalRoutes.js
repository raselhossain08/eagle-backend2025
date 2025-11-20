const express = require("express");
const router = express.Router();
const {
  createOrder,
  captureOrder,
  getAdminTransactions,
} = require("../controllers/paypalController");
const {
  createContractOrder,
  captureContractOrder,
  createStripePaymentIntent,
  confirmStripePayment,
  completeFreeOrder,
} = require("../controllers/contractPayment.controller");
const { protect, optionalAuth, restrictTo } = require("../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   - name: PayPal
 *     description: PayPal and Stripe payment processing endpoints
 */

/**
 * @swagger
 * /api/paypal/admin/transactions:
 *   get:
 *     summary: Get all PayPal transactions (Admin only)
 *     tags: [PayPal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all transactions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get("/admin/transactions", protect, restrictTo("admin"), getAdminTransactions);

/**
 * @swagger
 * /api/paypal/create-order:
 *   post:
 *     summary: Create PayPal order (Legacy)
 *     tags: [PayPal]
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
 *         description: Order created successfully
 *       400:
 *         description: Bad request
 */
router.post("/create-order", createOrder);

/**
 * @swagger
 * /api/paypal/capture-order/{orderId}:
 *   post:
 *     summary: Capture PayPal order (Legacy)
 *     tags: [PayPal]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: PayPal order ID
 *     responses:
 *       200:
 *         description: Order captured successfully
 *       404:
 *         description: Order not found
 */
router.post("/capture-order/:orderId", captureOrder);

/**
 * @swagger
 * /api/paypal/contracts/create-order:
 *   post:
 *     summary: Create PayPal order for contract payment
 *     tags: [PayPal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Contract order created
 *       400:
 *         description: Invalid request
 */
router.post("/contracts/create-order", optionalAuth, createContractOrder);

/**
 * @swagger
 * /api/paypal/contracts/capture-order/{orderId}:
 *   post:
 *     summary: Capture PayPal order for contract
 *     tags: [PayPal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract payment captured
 *       404:
 *         description: Order not found
 */
router.post("/contracts/capture-order/:orderId", optionalAuth, captureContractOrder);

/**
 * @swagger
 * /api/paypal/contracts/create-payment-intent:
 *   post:
 *     summary: Create Stripe payment intent for contract
 *     tags: [PayPal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment intent created
 *       400:
 *         description: Invalid request
 */
router.post(
  "/contracts/create-payment-intent",
  optionalAuth,
  createStripePaymentIntent
);

/**
 * @swagger
 * /api/paypal/contracts/confirm-payment:
 *   post:
 *     summary: Confirm Stripe payment for contract
 *     tags: [PayPal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *               contractId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       400:
 *         description: Payment confirmation failed
 */
router.post("/contracts/confirm-payment", optionalAuth, confirmStripePayment);

/**
 * @swagger
 * /api/paypal/contracts/complete-free-order:
 *   post:
 *     summary: Complete a free order (100% discount)
 *     tags: [PayPal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractId:
 *                 type: string
 *               subscriptionType:
 *                 type: string
 *               discountCode:
 *                 type: string
 *               discountAmount:
 *                 type: number
 *               productName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Free order completed
 *       400:
 *         description: Invalid request
 */
router.post("/contracts/complete-free-order", optionalAuth, completeFreeOrder);

module.exports = router;
