const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');

/**
 * Transaction Service - Business logic for transaction management
 */
class TransactionService {
    /**
     * Create a new transaction
     */
    async createTransaction(transactionData) {
        try {
            const transaction = await Transaction.createCharge(transactionData);
            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }
    }

    /**
     * Get transaction by ID
     */
    async getTransactionById(transactionId) {
        try {
            const transaction = await Transaction.findOne({ transactionId })
                .populate('userId', 'name email')
                .populate('subscriptionId')
                .populate('invoiceId');

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error fetching transaction:', error);
            throw error;
        }
    }

    /**
     * Get transaction by MongoDB _id
     */
    async getTransactionByObjectId(id) {
        try {
            const transaction = await Transaction.findById(id)
                .populate('userId', 'name email')
                .populate('subscriptionId')
                .populate('invoiceId');

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error fetching transaction:', error);
            throw error;
        }
    }

    /**
     * Get transaction by PSP reference
     */
    async getTransactionByPspReference(provider, referenceId) {
        try {
            const query = {
                'psp.provider': provider,
            };

            // Check different reference fields
            if (provider === 'stripe') {
                query.$or = [
                    { 'psp.reference.chargeId': referenceId },
                    { 'psp.reference.paymentIntentId': referenceId },
                    { 'psp.reference.balanceTransactionId': referenceId },
                ];
            } else if (provider === 'paypal') {
                query.$or = [
                    { 'psp.reference.transactionId': referenceId },
                    { 'psp.reference.orderId': referenceId },
                ];
            }

            const transaction = await Transaction.findOne(query)
                .populate('userId', 'name email')
                .populate('subscriptionId')
                .populate('invoiceId');

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error fetching transaction by PSP reference:', error);
            throw error;
        }
    }

    /**
     * Get user transactions with filters and pagination
     */
    async getUserTransactions(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status,
                type,
                startDate,
                endDate,
                sortBy = 'timeline.initiatedAt',
                sortOrder = 'desc',
            } = options;

            // Build query - only add userId if provided
            const query = {};
            if (userId) {
                query.userId = userId;
            }

            console.log('🔍 getUserTransactions query:', JSON.stringify(query));
            console.log('📄 Page:', page, 'Limit:', limit);

            if (status) {
                query.status = status;
            }

            if (type) {
                query.type = type;
            }

            if (startDate || endDate) {
                query['timeline.initiatedAt'] = {};
                if (startDate) query['timeline.initiatedAt'].$gte = new Date(startDate);
                if (endDate) query['timeline.initiatedAt'].$lte = new Date(endDate);
            }

            // Sort options
            const sort = {};
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Execute query
            const skip = (page - 1) * limit;

            const [transactions, total] = await Promise.all([
                Transaction.find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate('subscriptionId', 'planId billingCycle')
                    .populate('invoiceId', 'invoiceNumber')
                    .lean(),
                Transaction.countDocuments(query),
            ]);

            console.log('✅ Database returned:', transactions.length, 'transactions');
            console.log('📊 Total count:', total);

