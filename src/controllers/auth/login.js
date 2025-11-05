const User = require("../../models/user.model");
const bcrypt = require("bcryptjs");
const createError = require("http-errors");
const generateToken = require("../../utils/generateToken");
const mongoose = require("mongoose");

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

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      throw createError(401, "Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Password mismatch for:", email);
      throw createError(401, "Invalid credentials");
    }

    const token = generateToken(user);
    console.log("✅ Login successful for:", email);
    res.json({ success: true, token });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    next(err);
  }
};
