const express = require('express');
const router = express.Router();
const {
    getSystemSettings,
    updateSystemSettings,
    getFeatureFlags,
    addFeatureFlag,
    updateFeatureFlag,
    deleteFeatureFlag,
    getLegalTexts,
    addLegalText,
    getPolicyUrls,
    addPolicyUrl,
    getSystemSettingsAnalytics
} = require('../controllers/systemSettings.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { optionalAuth } = require('../../middlewares/auth.middleware');

// Analytics endpoint (must come before root route)
router.get('/analytics', protect, restrictTo('admin'), getSystemSettingsAnalytics);

// System Settings - Main endpoints
router.get('/', optionalAuth, getSystemSettings); // Public with optional auth for different views
router.put('/', protect, restrictTo('admin'), updateSystemSettings);

// Feature Flags
router.get('/feature-flags', optionalAuth, getFeatureFlags);
router.post('/feature-flags', protect, restrictTo('admin'), addFeatureFlag);
router.put('/feature-flags/:flagId', protect, restrictTo('admin'), updateFeatureFlag);
router.delete('/feature-flags/:flagId', protect, restrictTo('admin'), deleteFeatureFlag);

// Legal Texts
router.get('/legal-texts', getLegalTexts); // Public
router.post('/legal-texts', protect, restrictTo('admin'), addLegalText);

// Policy URLs
router.get('/policy-urls', getPolicyUrls); // Public
router.post('/policy-urls', protect, restrictTo('admin'), addPolicyUrl);

module.exports = router;
