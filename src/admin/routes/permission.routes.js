const express = require('express');
const router = express.Router();
const PermissionController = require('../controllers/permission.controller');
const RBACMiddleware = require('../middlewares/rbac.middleware');
const { protect } = require('../../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(protect);

// Apply RBAC permissions injection
router.use(RBACMiddleware.injectUserPermissions);

/**
 * @route   GET /api/permissions
 * @desc    Get all permissions
 * @access  Private (requires system_admin:read permission)
 */
router.get('/', 
  RBACMiddleware.checkPermission('system_admin', 'read'),
  PermissionController.getAllPermissions
);

/**
 * @route   GET /api/permissions/:permissionId
 * @desc    Get permission by ID
 * @access  Private (requires system_admin:read permission)
 */
router.get('/:permissionId', 
  RBACMiddleware.checkPermission('system_admin', 'read'),
  PermissionController.getPermissionById
);

/**
 * @route   POST /api/permissions
 * @desc    Create new permission
 * @access  Private (requires system_admin:create permission)
 */
router.post('/', 
  RBACMiddleware.checkPermission('system_admin', 'create'),
  PermissionController.createPermission
);

/**
 * @route   PUT /api/permissions/:permissionId
 * @desc    Update permission
 * @access  Private (requires system_admin:update permission)
 */
router.put('/:permissionId', 
  RBACMiddleware.checkPermission('system_admin', 'update'),
  PermissionController.updatePermission
);

/**
 * @route   DELETE /api/permissions/:permissionId
 * @desc    Delete permission (soft delete)
 * @access  Private (requires system_admin:delete permission)
 */
router.delete('/:permissionId', 
  RBACMiddleware.checkPermission('system_admin', 'delete'),
  PermissionController.deletePermission
);

/**
 * @route   GET /api/permissions/category/:category
 * @desc    Get permissions by category
 * @access  Private (requires system_admin:read permission)
 */
router.get('/category/:category', 
  RBACMiddleware.checkPermission('system_admin', 'read'),
  PermissionController.getPermissionsByCategory
);

/**
 * @route   GET /api/permissions/meta/categories
 * @desc    Get all categories
 * @access  Private (requires system_admin:read permission)
 */
router.get('/meta/categories', 
  RBACMiddleware.checkPermission('system_admin', 'read'),
  PermissionController.getCategories
);

/**
 * @route   POST /api/permissions/bulk
 * @desc    Bulk create permissions
 * @access  Private (requires system_admin:create permission)
 */
router.post('/bulk', 
  RBACMiddleware.checkPermission('system_admin', 'create'),
  PermissionController.bulkCreatePermissions
);

module.exports = router;