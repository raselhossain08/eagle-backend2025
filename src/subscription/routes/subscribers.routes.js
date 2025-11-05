const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Subscribers
 *   description: Comprehensive subscriber management and lifecycle operations
 */

const subscriberController = require('../controllers/subscriber.controller');
const subscriberLifecycleController = require('../controllers/subscriberLifecycle.controller');
const completeLifecycleController = require('../controllers/subscriberLifecycleComplete.controller');

// Apply authentication to all routes
router.use(protect);

// ===============================
// SUBSCRIBER MANAGEMENT
// ===============================

/**
 * @route GET /v1/subscribers
 * @desc List and search subscribers with advanced filtering
 * @access Admin, Support, Finance
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('search').optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage('Search must be 1-200 characters'),
    query('status').optional().isIn(['active', 'paused', 'cancelled', 'trial', 'past_due', 'unpaid', 'all']).withMessage('Invalid status'),
    query('plan').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']).withMessage('Invalid plan'),
    query('paymentStatus').optional().isIn(['current', 'past_due', 'failed', 'all']).withMessage('Invalid payment status'),
    query('sortBy').optional().isIn(['createdAt', 'lastPayment', 'nextBilling', 'mrr', 'ltv', 'name', 'email']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    query('mrrMin').optional().isFloat({ min: 0 }).withMessage('MRR min must be positive'),
    query('mrrMax').optional().isFloat({ min: 0 }).withMessage('MRR max must be positive'),
    query('tags').optional().isString().withMessage('Tags must be string'),
    query('cohort').optional().isString().withMessage('Cohort must be string'),
    query('includeMetrics').optional().isBoolean().withMessage('Include metrics must be boolean'),
    query('fields').optional().isString().withMessage('Fields must be comma-separated string')
  ],
  subscriberController.getSubscribers
);

/**
 * @route GET /v1/subscribers/:id
 * @desc Get detailed subscriber information
 * @access Admin, Support, Finance, or Subscriber Self
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    query('includePaymentHistory').optional().isBoolean().withMessage('Include payment history must be boolean'),
    query('includeUsageMetrics').optional().isBoolean().withMessage('Include usage metrics must be boolean'),
    query('includeSupport').optional().isBoolean().withMessage('Include support data must be boolean'),
    query('includeContracts').optional().isBoolean().withMessage('Include contracts must be boolean')
  ],
  subscriberController.getSubscriberById
);

/**
 * @route GET /v1/subscribers/:id/timeline
 * @desc Get subscriber activity timeline and events
 * @access Admin, Support, Finance
 */
router.get('/:id/timeline',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    query('eventTypes').optional().isString().withMessage('Event types must be comma-separated string'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be 1-200'),
    query('includeSensitive').optional().isBoolean().withMessage('Include sensitive must be boolean')
  ],
  subscriberController.getSubscriberTimeline
);

/**
 * @route GET /v1/subscribers/stats
 * @desc Get comprehensive subscriber statistics for dashboard
 * @access Admin, Support, Finance
 */
router.get('/stats',
  restrictTo('admin', 'support', 'finance'),
  subscriberController.getSubscriberStats
);

/**
 * @route GET /v1/subscribers/export
 * @desc Export subscribers data in various formats
 * @access Admin, Support, Finance
 */
router.get('/export',
  restrictTo('admin', 'support', 'finance'),
  [
    query('format').isIn(['csv', 'excel', 'json']).withMessage('Format must be csv, excel, or json'),
    query('status').optional().isIn(['active', 'paused', 'cancelled', 'trial', 'past_due', 'unpaid', 'all']).withMessage('Invalid status'),
    query('plan').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']).withMessage('Invalid plan'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format')
  ],
  subscriberController.exportSubscribers
);

/**
 * @route PUT /v1/subscribers/:id
 * @desc Update subscriber information
 * @access Admin, Support, Finance
 */
