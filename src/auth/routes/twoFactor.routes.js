const express = require('express');
const router = express.Router();
const TwoFactorController = require('../controllers/twoFactor.controller');
const { protect } = require('../middlewares/auth.middleware');

// All 2FA routes require authentication
router.use(protect);

/**
 * @route   POST /api/auth/2fa/setup
 * @desc    Initiate 2FA setup (generate QR code)
 * @access  Private
 */
router.post('/setup', TwoFactorController.initiateTwoFactorSetup);

/**
 * @route   POST /api/auth/2fa/enable
 * @desc    Enable 2FA after verifying setup
 * @access  Private
 */
router.post('/enable', TwoFactorController.enableTwoFactor);

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable 2FA for user
 * @access  Private
 */
router.post('/disable', TwoFactorController.disableTwoFactor);

/**
 * @route   POST /api/auth/2fa/verify
 * @desc    Verify 2FA token
 * @access  Private
 */
router.post('/verify', TwoFactorController.verifyTwoFactorToken);

/**
 * @route   GET /api/auth/2fa/status
 * @desc    Get 2FA status for current user
 * @access  Private
 */
router.get('/status', TwoFactorController.getTwoFactorStatus);

/**
 * @route   POST /api/auth/2fa/backup-codes
 * @desc    Generate new backup codes
 * @access  Private
 */
router.post('/backup-codes', TwoFactorController.generateBackupCodes);

/**
 * @route   POST /api/auth/2fa/emergency-access
 * @desc    Generate emergency access code (admin only)
 * @access  Private (Admin)
 */
router.post('/emergency-access', TwoFactorController.generateEmergencyAccess);

module.exports = router;