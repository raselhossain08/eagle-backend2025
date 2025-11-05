const express = require("express");
const router = express.Router();
const { protect } = require("../../middlewares/auth.middleware");
const subscriberController = require("../controllers/subscriber.controller");
const subscriberLifecycleController = require("../controllers/subscriberLifecycle.controller");

/**
 * @swagger
 * tags:
 *   name: Subscription
 *   description: User subscription management
 */

router.use(protect); // Protect all subscription routes

// Legacy subscription routes - redirected to new API structure
router.get("/status", subscriberController.getSubscriberById);
router.put("/update", subscriberLifecycleController.processUpgradeDowngrade);
router.post("/schedule-downgrade", subscriberLifecycleController.downgradeSubscriber);
router.post("/cancel-downgrade", subscriberLifecycleController.cancelSubscriber);

module.exports = router;





