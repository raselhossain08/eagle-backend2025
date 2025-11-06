const User = require("../../user/models/user.model");
const bcrypt = require("bcryptjs");
const createError = require("http-errors");
const generateToken = require("../../utils/generateToken");
const mongoose = require("mongoose");
const wordpressAuthService = require("../../services/wordpressAuth.service");

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         description: Invalid credentials
 */
module.exports = async (req, res, next) => {
  try {
    // Check if MongoDB connection is ready
    if (mongoose.connection.readyState !== 1) {
      console.log("🔄 MongoDB not ready, waiting for connection...");
      // Wait for connection to be ready (max 5 seconds)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Database connection timeout"));
        }, 5000);

        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      });
    }

    const { email, password } = req.body;

    console.log("🔐 Login attempt for:", email);

    if (!email || !password) {
      throw createError(400, "Please provide email and password");
    }

    // Try WordPress authentication with fallback to local
    // This allows seamless login for WordPress users even before migration
    const authResult = await wordpressAuthService.authenticateWithWordPressFallback(
      email,
      password
    );

    if (!authResult.success) {
      console.log("❌ Authentication failed for:", email);
      throw createError(401, "Invalid credentials");
    }

    // Generate JWT token for local system
    const token = generateToken(authResult.user);

    console.log(`✅ Login successful for: ${email} (${authResult.isWordPressAuth ? 'WordPress' : 'Local'} auth)`);

    res.json({
      success: true,
      token,
      authType: authResult.isWordPressAuth ? 'wordpress' : 'local',
      message: authResult.message
    });

  } catch (err) {
    console.error("❌ Login error:", err.message);
    next(err);
  }
};