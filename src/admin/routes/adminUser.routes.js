const express = require('express');
const router = express.Router();
const AdminUserController = require('../controllers/adminUser.controller');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');
const RBACMiddleware = require('../middlewares/rbac.middleware');

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

// Apply RBAC permissions injection
router.use(RBACMiddleware.injectUserPermissions);

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users
 * @access  Private (requires user_management:read permission)
 */
router.get('/', 
  RBACMiddleware.checkPermission('user_management', 'read'),
  AdminUserController.getAllAdminUsers
);

/**
 * @route   GET /api/admin/users/statistics
 * @desc    Get admin user statistics
 * @access  Private (requires analytics_reports:read permission)
 */
router.get('/statistics', 
  RBACMiddleware.checkPermission('analytics_reports', 'read'),
  AdminUserController.getAdminStatistics
);

/**
 * @route   GET /api/admin/users/:adminUserId
 * @desc    Get admin user by ID
 * @access  Private (requires user_management:read permission or own profile)
 */
router.get('/:adminUserId', 
  async (req, res, next) => {
    if (req.user.id === req.params.adminUserId) {
      return next(); // User can view their own profile
    }
    // Check permission for viewing other users' profiles
    return RBACMiddleware.checkPermission('user_management', 'read')(req, res, next);
  },
  AdminUserController.getAdminUserById
);

/**
 * @route   POST /api/admin/users
 * @desc    Create new admin user
 * @access  Private (requires user_management:create permission)
 */
router.post('/', 
  RBACMiddleware.checkPermission('user_management', 'create'),
  AdminUserController.createAdminUser
);

/**
 * @route   PUT /api/admin/users/:adminUserId
 * @desc    Update admin user
 * @access  Private (requires user_management:update permission or own profile)
 */
router.put('/:adminUserId', 
  async (req, res, next) => {
    if (req.user.id === req.params.adminUserId) {
      return next(); // User can update their own profile
    }
    // Check permission for updating other users
    return RBACMiddleware.checkPermission('user_management', 'update')(req, res, next);
  },
  AdminUserController.updateAdminUser
);

/**
 * @route   DELETE /api/admin/users/:adminUserId
 * @desc    Delete admin user (soft delete)
 * @access  Private (requires user_management:delete permission)
 */
router.delete('/:adminUserId', 
  RBACMiddleware.checkPermission('user_management', 'delete'),
  AdminUserController.deleteAdminUser
);

/**
 * @route   POST /api/admin/users/:adminUserId/change-password
 * @desc    Change admin user password
 * @access  Private (requires user_management:update permission or own account)
 */
router.post('/:adminUserId/change-password', 
  async (req, res, next) => {
    if (req.user.id === req.params.adminUserId) {
      return next(); // User can change their own password
    }
    // Check permission for changing other users' passwords
    return RBACMiddleware.checkPermission('user_management', 'update')(req, res, next);
  },
  AdminUserController.changePassword
);

/**
 * @route   POST /api/admin/users/:adminUserId/reset-password
 * @desc    Reset admin user password
 * @access  Private (requires user_management:update permission)
 */
router.post('/:adminUserId/reset-password', 
  RBACMiddleware.checkPermission('user_management', 'update'),
  AdminUserController.resetPassword
);

module.exports = router;