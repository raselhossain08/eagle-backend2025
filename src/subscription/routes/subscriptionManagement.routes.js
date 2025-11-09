/**
 * Subscription Management Routes
 * Admin dashboard subscription management endpoints
 * Maps to frontend subscription.service.ts expectations
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const subscriptionManagementController = require('../controllers/subscriptionManagement.controller');
const subscriptionAnalyticsController = require('../controllers/subscription-analytics.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { createAuditLogger } = require('../middlewares/auditLogger.middleware');
const {
    generalLimiter,
    mutationLimiter,
    criticalLimiter,
    bulkOperationLimiter,
    analyticsLimiter
} = require('../middlewares/rateLimiter.middleware');

// Apply authentication to all routes
router.use(protect);
router.use(restrictTo('admin', 'superAdmin', 'support'));

/**
 * @route   GET /api/subscription/analytics
 * @desc    Get subscription analytics and metrics
 * @access  Admin
 */
router.get('/analytics', analyticsLimiter, subscriptionManagementController.getAnalytics);

/**
 * @route   GET /api/subscription/analytics/mrr
 * @desc    Get Monthly Recurring Revenue metrics
 * @access  Admin
 */
router.get('/analytics/mrr', analyticsLimiter, subscriptionAnalyticsController.getMRRMetrics);

/**
 * @route   GET /api/subscription/analytics/churn
 * @desc    Get churn analytics
 * @access  Admin
 */
router.get('/analytics/churn', analyticsLimiter, subscriptionAnalyticsController.getChurnAnalytics);

/**
 * @route   GET /api/subscription/analytics/growth
 * @desc    Get growth trends
 * @access  Admin
 */
router.get('/analytics/growth', analyticsLimiter, subscriptionAnalyticsController.getGrowthTrends);

/**
 * @route   GET /api/subscription/expiring-soon
 * @desc    Get subscriptions expiring soon
 * @access  Admin
 * @query   days - number of days to look ahead (default: 7)
 */
router.get('/expiring-soon',
    generalLimiter,
    [query('days').optional().isInt({ min: 1, max: 90 }).withMessage('Days must be 1-90')],
    subscriptionManagementController.getExpiringSoon
);

/**
 * @route   GET /api/subscription/due-for-renewal
 * @desc    Get subscriptions due for renewal
 * @access  Admin
 */
router.get('/due-for-renewal', generalLimiter, subscriptionManagementController.getDueForRenewal);

/**
 * @route   GET /api/subscription/activity/recent
 * @desc    Get recent subscription activity
 * @access  Admin
 * @query   limit - number of activities to return (default: 10)
 */
