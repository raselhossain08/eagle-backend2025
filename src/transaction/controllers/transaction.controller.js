const transactionService = require('../services/transaction.service');

/**
 * Transaction Controller - Handle HTTP requests for transactions
 */

/**
 * Create a new transaction
 * POST /api/transactions
 * Supports both authenticated and guest users
 */
exports.createTransaction = async (req, res) => {
    try {
        console.log('💳 createTransaction called');
        console.log('👤 User:', req.user?.email || 'Guest');
        console.log('📦 Request body:', req.body);

        // Transform frontend data to match Transaction model schema
        const requestData = req.body;

        // Determine payment method type from PSP provider or metadata
        let paymentMethodType = 'other';
        if (requestData.psp?.provider === 'paypal') {
            paymentMethodType = 'paypal';
        } else if (requestData.psp?.provider === 'stripe') {
            paymentMethodType = 'card'; // Default to card for Stripe
        } else if (requestData.metadata?.paymentMethod === 'paypal') {
            paymentMethodType = 'paypal';
        } else if (requestData.metadata?.paymentMethod === 'stripe') {
            paymentMethodType = 'card';
        }

        // Calculate amount structure (convert to cents if needed)
        const amountValue = typeof requestData.amount === 'number'
            ? requestData.amount
            : parseFloat(requestData.amount) || 0;

        const grossAmount = Math.round(amountValue * 100); // Convert to cents
        const discountAmount = requestData.metadata?.discountAmount
            ? Math.round(parseFloat(requestData.metadata.discountAmount) * 100)
            : 0;
        const netAmount = grossAmount - discountAmount;

        // Normalize status (frontend sends "completed", model expects "succeeded")
        const normalizedStatus = requestData.status === 'completed'
            ? 'succeeded'
            : requestData.status || 'pending';

        const transactionData = {
            userId: req.user?.id || null, // Use authenticated user's ID or null for guest
            type: requestData.type || 'charge',
            status: normalizedStatus,

            // Amount structure (required)
            amount: {
                gross: grossAmount,
                net: netAmount,
                fee: 0,
                tax: 0,
                discount: discountAmount,
            },

            currency: requestData.currency || 'USD',
            description: requestData.description || 'Transaction',

            // Payment method (required)
            paymentMethod: {
                type: paymentMethodType,
                ...(paymentMethodType === 'paypal' && requestData.billingDetails?.email && {
                    digital: {
                        email: requestData.billingDetails.email,
                    }
                }),
            },

            // PSP details (required)
            psp: {
                provider: requestData.psp?.provider || 'other',
                reference: requestData.psp?.reference || {},
            },

            // Optional fields
            ...(requestData.subscriptionId && { subscriptionId: requestData.subscriptionId }),
            ...(requestData.invoiceId && { invoiceId: requestData.invoiceId }),
            ...(requestData.orderId && { orderId: requestData.orderId }),
            ...(requestData.billingDetails && { billingDetails: requestData.billingDetails }),
            ...(requestData.metadata && { metadata: requestData.metadata }),
        };

        console.log('🔄 Transformed transaction data:', {
            ...transactionData,
            amount: transactionData.amount,
            status: transactionData.status,
            paymentMethod: transactionData.paymentMethod.type,
        });

        const result = await transactionService.createTransaction(transactionData);

        console.log('✅ Transaction created:', result.transaction.transactionId);

        res.status(201).json({
            success: true,
            transaction: result.transaction,
            message: 'Transaction created successfully',
        });
    } catch (error) {
        console.error('❌ Error creating transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create transaction',
            error: error.message,
        });
    }
};

/**
 * Get user's transaction history
 * GET /api/transactions
 * NOTE: Modified to show all transactions for dashboard purposes
 */
exports.getTransactions = async (req, res) => {
    try {
        console.log('🔍 getTransactions called');
        console.log('👤 User:', req.user?.email, 'Role:', req.user?.role);

        // Pass null as userId to get all transactions
        const userId = null;
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

        console.log('📋 Query options:', options);
        console.log('🔑 userId (null = all):', userId);

        const result = await transactionService.getUserTransactions(userId, options);

        console.log('✅ Result pagination:', result.data.pagination);
        console.log('📦 Transactions count:', result.data.transactions.length);

        res.json({
            success: true,
            ...result.data,
        });
    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
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
        // Only filter by userId if user is not admin
        const userId = req.user?.role === 'admin' ? undefined : req.user.id;

        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            type: req.query.type,
        };

        // Add userId filter only if not admin
        if (userId) {
            filters.userId = userId;
        }

        const result = await transactionService.getTransactionStats(filters);

        res.json({
            success: true,
            stats: result.stats,
        });
    } catch (error) {
        console.error('❌ Error fetching transaction stats:', error);
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
