const express = require('express');
const AdminAuthController = require('../controllers/auth.controller');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     AdminBearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     AdminLoginRequest:
 *       type: object
 *       required:
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Admin email address
 *         username:
 *           type: string
 *           description: Admin username (alternative to email)
 *         password:
 *           type: string
 *           description: Admin password
 *         twoFactorCode:
 *           type: string
 *           description: Two-factor authentication code (if enabled)
 *     AdminLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         token:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/AdminUser'
 *         expiresIn:
 *           type: number
 *         requiresTwoFactor:
 *           type: boolean
 *     AdminUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         fullName:
 *           type: string
 *         email:
 *           type: string
 *         username:
 *           type: string
 *         adminLevel:
 *           type: string
 *           enum: [super_admin, finance_admin, growth_marketing, support, read_only]
 *         department:
 *           type: string
 *         permissions:
 *           type: array
 *         forcePasswordChange:
 *           type: boolean
 *         isTwoFactorEnabled:
 *           type: boolean
 */

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Admin login with enhanced security
 *     description: Authenticate admin user with email/username and password. Supports 2FA, account lockouts, and login attempt tracking.
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *     responses:
 *       200:
 *         description: Login successful or 2FA required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLoginResponse'
 *       400:
 *         description: Bad request - missing credentials
 *       401:
 *         description: Invalid credentials or 2FA code
 *       423:
 *         description: Account locked due to too many failed attempts
 *       500:
 *         description: Internal server error
 */
router.post('/login', 
  AdminAuthMiddleware.rateLimitSensitiveOperations(),
  AdminAuthController.login
);

/**
 * @swagger
 * /api/admin/auth/login-2fa:
 *   post:
 *     summary: Complete admin login with 2FA
 *     description: Complete the login process by providing the two-factor authentication code
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP code or 8-character backup code
 *     responses:
 *       200:
 *         description: 2FA verification successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLoginResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid 2FA code
 */
router.post('/login-2fa', 
  AdminAuthMiddleware.rateLimitSensitiveOperations(),
  AdminAuthController.loginWith2FA
);

/**
 * @swagger
 * /api/admin/auth/profile:
 *   get:
 *     summary: Get admin user profile
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Admin user not found
 */
router.get('/profile', 
  AdminAuthMiddleware.verifyToken,
  AdminAuthController.getProfile
);

/**
 * @swagger
 * /api/admin/auth/setup-2fa:
 *   post:
 *     summary: Setup two-factor authentication
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup data generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     secret:
 *                       type: string
 *                     qrCodeUrl:
 *                       type: string
 *                     manualEntryKey:
 *                       type: string
 *       400:
 *         description: 2FA already enabled
 *       401:
 *         description: Unauthorized
 */
router.post('/setup-2fa', 
  AdminAuthMiddleware.verifyToken,
  AdminAuthController.setup2FA
);

/**
 * @swagger
 * /api/admin/auth/confirm-2fa:
 *   post:
 *     summary: Confirm and activate 2FA setup
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit verification code from authenticator app
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *       400:
 *         description: Invalid token or no pending setup
 *       401:
 *         description: Unauthorized
 */
router.post('/confirm-2fa', 
  AdminAuthMiddleware.verifyToken,
  AdminAuthController.confirm2FA
);

/**
 * @swagger
 * /api/admin/auth/disable-2fa:
 *   post:
 *     summary: Disable two-factor authentication
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - token
 *             properties:
 *               password:
 *                 type: string
 *               token:
 *                 type: string
 *                 description: Current 6-digit TOTP code
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid password or token
 */
router.post('/disable-2fa', 
  AdminAuthMiddleware.verifyToken,
  AdminAuthController.disable2FA
);

/**
 * @swagger
 * /api/admin/auth/change-password:
 *   post:
 *     summary: Change admin password (including forced password changes)
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid current password
 */
router.post('/change-password', 
  AdminAuthMiddleware.verifyToken,
  AdminAuthController.forcePasswordChange
);

/**
 * @swagger
 * /api/admin/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Admin Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset link sent (if email exists)
 *       400:
 *         description: Email is required
 */
router.post('/forgot-password', 
  AdminAuthMiddleware.rateLimitSensitiveOperations(),
  AdminAuthController.forgotPassword
);

/**
 * @swagger
 * /api/admin/auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using token
 *     tags: [Admin Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password/:token', 
  AdminAuthController.resetPassword
);

/**
 * @swagger
 * /api/admin/auth/validate-token:
 *   get:
 *     summary: Validate admin JWT token
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Invalid token
 */
router.get('/validate-token', 
  AdminAuthMiddleware.verifyToken,
  AdminAuthController.validateToken
);

/**
 * @swagger
 * /api/admin/auth/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin Authentication]
 *     security:
 *       - AdminBearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', 
  AdminAuthController.logout
);

module.exports = router;