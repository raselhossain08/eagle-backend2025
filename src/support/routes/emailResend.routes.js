/**
 * Eagle Email Resend Routes
 * Routes for email resending functionality
 */

const express = require('express');
const router = express.Router();

// Controllers
const emailResendController = require('../controllers/emailResend.controller');

// Middlewares
const { protect, adminOnly } = require('../../middlewares/auth.middleware');

// All routes require authentication and admin privileges
router.use(protect);
router.use(adminOnly);

/**
 * @route   GET /api/support/email-resend/types
 * @desc    Get available email types for resending
 * @access  Admin
 */
router.get('/types', emailResendController.getEmailTypes);

/**
 * @route   POST /api/support/email-resend/verification/:userId
 * @desc    Resend verification email
 * @access  Admin
 */
router.post('/verification/:userId', emailResendController.resendVerification);

/**
 * @route   POST /api/support/email-resend/receipt/:userId
 * @desc    Resend payment receipt
 * @access  Admin
 */
router.post('/receipt/:userId', emailResendController.resendReceipt);

/**
 * @route   POST /api/support/email-resend/contract-link/:userId
 * @desc    Resend contract link
 * @access  Admin
 */
router.post('/contract-link/:userId', emailResendController.resendContractLink);

/**
 * @route   POST /api/support/email-resend/password-reset
 * @desc    Resend password reset email
 * @access  Admin
 */
router.post('/password-reset', emailResendController.resendPasswordReset);

/**
 * @route   POST /api/support/email-resend/welcome/:userId
 * @desc    Resend welcome email
 * @access  Admin
 */
router.post('/welcome/:userId', emailResendController.resendWelcome);

/**
 * @route   POST /api/support/email-resend/bulk
 * @desc    Bulk resend emails to multiple users
 * @access  Admin
 */
router.post('/bulk', emailResendController.bulkResend);

/**
 * @route   GET /api/support/email-resend/history/:userId
 * @desc    Get resend history for a user
 * @access  Admin
 */
router.get('/history/:userId', emailResendController.getResendHistory);

/**
 * @route   GET /api/support/email-resend/rate-limits/:userId
 * @desc    Check rate limits for all email types
 * @access  Admin
 */
router.get('/rate-limits/:userId', emailResendController.checkRateLimits);

/**
 * @route   GET /api/support/email-resend/stats/:userId
 * @desc    Get resend statistics for a user
 * @access  Admin
 */
router.get('/stats/:userId', emailResendController.getResendStats);

module.exports = router;