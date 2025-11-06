const User = require("../../user/models/user.model");
const createError = require("http-errors");
const generateToken = require("../../utils/generateToken");
const mongoose = require("mongoose");

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 description: User role (optional, defaults to 'user')
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *       409:
 *         description: Email already in use
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

    const { firstName, lastName, email, password, role } = req.body;

    console.log("📝 Registration attempt for:", email);

    if (!firstName || !lastName || !email || !password) {
      throw createError(400, "All fields are required");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("❌ Email already exists:", email);
      throw createError(409, "Email already in use");
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || "user",
    });

    const token = generateToken(user);
    console.log("✅ Registration successful for:", email);
    res.status(201).json({ success: true, token });
  } catch (err) {
    next(err);
  }
};
