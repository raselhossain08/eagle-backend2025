/**
 * Subscription Lifecycle Routes
 * Complete subscription lifecycle management endpoints
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const subscriptionLifecycleController = require('../controllers/subscriptionLifecycle.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Subscription Lifecycle
 *     description: Complete subscription lifecycle management
 */

// Input validation middleware
const validateSubscriptionCreate = [
    body('userId')
        .isMongoId()
        .withMessage('Valid user ID is required'),
    body('planId')
        .isMongoId()
        .withMessage('Valid plan ID is required'),
    body('billingCycle')
        .optional()
        .isIn(['weekly', 'monthly', 'quarterly', 'semiannual', 'annual'])
        .withMessage('Invalid billing cycle'),
    body('paymentData.amount')
        .optional()
        .isNumeric()
        .withMessage('Payment amount must be numeric'),
    body('paymentData.currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be 3 characters')
];

const validateSubscriptionId = [
    param('id')
        .isMongoId()
        .withMessage('Valid subscription ID is required')
];

const validatePlanId = [
    body('newPlanId')
        .isMongoId()
        .withMessage('Valid plan ID is required')
];

const validateCancellation = [
    body('reason')
        .optional()
        .isIn(['voluntary', 'payment_failed', 'chargeback', 'fraud', 'admin_action', 'downgrade', 'upgrade', 'other'])
        .withMessage('Invalid cancellation reason'),
    body('effectiveDate')
        .optional()
        .isISO8601()
        .withMessage('Effective date must be valid ISO date'),
    body('immediate')
        .optional()
        .isBoolean()
        .withMessage('Immediate must be boolean')
];

/**
 * @route   POST /api/v1/subscriptions/lifecycle/create
 * @desc    Create new subscription
 * @access  Protected (Admin/User)
 * @body    { userId, planId, billingCycle?, paymentData?, startImmediately?, trialOverride? }
 */
