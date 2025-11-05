const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const updateSubscription = require("../controllers/subscription/updateSubscription");
const getSubscriptionStatus = require("../controllers/subscription/getSubscriptionStatus");
const scheduleDowngrade = require("../controllers/subscription/scheduleDowngrade");
const cancelDowngrade = require("../controllers/subscription/cancelDowngrade");

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: User subscription management
 */

router.use(protect); // Protect all subscription routes

router.get("/status", getSubscriptionStatus);
router.put("/update", updateSubscription);
router.post("/schedule-downgrade", scheduleDowngrade);
router.post("/cancel-downgrade", cancelDowngrade);

module.exports = router;
