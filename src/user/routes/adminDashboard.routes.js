const express = require("express");
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Admin Dashboard - Users
 *     description: Admin Dashboard - Users API endpoints
 */

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
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with filtering, pagination, and sorting
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role
 *       - in: query
 *         name: subscription
 *         schema:
 *           type: string
 *         description: Filter by subscription
 *       - in: query
 *         name: subscriptionStatus
 *         schema:
 *           type: string
 *         description: Filter by subscription status
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *         description: Filter by user type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isBlocked
 *         schema:
 *           type: boolean
 *         description: Filter by blocked status
 *       - in: query
 *         name: isEmailVerified
 *         schema:
 *           type: boolean
 *         description: Filter by email verification
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, getAllUsers);

/**
 * @swagger
 * /api/admin/users/stats:
 *   get:
 *     summary: Get user statistics for dashboard
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get("/stats", protect, getUserStats);

/**
 * @swagger
 * /api/admin/users/export:
 *   get:
 *     summary: Export users data (JSON/CSV)
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Export format
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: subscription
 *         schema:
 *           type: string
 *       - in: query
 *         name: subscriptionStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isBlocked
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Users exported successfully
 */
router.get("/export", protect, exportUsers);

/**
 * @swagger
 * /api/admin/users/search:
 *   post:
 *     summary: Advanced search for users
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               searchTerm:
 *                 type: string
 *               filters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Search results
 */
router.post("/search", protect, searchUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get single user details
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved
 *       404:
 *         description: User not found
 */
router.get("/:id", protect, getUserDetails);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user details
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: User updated successfully
 */
router.put("/:id", protect, updateUser);

/**
 * @swagger
 * /api/admin/users/{id}/block:
 *   put:
 *     summary: Block or unblock a user
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isBlocked:
 *                 type: boolean
 *               blockedReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User block status updated
 */
router.put("/:id/block", protect, toggleBlockUser);

/**
 * @swagger
 * /api/admin/users/{id}/activate:
 *   put:
 *     summary: Activate or deactivate a user
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User activation status updated
 */
router.put("/:id/activate", protect, toggleActivateUser);

/**
 * @swagger
 * /api/admin/users/{id}/subscription:
 *   put:
 *     summary: Update user subscription from admin panel
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscription:
 *                 type: string
 *               subscriptionStatus:
 *                 type: string
 *               billingCycle:
 *                 type: string
 *               subscriptionEndDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: User subscription updated
 */
router.put("/:id/subscription", protect, updateUserSubscription);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user (permanent)
 *     tags: [Admin Dashboard - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete("/:id", protect, deleteUser);

module.exports = router;