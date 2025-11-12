const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Admin Users
 *     description: Admin Users API endpoints
 */
const AdminUserController = require('../controllers/adminUser.controller');
const AdminAuthMiddleware = require('../middlewares/auth.middleware');
const RBACMiddleware = require('../middlewares/rbac.middleware');

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.verifyToken);

// Apply RBAC permissions injection
router.use(RBACMiddleware.injectUserPermissions);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all admin users
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of admin users retrieved
 */
router.get('/',
  RBACMiddleware.checkPermission('user_management', 'read'),
  AdminUserController.getAllAdminUsers
);

/**
 * @swagger
 * /api/admin/users/statistics:
 *   get:
 *     summary: Get admin user statistics
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin statistics retrieved
 */
router.get('/statistics',
  RBACMiddleware.checkPermission('analytics_reports', 'read'),
  AdminUserController.getAdminStatistics
);

/**
 * @swagger
 * /api/admin/users/{adminUserId}:
 *   get:
 *     summary: Get admin user by ID
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     responses:
 *       200:
 *         description: Admin user details retrieved
 */
router.get('/:adminUserId',
  async (req, res, next) => {
    if (req.user.id === req.params.adminUserId) {
      return next(); // User can view their own profile
    }
    // Check permission for viewing other users' profiles
    return RBACMiddleware.checkPermission('user_management', 'read')(req, res, next);
  },
  AdminUserController.getAdminUserById
);

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create new admin user
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin user created
 */
router.post('/',
  RBACMiddleware.checkPermission('user_management', 'create'),
  AdminUserController.createAdminUser
);

/**
 * @swagger
 * /api/admin/users/{adminUserId}:
 *   put:
 *     summary: Update admin user
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Admin user updated
 */
router.put('/:adminUserId',
  async (req, res, next) => {
    if (req.user.id === req.params.adminUserId) {
      return next(); // User can update their own profile
    }
    // Check permission for updating other users
    return RBACMiddleware.checkPermission('user_management', 'update')(req, res, next);
  },
  AdminUserController.updateAdminUser
);

/**
 * @swagger
 * /api/admin/users/{adminUserId}:
 *   delete:
 *     summary: Delete admin user (soft delete)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     responses:
 *       200:
 *         description: Admin user deleted
 */
router.delete('/:adminUserId',
  RBACMiddleware.checkPermission('user_management', 'delete'),
  AdminUserController.deleteAdminUser
);

/**
 * @swagger
 * /api/admin/users/{adminUserId}/change-password:
 *   post:
 *     summary: Change admin user password
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
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
 */
router.post('/:adminUserId/change-password',
  async (req, res, next) => {
    if (req.user.id === req.params.adminUserId) {
      return next(); // User can change their own password
    }
    // Check permission for changing other users' passwords
    return RBACMiddleware.checkPermission('user_management', 'update')(req, res, next);
  },
  AdminUserController.changePassword
);

/**
 * @swagger
 * /api/admin/users/{adminUserId}/reset-password:
 *   post:
 *     summary: Reset admin user password
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin user ID
 *     responses:
 *       200:
 *         description: Password reset link sent
 */
router.post('/:adminUserId/reset-password',
  RBACMiddleware.checkPermission('user_management', 'update'),
  AdminUserController.resetPassword
);

module.exports = router;