router.put('/:id',
  restrictTo('admin', 'support', 'finance'),
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name must be 1-50 characters'),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be 1-50 characters'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().isString().withMessage('Phone must be string'),
    body('status').optional().isIn(['active', 'inactive', 'trial', 'cancelled', 'suspended']).withMessage('Invalid status'),
    body('plan').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'None']).withMessage('Invalid plan'),
    body('country').optional().isString().withMessage('Country must be string'),
    body('company').optional().isString().withMessage('Company must be string'),
    body('tags').optional().isArray().withMessage('Tags must be array'),
    body('notes').optional().isString().withMessage('Notes must be string')
  ],
  subscriberController.updateSubscriber
);

/**
 * @route DELETE /v1/subscribers/:id
 * @desc Delete subscriber (soft delete)
 * @access Admin only
 */
router.delete('/:id',
  restrictTo('admin'),
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID')
  ],
  subscriberController.deleteSubscriber
);

// ===============================
// SUBSCRIBER LIFECYCLE MANAGEMENT
// ===============================

/**
 * @route POST /v1/subscribers
 * @desc Create new subscriber
 * @access Admin, Sales
 */
router.post('/',
  restrictTo('admin', 'sales'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name must be 1-50 characters'),
    body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be 1-50 characters'),
    body('plan').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script']).withMessage('Invalid plan'),
    body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annual']).withMessage('Invalid billing cycle'),
    body('trialDays').optional().isInt({ min: 0, max: 365 }).withMessage('Trial days must be 0-365'),
    body('customPricing').optional().isObject().withMessage('Custom pricing must be object'),
    body('metadata').optional().isObject().withMessage('Metadata must be object'),
    body('tags').optional().isArray().withMessage('Tags must be array'),
    body('referralCode').optional().isString().trim().withMessage('Referral code must be string'),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice']).withMessage('Invalid proration behavior'),
    body('paymentMethodId').optional().isString().withMessage('Payment method ID must be string'),
    body('billingAddress').optional().isObject().withMessage('Billing address must be object'),
    body('taxExempt').optional().isBoolean().withMessage('Tax exempt must be boolean'),
    body('sendWelcomeEmail').optional().isBoolean().withMessage('Send welcome email must be boolean')
  ],
  subscriberLifecycleController.createSubscriber
);

/**
 * @route POST /v1/subscribers/:id/plans
 * @desc Assign or change subscriber plan
 * @access Admin, Sales
 */
router.post('/:id/plans',
  restrictTo('admin', 'sales'),
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('planId').isString().withMessage('Plan ID is required'),
    body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annual']).withMessage('Invalid billing cycle'),
    body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice']).withMessage('Invalid proration behavior'),
    body('replaceCurrentPlan').optional().isBoolean().withMessage('Replace current plan must be boolean'),
    body('customPricing').optional().isObject().withMessage('Custom pricing must be object'),
    body('addons').optional().isArray().withMessage('Addons must be array'),
    body('discountCodes').optional().isArray().withMessage('Discount codes must be array'),
    body('reason').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Reason must be 1-500 characters'),
    body('notifySubscriber').optional().isBoolean().withMessage('Notify subscriber must be boolean')
  ],
  subscriberLifecycleController.assignPlan
);

/**
 * @route POST /v1/subscribers/:id/upgrade
 * @desc Upgrade subscriber to higher plan
 * @access Admin, Sales, Subscriber Self
 */
router.post('/:id/upgrade',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('targetPlan').isString().withMessage('Target plan is required'),
    body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annual']).withMessage('Invalid billing cycle'),
    body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice']).withMessage('Invalid proration behavior'),
    body('addons').optional().isArray().withMessage('Addons must be array'),
    body('discountCodes').optional().isArray().withMessage('Discount codes must be array'),
    body('paymentMethodId').optional().isString().withMessage('Payment method ID must be string'),
    body('sendConfirmation').optional().isBoolean().withMessage('Send confirmation must be boolean')
  ],
  subscriberLifecycleController.upgradeSubscriber
);

