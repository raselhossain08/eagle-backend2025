const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../../middlewares/auth.middleware");
const {
  createSubscriberValidation,
  updateSubscriberValidation,
  bulkUpdateValidation
} = require("../../middlewares/subscriberValidation");

// Import consolidated subscriber controller
const subscriberController = require("../controllers/subscriber.controller");

// Import lifecycle controller
const lifecycleController = require("../controllers/subscriberLifecycle.controller");

// Import complete lifecycle controller for advanced operations
const completeLifecycleController = require("../controllers/subscriberLifecycleComplete.controller");

/**
 * @swagger
 * tags:
 *   name: Subscribers
 *   description: Subscriber management endpoints for dashboard
 */

// Apply authentication to all subscriber routes
router.use(protect);

// Development bypass for testing - remove in production
if (process.env.NODE_ENV === 'development') {
  console.log('🔓 Development mode: Allowing subscriber access for all authenticated users');
  // In development, allow any authenticated user to access subscriber routes
} else {
  // In production, restrict to admin users only
  router.use(restrictTo("admin", "superadmin"));
}

/**
 * @swagger
 * /api/dashboard/subscribers:
 *   get:
 *     summary: Get all subscribers with search, filter, and pagination
 *     tags: [Subscribers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of subscribers per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name, email, phone, country, company
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, trial, cancelled, suspended]
 *         description: Filter by subscriber status
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *           enum: [None, Basic, Diamond, Infinity, Script]
 *         description: Filter by subscription plan
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Subscribers retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/", subscriberController.getSubscribers);

/**
 * @swagger
 * /api/dashboard/subscribers/stats:
 *   get:
 *     summary: Get subscriber statistics
 *     tags: [Subscribers]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get("/stats", subscriberController.getSubscriberStats);

/**
 * @swagger
 * /api/dashboard/subscribers/export:
 *   get:
 *     summary: Export subscribers data
 *     tags: [Subscribers]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json, excel]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: filters
 *         schema:
 *           type: object
 *         description: Filters to apply to export
 *     responses:
 *       200:
 *         description: Export data generated successfully
 */
router.get("/export", subscriberController.exportSubscribers);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}:
 *   get:
 *     summary: Get subscriber by ID
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     responses:
 *       200:
 *         description: Subscriber details retrieved successfully
 *       404:
 *         description: Subscriber not found
 */
router.get("/:id", subscriberController.getSubscriberById);

/**
 * @swagger
 * /api/dashboard/subscribers:
 *   post:
 *     summary: Create new subscriber
 *     tags: [Subscribers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               subscription:
 *                 type: string
 *                 enum: [None, Basic, Diamond, Infinity, Script]
 *               country:
 *                 type: string
 *               company:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, trial, cancelled, suspended]
 *     responses:
 *       201:
 *         description: Subscriber created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User with email already exists
 */
router.post("/", createSubscriberValidation, subscriberController.createSubscriber);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}:
 *   put:
 *     summary: Update subscriber
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               subscription:
 *                 type: string
 *                 enum: [None, Basic, Diamond, Infinity, Script]
 *               country:
 *                 type: string
 *               company:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, trial, cancelled, suspended]
 *     responses:
 *       200:
 *         description: Subscriber updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Subscriber not found
 */
router.put("/:id", updateSubscriberValidation, subscriberController.updateSubscriber);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}:
 *   delete:
 *     summary: Delete subscriber
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     responses:
 *       200:
 *         description: Subscriber deleted successfully
 *       404:
 *         description: Subscriber not found
 */
router.delete("/:id", subscriberController.deleteSubscriber);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/subscriptions:
 *   post:
 *     summary: Create subscription for subscriber
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Subscriber not found
 *       409:
 *         description: Subscriber already has active subscription
 */
router.post("/:id/subscriptions", subscriberController.createSubscription);

// ===============================================
// COMPLETE SUBSCRIBER LIFECYCLE ROUTES
// ===============================================

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/cancel:
 *   post:
 *     summary: Cancel subscriber subscription with retention handling
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Cancellation reason
 *               reasonCategory:
 *                 type: string
 *                 enum: [pricing, features, competition, support, other]
 *                 default: other
 *               effectiveDate:
 *                 type: string
 *                 format: date
 *               scheduleEndOfPeriod:
 *                 type: boolean
 *                 default: true
 *               retentionOffered:
 *                 type: boolean
 *                 default: false
 *               retentionOffers:
 *                 type: array
 *                 items:
 *                   type: object
 *               saveOffers:
 *                 type: array
 *                 items:
 *                   type: object
 *               refundRequest:
 *                 type: boolean
 *                 default: false
 *               refundAmount:
 *                 type: number
 *               refundReason:
 *                 type: string
 *               surveyResponses:
 *                 type: object
 *               sendConfirmation:
 *                 type: boolean
 *                 default: true
 *               allowReactivation:
 *                 type: boolean
 *                 default: true
 *               dataRetentionPeriod:
 *                 type: number
 *                 default: 365
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       400:
 *         description: Validation error or no active subscription
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subscriber not found
 */
