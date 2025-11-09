const express = require('express');
const router = express.Router();
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
const { protect, restrictTo, adminOnly } = require('../middlewares/auth.middleware');

// All routes require authentication and admin privileges
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
// PAYMENT WEBHOOK ROUTES (Public - No Auth Required)
// ========================================

// Stripe webhook handler
router.post('/stripe', express.raw({ type: 'application/json' }), paymentWebhookController.handleStripeWebhook);

// PayPal webhook handler  
router.post('/paypal', express.json(), paymentWebhookController.handlePayPalWebhook);

// ========================================
// ADMIN TRANSACTION ROUTES (Auth Required)
// ========================================

// Manual transaction creation (Admin only)
router.post('/admin/transactions/manual', protect, adminOnly, paymentWebhookController.createManualTransaction);

module.exports = router;
