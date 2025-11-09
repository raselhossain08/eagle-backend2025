const express = require("express");
const router = express.Router();

// Import route modules
const publicUserRoutes = require("./publicUser.routes");
const adminDashboardRoutes = require("./adminDashboard.routes");
const userManagementRoutes = require("./userManagement.routes");

// User Management Routes (Admin) - Primary endpoint for frontend user management
// These routes provide comprehensive CRUD operations for user management dashboard
// Matches frontend UserService API calls to /api/users/*
router.use("/", userManagementRoutes);

// Public user routes - for website visitors, registered users, subscribers  
// These routes handle user registration, login, profile management, subscription management
// Note: Some endpoints may overlap with userManagement, routes are processed in order
// router.use("/", publicUserRoutes);

// Admin dashboard routes - Legacy/additional user management endpoints
// These routes allow admins to view, edit, block, delete, and manage all public users
router.use("/admin", adminDashboardRoutes);

module.exports = router;