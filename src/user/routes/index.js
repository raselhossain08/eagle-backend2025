const express = require("express");
const router = express.Router();

// Import route modules
const publicUserRoutes = require("./publicUser.routes");
const adminDashboardRoutes = require("./adminDashboard.routes");

// Public user routes - for website visitors, registered users, subscribers
// These routes handle user registration, login, profile management, subscription management
router.use("/", publicUserRoutes);

// Admin dashboard routes - for managing users from admin panel
// These routes allow admins to view, edit, block, delete, and manage all public users
router.use("/admin", adminDashboardRoutes);

module.exports = router;