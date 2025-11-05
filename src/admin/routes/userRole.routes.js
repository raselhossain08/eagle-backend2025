const express = require('express');
const router = express.Router();
const UserRoleController = require('../controllers/userRole.controller');
const RBACMiddleware = require('../middlewares/rbac.middleware');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

// Apply RBAC permissions injection
router.use(RBACMiddleware.injectUserPermissions);

/**
 * @route   GET /api/user-roles
 * @desc    Get all user role assignments
 * @access  Private (requires user_management:read permission)
 */
router.get('/', 
  RBACMiddleware.checkPermission('user_management', 'read'),
  UserRoleController.getAllUserRoles
);

/**
 * @route   GET /api/user-roles/user/:userId
 * @desc    Get user's roles and permissions
 * @access  Private (requires user_management:read permission OR own profile)
 */
router.get('/user/:userId', 
  // Allow users to view their own roles or require permission for others
  async (req, res, next) => {
    if (req.user.id === req.params.userId) {
      return next(); // User can view their own roles
    }
    // Check permission for viewing other users' roles
    return RBACMiddleware.checkPermission('user_management', 'read')(req, res, next);
  },
  UserRoleController.getUserRolesAndPermissions
);

/**
 * @route   GET /api/user-roles/check-permission/:userId
 * @desc    Check if user has specific permission
 * @access  Private (requires user_management:read permission)
 */
router.get('/check-permission/:userId', 
  RBACMiddleware.checkPermission('user_management', 'read'),
  UserRoleController.checkUserPermission
);

/**
 * @route   GET /api/user-roles/role/:roleId/users
 * @desc    Get users by role
 * @access  Private (requires user_management:read permission)
 */
router.get('/role/:roleId/users', 
  RBACMiddleware.checkPermission('user_management', 'read'),
  UserRoleController.getUsersByRole
);

/**
 * @route   PUT /api/user-roles/:userRoleId
 * @desc    Update user role assignment
 * @access  Private (requires user_management:update permission)
 */
router.put('/:userRoleId', 
  RBACMiddleware.checkPermission('user_management', 'update'),
  UserRoleController.updateUserRole
);

/**
 * @route   GET /api/user-roles/statistics
 * @desc    Get role statistics
 * @access  Private (requires analytics_reports:read permission)
 */
router.get('/statistics', 
  RBACMiddleware.checkPermission('analytics_reports', 'read'),
  UserRoleController.getRoleStatistics
);

/**
 * @route   POST /api/user-roles/bulk-assign
 * @desc    Bulk assign role to multiple users
 * @access  Private (requires user_management:create permission)
 */
router.post('/bulk-assign', 
  RBACMiddleware.checkPermission('user_management', 'create'),
  UserRoleController.bulkAssignRole
);

module.exports = router;