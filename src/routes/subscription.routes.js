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

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: User subscription management
 */

router.use(protect); // Protect all subscription routes

// GET /api/subscription - List all subscriptions with pagination
router.get("/", subscriberController.getSubscribers);

router.get("/status", getSubscriptionStatus);
router.get("/due-for-renewal", getDueForRenewal);
router.put("/update", updateSubscription);
router.post("/schedule-downgrade", scheduleDowngrade);
router.post("/cancel-downgrade", cancelDowngrade);

module.exports = router;
