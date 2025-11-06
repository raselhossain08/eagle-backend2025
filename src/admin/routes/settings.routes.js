const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settings.controller');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

/**
 * @route   GET /api/admin/settings
 * @desc    Get all settings for current user
 * @access  Private
 */
router.get('/', SettingsController.getSettings);

/**
 * @route   PUT /api/admin/settings/notifications
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/notifications', SettingsController.updateNotificationSettings);

/**
 * @route   PUT /api/admin/settings/privacy
 * @desc    Update privacy settings
 * @access  Private
 */
router.put('/privacy', SettingsController.updatePrivacySettings);

/**
 * @route   PUT /api/admin/settings/security
 * @desc    Update security settings
 * @access  Private
 */
router.put('/security', SettingsController.updateSecuritySettings);

/**
 * @route   POST /api/admin/settings/2fa
 * @desc    Toggle two-factor authentication
 * @access  Private
 */
router.post('/2fa', SettingsController.toggleTwoFactor);

/**
 * @route   POST /api/admin/settings/change-password
 * @desc    Change password from settings
 * @access  Private
 */
router.post('/change-password', SettingsController.changePassword);

/**
 * @route   GET /api/admin/settings/export-data
 * @desc    Export user data
 * @access  Private
 */
router.get('/export-data', SettingsController.exportData);

/**
 * @route   POST /api/admin/settings/delete-account
 * @desc    Delete account (soft delete)
 * @access  Private
 */
router.post('/delete-account', SettingsController.deleteAccount);

/**
 * @route   GET /api/admin/settings/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', SettingsController.getActiveSessions);

/**
 * @route   DELETE /api/admin/settings/sessions/:sessionId
 * @desc    Revoke session
 * @access  Private
 */
router.delete('/sessions/:sessionId', SettingsController.revokeSession);

module.exports = router;
