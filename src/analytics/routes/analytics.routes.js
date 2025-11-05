const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Analytics and tracking endpoints
 */

// Analytics Data Endpoints (Protected - Admin/Dashboard access)
router.get("/metrics", protect, require("../controllers/analytics/getMetrics"));
router.get("/traffic", protect, require("../controllers/analytics/getTrafficSources"));
router.get("/pages", protect, require("../controllers/analytics/getTopPages"));
router.get("/devices", protect, require("../controllers/analytics/getDeviceBreakdown"));
router.get("/conversion", protect, require("../controllers/analytics/getConversionFunnel"));
router.get("/events", protect, require("../controllers/analytics/getEvents"));

// Tracking Endpoints (Public - for frontend tracking)
const {
  trackPageView,
  trackEvent,
  updateSession,
  generateSampleData
} = require("../controllers/analytics/trackingController");

router.post("/track/pageview", trackPageView);
router.post("/track/event", trackEvent);
router.post("/track/session", updateSession);

// Development/Testing Endpoints
router.post("/generate-sample-data", protect, restrictTo("admin"), generateSampleData);

/**
 * @swagger
 * /api/analytics/metrics:
 *   get:
 *     summary: Get analytics metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for metrics
 *     responses:
 *       200:
 *         description: Analytics metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/traffic:
 *   get:
 *     summary: Get traffic sources data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for traffic data
 *     responses:
 *       200:
 *         description: Traffic sources data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/pages:
 *   get:
 *     summary: Get top pages data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for page data
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of pages to return
 *     responses:
 *       200:
 *         description: Top pages data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/devices:
 *   get:
 *     summary: Get device breakdown data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for device data
 *     responses:
 *       200:
 *         description: Device breakdown data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/conversion:
 *   get:
 *     summary: Get conversion funnel data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for conversion data
 *     responses:
 *       200:
 *         description: Conversion funnel data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/events:
 *   get:
 *     summary: Get events data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for events data
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Maximum number of events to return
 *     responses:
 *       200:
 *         description: Events data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/track/pageview:
 *   post:
 *     summary: Track a page view
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - page
 *               - deviceType
 *               - trafficSource
 *             properties:
 *               sessionId:
 *                 type: string
 *               userId:
 *                 type: string
 *               page:
 *                 type: string
 *               referrer:
 *                 type: string
 *               userAgent:
 *                 type: string
 *               deviceType:
 *                 type: string
 *                 enum: [desktop, mobile, tablet]
 *               trafficSource:
 *                 type: string
 *                 enum: [organic, paid, direct, social, referral]
 *               duration:
 *                 type: number
 *     responses:
 *       201:
 *         description: Page view tracked successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/track/event:
 *   post:
 *     summary: Track an event
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - eventType
 *               - eventCategory
 *               - eventAction
 *             properties:
 *               sessionId:
 *                 type: string
 *               userId:
 *                 type: string
 *               eventType:
 *                 type: string
 *               eventCategory:
 *                 type: string
 *               eventAction:
 *                 type: string
 *               eventLabel:
 *                 type: string
 *               eventValue:
 *                 type: number
 *               page:
 *                 type: string
 *               properties:
 *                 type: object
 *     responses:
 *       201:
 *         description: Event tracked successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */

module.exports = router;





