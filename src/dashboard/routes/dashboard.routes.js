const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../../../middlewares/auth.middleware");

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard metrics and analytics
 */

// @route   GET /api/dashboard/metrics
// @desc    Get dashboard metrics
// @access  Private
router.get("/metrics", protect, require("../controllers/dashboard/getMetrics"));

// Subscriber management routes
router.use("/subscribers", require("./subscriber.routes"));

module.exports = router;





