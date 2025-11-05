const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/role.controller');
const RBACMiddleware = require('../middlewares/rbac.middleware');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

// Apply RBAC permissions injection
router.use(RBACMiddleware.injectUserPermissions);

/**
 * @route   GET /api/roles
 * @desc    Get all roles
 * @access  Private (requires user_management:read permission)
 */
router.get('/', 
  RBACMiddleware.checkPermission('user_management', 'read'),
  RoleController.getAllRoles
);

/**
 * @route   GET /api/roles/:roleId
 * @desc    Get role by ID
 * @access  Private (requires user_management:read permission)
 */
router.get('/:roleId', 
  RBACMiddleware.checkPermission('user_management', 'read'),
  RoleController.getRoleById
);

/**
 * @route   POST /api/roles
 * @desc    Create new role
 * @access  Private (requires user_management:create permission)
 */
router.post('/', 
  RBACMiddleware.checkPermission('user_management', 'create'),
  RoleController.createRole
);

/**
 * @route   PUT /api/roles/:roleId
 * @desc    Update role
 * @access  Private (requires user_management:update permission)
 */
router.put('/:roleId', 
  RBACMiddleware.checkPermission('user_management', 'update'),
  RoleController.updateRole
);

/**
 * @route   DELETE /api/roles/:roleId
 * @desc    Delete role (soft delete)
 * @access  Private (requires user_management:delete permission)
 */
router.delete('/:roleId', 
  RBACMiddleware.checkPermission('user_management', 'delete'),
  RoleController.deleteRole
);

/**
 * @route   POST /api/roles/assign
 * @desc    Assign role to user
 * @access  Private (requires user_management:update permission)
 */
router.post('/assign', 
  RBACMiddleware.checkPermission('user_management', 'update'),
  RoleController.assignRoleToUser
);

/**
 * @route   DELETE /api/roles/user-role/:userRoleId
 * @desc    Remove role from user
 * @access  Private (requires user_management:update permission)
 */
router.delete('/user-role/:userRoleId', 
  RBACMiddleware.checkPermission('user_management', 'update'),
  RoleController.removeRoleFromUser
);

module.exports = router;