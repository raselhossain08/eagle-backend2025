const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");

// Import from subscription module
const {
  updateSubscription,
  getSubscriptionStatus,
  scheduleDowngrade,
  cancelDowngrade,
  getDueForRenewal
} = require("../subscription/controllers");

// Import subscriber controller for listing subscriptions
const subscriberController = require("../subscription/controllers/subscriber.controller");

// Import subscription analytics controller
const subscriptionAnalyticsController = require("../subscription/controllers/subscription-analytics.controller");

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: User subscription management
 */

router.use(protect); // Protect all subscription routes

// Analytics routes - must come before other routes to avoid conflicts
router.get("/analytics", subscriptionAnalyticsController.getAnalyticsOverview);
router.get("/analytics/mrr", subscriptionAnalyticsController.getMRRMetrics);
router.get("/analytics/churn", subscriptionAnalyticsController.getChurnAnalytics);
router.get("/analytics/growth", subscriptionAnalyticsController.getGrowthTrends);

// Activity routes
router.get("/activity/recent", subscriptionAnalyticsController.getRecentActivityEndpoint);

// GET /api/subscription - List all subscriptions with pagination
router.get("/", subscriberController.getSubscribers);

router.get("/status", getSubscriptionStatus);
router.get("/due-for-renewal", getDueForRenewal);
router.get("/expiring-soon", getDueForRenewal); // Alias for due-for-renewal
router.put("/update", updateSubscription);
router.post("/schedule-downgrade", scheduleDowngrade);
router.post("/cancel-downgrade", cancelDowngrade);

module.exports = router;
