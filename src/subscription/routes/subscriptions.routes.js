const express = require('express');
const { body, query, param } = require('express-validator');
const subscriptionController = require('../controllers/subscription.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Validation middleware
const validateSubscriptionUpdate = [
  body('newPlanId').isMongoId().withMessage('Valid new plan ID is required'),
  body('changeType').optional().isIn(['immediate', 'end_of_period']).withMessage('Invalid change type'),
  body('prorationBehavior').optional().isIn(['create_prorations', 'none']).withMessage('Invalid proration behavior')
];

const validateSubscriptionCancel = [
  body('reason').isString().isLength({ min: 1, max: 200 }).withMessage('Cancellation reason is required (max 200 characters)'),
  body('effectiveDate').optional().isIn(['immediately', 'end_of_period']).withMessage('Invalid effective date'),
  body('offerCode').optional().isString().isLength({ max: 50 }).withMessage('Offer code must be max 50 characters')
];

const validateMongoId = [
  param('id').isMongoId().withMessage('Invalid subscription ID format')
];

// Routes

/**
 * @route   PATCH /api/v1/subscriptions/:id
 * @desc    Update subscription (upgrade/downgrade)
 * @access  Admin
 */
router.patch('/:id',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  validateSubscriptionUpdate,
  subscriptionController.updateSubscription
);

/**
 * @route   POST /api/v1/subscriptions/:id/pause
 * @desc    Pause subscription
 * @access  Admin
 */
router.post('/:id/pause',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  body('reason').optional().isString().isLength({ max: 200 }).withMessage('Reason must be max 200 characters'),
  subscriptionController.pauseSubscription
);

/**
 * @route   POST /api/v1/subscriptions/:id/resume
 * @desc    Resume subscription
 * @access  Admin
 */
router.post('/:id/resume',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  subscriptionController.resumeSubscription
);

/**
 * @route   POST /api/v1/subscriptions/:id/cancel
 * @desc    Cancel subscription
 * @access  Admin
 */
router.post('/:id/cancel',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  validateSubscriptionCancel,
  subscriptionController.cancelSubscription
);

module.exports = router;





