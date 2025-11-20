const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Webhooks
 *     description: Webhooks API endpoints
 */
const {
    getAllWebhooks,
    getWebhook,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    regenerateSecret,
    testWebhook,
    getWebhookDeliveries
} = require('../controllers/webhookController');
const paymentWebhookController = require('../controllers/paymentWebhook.controller');
const stripeWebhookController = require('../controllers/stripeWebhook.controller');
const { protect, restrictTo, adminOnly } = require('../middlewares/auth.middleware');

// ========================================
// PAYMENT WEBHOOK ROUTES (Public - No Auth Required)
// These must be BEFORE protect middleware
// ========================================

// Stripe webhook handler - Enhanced with recurring subscription support
router.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhookController.handleStripeWebhook);

// PayPal webhook handler  
router.post('/paypal', express.json(), paymentWebhookController.handlePayPalWebhook);

// All routes below require authentication and admin privileges
router.use(protect);
router.use(adminOnly);

// Webhook CRUD routes
router.route('/')
    .get(getAllWebhooks)
    .post(createWebhook);

router.route('/:id')
    .get(getWebhook)
    .put(updateWebhook)
    .delete(deleteWebhook);

// Webhook actions
router.post('/:id/regenerate-secret', regenerateSecret);
router.post('/:id/test', testWebhook);
router.get('/:id/deliveries', getWebhookDeliveries);

// ========================================
// ADMIN TRANSACTION ROUTES (Auth Required)
// ========================================

// Manual transaction creation (Admin only)
router.post('/admin/transactions/manual', paymentWebhookController.createManualTransaction);

module.exports = router;
