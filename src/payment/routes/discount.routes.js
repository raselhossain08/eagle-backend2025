const express = require('express');
const {
  getDiscountStats,
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscountCode,
  getDiscountAnalytics,
  bulkGenerateDiscounts,
  exportDiscounts
} = require('../controllers/discount.controller');

const { protect } = require('../../middlewares/auth.middleware');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Discounts
 *     description: Discount code management and validation
 */

/**
 * @swagger
 * /api/discounts/public/verify:
 *   post:
 *     summary: Verify discount code (Public)
 *     tags: [Discounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Discount code validated
 *       404:
 *         description: Invalid discount code
 */
router.post('/public/verify', validateDiscountCode);

/**
 * @swagger
 * /api/discounts/public/verify/{code}:
 *   get:
 *     summary: Verify discount code by code (Public)
 *     tags: [Discounts]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Discount code details
 */
router.get('/public/verify/:code', validateDiscountCode);

// Apply authentication to remaining routes
router.use(protect);

/**
 * @swagger
 * /api/discounts/validate/{code}:
 *   get:
 *     summary: Validate discount code (Authenticated)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Discount validated
 */
router.get('/validate/:code', validateDiscountCode);

// Admin routes
router.use(rbacMiddleware.checkRole(['admin', 'moderator']));

/**
 * @swagger
 * /api/discounts/stats:
 *   get:
 *     summary: Get discount statistics (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discount statistics
 */
router.get('/stats', getDiscountStats);

/**
 * @swagger
 * /api/discounts/analytics:
 *   get:
 *     summary: Get discount analytics (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Discount analytics data
 */
router.get('/analytics', getDiscountAnalytics);

/**
 * @swagger
 * /api/discounts/export:
 *   get:
 *     summary: Export discounts (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exported discount data
 */
router.get('/export', exportDiscounts);

/**
 * @swagger
 * /api/discounts/bulk-generate:
 *   post:
 *     summary: Bulk generate discount codes (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: number
 *               discountPercent:
 *                 type: number
 *     responses:
 *       200:
 *         description: Discounts generated
 */
router.post('/bulk-generate', bulkGenerateDiscounts);

/**
 * @swagger
 * /api/discounts:
 *   get:
 *     summary: Get all discounts (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of discounts
 *   post:
 *     summary: Create discount (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               discountPercent:
 *                 type: number
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Discount created
 */
router.get('/', getDiscounts);
router.post('/', createDiscount);

/**
 * @swagger
 * /api/discounts/{id}:
 *   get:
 *     summary: Get discount by ID (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Discount details
 *   put:
 *     summary: Update discount (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Discount updated
 *   delete:
 *     summary: Delete discount (Admin)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Discount deleted
 */
router.get('/:id', getDiscountById);
router.put('/:id', updateDiscount);
router.delete('/:id', deleteDiscount);

module.exports = router;





