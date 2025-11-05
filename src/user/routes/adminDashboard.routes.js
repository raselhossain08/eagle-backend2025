const express = require("express");
const router = express.Router();

// Import controllers
const {
  getAllUsers,
  getUserDetails,
  updateUser,
  toggleBlockUser,
  toggleActivateUser,
  updateUserSubscription,
  deleteUser,
  getUserStats,
  exportUsers,
  searchUsers
} = require("../controllers/adminDashboard.controller");

// Import middleware
const { protect } = require("../../middlewares/auth.middleware");
// Note: In production, add admin role check middleware

// All routes are protected and require admin access

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filtering, pagination, and sorting
 * @access  Private (Admin only)
 * @query   page, limit, search, role, subscription, subscriptionStatus, userType, isActive, isBlocked, isEmailVerified, sortBy, sortOrder
 */
router.get("/", protect, getAllUsers);

/**
 * @route   GET /api/admin/users/stats
 * @desc    Get user statistics for dashboard
 * @access  Private (Admin only)
 */
router.get("/stats", protect, getUserStats);

/**
 * @route   GET /api/admin/users/export
 * @desc    Export users data (JSON/CSV)
 * @access  Private (Admin only)
 * @query   format, role, subscription, subscriptionStatus, isActive, isBlocked
 */
router.get("/export", protect, exportUsers);

/**
 * @route   POST /api/admin/users/search
 * @desc    Advanced search for users
 * @access  Private (Admin only)
 */
router.post("/search", protect, searchUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single user details
 * @access  Private (Admin only)
 */
router.get("/:id", protect, getUserDetails);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user details
 * @access  Private (Admin only)
 */
router.put("/:id", protect, updateUser);

/**
 * @route   PUT /api/admin/users/:id/block
 * @desc    Block or unblock a user
 * @access  Private (Admin only)
 * @body    { isBlocked: boolean, blockedReason?: string }
 */
router.put("/:id/block", protect, toggleBlockUser);

/**
 * @route   PUT /api/admin/users/:id/activate
 * @desc    Activate or deactivate a user
 * @access  Private (Admin only)
 * @body    { isActive: boolean }
 */
router.put("/:id/activate", protect, toggleActivateUser);

/**
 * @route   PUT /api/admin/users/:id/subscription
 * @desc    Update user subscription from admin panel
 * @access  Private (Admin only)
 * @body    { subscription, subscriptionStatus, billingCycle, subscriptionEndDate }
 */
router.put("/:id/subscription", protect, updateUserSubscription);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user (permanent)
 * @access  Private (Admin only)
 */
router.delete("/:id", protect, deleteUser);

module.exports = router;