            return {
                success: true,
                data: {
                    transactions,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: total,
                        limit,
                    },
                },
            };
        } catch (error) {
            console.error('Error fetching user transactions:', error);
            throw error;
        }
    }

    /**
     * Update transaction status
     */
    async updateTransactionStatus(transactionId, status, additionalData = {}) {
        try {
            const transaction = await Transaction.findOne({ transactionId });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            transaction.status = status;

            // Update timeline based on status
            const now = new Date();
            switch (status) {
                case 'succeeded':
                    transaction.timeline.capturedAt = now;
                    if (additionalData.pspData) {
                        Object.assign(transaction.psp.reference, additionalData.pspData);
                    }
                    break;
                case 'failed':
                    transaction.timeline.failedAt = now;
                    if (additionalData.failure) {
                        transaction.failure = additionalData.failure;
                    }
                    break;
            }

            await transaction.save();

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error updating transaction status:', error);
            throw error;
        }
    }

    /**
     * Mark transaction as succeeded
     */
    async markAsSucceeded(transactionId, pspData = {}) {
        try {
            const transaction = await Transaction.findOne({ transactionId });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            await transaction.markAsSucceeded(pspData);

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error marking transaction as succeeded:', error);
            throw error;
        }
    }

    /**
     * Mark transaction as failed
     */
    async markAsFailed(transactionId, failureData) {
        try {
            const transaction = await Transaction.findOne({ transactionId });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            await transaction.markAsFailed(failureData);

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error marking transaction as failed:', error);
            throw error;
        }
    }

    /**
     * Create refund for a transaction
     */
    async createRefund(transactionId, refundData) {
        try {
            const originalTransaction = await Transaction.findOne({ transactionId });

            if (!originalTransaction) {
                throw new Error('Original transaction not found');
            }

            // Add refund to original transaction
            await originalTransaction.addRefund(refundData);

            // Create separate refund transaction
            const refundTransaction = await Transaction.createRefund(
                originalTransaction._id,
                refundData
            );

            return {
                success: true,
                originalTransaction,
                refundTransaction,
            };
        } catch (error) {
            console.error('Error creating refund:', error);
            throw error;
        }
    }

    /**
     * Add dispute to transaction
     */
    async addDispute(transactionId, disputeData) {
        try {
            const transaction = await Transaction.findOne({ transactionId });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            await transaction.addDispute(disputeData);

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error adding dispute:', error);
            throw error;
        }
    }

    /**
     * Update payout status
     */
    async updatePayoutStatus(transactionId, payoutData) {
        try {
            const transaction = await Transaction.findOne({ transactionId });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            await transaction.updatePayoutStatus(payoutData);

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error updating payout status:', error);
            throw error;
        }
    }

    /**
     * Get transaction statistics
     */
    async getTransactionStats(filters = {}) {
        try {
            const { userId, startDate, endDate, type } = filters;

            const matchQuery = {};
            if (userId) matchQuery.userId = new mongoose.Types.ObjectId(userId);
            if (type) matchQuery.type = type;
            if (startDate || endDate) {
                matchQuery['timeline.initiatedAt'] = {};
                if (startDate) matchQuery['timeline.initiatedAt'].$gte = new Date(startDate);
                if (endDate) matchQuery['timeline.initiatedAt'].$lte = new Date(endDate);
            }

            const stats = await Transaction.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: null,
                        totalTransactions: { $sum: 1 },
                        totalAmount: { $sum: '$amount.gross' },
                        totalFees: { $sum: '$amount.fee' },
                        totalNet: { $sum: '$amount.net' },
                        succeededCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] },
                        },
                        failedCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
                        },
                        refundedCount: {
                            $sum: { $cond: [{ $in: ['$status', ['refunded', 'partially_refunded']] }, 1, 0] },
                        },
                        disputedCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] },
                        },
                    },
                },
            ]);

            // Get daily/period breakdown
            const dailyStats = await Transaction.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$timeline.initiatedAt'
                            }
                        },
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount.gross' },
                        totalFees: { $sum: '$amount.fee' },
                        succeeded: {
                            $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] }
                        }
                    }
                },
                {
                    $project: {
                        date: '$_id',
                        count: 1,
                        totalAmount: 1,
                        totalFees: 1,
                        succeeded: 1,
                        _id: 0
                    }
                },
                { $sort: { date: 1 } }
            ]);

            const result = stats[0] || {
                totalTransactions: 0,
                totalAmount: 0,
                totalFees: 0,
                totalNet: 0,
                succeededCount: 0,
                failedCount: 0,
                refundedCount: 0,
                disputedCount: 0,
            };

            // Calculate success rate
            const successRate = result.totalTransactions > 0
                ? parseFloat(((result.succeededCount / result.totalTransactions) * 100).toFixed(2))
                : 0;

            result.successRate = successRate;

            // Add daily breakdown
            result.byPeriod = dailyStats;
            result.dailyStats = dailyStats;

            return {
                success: true,
                stats: result,
            };
        } catch (error) {
            console.error('Error fetching transaction stats:', error);
            throw error;
        }
    }

    /**
     * Get transactions by status
     */
    async getTransactionsByStatus(status, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'timeline.initiatedAt',
                sortOrder = 'desc',
            } = options;

            const sort = {};
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

            const skip = (page - 1) * limit;

            const [transactions, total] = await Promise.all([
                Transaction.find({ status })
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate('userId', 'name email')
                    .populate('subscriptionId', 'planId')
                    .lean(),
                Transaction.countDocuments({ status }),
            ]);

            return {
                success: true,
                data: {
                    transactions,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: total,
                        limit,
                    },
                },
            };
        } catch (error) {
            console.error('Error fetching transactions by status:', error);
            throw error;
        }
    }

    /**
     * Add webhook event to transaction
     */
    async addWebhookEvent(transactionId, eventData) {
        try {
            const transaction = await Transaction.findOne({ transactionId });

            if (!transaction) {
                throw new Error('Transaction not found');
            }

            await transaction.addWebhookEvent(eventData);

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error adding webhook event:', error);
            throw error;
        }
    }

    /**
     * Search transactions
     */
    async searchTransactions(searchQuery, options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'timeline.initiatedAt',
                sortOrder = 'desc',
            } = options;

            // Build search query
            const query = {
                $or: [
                    { transactionId: { $regex: searchQuery, $options: 'i' } },
                    { 'psp.reference.chargeId': { $regex: searchQuery, $options: 'i' } },
                    { 'psp.reference.paymentIntentId': { $regex: searchQuery, $options: 'i' } },
                    { 'psp.reference.transactionId': { $regex: searchQuery, $options: 'i' } },
                    { 'billing.email': { $regex: searchQuery, $options: 'i' } },
                    { description: { $regex: searchQuery, $options: 'i' } },
                ],
            };

            const sort = {};
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

            const skip = (page - 1) * limit;

            const [transactions, total] = await Promise.all([
                Transaction.find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate('userId', 'name email')
                    .lean(),
                Transaction.countDocuments(query),
            ]);

            return {
                success: true,
                data: {
                    transactions,
                    pagination: {
                        current: page,
                        total: Math.ceil(total / limit),
                        count: total,
                        limit,
                    },
                },
            };
        } catch (error) {
            console.error('Error searching transactions:', error);
            throw error;
        }
    }
}

module.exports = new TransactionService();
