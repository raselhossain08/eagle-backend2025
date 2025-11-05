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

module.exports = router;