router.get('/activity/recent',
    generalLimiter,
    [query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')],
    subscriptionManagementController.getRecentActivity
);

/**
 * @route   GET /api/subscription/user/:userId
 * @desc    Get user's subscriptions
 * @access  Admin
 */
router.get('/user/:userId',
    generalLimiter,
    [param('userId').isMongoId().withMessage('Invalid user ID')],
    subscriptionManagementController.getUserSubscriptions
);

/**
 * @route   GET /api/subscription/plan/:planId
 * @desc    Get subscriptions for a plan
 * @access  Admin
 */
router.get('/plan/:planId',
    [param('planId').isMongoId().withMessage('Invalid plan ID')],
    subscriptionManagementController.getPlanSubscriptions
);

/**
 * @route   GET /api/subscription
 * @desc    Get all subscriptions with filtering and pagination
 * @access  Admin
 * @query   page, limit, sortBy, sortOrder, status, planType, userId, planId, startDate, endDate
 */
router.get('/', subscriptionManagementController.getSubscriptions);

/**
 * @route   GET /api/subscription/:id
 * @desc    Get single subscription by ID
 * @access  Admin
 */
router.get('/:id',
    [param('id').isMongoId().withMessage('Invalid subscription ID')],
    subscriptionManagementController.getSubscription
);

/**
 * @route   POST /api/subscription
 * @desc    Create new subscription
 * @access  Admin
 */
router.post('/',
    mutationLimiter,
    createAuditLogger('CREATE'),
    [
        body('userId').isMongoId().withMessage('Valid user ID required'),
        body('planId').isMongoId().withMessage('Valid plan ID required'),
        body('billingCycle').isIn(['monthly', 'annual', 'oneTime']).withMessage('Invalid billing cycle'),
        body('price').optional().isNumeric().withMessage('Price must be numeric'),
        body('startDate').optional().isISO8601().withMessage('Invalid start date'),
        body('endDate').optional().isISO8601().withMessage('Invalid end date')
    ],
    subscriptionManagementController.createSubscription
);

/**
 * @route   PUT /api/subscription/:id
 * @desc    Update subscription
 * @access  Admin
 */
router.put('/:id',
    mutationLimiter,
    createAuditLogger('UPDATE'),
    [
        param('id').isMongoId().withMessage('Invalid subscription ID'),
        body('status').optional().isString().withMessage('Status must be string'),
        body('price').optional().isNumeric().withMessage('Price must be numeric'),
        body('billingCycle').optional().isString().withMessage('Billing cycle must be string'),
        body('adminNotes').optional().isString().withMessage('Admin notes must be string'),
        body('endDate').optional().isISO8601().withMessage('Invalid end date')
    ],
    subscriptionManagementController.updateSubscription
);

/**
 * @route   POST /api/subscription/:id/cancel
 * @desc    Cancel subscription
 * @access  Admin
 */
router.post('/:id/cancel',
    criticalLimiter,
    createAuditLogger('CANCEL'),
    [
        param('id').isMongoId().withMessage('Invalid subscription ID'),
        body('reason').notEmpty().withMessage('Cancellation reason is required'),
        body('immediate').optional().isBoolean().withMessage('Immediate must be boolean'),
        body('refund').optional().isBoolean().withMessage('Refund must be boolean')
    ],
    subscriptionManagementController.cancelSubscription
);

/**
 * @route   POST /api/subscription/:id/reactivate
 * @desc    Reactivate cancelled/expired subscription
 * @access  Admin
 */
router.post('/:id/reactivate',
    mutationLimiter,
    createAuditLogger('REACTIVATE'),
    [param('id').isMongoId().withMessage('Invalid subscription ID')],
    subscriptionManagementController.reactivateSubscription
);

/**
 * @route   POST /api/subscription/:id/suspend
 * @desc    Suspend subscription temporarily
 * @access  Admin
 */
router.post('/:id/suspend',
    criticalLimiter,
    createAuditLogger('SUSPEND'),
    [
        param('id').isMongoId().withMessage('Invalid subscription ID'),
        body('reason').notEmpty().withMessage('Suspension reason is required')
    ],
    subscriptionManagementController.suspendSubscription
);

/**
 * @route   POST /api/subscription/:id/resume
 * @desc    Resume suspended subscription
 * @access  Admin
 */
router.post('/:id/resume',
    mutationLimiter,
    createAuditLogger('RESUME'),
    [param('id').isMongoId().withMessage('Invalid subscription ID')],
    subscriptionManagementController.resumeSubscription
);

/**
 * @route   POST /api/subscription/:id/pause
 * @desc    Pause subscription for specified duration
 * @access  Admin
 */
router.post('/:id/pause',
    mutationLimiter,
    createAuditLogger('PAUSE'),
    [
        param('id').isMongoId().withMessage('Invalid subscription ID'),
        body('pauseDuration').isInt({ min: 1, max: 365 }).withMessage('Pause duration must be 1-365 days'),
        body('reason').notEmpty().withMessage('Pause reason is required')
    ],
    subscriptionManagementController.pauseSubscription
);

/**
 * @route   DELETE /api/subscription/:id
 * @desc    Delete subscription permanently
 * @access  Admin (superAdmin only)
 */
router.delete('/:id',
    restrictTo('admin', 'superAdmin'),
    criticalLimiter,
    createAuditLogger('DELETE'),
    [param('id').isMongoId().withMessage('Invalid subscription ID')],
    subscriptionManagementController.deleteSubscription
);

/**
 * @route   POST /api/subscription/:id/change-plan
 * @desc    Change subscription plan
 * @access  Admin
 */
router.post('/:id/change-plan',
    mutationLimiter,
    createAuditLogger('PLAN_CHANGE'),
    [
        param('id').isMongoId().withMessage('Invalid subscription ID'),
        body('newPlanId').isMongoId().withMessage('Valid new plan ID required'),
        body('billingCycle').isIn(['monthly', 'annual', 'oneTime']).withMessage('Invalid billing cycle'),
        body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
        body('prorationMode').optional().isIn(['immediate', 'next_cycle']).withMessage('Invalid proration mode')
    ],
    subscriptionManagementController.changePlan
);

/**
 * @route   POST /api/subscription/:id/cancel-scheduled-change
 * @desc    Cancel scheduled plan change
 * @access  Admin
 */
router.post('/:id/cancel-scheduled-change',
    mutationLimiter,
    createAuditLogger('CANCEL_SCHEDULED_CHANGE'),
    [param('id').isMongoId().withMessage('Invalid subscription ID')],
    subscriptionManagementController.cancelScheduledPlanChange
);

/**
 * @route   POST /api/subscription/:id/renew
 * @desc    Process subscription renewal
 * @access  Admin
 */
router.post('/:id/renew',
    mutationLimiter,
    createAuditLogger('RENEW'),
    [
        param('id').isMongoId().withMessage('Invalid subscription ID'),
        body('paymentId').optional().isString().withMessage('Payment ID must be string')
    ],
    subscriptionManagementController.processRenewal
);

/**
 * @route   POST /api/subscription/create-sample-data
 * @desc    Create sample subscriptions for testing
 * @access  Admin
 */
router.post('/create-sample-data',
    bulkOperationLimiter,
    subscriptionManagementController.createSampleData
);

/**
 * @route   POST /api/subscription/create-sample-audit-logs
 * @desc    Create sample audit logs for testing
 * @access  Admin
 */
router.post('/create-sample-audit-logs',
    bulkOperationLimiter,
    subscriptionManagementController.createSampleAuditLogs
);

// Import WordPress subscription migration routes
const wpMigrationRoutes = require('./wpSubscriptionMigration.routes');
router.use('/', wpMigrationRoutes);

module.exports = router;
