const express = require('express');
const { PaymentController, validationRules } = require('../controllers/paymentProcessors.controller');
const { protect: authenticateToken } = require('../../middlewares/auth.middleware');
const { restrictTo: checkPermission } = require('../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Payment Processors
 *     description: Payment processor integration (Stripe, Braintree, Paddle)
 */

/**
 * @swagger
 * /api/payment-processors/customers:
 *   post:
 *     summary: Create customer in payment processor
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created
 */
router.post('/customers',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createCustomer,
  PaymentController.createCustomer
);

/**
 * @swagger
 * /api/payment-processors/customers/{customerId}/payment-methods:
 *   post:
 *     summary: Create payment method for customer
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Payment method created
 */
router.post('/customers/:customerId/payment-methods',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createPaymentMethod,
  PaymentController.createPaymentMethod
);

/**
 * @swagger
 * /api/payment-processors/subscriptions:
 *   post:
 *     summary: Create subscription in payment processor
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Subscription created
 */
router.post('/subscriptions',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createSubscription,
  PaymentController.createSubscription
);

/**
 * @swagger
 * /api/payment-processors/subscriptions/{subscriptionId}:
 *   delete:
 *     summary: Cancel subscription
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */
router.delete('/subscriptions/:subscriptionId',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.cancelSubscription,
  PaymentController.cancelSubscription
);

/**
 * @swagger
 * /api/payment-processors/invoices:
 *   post:
 *     summary: Create invoice in payment processor
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Invoice created
 */
router.post('/invoices',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createInvoice,
  PaymentController.createInvoice
);

/**
 * @swagger
 * /api/payment-processors/payments:
 *   post:
 *     summary: Process payment
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment processed
 */
router.post('/payments',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.processPayment,
  PaymentController.processPayment
);

/**
 * @swagger
 * /api/payment-processors/payments/{paymentId}/refund:
 *   post:
 *     summary: Refund payment
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment refunded
 */
router.post('/payments/:paymentId/refund',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.refundPayment,
  PaymentController.refundPayment
);

/**
 * @swagger
 * /api/payment-processors/providers:
 *   get:
 *     summary: Get all payment providers (Admin)
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of providers
 */
router.get('/providers',
  authenticateToken,
  checkPermission('payment:admin'),
  PaymentController.getAllProviders
);

/**
 * @swagger
 * /api/payment-processors/providers/{provider}/status:
 *   get:
 *     summary: Get provider status (Admin)
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider status
 */
router.get('/providers/:provider/status',
  authenticateToken,
  checkPermission('payment:admin'),
  PaymentController.getProviderStatus
);

/**
 * @swagger
 * /api/payment-processors/providers/{provider}/test:
 *   post:
 *     summary: Test provider connection (Admin)
 *     tags: [Payment Processors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Test result
 */
router.post('/providers/:provider/test',
  authenticateToken,
  checkPermission('payment:admin'),
  PaymentController.testProvider
);

/**
 * @swagger
 * /api/payment-processors/webhooks/stripe:
 *   post:
 *     summary: Stripe webhook handler
 *     tags: [Payment Processors]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  PaymentController.handleStripeWebhook
);

/**
 * @swagger
 * /api/payment-processors/webhooks/braintree:
 *   post:
 *     summary: Braintree webhook handler
 *     tags: [Payment Processors]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhooks/braintree',
  PaymentController.handleBraintreeWebhook
);

/**
 * @swagger
 * /api/payment-processors/webhooks/paddle:
 *   post:
 *     summary: Paddle webhook handler
 *     tags: [Payment Processors]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhooks/paddle',
  PaymentController.handlePaddleWebhook
);

module.exports = router;





