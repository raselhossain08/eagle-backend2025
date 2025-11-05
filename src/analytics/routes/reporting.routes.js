const express = require('express');
const router = express.Router();
const ReportingController = require('../controllers/reporting.controller');
const AdvancedFeaturesController = require('../controllers/advancedFeatures.controller');
const { authMiddleware } = require('../../../middlewares/auth.middleware');
const { rbacMiddleware } = require('../../../middlewares/rbac.middleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     RevenueAnalytics:
 *       type: object
 *       properties:
 *         period:
 *           type: object
 *           properties:
 *             date:
 *               type: string
 *               format: date
 *             periodType:
 *               type: string
 *               enum: [DAILY, MONTHLY, QUARTERLY, YEARLY]
 *         revenue:
 *           type: object
 *           properties:
 *             mrr:
 *               type: number
 *               description: Monthly Recurring Revenue
 *             arr:
 *               type: number
 *               description: Annual Recurring Revenue
 *             newRevenue:
 *               type: number
 *             churnedRevenue:
 *               type: number
 *         kpis:
 *           type: object
 *           properties:
 *             arpu:
 *               type: number
 *               description: Average Revenue Per User
 *             churnRate:
 *               type: number
 *               description: Customer churn rate percentage
 *             ltv:
 *               type: number
 *               description: Customer Lifetime Value
 *     
 *     Alert:
 *       type: object
 *       properties:
 *         alertId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [FAILED_PAYMENT_SPIKE, CHURN_THRESHOLD_EXCEEDED, FRAUD_DETECTION, REVENUE_DROP]
 *         severity:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, DISMISSED]
 *     
 *     FamilyPlan:
 *       type: object
 *       properties:
 *         planId:
 *           type: string
 *         primaryAccountId:
 *           type: string
 *         settings:
 *           type: object
 *           properties:
 *             maxMembers:
 *               type: number
 *             currentMembers:
 *               type: number
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [PRIMARY, ADULT, TEEN, CHILD]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, PENDING, SUSPENDED, REMOVED]
 *     
 *     GiftSubscription:
 *       type: object
 *       properties:
 *         giftId:
 *           type: string
 *         giver:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             message:
 *               type: string
 *         recipient:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         redemption:
 *           type: object
 *           properties:
 *             redemptionCode:
 *               type: string
 *             redeemedAt:
 *               type: string
 *               format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING_PAYMENT, PAID, DELIVERED, REDEEMED, EXPIRED, REFUNDED]
 */

// ======================
// REVENUE ANALYTICS ROUTES
// ======================

/**
 * @swagger
 * /api/reporting/revenue/dashboard:
 *   get:
 *     summary: Get comprehensive revenue analytics dashboard
 *     description: Returns MRR/ARR, customer metrics, KPIs, and trends for business intelligence
 *     tags: [Reporting - Revenue Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [DAILY, MONTHLY, QUARTERLY, YEARLY]
 *           default: MONTHLY
 *         description: Analytics period type
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *         description: Currency for revenue calculations
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics period
 *     responses:
 *       200:
 *         description: Revenue dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     current:
 *                       $ref: '#/components/schemas/RevenueAnalytics'
 *                     trends:
 *                       type: object
 *                     alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Alert'
 */
router.get('/revenue/dashboard', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getRevenueDashboard
);

/**
 * @swagger
 * /api/reporting/revenue/mrr-trends:
 *   get:
 *     summary: Get MRR/ARR trends over time
 *     description: Returns monthly recurring revenue trends with breakdown by plan
 *     tags: [Reporting - Revenue Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of months to include in trends
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *       - in: query
 *         name: breakdown
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include plan breakdown data
 *     responses:
 *       200:
 *         description: MRR trends data
 */
router.get('/revenue/mrr-trends', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getMRRTrends
);

/**
 * @swagger
 * /api/reporting/revenue/ltv-analysis:
 *   get:
 *     summary: Get customer lifetime value analysis
 *     description: Returns LTV calculations, segmentation, and trends
 *     tags: [Reporting - Revenue Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *       - in: query
 *         name: segment
 *         schema:
 *           type: string
 *         description: Customer segment filter
 *     responses:
 *       200:
 *         description: LTV analysis data
 */
router.get('/revenue/ltv-analysis', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getLTVAnalysis
);

