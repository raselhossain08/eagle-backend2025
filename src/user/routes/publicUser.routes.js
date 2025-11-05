const express = require("express");
const router = express.Router();

// Import controllers
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  activateAccount,
  updateSubscription,
  getDashboardData
} = require("../controllers/publicUser.controller");

// Import middleware
const { protect } = require("../../middlewares/auth.middleware");

// Public routes (no authentication required)

/**
 * @route   POST /api/users/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", registerUser);

/**
 * @route   POST /api/users/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", loginUser);

/**
 * @route   POST /api/users/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post("/forgot-password", forgotPassword);

/**
 * @route   POST /api/users/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post("/reset-password/:token", resetPassword);

/**
 * @route   POST /api/users/activate/:token
 * @desc    Activate user account
 * @access  Public
 */
router.post("/activate/:token", activateAccount);

// Protected routes (authentication required)

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get("/profile", protect, getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile", protect, updateUserProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put("/change-password", protect, changePassword);

/**
 * @route   PUT /api/users/subscription
 * @desc    Update user subscription
 * @access  Private
 */
router.put("/subscription", protect, updateSubscription);

/**
 * @route   GET /api/users/dashboard
 * @desc    Get user dashboard data
 * @access  Private
 */
router.get("/dashboard", protect, getDashboardData);

module.exports = router;