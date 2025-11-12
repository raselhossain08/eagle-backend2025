const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const analyticsController = require("../controllers/analytics.controller");

/**
 * @swagger
 * tags:
 *   - name: Analytics
 *     description: Analytics tracking and reporting
 */

// Analytics Events Routes
router.post("/events/batch", analyticsController.batchEvents);
router.post("/events/single", analyticsController.singleEvent);
router.get("/events", authMiddleware, analyticsController.getEvents);

// Analytics Reports Routes
router.get("/dashboard", authMiddleware, analyticsController.getDashboardStats);
router.get("/user-activity", authMiddleware, analyticsController.getUserActivity);
router.get("/popular-content", authMiddleware, analyticsController.getPopularContent);
router.get("/conversion-funnel", authMiddleware, analyticsController.getConversionFunnel);

// Analytics Export Routes
router.get("/export/events", authMiddleware, analyticsController.exportEvents);
router.get("/export/report", authMiddleware, analyticsController.exportReport);

// Analytics Configuration Routes
router.get("/config", authMiddleware, analyticsController.getConfig);
router.put("/config", authMiddleware, analyticsController.updateConfig);

module.exports = router;