/**
 * @swagger
 * /api/reporting/revenue/plan-mix:
 *   get:
 *     summary: Get plan mix analytics
 *     description: Returns revenue and customer distribution across subscription plans
 *     tags: [Reporting - Revenue Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [DAILY, MONTHLY, QUARTERLY, YEARLY]
 *           default: MONTHLY
 *     responses:
 *       200:
 *         description: Plan mix analysis data
 */
router.get('/revenue/plan-mix', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getPlanMixAnalysis
);

// ======================
// COHORT ANALYSIS ROUTES
// ======================

/**
 * @swagger
 * /api/reporting/cohorts/retention:
 *   get:
 *     summary: Get cohort retention analysis
 *     description: Returns customer and revenue retention by cohort with retention matrix
 *     tags: [Reporting - Cohort Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *         description: Number of cohort months to analyze
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *           default: USD
 *     responses:
 *       200:
 *         description: Cohort retention data
 */
router.get('/cohorts/retention', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getCohortAnalysis
);

// ======================
// ALERTS AND MONITORING ROUTES
// ======================

/**
 * @swagger
 * /api/reporting/alerts/dashboard:
 *   get:
 *     summary: Get alerts monitoring dashboard
 *     description: Returns active alerts, statistics, and trends for business monitoring
 *     tags: [Reporting - Alerts & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, DISMISSED]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [FINANCIAL, SECURITY, OPERATIONAL, COMPLIANCE]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Alerts dashboard data
 */
router.get('/alerts/dashboard', 
  authMiddleware, 
  rbacMiddleware(['admin', 'support_manager']), 
  ReportingController.getAlertsDashboard
);

/**
 * @swagger
 * /api/reporting/alerts/{alertId}/acknowledge:
 *   post:
 *     summary: Acknowledge an alert
 *     description: Mark an alert as acknowledged by the current user
 *     tags: [Reporting - Alerts & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 */
router.post('/alerts/:alertId/acknowledge', 
  authMiddleware, 
  rbacMiddleware(['admin', 'support_manager']), 
  ReportingController.acknowledgeAlert
);

/**
 * @swagger
 * /api/reporting/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve an alert
 *     description: Mark an alert as resolved with optional resolution notes
 *     tags: [Reporting - Alerts & Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Resolution notes
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 */
router.post('/alerts/:alertId/resolve', 
  authMiddleware, 
  rbacMiddleware(['admin', 'support_manager']), 
  ReportingController.resolveAlert
);

// ======================
// FAMILY PLANS ROUTES
// ======================

/**
 * @swagger
 * /api/reporting/family-plans:
 *   post:
 *     summary: Create a new family plan
 *     description: Set up a family subscription plan with multi-user management
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Membership plan ID
 *               maxMembers:
 *                 type: number
 *                 default: 5
 *               ageRestrictions:
 *                 type: object
 *                 properties:
 *                   minAge:
 *                     type: number
 *                     default: 13
 *                   requireParentalConsent:
 *                     type: boolean
 *                     default: true
 *               contentFiltering:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                     default: false
 *                   level:
 *                     type: string
 *                     enum: [STRICT, MODERATE, PERMISSIVE]
 *                     default: MODERATE
 *     responses:
 *       201:
 *         description: Family plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FamilyPlan'
 */
router.post('/family-plans', 
  authMiddleware, 
  AdvancedFeaturesController.createFamilyPlan
);

/**
 * @swagger
 * /api/reporting/family-plans/{familyPlanId}:
 *   get:
 *     summary: Get family plan details
 *     description: Retrieve detailed information about a family plan including members and settings
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: familyPlanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Family plan details
 */
router.get('/family-plans/:familyPlanId', 
  authMiddleware, 
  AdvancedFeaturesController.getFamilyPlan
);

/**
 * @swagger
 * /api/reporting/family-plans/{familyPlanId}/invite:
 *   post:
 *     summary: Invite a member to family plan
 *     description: Send an invitation email to join the family subscription plan
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: familyPlanId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [ADULT, TEEN, CHILD]
 *                 default: ADULT
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 */
router.post('/family-plans/:familyPlanId/invite', 
  authMiddleware, 
  AdvancedFeaturesController.inviteFamilyMember
);

/**
 * @swagger
 * /api/reporting/family-plans/accept-invitation/{invitationToken}:
 *   post:
 *     summary: Accept family plan invitation
 *     description: Accept an invitation to join a family subscription plan
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationToken
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 */
router.post('/family-plans/accept-invitation/:invitationToken', 
  authMiddleware, 
  AdvancedFeaturesController.acceptFamilyInvitation
);

