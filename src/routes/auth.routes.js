const express = require("express");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and registration
 */

const register = require("../controllers/auth/register");
const login = require("../controllers/auth/login");
const forgotPassword = require("../controllers/auth/forgotPassword");
const resetPassword = require("../controllers/auth/resetPassword");
const getAuthProfile = require("../controllers/auth/getAuthProfile");
const { activateAccount, setPassword, resendActivation } = require("../controllers/auth/activation");
const {
    migrateWordPressUser,
    checkUserExists,
    bulkMigrateWordPressUsers,
    getMigrationStats,
    getMigrationHistory,
    checkMigrationStatus
} = require("../controllers/auth/migrateWordPressUser");
const { protect } = require("../middlewares/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/profile", protect, getAuthProfile);

// Account activation routes
router.get("/activate/:token", activateAccount);
router.post("/set-password", setPassword);
router.post("/resend-activation", resendActivation);

// WordPress migration routes
router.post("/migrate-wordpress-user", migrateWordPressUser);
router.post("/bulk-migrate-wordpress-users", bulkMigrateWordPressUsers);
router.get("/check-user-exists", checkUserExists);
router.get("/migration-stats", getMigrationStats);
router.get("/migration-history", getMigrationHistory);
router.post("/check-migration-status", checkMigrationStatus);

module.exports = router;
