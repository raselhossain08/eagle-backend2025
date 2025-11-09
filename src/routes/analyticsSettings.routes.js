const express = require('express');
const router = express.Router();
const analyticsSettingsController = require('../controllers/analyticsSettingsController');
const { protect, adminOnly } = require('../middlewares/auth.middleware');

// Get analytics settings (admin only)
router.get(
    '/',
    protect,
    adminOnly,
    analyticsSettingsController.getAnalyticsSettings
);

// Update analytics settings (admin only)
router.put(
    '/',
    protect,
    adminOnly,
    analyticsSettingsController.updateAnalyticsSettings
);

// Test analytics connection (admin only)
router.post(
    '/test/:provider',
    protect,
    adminOnly,
    analyticsSettingsController.testAnalyticsConnection
);

// Get analytics statistics (admin only)
router.get(
    '/stats',
    protect,
    adminOnly,
    analyticsSettingsController.getAnalyticsStats
);

module.exports = router;