/**
 * @route POST /v1/subscribers/:id/downgrade
 * @desc Downgrade subscriber to lower plan
 * @access Admin, Sales, Subscriber Self
 */
router.post('/:id/downgrade',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('targetPlan').isString().withMessage('Target plan is required'),
    body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annual']).withMessage('Invalid billing cycle'),
    body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice']).withMessage('Invalid proration behavior'),
    body('reason').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Reason must be 1-500 characters'),
    body('retentionAttempt').optional().isBoolean().withMessage('Retention attempt must be boolean'),
    body('scheduleForEndOfPeriod').optional().isBoolean().withMessage('Schedule for end of period must be boolean'),
    body('sendConfirmation').optional().isBoolean().withMessage('Send confirmation must be boolean')
  ],
  subscriberLifecycleController.downgradeSubscriber
);

/**
 * @route POST /v1/subscribers/:id/pause
 * @desc Pause subscriber subscription
 * @access Admin, Sales, Subscriber Self
 */
router.post('/:id/pause',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('reason').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Reason must be 1-500 characters'),
    body('pauseDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Pause duration must be 1-365 days'),
    body('resumeDate').optional().isISO8601().withMessage('Invalid resume date'),
    body('pauseBehavior').optional().isIn(['pause_collection', 'void_invoice', 'mark_uncollectible']).withMessage('Invalid pause behavior'),
    body('retainAccess').optional().isBoolean().withMessage('Retain access must be boolean'),
    body('sendNotification').optional().isBoolean().withMessage('Send notification must be boolean')
  ],
  subscriberLifecycleController.pauseSubscriber
);

/**
 * @route POST /v1/subscribers/:id/resume
 * @desc Resume paused subscriber subscription
 * @access Admin, Sales, Subscriber Self
 */
router.post('/:id/resume',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('resumeDate').optional().isISO8601().withMessage('Invalid resume date'),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice']).withMessage('Invalid proration behavior'),
    body('updatePaymentMethod').optional().isBoolean().withMessage('Update payment method must be boolean'),
    body('paymentMethodId').optional().isString().withMessage('Payment method ID must be string'),
    body('sendWelcomeBack').optional().isBoolean().withMessage('Send welcome back must be boolean')
  ],
  subscriberLifecycleController.resumeSubscriber
);

/**
 * @route POST /v1/subscribers/:id/cancel
 * @desc Cancel subscriber subscription
 * @access Admin, Sales, Subscriber Self
 */
router.post('/:id/cancel',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('reason').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Reason must be 1-500 characters'),
    body('cancellationType').optional().isIn(['immediate', 'end_of_period', 'scheduled']).withMessage('Invalid cancellation type'),
    body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
    body('refundType').optional().isIn(['none', 'prorated', 'full']).withMessage('Invalid refund type'),
    body('retainData').optional().isBoolean().withMessage('Retain data must be boolean'),
    body('retentionAttempt').optional().isBoolean().withMessage('Retention attempt must be boolean'),
    body('sendCancellationEmail').optional().isBoolean().withMessage('Send cancellation email must be boolean'),
    body('surveyResponse').optional().isObject().withMessage('Survey response must be object')
  ],
  subscriberLifecycleController.cancelSubscriber
);

/**
 * @route POST /v1/subscribers/:id/refunds
 * @desc Process subscriber refund
 * @access Admin, Finance
 */
router.post('/:id/refunds',
  restrictTo('admin', 'finance'),
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('reason').isString().trim().isLength({ min: 5, max: 500 }).withMessage('Reason must be 5-500 characters'),
    body('refundType').isIn(['full', 'partial', 'credit']).withMessage('Invalid refund type'),
    body('paymentId').optional().isString().withMessage('Payment ID must be string'),
    body('invoiceId').optional().isString().withMessage('Invoice ID must be string'),
    body('reverseProration').optional().isBoolean().withMessage('Reverse proration must be boolean'),
    body('sendNotification').optional().isBoolean().withMessage('Send notification must be boolean'),
    body('internalNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Internal notes max 1000 characters')
  ],
  subscriberLifecycleController.processRefund
);

