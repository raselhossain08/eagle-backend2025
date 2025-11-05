const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { protect } = require('../../middlewares/auth.middleware');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');

// ========================================
// USER ROUTES - Authenticated users
// ========================================

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/transactions
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get('/', transactionController.getTransactions);

/**
 * @route   GET /api/transactions/stats
 * @desc    Get user's transaction statistics
 * @access  Private
 */
router.get('/stats', transactionController.getTransactionStats);

/**
 * @route   GET /api/transactions/search
 * @desc    Search user's transactions
 * @access  Private
 */
router.get('/search', transactionController.searchTransactions);

/**
 * @route   GET /api/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get('/:id', transactionController.getTransactionById);

/**
 * @route   POST /api/transactions/:id/refund
 * @desc    Request refund for a transaction
 * @access  Private
 */
router.post('/:id/refund', transactionController.requestRefund);

// ========================================
// ADMIN ROUTES - Admin and Moderator only
// ========================================

// Apply RBAC middleware for admin routes
router.use('/admin', rbacMiddleware.checkRole(['admin', 'moderator']));

/**
 * @route   GET /api/transactions/admin/all
 * @desc    Get all transactions (Admin)
 * @access  Private/Admin
 */
router.get('/admin/all', transactionController.getAllTransactions);

/**
 * @route   GET /api/transactions/admin/stats
 * @desc    Get global transaction statistics (Admin)
 * @access  Private/Admin
 */
router.get('/admin/stats', transactionController.getGlobalStats);

/**
 * @route   PATCH /api/transactions/admin/:id/status
 * @desc    Update transaction status (Admin)
 * @access  Private/Admin
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

module.exports = router;
