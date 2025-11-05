const express = require('express');
const router = express.Router();
const PaymentGatewayController = require('../controllers/paymentGateway.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const RBACMiddleware = require('../middlewares/rbac.middleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply RBAC middleware for admin-only access
router.use(RBACMiddleware.checkRole(['admin', 'super_admin']));

/**
 * @route   GET /api/admin/payment-gateways/status
 * @desc    Get status of all payment gateways
 * @access  Admin
 */
router.get('/status', PaymentGatewayController.getGatewayStatus);

/**
 * Stripe Routes
 */
router.get('/stripe', PaymentGatewayController.getStripeConfig);
router.put('/stripe', PaymentGatewayController.updateStripeConfig);
router.post('/stripe/test', PaymentGatewayController.testStripeConnection);

/**
 * PayPal Routes
 */
router.get('/paypal', PaymentGatewayController.getPayPalConfig);
router.put('/paypal', PaymentGatewayController.updatePayPalConfig);
router.post('/paypal/test', PaymentGatewayController.testPayPalConnection);

module.exports = router;
