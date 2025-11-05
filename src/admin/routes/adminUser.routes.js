const express = require('express');
const router = express.Router();
const AdminUserController = require('../controllers/adminUser.controller');
const { protect } = require('../../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users
 * @access  Private (Super Admin, Admin)
 */
router.get('/', 
  // Add permission check middleware here if needed
  AdminUserController.getAllAdminUsers
);

/**
 * @route   GET /api/admin/users/statistics
 * @desc    Get admin user statistics
 * @access  Private (Super Admin, Admin)
 */
router.get('/statistics', 
  AdminUserController.getAdminStatistics
);

/**
 * @route   GET /api/admin/users/:adminUserId
 * @desc    Get admin user by ID
 * @access  Private (Super Admin, Admin, or own profile)
 */
router.get('/:adminUserId', 
  AdminUserController.getAdminUserById
);

/**
 * @route   POST /api/admin/users
 * @desc    Create new admin user
 * @access  Private (Super Admin only)
 */
router.post('/', 
  // Add super admin check middleware here
  AdminUserController.createAdminUser
);

/**
 * @route   PUT /api/admin/users/:adminUserId
 * @desc    Update admin user
 * @access  Private (Super Admin, Admin, or own profile)
 */
router.put('/:adminUserId', 
  AdminUserController.updateAdminUser
);

/**
 * @route   DELETE /api/admin/users/:adminUserId
 * @desc    Delete admin user (soft delete)
 * @access  Private (Super Admin only)
 */
router.delete('/:adminUserId', 
  AdminUserController.deleteAdminUser
);

/**
 * @route   POST /api/admin/users/:adminUserId/change-password
 * @desc    Change admin user password
 * @access  Private (Super Admin or own account)
 */
router.post('/:adminUserId/change-password', 
  AdminUserController.changePassword
);

/**
 * @route   POST /api/admin/users/:adminUserId/reset-password
 * @desc    Reset admin user password
 * @access  Private (Super Admin only)
 */
router.post('/:adminUserId/reset-password', 
  AdminUserController.resetPassword
);

module.exports = router;