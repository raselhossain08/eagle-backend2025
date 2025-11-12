const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Verification
 *     description: Verification API endpoints
 */
const {
    sendVerificationEmail,
    verifyEmail,
    resendVerificationEmail,
    getVerificationStatus,
    getVerificationSettings,
    updateVerificationSettings,
    getRecentAttempts
} = require('../controllers/verificationController');

const { protect, adminOnly } = require('../middlewares/auth.middleware');

// Public routes
router.post('/verify/:token', verifyEmail);

// Protected routes (authenticated users)
router.post('/send', protect, sendVerificationEmail);
router.post('/resend', protect, resendVerificationEmail);
router.get('/status', protect, getVerificationStatus);

// Admin only routes
router.get('/settings', protect, adminOnly, getVerificationSettings);
router.put('/settings', protect, adminOnly, updateVerificationSettings);
router.get('/attempts', protect, adminOnly, getRecentAttempts);

module.exports = router;
