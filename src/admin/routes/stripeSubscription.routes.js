const express = require('express');
const router = express.Router();
const stripeSubscriptionController = require('../controllers/stripeSubscription.controller');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');
const RBACMiddleware = require('../middlewares/rbac.middleware');

/**
 * @swagger
 * tags:
 *   name: Admin Stripe Subscriptions
 *   description: Admin dashboard endpoints for managing Stripe subscriptions
 */

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

// Apply RBAC middleware for admin-only access
router.use(RBACMiddleware.checkRole(['admin', 'super_admin']));

/**
 * @route   GET /api/admin/stripe/stats
 * @desc    Get Stripe subscription statistics
 * @access  Admin
 */
router.get('/stats', stripeSubscriptionController.getStripeStats);

/**
 * @route   GET /api/admin/stripe/subscriptions
 * @desc    Get all Stripe subscriptions with filters
 * @access  Admin
 */
router.get('/subscriptions', stripeSubscriptionController.getAllStripeSubscriptions);

/**
 * @route   GET /api/admin/stripe/subscriptions/:id
 * @desc    Get single Stripe subscription details
 * @access  Admin
 */
router.get('/subscriptions/:id', stripeSubscriptionController.getStripeSubscription);

/**
 * @route   POST /api/admin/stripe/subscriptions/:id/sync
 * @desc    Sync subscription with Stripe
 * @access  Admin
 */
router.post('/subscriptions/:id/sync', stripeSubscriptionController.syncSubscription);

/**
 * @route   POST /api/admin/stripe/subscriptions/:id/cancel
 * @desc    Cancel Stripe subscription
 * @access  Admin
 */
router.post('/subscriptions/:id/cancel', stripeSubscriptionController.cancelSubscription);

/**
 * @route   POST /api/admin/stripe/subscriptions/:id/resume
 * @desc    Resume/Reactivate Stripe subscription
 * @access  Admin
 */
router.post('/subscriptions/:id/resume', stripeSubscriptionController.resumeSubscription);

/**
 * @route   POST /api/admin/stripe/subscriptions/:id/refund
 * @desc    Refund last payment of subscription
 * @access  Admin
 */
router.post('/subscriptions/:id/refund', stripeSubscriptionController.refundLastPayment);

module.exports = router;
