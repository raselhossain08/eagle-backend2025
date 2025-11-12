const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Audit Logs
 *     description: Audit Logs API endpoints
 */
const AuditController = require('../controllers/audit.controller');
const RBACMiddleware = require('../middlewares/rbac.middleware');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

// Apply RBAC permissions injection
router.use(RBACMiddleware.injectUserPermissions);

/**
 * @route   GET /api/audit
 * @desc    Get audit logs
 * @access  Private (requires security_settings:read permission)
 */
router.get('/', 
  RBACMiddleware.checkPermission('security_settings', 'read'),
  AuditController.getAuditLogs
);

/**
 * @route   GET /api/audit/statistics
 * @desc    Get audit statistics
 * @access  Private (requires analytics_reports:read permission)
 */
router.get('/statistics', 
  RBACMiddleware.checkPermission('analytics_reports', 'read'),
  AuditController.getAuditStatistics
);

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get user activity log
 * @access  Private (requires security_settings:read permission OR own profile)
 */
router.get('/user/:userId', 
  // Allow users to view their own audit logs or require permission for others
  async (req, res, next) => {
    if (req.user.id === req.params.userId) {
      return next(); // User can view their own audit logs
    }
    // Check permission for viewing other users' audit logs
    return RBACMiddleware.checkPermission('security_settings', 'read')(req, res, next);
  },
  AuditController.getUserActivity
);

/**
 * @route   GET /api/audit/security-events
 * @desc    Get security events
 * @access  Private (requires security_settings:read permission)
 */
router.get('/security-events', 
  RBACMiddleware.checkPermission('security_settings', 'read'),
  AuditController.getSecurityEvents
);

module.exports = router;