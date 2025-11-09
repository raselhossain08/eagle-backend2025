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
router.get("/overview", protect, require("../controllers/analytics/getOverview"));
router.get("/metrics", protect, require("../controllers/analytics/getMetrics"));
router.get("/traffic", protect, require("../controllers/analytics/getTrafficSources"));
router.get("/pages", protect, require("../controllers/analytics/getTopPages"));
router.get("/devices", protect, require("../controllers/analytics/getDeviceBreakdown"));
router.get("/conversion", protect, require("../controllers/analytics/getConversionFunnel"));
router.get("/funnel", protect, require("../controllers/analytics/getConversionFunnel")); // Alias for /conversion
router.get("/events", protect, require("../controllers/analytics/getEvents"));
router.get("/growth", protect, require("../controllers/analytics/getGrowth"));
router.get("/realtime", protect, require("../controllers/analytics/getRealtime"));
router.get("/integrations", protect, restrictTo("admin"), require("../controllers/analytics/getIntegrations"));
router.get("/export", protect, restrictTo("admin"), require("../controllers/analytics/exportAnalytics"));

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

// Backward compatibility aliases - public tracking endpoints
router.post("/pageview", trackPageView); // Alias for /track/pageview
router.post("/event", trackEvent); // Alias for /track/event
router.post("/session", updateSession); // Alias for /track/session

// Batch Events Endpoint (for bulk analytics tracking)
const simpleAnalyticsController = require("../../controllers/simpleAnalytics.controller");
router.post("/events/batch", simpleAnalyticsController.batchEvents);
router.get("/events", protect, simpleAnalyticsController.getEvents);

// Keep old controller for compatibility  
const analyticsController = require("../../controllers/analytics.controller");
router.post("/events/single", analyticsController.singleEvent);

// Test endpoint to verify request format
router.post("/events/test", (req, res) => {
  res.json({
    success: true,
    message: "Test endpoint - your request was received",
    receivedBody: req.body,
    bodyKeys: Object.keys(req.body),
    eventsArray: req.body.events,
    eventsType: Array.isArray(req.body.events) ? 'array' : typeof req.body.events,
    eventsLength: Array.isArray(req.body.events) ? req.body.events.length : 'N/A',
    firstEvent: Array.isArray(req.body.events) && req.body.events[0] ? req.body.events[0] : 'N/A',
    correctFormat: {
      events: [
        {
          type: "page_view",
          properties: { page: "/home" }
        }
      ]
    }
  });
});

// Development/Testing Endpoints
router.post("/generate-sample-data", protect, restrictTo("admin"), generateSampleData);

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     summary: Get comprehensive analytics overview dashboard
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for analytics data
 *     responses:
 *       200:
 *         description: Complete analytics overview retrieved successfully
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
 *                     metrics:
 *                       type: array
 *                       items:
 *                         type: object
 *                     trafficSources:
 *                       type: object
 *                     topPages:
 *                       type: object
 *                     devices:
 *                       type: object
 *                     conversion:
 *                       type: object
 *                     recentEvents:
 *                       type: object
 *                     stats:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

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
 * /api/analytics/funnel:
 *   get:
 *     summary: Get conversion funnel data (alias for /conversion)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *         description: Time range for funnel data
 *     responses:
 *       200:
 *         description: Funnel data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       step:
 *                         type: string
 *                         example: "Website Visit"
 *                       users:
 *                         type: number
 *                         example: 1000
 *                       conversionRate:
 *                         type: number
 *                         example: 100
 *                 range:
 *                   type: string
 *                   example: "30d"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/growth:
 *   get:
 *     summary: Get growth analytics data over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 180d, 365d]
 *           default: "30d"
 *         description: Time range for growth data
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [all, users, sessions, pageviews, conversions]
 *           default: "all"
 *         description: Specific metric to track
 *     responses:
 *       200:
 *         description: Growth data retrieved successfully
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
 *                     labels:
 *                       type: array
 *                       items:
 *                         type: string
 *                     datasets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                           data:
 *                             type: array
 *                             items:
 *                               type: number
 *                           color:
 *                             type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     summary: Get real-time analytics data (last 30 minutes)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time analytics retrieved successfully
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
 *                       type: object
 *                       properties:
 *                         activeUsers:
 *                           type: number
 *                         activeSessions:
 *                           type: number
 *                         pageViews:
 *                           type: number
 *                         events:
 *                           type: number
 *                         trend:
 *                           type: string
 *                     topPages:
 *                       type: array
 *                       items:
 *                         type: object
 *                     devices:
 *                       type: array
 *                       items:
 *                         type: object
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/integrations:
 *   get:
 *     summary: Get analytics integrations status and configuration
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Integrations data retrieved successfully
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
 *                     integrations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [available, active, disabled]
 *                           enabled:
 *                             type: boolean
 *                           icon:
 *                             type: string
 *                           category:
 *                             type: string
 *                           features:
 *                             type: array
 *                             items:
 *                               type: string
 *                           config:
 *                             type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         enabled:
 *                           type: number
 *                         available:
 *                           type: number
 *                     stats:
 *                       type: object
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics data in various formats
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 180d, 365d, all]
 *           default: "30d"
 *         description: Time range for exported data
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv, xlsx]
 *           default: "json"
 *         description: Export format
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, metrics, events, sessions, pageviews, conversions]
 *           default: "all"
 *         description: Type of data to export
 *       - in: query
 *         name: include
 *         schema:
 *           type: string
 *           enum: [all, summary, detailed]
 *           default: "all"
 *         description: Level of detail to include
 *     responses:
 *       200:
 *         description: Analytics data exported successfully
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
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         exportedAt:
 *                           type: string
 *                           format: date-time
 *                         dateRange:
 *                           type: object
 *                         dataType:
 *                           type: string
 *                         format:
 *                           type: string
 *                     data:
 *                       type: object
 *                       properties:
 *                         metrics:
 *                           type: object
 *                         pageViews:
 *                           type: array
 *                         sessions:
 *                           type: array
 *                         events:
 *                           type: array
 *                         conversions:
 *                           type: array
 *                     summary:
 *                       type: object
 *                 exportInfo:
 *                   type: object
 *           text/csv:
 *             schema:
 *               type: string
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
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





