const express = require('express');
const router = express.Router();
const TwoFactorController = require('../controllers/twoFactor.controller');
const { protect } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Two-Factor Authentication
 *     description: Two-factor authentication (2FA) management
 */

// All 2FA routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/auth/2fa/setup:
 *   post:
 *     summary: Initiate 2FA setup (generate QR code)
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code generated
 */
router.post('/setup', TwoFactorController.initiateTwoFactorSetup);

/**
 * @swagger
 * /api/auth/2fa/enable:
 *   post:
 *     summary: Enable 2FA after verifying setup
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled
 */
router.post('/enable', TwoFactorController.enableTwoFactor);

/**
 * @swagger
 * /api/auth/2fa/disable:
 *   post:
 *     summary: Disable 2FA for user
 *     tags: [Two-Factor Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled
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