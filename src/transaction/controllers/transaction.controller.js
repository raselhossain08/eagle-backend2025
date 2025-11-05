const transactionService = require('../services/transaction.service');

/**
 * Transaction Controller - Handle HTTP requests for transactions
 */

/**
 * Get user's transaction history
 * GET /api/transactions
 */
exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            status: req.query.status,
            type: req.query.type,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sortBy: req.query.sortBy || 'timeline.initiatedAt',
            sortOrder: req.query.sortOrder || 'desc',
        };

        const result = await transactionService.getUserTransactions(userId, options);

        res.json({
            success: true,
            ...result.data,
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message,
        });
    }
};

/**
 * Get transaction by ID
 * GET /api/transactions/:id
 */
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await transactionService.getTransactionById(id);

        // Check if user owns this transaction (unless admin)
        if (result.transaction.userId.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        res.json({
            success: true,
            transaction: result.transaction,
        });
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(error.message === 'Transaction not found' ? 404 : 500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Get transaction statistics
 * GET /api/transactions/stats
 */
exports.getTransactionStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = {
            userId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            type: req.query.type,
        };

        const result = await transactionService.getTransactionStats(filters);

        res.json({
            success: true,
            stats: result.stats,
        });
    } catch (error) {
        console.error('Error fetching transaction stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction statistics',
            error: error.message,
        });
    }
};

/**
 * Search transactions
 * GET /api/transactions/search
 */
exports.searchTransactions = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required',
            });
        }

        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            sortBy: req.query.sortBy || 'timeline.initiatedAt',
            sortOrder: req.query.sortOrder || 'desc',
        };

        const result = await transactionService.searchTransactions(q, options);

        res.json({
            success: true,
            ...result.data,
        });
    } catch (error) {
        console.error('Error searching transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search transactions',
            error: error.message,
        });
    }
};

/**
 * Request refund
 * POST /api/transactions/:id/refund
 */
exports.requestRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason } = req.body;
        const userId = req.user.id;

        if (!amount || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Amount and reason are required',
            });
        }

        // Get transaction and verify ownership
        const txnResult = await transactionService.getTransactionById(id);

        if (txnResult.transaction.userId.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        const refundData = {
            amount: parseFloat(amount),
            reason,
            refundedBy: req.user.id,
        };

        const result = await transactionService.createRefund(id, refundData);

        res.json({
            success: true,
            message: 'Refund request submitted successfully',
            transaction: result.originalTransaction,
            refund: result.refundTransaction,
        });
    } catch (error) {
        console.error('Error requesting refund:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund request',
            error: error.message,
        });
    }
};

// ========================================
// ADMIN ONLY ENDPOINTS
// ========================================

/**
 * Get all transactions (Admin)
 * GET /api/transactions/admin/all
 */
exports.getAllTransactions = async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            status: req.query.status,
            type: req.query.type,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sortBy: req.query.sortBy || 'timeline.initiatedAt',
            sortOrder: req.query.sortOrder || 'desc',
        };

        const result = req.query.status
            ? await transactionService.getTransactionsByStatus(req.query.status, options)
            : await transactionService.getUserTransactions(null, options);

        res.json({
            success: true,
            ...result.data,
        });
    } catch (error) {
        console.error('Error fetching all transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message,
        });
    }
};

/**
 * Get global transaction statistics (Admin)
 * GET /api/transactions/admin/stats
 */
exports.getGlobalStats = async (req, res) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            type: req.query.type,
        };

        const result = await transactionService.getTransactionStats(filters);

        res.json({
            success: true,
            stats: result.stats,
        });
    } catch (error) {
        console.error('Error fetching global stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch global statistics',
            error: error.message,
        });
    }
};

/**
 * Update transaction status (Admin)
 * PATCH /api/transactions/admin/:id/status
 */
exports.updateTransactionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, additionalData } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required',
            });
        }

        const result = await transactionService.updateTransactionStatus(
            id,
            status,
            additionalData || {}
        );

        res.json({
            success: true,
            message: 'Transaction status updated successfully',
            transaction: result.transaction,
        });
    } catch (error) {
        console.error('Error updating transaction status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update transaction status',
            error: error.message,
        });
    }
};

/**
 * Process refund (Admin)
 * POST /api/transactions/admin/:id/refund
 */
exports.processRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason, pspRefundId } = req.body;

        if (!amount || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Amount and reason are required',
            });
        }

        const refundData = {
            amount: parseFloat(amount),
            reason,
            refundedBy: req.user.id,
            pspRefundId,
        };

        const result = await transactionService.createRefund(id, refundData);

        res.json({
            success: true,
            message: 'Refund processed successfully',
            transaction: result.originalTransaction,
            refund: result.refundTransaction,
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund',
            error: error.message,
        });
    }
};

/**
 * Add dispute (Admin)
 * POST /api/transactions/admin/:id/dispute
 */
exports.addDispute = async (req, res) => {
    try {
        const { id } = req.params;
        const disputeData = req.body;

        const result = await transactionService.addDispute(id, disputeData);

        res.json({
            success: true,
            message: 'Dispute added successfully',
            transaction: result.transaction,
        });
    } catch (error) {
        console.error('Error adding dispute:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add dispute',
            error: error.message,
        });
    }
};

/**
 * Update payout status (Admin)
 * PATCH /api/transactions/admin/:id/payout
 */
exports.updatePayoutStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const payoutData = req.body;

        const result = await transactionService.updatePayoutStatus(id, payoutData);

        res.json({
            success: true,
            message: 'Payout status updated successfully',
            transaction: result.transaction,
        });
    } catch (error) {
        console.error('Error updating payout status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payout status',
            error: error.message,
        });
    }
};
