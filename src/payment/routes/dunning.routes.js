const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protect } = require('../../middlewares/auth.middleware');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');

/**
 * @swagger
 * tags:
 *   name: Dunning Management
 *   description: Automated payment recovery and failed payment management
 */

const dunningController = require('../controllers/dunning.controller');

// Apply authentication to all routes
router.use(protect);

// ===============================
// DUNNING CAMPAIGNS
// ===============================

/**
 * @route GET /v1/dunning/campaigns
 * @desc List all dunning campaigns with filtering
 * @access Admin, Finance
 */
router.get('/campaigns',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('status').optional().isIn(['active', 'paused', 'archived', 'all']).withMessage('Invalid status'),
    query('type').optional().isIn(['email', 'sms', 'webhook', 'all']).withMessage('Invalid type'),
    query('includeMetrics').optional().isBoolean().withMessage('Include metrics must be boolean')
  ],
  dunningController.getCampaigns
);

/**
 * @route POST /v1/dunning/campaigns
 * @desc Create new dunning campaign
 * @access Admin, Finance
 */
router.post('/campaigns',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE']),
  [
    body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Campaign name must be 3-100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 characters'),
    body('type').isIn(['email', 'sms', 'webhook', 'multi']).withMessage('Invalid campaign type'),
    body('retrySchedule').isArray({ min: 1, max: 10 }).withMessage('Retry schedule must have 1-10 entries')
  ],
  dunningController.createCampaign
);

/**
 * @route GET /v1/dunning/campaigns/:id
 * @desc Get dunning campaign details
 * @access Admin, Finance
 */
router.get('/campaigns/:id',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE']),
  [
    param('id').isMongoId().withMessage('Invalid campaign ID')
  ],
  dunningController.getCampaignById
);

/**
 * @route PUT /v1/dunning/campaigns/:id
 * @desc Update dunning campaign
 * @access Admin, Finance
 */
router.put('/campaigns/:id',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE']),
  [
    param('id').isMongoId().withMessage('Invalid campaign ID')
  ],
  dunningController.updateCampaign
);

/**
 * @route POST /v1/dunning/process
 * @desc Process dunning campaigns (automated execution)
 * @access Admin, System
 */
router.post('/process',
  rbacMiddleware.checkRole(['ADMIN', 'SYSTEM']),
  [
    body('campaignId').optional().isMongoId().withMessage('Invalid campaign ID'),
    body('dryRun').optional().isBoolean().withMessage('Dry run must be boolean')
  ],
  dunningController.processDunning
);

/**
 * @route GET /v1/dunning/analytics
 * @desc Get dunning analytics overview
 * @access Admin, Finance, Support
 */
router.get('/analytics',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE', 'SUPPORT']),
  [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    query('campaignId').optional().isMongoId().withMessage('Invalid campaign ID')
  ],
  dunningController.getAnalyticsOverview
);

/**
 * @route GET /v1/dunning/failed-payments
 * @desc List failed payments with recovery status
 * @access Admin, Finance, Support
 */
router.get('/failed-payments',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE', 'SUPPORT']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('status').optional().isIn(['failed', 'retrying', 'recovered', 'abandoned', 'all']).withMessage('Invalid status'),
    query('includeRecoveryData').optional().isBoolean().withMessage('Include recovery data must be boolean')
  ],
  dunningController.getFailedPayments
);

/**
 * @route GET /v1/dunning/failed-payments/:id
 * @desc Get failed payment details with recovery timeline
 * @access Admin, Finance, Support
 */
router.get('/failed-payments/:id',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE', 'SUPPORT']),
  [
    param('id').isMongoId().withMessage('Invalid failed payment ID')
  ],
  dunningController.getFailedPaymentById
);

/**
 * @route POST /v1/dunning/failed-payments/:id/retry
 * @desc Manually retry failed payment
 * @access Admin, Finance, Support
 */
router.post('/failed-payments/:id/retry',
  rbacMiddleware.checkRole(['ADMIN', 'FINANCE', 'SUPPORT']),
  [
    param('id').isMongoId().withMessage('Invalid failed payment ID'),
    body('useNewPaymentMethod').optional().isBoolean().withMessage('Use new payment method must be boolean'),
    body('paymentMethodId').optional().isString().withMessage('Payment method ID must be string')
  ],
  dunningController.retryFailedPayment
);

module.exports = router;





