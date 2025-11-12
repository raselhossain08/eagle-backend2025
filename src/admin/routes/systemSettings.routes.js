const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: System Settings
 *     description: System Settings API endpoints
 */
const {
    getSystemSettings,
    updateSystemSettings,
    getPublicSettings,
    getFeatureFlags,
    addFeatureFlag,
    updateFeatureFlag,
    deleteFeatureFlag,
    checkFeatureFlag,
    getLegalTexts,
    addLegalText,
    updateLegalText,
    approveLegalText,
    getPolicyUrls,
    addPolicyUrl,
    updatePolicyUrl,
    deletePolicyUrl,
    getConfigurations,
    updateConfiguration,
    toggleMaintenanceMode,
    exportSettings,
    getSystemSettingsAnalytics
} = require('../controllers/systemSettings.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');
const { optionalAuth } = require('../../middlewares/auth.middleware');

// Analytics endpoint (must come before root route)
router.get('/analytics', protect, restrictTo('admin'), getSystemSettingsAnalytics);

// Public endpoint (no auth required)
router.get('/public', getPublicSettings);

// Export endpoint
router.get('/export', protect, restrictTo('admin'), exportSettings);

// Maintenance Mode
router.post('/maintenance-mode', protect, restrictTo('admin'), toggleMaintenanceMode);

// System Settings - Main endpoints
router.get('/', optionalAuth, getSystemSettings); // Public with optional auth for different views
router.put('/', protect, restrictTo('admin'), updateSystemSettings);

// Feature Flags
router.get('/feature-flags', optionalAuth, getFeatureFlags);
router.post('/feature-flags', protect, restrictTo('admin'), addFeatureFlag);
router.get('/feature-flag/:key/check', checkFeatureFlag);
router.put('/feature-flags/:key', protect, restrictTo('admin'), updateFeatureFlag);
router.delete('/feature-flags/:key', protect, restrictTo('admin'), deleteFeatureFlag);

// Legal Texts
router.get('/legal-texts', getLegalTexts); // Public
router.post('/legal-texts', protect, restrictTo('admin'), addLegalText);
router.put('/legal-texts/:id', protect, restrictTo('admin'), updateLegalText);
router.post('/legal-texts/:id/approve', protect, restrictTo('admin'), approveLegalText);

// Policy URLs
router.get('/policy-urls', getPolicyUrls); // Public
router.post('/policy-urls', protect, restrictTo('admin'), addPolicyUrl);
router.put('/policy-urls/:key', protect, restrictTo('admin'), updatePolicyUrl);
router.delete('/policy-urls/:key', protect, restrictTo('admin'), deletePolicyUrl);

// Configurations
router.get('/configurations', protect, restrictTo('admin'), getConfigurations);
router.put('/configurations/:key', protect, restrictTo('admin'), updateConfiguration);

module.exports = router;
