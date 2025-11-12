const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { protect, optionalAuth } = require('../../middlewares/auth.middleware');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');
const taxRoutes = require('./tax.routes');

/**
 * @swagger
 * tags:
 *   - name: Transactions
 *     description: Transaction management and history
 */

// ========================================
// PUBLIC/GUEST ROUTES - Optional authentication
// ========================================

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction (supports guest checkout)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - type
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *               psp:
 *                 type: object
 *     responses:
 *       201:
 *         description: Transaction created successfully
 */
router.post('/', (req, res, next) => {
    console.log('🚀 [TRANSACTION ROUTE] POST / matched - optionalAuth will run next');
    next();
}, optionalAuth, transactionController.createTransaction);

// ========================================
// USER ROUTES - Authenticated users
// ========================================

// Apply authentication to remaining routes
router.use(protect);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get user's transaction history
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get('/', transactionController.getTransactions);

/**
 * @swagger
 * /api/transactions/stats:
 *   get:
 *     summary: Get user's transaction statistics
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics
 */
router.get('/stats', transactionController.getTransactionStats);

/**
 * @swagger
 * /api/transactions/search:
 *   get:
 *     summary: Search user's transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', transactionController.searchTransactions);

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Transactions]
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
 *         description: Transaction details
 */
router.get('/:id', transactionController.getTransactionById);

/**
 * @swagger
 * /api/transactions/{id}/refund:
 *   post:
 *     summary: Request refund for transaction
 *     tags: [Transactions]
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
 *         description: Refund requested
 */
router.post('/:id/refund', transactionController.requestRefund);

// ========================================
// ADMIN STATS ROUTE - Available to all authenticated users (no role check)
// ========================================

/**
 * @swagger
 * /api/transactions/admin/stats:
 *   get:
 *     summary: Get global transaction statistics
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global statistics
 */
router.get('/admin/stats', transactionController.getGlobalStats);

/**
 * @swagger
 * /api/transactions/admin/all:
 *   get:
 *     summary: Get all transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All transactions
 */
router.get('/admin/all', transactionController.getAllTransactions);

// ========================================
// ADMIN WRITE ROUTES - Admin and Moderator only
// ========================================

// Apply RBAC middleware only for write operations
router.use('/admin/:id', rbacMiddleware.checkRole(['admin', 'moderator']));

/**
 * @swagger
 * /api/transactions/admin/{id}/status:
 *   patch:
 *     summary: Update transaction status (Admin)
 *     tags: [Transactions]
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
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/admin/:id/status', transactionController.updateTransactionStatus);

/**
 * @route   POST /api/transactions/admin/:id/refund
 * @desc    Process refund for a transaction (Admin)
 * @access  Private/Admin
 */
router.post('/admin/:id/refund', transactionController.processRefund);

/**
 * @route   POST /api/transactions/admin/:id/dispute
 * @desc    Add dispute to a transaction (Admin)
 * @access  Private/Admin
 */
router.post('/admin/:id/dispute', transactionController.addDispute);

/**
 * @route   PATCH /api/transactions/admin/:id/payout
 * @desc    Update payout status for a transaction (Admin)
 * @access  Private/Admin
 */
router.patch('/admin/:id/payout', transactionController.updatePayoutStatus);

// ========================================
// TAX ROUTES - Tax calculation and reporting
// ========================================
router.use('/tax', taxRoutes);

module.exports = router;