/**
 * @swagger
 * /api/reporting/family-plans/{familyPlanId}/members/{memberId}:
 *   delete:
 *     summary: Remove family member
 *     description: Remove a member from the family subscription plan
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: familyPlanId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Family member removed successfully
 */
router.delete('/family-plans/:familyPlanId/members/:memberId', 
  authMiddleware, 
  AdvancedFeaturesController.removeFamilyMember
);

/**
 * @swagger
 * /api/reporting/family-plans/{familyPlanId}/sharing-detection:
 *   get:
 *     summary: Detect account sharing violations
 *     description: Analyze usage patterns to detect potential account sharing violations
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: familyPlanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sharing detection results
 */
router.get('/family-plans/:familyPlanId/sharing-detection', 
  authMiddleware, 
  AdvancedFeaturesController.detectAccountSharing
);

/**
 * @swagger
 * /api/reporting/family-plans/analytics:
 *   get:
 *     summary: Get family plan analytics
 *     description: Retrieve analytics data for family plans including usage and sharing detection insights
 *     tags: [Advanced Features - Family Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Family plan analytics data
 */
router.get('/family-plans/analytics', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getFamilyPlanAnalytics
);

// ======================
// GIFT SUBSCRIPTIONS ROUTES
// ======================

/**
 * @swagger
 * /api/reporting/gift-subscriptions:
 *   post:
 *     summary: Create a gift subscription
 *     description: Purchase a subscription as a gift for someone else
 *     tags: [Advanced Features - Gift Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - duration
 *               - recipientName
 *               - recipientEmail
 *               - giverName
 *               - giverEmail
 *             properties:
 *               planId:
 *                 type: string
 *                 description: Membership plan ID
 *               duration:
 *                 type: number
 *                 description: Gift duration in months
 *               recipientName:
 *                 type: string
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *               giverName:
 *                 type: string
 *               giverEmail:
 *                 type: string
 *                 format: email
 *               message:
 *                 type: string
 *                 description: Personal message for the recipient
 *               deliveryMethod:
 *                 type: string
 *                 enum: [IMMEDIATE, SCHEDULED, ON_DEMAND]
 *                 default: IMMEDIATE
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 description: Required if deliveryMethod is SCHEDULED
 *               customization:
 *                 type: object
 *                 properties:
 *                   theme:
 *                     type: string
 *                     enum: [DEFAULT, BIRTHDAY, HOLIDAY, ANNIVERSARY, CUSTOM]
 *                   customMessage:
 *                     type: string
 *                   giftCardImage:
 *                     type: string
 *     responses:
 *       201:
 *         description: Gift subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     giftId:
 *                       type: string
 *                     redemptionCode:
 *                       type: string
 *                     status:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 */
router.post('/gift-subscriptions', 
  authMiddleware, 
  AdvancedFeaturesController.createGiftSubscription
);

/**
 * @swagger
 * /api/reporting/gift-subscriptions/redeem:
 *   post:
 *     summary: Redeem a gift subscription
 *     description: Redeem a gift subscription using the redemption code
 *     tags: [Advanced Features - Gift Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - redemptionCode
 *             properties:
 *               redemptionCode:
 *                 type: string
 *                 description: Unique redemption code for the gift
 *     responses:
 *       200:
 *         description: Gift subscription redeemed successfully
 */
router.post('/gift-subscriptions/redeem', 
  authMiddleware, 
  AdvancedFeaturesController.redeemGiftSubscription
);

/**
 * @swagger
 * /api/reporting/gift-subscriptions/{giftId}/status:
 *   get:
 *     summary: Get gift subscription status
 *     description: Check the status of a gift subscription
 *     tags: [Advanced Features - Gift Subscriptions]
 *     parameters:
 *       - in: path
 *         name: giftId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gift subscription status
 */
router.get('/gift-subscriptions/:giftId/status', 
  AdvancedFeaturesController.getGiftSubscriptionStatus
);

/**
 * @swagger
 * /api/reporting/gift-subscriptions/analytics:
 *   get:
 *     summary: Get gift subscription analytics
 *     description: Retrieve analytics data for gift subscriptions including redemption rates and trends
 *     tags: [Advanced Features - Gift Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Gift subscription analytics data
 */
router.get('/gift-subscriptions/analytics', 
  authMiddleware, 
  rbacMiddleware(['admin', 'finance_manager']), 
  ReportingController.getGiftSubscriptionAnalytics
);

module.exports = router;