router.post("/:id/cancel", completeLifecycleController.cancelSubscriber);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/refunds:
 *   post:
 *     summary: Process subscriber refund
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId:
 *                 type: string
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *                 default: "Customer request"
 *               refundType:
 *                 type: string
 *                 enum: [full, partial, credit]
 *                 default: full
 *               issueCredit:
 *                 type: boolean
 *                 default: false
 *               creditExpirationDays:
 *                 type: number
 *                 default: 365
 *               notes:
 *                 type: string
 *               notifyCustomer:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *       400:
 *         description: No eligible payment found or validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Subscriber not found
 */
router.post("/:id/refunds", restrictTo("admin", "finance", "support"), completeLifecycleController.processRefund);

// Basic lifecycle operations using the lifecycle controller
router.post("/:id/pause", lifecycleController.pauseSubscriber);
router.post("/:id/resume", lifecycleController.resumeSubscriber);
router.post("/:id/reactivate", lifecycleController.reactivateSubscriber);
router.post("/:id/change-plan", lifecycleController.changeSubscriberPlan);
router.get("/:id/lifecycle", lifecycleController.getLifecycleHistory);
router.get("/:id/renewal", lifecycleController.getRenewalInfo);
router.post("/:id/upgrade-downgrade", lifecycleController.processUpgradeDowngrade);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/payment-method/update-link:
 *   post:
 *     summary: Generate secure payment method update link
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expirationHours:
 *                 type: number
 *                 default: 24
 *               returnUrl:
 *                 type: string
 *               requireCurrentMethod:
 *                 type: boolean
 *                 default: false
 *               allowedMethods:
 *                 type: array
 *                 items:
 *                   type: string
 *                 default: ["card"]
 *               sendEmail:
 *                 type: boolean
 *                 default: true
 *               customMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment update link generated successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subscriber not found
 */
router.post("/:id/payment-method/update-link", completeLifecycleController.generatePaymentUpdateLink);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/payment-method/status:
 *   get:
 *     summary: Get payment method status and security info
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     responses:
 *       200:
 *         description: Payment method status retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subscriber not found
 */
router.get("/:id/payment-method/status", completeLifecycleController.getPaymentMethodStatus);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/trial:
 *   post:
 *     summary: Issue trial subscription
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Plan to grant trial for
 *               trialDays:
 *                 type: number
 *                 default: 14
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 default: monthly
 *               requirePaymentMethod:
 *                 type: boolean
 *                 default: false
 *               autoConvert:
 *                 type: boolean
 *                 default: true
 *               customPricing:
 *                 type: object
 *               addons:
 *                 type: array
 *                 items:
 *                   type: object
 *               reason:
 *                 type: string
 *                 default: "Trial subscription"
 *               sendWelcomeEmail:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Trial subscription issued successfully
 *       400:
 *         description: User already has active subscription or validation error
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Subscriber or plan not found
 */
router.post("/:id/trial", restrictTo("admin", "sales", "support"), completeLifecycleController.issueTrial);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/schedule-change:
 *   post:
 *     summary: Schedule subscription changes at period end
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - changeType
 *             properties:
 *               changeType:
 *                 type: string
 *                 enum: [plan_change, cancellation, pause, addon_change]
 *               targetPlan:
 *                 type: string
 *               effectiveDate:
 *                 type: string
 *                 format: date
 *               addons:
 *                 type: array
 *                 items:
 *                   type: object
 *               removeAddons:
 *                 type: array
 *                 items:
 *                   type: string
 *               customPricing:
 *                 type: object
 *               reason:
 *                 type: string
 *               notifyCustomer:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Subscription change scheduled successfully
 *       400:
 *         description: No active subscription or invalid change type
 *       403:
 *         description: Access denied
 *       404:
 *         description: Subscriber not found
 */
router.post("/:id/schedule-change", completeLifecycleController.scheduleChange);

/**
 * @swagger
 * /api/dashboard/subscribers/{id}/retry-payment:
 *   post:
 *     summary: Manually retry failed payment
 *     tags: [Subscribers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscriber ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId:
 *                 type: string
 *               useNewPaymentMethod:
 *                 type: boolean
 *                 default: false
 *               paymentMethodId:
 *                 type: string
 *               sendNotification:
 *                 type: boolean
 *                 default: true
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment retry executed successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: No failed payment found
 */
router.post("/:id/retry-payment", restrictTo("admin", "finance", "support"), completeLifecycleController.retryPayment);

/**
 * @swagger
 * /api/dashboard/subscribers/dunning/dashboard:
 *   get:
 *     summary: Get dunning dashboard for failed payments
 *     tags: [Subscribers]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, failed, retry, grace_period, cancelled]
 *           default: all
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 30
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: failedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *     responses:
 *       200:
 *         description: Dunning dashboard data retrieved successfully
 *       403:
 *         description: Access denied
 */
router.get("/dunning/dashboard", restrictTo("admin", "finance", "support"), completeLifecycleController.getDunningDashboard);

module.exports = router;





