/**
 * Eagle Support Impersonation Routes
 * Routes for user impersonation functionality
 */

const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: User Impersonation
 *     description: User Impersonation API endpoints
 */

// Controllers
const impersonationController = require('../controllers/impersonation.controller');

// Middlewares
const { protect, adminOnly } = require('../../middlewares/auth.middleware');
const { 
  initializeImpersonation,
  validateImpersonation,
  requireWriteConfirmation,
  addImpersonationBanner,
  auditSupportAction
} = require('../middlewares/impersonation.middleware');

// All routes require authentication and admin privileges
router.use(protect);
router.use(adminOnly);

/**
 * @route   POST /api/support/impersonation/start
 * @desc    Start user impersonation session
 * @access  Admin
 */
router.post('/start', 
  initializeImpersonation,
  impersonationController.startImpersonation
);

/**
 * @route   GET /api/support/impersonation/sessions
 * @desc    Get active impersonation sessions for current user
 * @access  Admin
 */
router.get('/sessions',
  auditSupportAction('VIEW_SESSIONS'),
  impersonationController.getActiveSessions
);

/**
 * @route   GET /api/support/impersonation/sessions/all
 * @desc    Get all impersonation sessions (super admin only)
 * @access  Super Admin
 */
router.get('/sessions/all',
  auditSupportAction('VIEW_ALL_SESSIONS'),
  impersonationController.getAllSessions
);

/**
 * @route   GET /api/support/impersonation/sessions/:sessionId
 * @desc    Get session details
 * @access  Admin
 */
router.get('/sessions/:sessionId',
  auditSupportAction('VIEW_SESSION_DETAILS'),
  impersonationController.getSessionDetails
);

/**
 * @route   PUT /api/support/impersonation/sessions/:sessionId/extend
 * @desc    Extend session duration
 * @access  Admin
 */
router.put('/sessions/:sessionId/extend',
  auditSupportAction('EXTEND_SESSION'),
  impersonationController.extendSession
);

/**
 * @route   POST /api/support/impersonation/sessions/:sessionId/end
 * @desc    End impersonation session
 * @access  Admin
 */
router.post('/sessions/:sessionId/end',
  auditSupportAction('END_SESSION'),
  impersonationController.endImpersonation
);

/**
 * @route   POST /api/support/impersonation/sessions/:sessionId/actions/:actionId/approve
 * @desc    Approve write action for impersonation session
 * @access  Admin
 */
router.post('/sessions/:sessionId/actions/:actionId/approve',
  auditSupportAction('APPROVE_WRITE_ACTION'),
  impersonationController.approveWriteAction
);

/**
 * @route   GET /api/support/impersonation/sessions/:sessionId/audit
 * @desc    Get audit log for session
 * @access  Admin
 */
router.get('/sessions/:sessionId/audit',
  auditSupportAction('VIEW_AUDIT_LOG'),
  impersonationController.getAuditLog
);

module.exports = router;