const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/auth.middleware");
const getProfile = require("../controllers/user/getProfile");
const deleteUser = require("../controllers/user/deleteUser");

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User profile management
 */

router.get("/profile", protect, getProfile);
router.delete("/profile", protect, restrictTo("user", "admin"), deleteUser);

module.exports = router;
