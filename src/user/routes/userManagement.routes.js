const express = require('express');
const router = express.Router();
const {
    getUsers,
    getUserStats,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    bulkAction,
    changeUserRole,
    changeUserStatus,
    sendPasswordReset,
    verifyUserEmail,
    getUserActivity
} = require('../controllers/userManagement.controller');

// Import middleware
const { protect } = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/auth.middleware');

/**
 * User Management Routes
 * All routes are protected and require admin authentication
 */

// Apply authentication middleware to all routes
router.use(protect);
router.use(adminOnly);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics for dashboard
 * @access  Private (Admin only)
 */
router.get('/stats', getUserStats);

/**
 * @route   POST /api/users/bulk-action
 * @desc    Perform bulk actions on multiple users
 * @access  Private (Admin only)
 * @body    { action: string, userIds: string[], data?: any }
 */
router.post('/bulk-action', bulkAction);

/**
 * @route   GET /api/users
 * @desc    Get all users with filtering, pagination, and sorting
 * @access  Private (Admin only)
 * @query   page, limit, search, role, status, subscription, subscriptionStatus, 
 *          isEmailVerified, sortBy, sortOrder, startDate, endDate
 */
router.get('/', getUsers);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin only)
 * @body    { firstName, lastName, email, password, username?, role?, subscription?, ... }
 */
router.post('/', createUser);

/**
 * @route   GET /api/users/:id
 * @desc    Get single user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user details
 * @access  Private (Admin only)
 * @body    { firstName?, lastName?, email?, role?, subscription?, ... }
 */
router.put('/:id', updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user permanently
 * @access  Private (Admin only)
 */
router.delete('/:id', deleteUser);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Change user role
 * @access  Private (Admin only)
 * @body    { role: string }
 */
router.put('/:id/role', changeUserRole);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Change user status (active, inactive, suspended, pending)
 * @access  Private (Admin only)
 * @body    { status: string }
 */
router.put('/:id/status', changeUserStatus);

/**
 * @route   POST /api/users/:id/send-password-reset
 * @desc    Send password reset email to user
 * @access  Private (Admin only)
 */
router.post('/:id/send-password-reset', sendPasswordReset);

/**
 * @route   POST /api/users/:id/verify-email
 * @desc    Manually verify user email
 * @access  Private (Admin only)
 */
router.post('/:id/verify-email', verifyUserEmail);

/**
 * @route   GET /api/users/:id/activity
 * @desc    Get user activity logs
 * @access  Private (Admin only)
 * @query   page, limit
 */
router.get('/:id/activity', getUserActivity);

module.exports = router;