router.post('/create',
    protect,
    validateSubscriptionCreate,
    subscriptionLifecycleController.createSubscription
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/:id/renew
 * @desc    Process subscription renewal
 * @access  Protected (Admin)
 * @params  id - subscription ID
 * @body    { paymentData? }
 */
router.post('/:id/renew',
    protect,
    restrictTo('admin', 'superAdmin'),
    validateSubscriptionId,
    subscriptionLifecycleController.renewSubscription
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/:id/cancel
 * @desc    Cancel subscription
 * @access  Protected (Admin/User - own subscription)
 * @params  id - subscription ID
 * @body    { reason?, note?, effectiveDate?, immediate? }
 */
router.post('/:id/cancel',
    protect,
    validateSubscriptionId,
    validateCancellation,
    subscriptionLifecycleController.cancelSubscription
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/:id/upgrade
 * @desc    Upgrade subscription to higher plan
 * @access  Protected (Admin/User - own subscription)
 * @params  id - subscription ID
 * @body    { newPlanId, immediate?, paymentData?, reason? }
 */
router.post('/:id/upgrade',
    protect,
    validateSubscriptionId,
    validatePlanId,
    [
        body('immediate')
            .optional()
            .isBoolean()
            .withMessage('Immediate must be boolean'),
        body('reason')
            .optional()
            .isLength({ min: 1, max: 500 })
            .withMessage('Reason must be 1-500 characters')
    ],
    subscriptionLifecycleController.upgradeSubscription
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/:id/downgrade
 * @desc    Downgrade subscription to lower plan
 * @access  Protected (Admin/User - own subscription)
 * @params  id - subscription ID
 * @body    { newPlanId, immediate?, reason? }
 */
router.post('/:id/downgrade',
    protect,
    validateSubscriptionId,
    validatePlanId,
    [
        body('immediate')
            .optional()
            .isBoolean()
            .withMessage('Immediate must be boolean'),
        body('reason')
            .optional()
            .isLength({ min: 1, max: 500 })
            .withMessage('Reason must be 1-500 characters')
    ],
    subscriptionLifecycleController.downgradeSubscription
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/:id/pause
 * @desc    Pause subscription
 * @access  Protected (Admin/User - own subscription)
 * @params  id - subscription ID
 * @body    { reason?, pausedUntil? }
 */
router.post('/:id/pause',
    protect,
    validateSubscriptionId,
    [
        body('reason')
            .optional()
            .isLength({ min: 1, max: 500 })
            .withMessage('Reason must be 1-500 characters'),
        body('pausedUntil')
            .optional()
            .isISO8601()
            .withMessage('Paused until date must be valid ISO date')
    ],
    subscriptionLifecycleController.pauseSubscription
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/:id/resume
 * @desc    Resume paused subscription
 * @access  Protected (Admin/User - own subscription)
 * @params  id - subscription ID
 */
router.post('/:id/resume',
    protect,
    validateSubscriptionId,
    subscriptionLifecycleController.resumeSubscription
);

/**
 * @route   GET /api/v1/subscriptions/lifecycle/:id/details
 * @desc    Get detailed subscription information with lifecycle options
 * @access  Protected (Admin/User - own subscription)
 * @params  id - subscription ID
 */
router.get('/:id/details',
    protect,
    validateSubscriptionId,
    subscriptionLifecycleController.getSubscriptionDetails
);

/**
 * @route   GET /api/v1/subscriptions/lifecycle/due-for-renewal
 * @desc    Get subscriptions due for renewal
 * @access  Protected (Admin)
 * @query   lookAheadDays - number of days to look ahead (default: 3)
 */
router.get('/due-for-renewal',
    protect,
    restrictTo('admin', 'superAdmin'),
    [
        query('lookAheadDays')
            .optional()
            .isInt({ min: 1, max: 30 })
            .withMessage('Look ahead days must be 1-30')
    ],
    subscriptionLifecycleController.getSubscriptionsDueForRenewal
);

/**
 * @route   POST /api/v1/subscriptions/lifecycle/bulk
 * @desc    Bulk subscription operations (cancel, pause, resume)
 * @access  Protected (Admin)
 * @body    { operation, subscriptionIds, data? }
 */
router.post('/bulk',
    protect,
    restrictTo('admin', 'superAdmin'),
    [
        body('operation')
            .isIn(['cancel', 'pause', 'resume'])
            .withMessage('Operation must be cancel, pause, or resume'),
        body('subscriptionIds')
            .isArray({ min: 1 })
            .withMessage('Subscription IDs array is required'),
        body('subscriptionIds.*')
            .isMongoId()
            .withMessage('Each subscription ID must be valid')
    ],
    subscriptionLifecycleController.bulkSubscriptionOperations
);

/**
 * @route   GET /api/v1/subscriptions/lifecycle/analytics
 * @desc    Get subscription lifecycle analytics and metrics
 * @access  Protected (Admin)
 * @query   dateFrom, dateTo - date range for analytics
 */
router.get('/analytics',
    protect,
    restrictTo('admin', 'superAdmin'),
    [
        query('dateFrom')
            .optional()
            .isISO8601()
            .withMessage('Date from must be valid ISO date'),
        query('dateTo')
            .optional()
            .isISO8601()
            .withMessage('Date to must be valid ISO date')
    ],
    subscriptionLifecycleController.getSubscriptionLifecycleAnalytics
);

/**
 * @route   GET /api/v1/subscriptions/lifecycle/health-check
 * @desc    Health check for subscription lifecycle service
 * @access  Public
 */
router.get('/health-check', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Subscription lifecycle service is operational',
        timestamp: new Date().toISOString(),
        features: {
            create: '✅ Available',
            renew: '✅ Available',
            cancel: '✅ Available',
            upgrade: '✅ Available',
            downgrade: '✅ Available',
            pause: '✅ Available',
            resume: '✅ Available',
            analytics: '✅ Available',
            bulkOperations: '✅ Available'
        }
    });
});

module.exports = router;