/**
 * @route POST /v1/subscribers/:id/payment-method/update-link
 * @desc Generate payment method update link for subscriber
 * @access Admin, Support, Subscriber Self
 */
router.post('/:id/payment-method/update-link',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('redirectUrl').optional().isURL().withMessage('Invalid redirect URL'),
    body('expiresIn').optional().isInt({ min: 300, max: 86400 }).withMessage('Expires in must be 300-86400 seconds'),
    body('sendEmail').optional().isBoolean().withMessage('Send email must be boolean'),
    body('emailTemplate').optional().isString().withMessage('Email template must be string')
  ],
  subscriberLifecycleController.generatePaymentUpdateLink
);

/**
 * @route GET /v1/subscribers/:id/payment-method
 * @desc Get subscriber payment method information
 * @access Admin, Support, Finance, Subscriber Self
 */
router.get('/:id/payment-method',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    query('includeSensitive').optional().isBoolean().withMessage('Include sensitive must be boolean')
  ],
  subscriberController.getPaymentMethod
);

// ===============================
// NICE-TO-HAVE FEATURES
// ===============================

/**
 * @route POST /v1/subscribers/:id/seats
 * @desc Manage subscriber seats (for team plans)
 * @access Admin, Sales, Subscriber Self
 */
router.post('/:id/seats',
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID'),
    body('action').isIn(['add', 'remove', 'update']).withMessage('Action must be add, remove, or update'),
    body('seatCount').optional().isInt({ min: 1 }).withMessage('Seat count must be positive'),
    body('userEmails').optional().isArray().withMessage('User emails must be array'),
    body('userEmails.*').optional().isEmail().withMessage('Invalid email in user emails'),
    body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
    body('prorationBehavior').optional().isIn(['create_prorations', 'none', 'always_invoice']).withMessage('Invalid proration behavior'),
    body('sendInvitations').optional().isBoolean().withMessage('Send invitations must be boolean')
  ],
  subscriberLifecycleController.manageSeats
);

/**
 * @route POST /v1/gifts
 * @desc Create gift subscription
 * @access Admin, Sales
 */
router.post('/gifts',
  restrictTo('admin', 'sales'),
  [
    body('recipientEmail').isEmail().normalizeEmail().withMessage('Valid recipient email is required'),
    body('recipientName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Recipient name must be 1-100 characters'),
    body('giftPlan').isString().withMessage('Gift plan is required'),
    body('duration').isInt({ min: 1, max: 365 }).withMessage('Duration must be 1-365 days'),
    body('giftMessage').optional().trim().isLength({ max: 500 }).withMessage('Gift message max 500 characters'),
    body('deliveryDate').optional().isISO8601().withMessage('Invalid delivery date'),
    body('purchaserEmail').isEmail().withMessage('Valid purchaser email is required'),
    body('purchaserName').trim().isLength({ min: 1, max: 100 }).withMessage('Purchaser name must be 1-100 characters'),
    body('paymentMethodId').isString().withMessage('Payment method ID is required'),
    body('sendEmailToRecipient').optional().isBoolean().withMessage('Send email to recipient must be boolean'),
    body('sendEmailToPurchaser').optional().isBoolean().withMessage('Send email to purchaser must be boolean')
  ],
  subscriberLifecycleController.createGiftSubscription
);

/**
 * @route GET /v1/account-sharing/signals
 * @desc Get account sharing detection signals
 * @access Admin, Security
 */
router.get('/account-sharing/signals',
  restrictTo('admin', 'security'),
  [
    query('subscriberId').optional().isMongoId().withMessage('Invalid subscriber ID'),
    query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid risk level'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('includeDetails').optional().isBoolean().withMessage('Include details must be boolean')
  ],
  subscriberController.getAccountSharingSignals
);

module.exports = router;





