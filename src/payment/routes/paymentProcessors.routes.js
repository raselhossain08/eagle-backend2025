const express = require('express');
const { PaymentController, validationRules } = require('../controllers/paymentProcessors.controller');
const { protect: authenticateToken } = require('../../middlewares/auth.middleware');
const { restrictTo: checkPermission } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Payment operations routes (protected)
router.post('/customers',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createCustomer,
  PaymentController.createCustomer
);

router.post('/customers/:customerId/payment-methods',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createPaymentMethod,
  PaymentController.createPaymentMethod
);

router.post('/subscriptions',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createSubscription,
  PaymentController.createSubscription
);

router.delete('/subscriptions/:subscriptionId',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.cancelSubscription,
  PaymentController.cancelSubscription
);

router.post('/invoices',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.createInvoice,
  PaymentController.createInvoice
);

router.post('/payments',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.processPayment,
  PaymentController.processPayment
);

router.post('/payments/:paymentId/refund',
  authenticateToken,
  checkPermission('payment:write'),
  validationRules.refundPayment,
  PaymentController.refundPayment
);

// Provider management routes (admin only)
router.get('/providers',
  authenticateToken,
  checkPermission('payment:admin'),
  PaymentController.getAllProviders
);

router.get('/providers/:provider/status',
  authenticateToken,
  checkPermission('payment:admin'),
  PaymentController.getProviderStatus
);

router.post('/providers/:provider/test',
  authenticateToken,
  checkPermission('payment:admin'),
  PaymentController.testProvider
);

// Webhook endpoints (public, but verified internally)
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  PaymentController.handleStripeWebhook
);

router.post('/webhooks/braintree',
  PaymentController.handleBraintreeWebhook
);

router.post('/webhooks/paddle',
  PaymentController.handlePaddleWebhook
);

module.exports = router;





