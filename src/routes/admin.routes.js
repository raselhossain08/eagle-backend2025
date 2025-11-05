const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const getAllUsers = require("../controllers/admin/getAllUsers");
const updateUserSubscription = require("../controllers/admin/updateUserSubscription");

// Import admin auth routes
const adminAuthRoutes = require("../admin/routes/auth.routes");

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin-only endpoints for user management
 */

// Admin authentication routes (no middleware protection needed)
router.use("/auth", adminAuthRoutes);

// Protect all other admin routes and restrict to admin/superadmin
router.use(protect);
router.use(restrictTo("admin", "superadmin"));

router.get("/users", getAllUsers);
router.put("/users/:userId/subscription", updateUserSubscription);

module.exports = router;
