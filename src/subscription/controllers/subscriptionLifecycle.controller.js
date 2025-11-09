/**
 * Subscription Lifecycle Controller
 * Handles all subscription lifecycle operations - create, renew, cancel, upgrade/downgrade
 */

const subscriptionManagementService = require('../services/subscriptionManagement.service');
const { validationResult } = require('express-validator');

class SubscriptionLifecycleController {

    /**
     * Create new subscription
     * @route POST /api/v1/subscriptions/create
     */
    async createSubscription(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const {
                userId,
                planId,
                billingCycle = 'monthly',
                paymentData = {},
                startImmediately = true,
                trialOverride = false
            } = req.body;

            // Get user and plan data
            const User = require('../../user/models/user.model');
            const MembershipPlan = require('../models/membershipPlan.model');

            const [userData, planData] = await Promise.all([
                User.findById(userId),
                MembershipPlan.findById(planId)
            ]);

            if (!userData) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (!planData) {
                return res.status(404).json({
                    success: false,
                    message: 'Plan not found'
                });
            }

            // Prepare payment data
            const subscriptionPaymentData = {
                ...paymentData,
                billingCycle,
                amount: paymentData.amount || planData.getPriceForCycle(billingCycle)
            };

            const result = await subscriptionManagementService.createSubscription(
                userData,
                planData,
                subscriptionPaymentData
            );

            res.status(201).json({
                success: true,
                message: 'Subscription created successfully',
                data: {
                    subscription: result.subscription,
                    transaction: result.transaction,
                    plan: {
                        id: planData._id,
                        name: planData.name,
                        price: planData.getPriceForCycle(billingCycle),
                        billingCycle
                    }
                }
            });

        } catch (error) {
            console.error('Error in createSubscription controller:', error);
            const statusCode = error.message.includes('already has') ? 409 :
                error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to create subscription',
                error: error.message
            });
        }
    }

    /**
     * Process subscription renewal
     * @route POST /api/v1/subscriptions/:id/renew
     */
    async renewSubscription(req, res) {
        try {
            const { id } = req.params;
            const { paymentData = {} } = req.body;

            const result = await subscriptionManagementService.processSubscriptionRenewal(
                id,
                paymentData
            );

            res.status(200).json({
                success: true,
                message: 'Subscription renewed successfully',
                data: {
                    subscription: result.subscription,
                    transaction: result.transaction,
                    nextBillingDate: result.subscription.nextBillingDate
                }
            });

        } catch (error) {
            console.error('Error in renewSubscription controller:', error);
            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('not renewable') ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to renew subscription',
                error: error.message
            });
        }
    }

    /**
     * Cancel subscription
     * @route POST /api/v1/subscriptions/:id/cancel
     */
    async cancelSubscription(req, res) {
        try {
            const { id } = req.params;
            const {
                reason = 'voluntary',
                note,
                effectiveDate,
                immediate = false
            } = req.body;

            const cancellationData = {
                reason,
                note,
                effectiveDate: immediate ? new Date() : effectiveDate,
                userId: req.user?.id // From auth middleware
            };

            const result = await subscriptionManagementService.cancelSubscription(
                id,
                cancellationData
            );

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    subscription: result.subscription,
                    canceledAt: result.canceledAt,
                    effectiveDate: result.effectiveDate
                }
            });

        } catch (error) {
            console.error('Error in cancelSubscription controller:', error);
            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('already canceled') ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to cancel subscription',
                error: error.message
            });
        }
    }

    /**
     * Upgrade subscription
     * @route POST /api/v1/subscriptions/:id/upgrade
     */
    async upgradeSubscription(req, res) {
        try {
            const { id } = req.params;
            const {
                newPlanId,
                immediate = true,
                paymentData = {},
                reason
            } = req.body;

            const upgradeData = {
                immediate,
                paymentData,
                reason,
                userId: req.user?.id
            };

            const result = await subscriptionManagementService.upgradeSubscription(
                id,
                newPlanId,
                upgradeData
            );

            res.status(200).json({
                success: true,
                message: 'Subscription upgraded successfully',
                data: {
                    subscription: result.subscription,
                    transaction: result.transaction,
                    upgrade: result.upgrade
                }
            });

        } catch (error) {
            console.error('Error in upgradeSubscription controller:', error);
            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Only active') ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to upgrade subscription',
                error: error.message
            });
        }
    }

    /**
     * Downgrade subscription
     * @route POST /api/v1/subscriptions/:id/downgrade
     */
    async downgradeSubscription(req, res) {
        try {
            const { id } = req.params;
            const {
                newPlanId,
                immediate = false,
                reason
            } = req.body;

            const downgradeData = {
                immediate,
                reason,
                userId: req.user?.id
            };

            const result = await subscriptionManagementService.downgradeSubscription(
                id,
                newPlanId,
                downgradeData
            );

            res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    subscription: result.subscription,
                    downgrade: result.downgrade
                }
            });

        } catch (error) {
            console.error('Error in downgradeSubscription controller:', error);
            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Only active') ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to downgrade subscription',
                error: error.message
            });
        }
    }

    /**
     * Pause subscription
     * @route POST /api/v1/subscriptions/:id/pause
     */
    async pauseSubscription(req, res) {
        try {
            const { id } = req.params;
            const { reason, pausedUntil } = req.body;

            const result = await subscriptionManagementService.pauseSubscription(id, {
                reason,
                pausedUntil
            });

            res.status(200).json({
                success: true,
                message: 'Subscription paused successfully',
                data: {
                    subscription: result.subscription,
                    pausedAt: result.pausedAt,
                    pausedUntil: result.pausedUntil
                }
            });

        } catch (error) {
            console.error('Error in pauseSubscription controller:', error);
            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Only active') ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to pause subscription',
                error: error.message
            });
        }
    }

    /**
     * Resume subscription
     * @route POST /api/v1/subscriptions/:id/resume
     */
    async resumeSubscription(req, res) {
        try {
            const { id } = req.params;

            const result = await subscriptionManagementService.resumeSubscription(id);

            res.status(200).json({
                success: true,
                message: 'Subscription resumed successfully',
                data: {
                    subscription: result.subscription,
                    resumedAt: result.resumedAt
                }
            });

        } catch (error) {
            console.error('Error in resumeSubscription controller:', error);
            const statusCode = error.message.includes('not found') ? 404 :
                error.message.includes('Only paused') ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                message: 'Failed to resume subscription',
                error: error.message
            });
        }
    }

    /**
     * Get subscription details with lifecycle information
     * @route GET /api/v1/subscriptions/:id/details
     */
    async getSubscriptionDetails(req, res) {
        try {
            const { id } = req.params;

            const Subscription = require('../models/subscription.model');
            const subscription = await Subscription.findById(id)
                .populate('userId', 'name email')
                .populate('planId', 'name description pricing');

            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    message: 'Subscription not found'
                });
            }

            // Calculate additional metrics
            const metrics = {
                isActive: subscription.isActive(),
                isInTrial: subscription.isInTrial(),
                trialDaysRemaining: subscription.trialDaysRemaining(),
                ageInDays: subscription.ageInDays,
                daysUntilNextBilling: subscription.daysUntilNextBilling,
                mrr: subscription.mrr
            };

            res.status(200).json({
                success: true,
                message: 'Subscription details retrieved successfully',
                data: {
                    subscription,
                    metrics,
                    lifecycle: {
                        canUpgrade: subscription.isActive(),
                        canDowngrade: subscription.isActive(),
                        canPause: subscription.isActive(),
                        canCancel: ['trial', 'active', 'past_due'].includes(subscription.status),
                        canResume: subscription.status === 'paused'
                    }
                }
            });

        } catch (error) {
            console.error('Error in getSubscriptionDetails controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get subscription details',
                error: error.message
            });
        }
    }

    /**
     * Get subscriptions due for renewal
     * @route GET /api/v1/subscriptions/due-for-renewal
     */
    async getSubscriptionsDueForRenewal(req, res) {
        try {
            const { lookAheadDays = 3 } = req.query;

            const result = await subscriptionManagementService.getSubscriptionsDueForRenewal(
                parseInt(lookAheadDays)
            );

            res.status(200).json({
                success: true,
                message: 'Due renewals retrieved successfully',
                data: result
            });

        } catch (error) {
            console.error('Error in getSubscriptionsDueForRenewal controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get due renewals',
                error: error.message
            });
        }
    }

    /**
     * Bulk subscription operations
     * @route POST /api/v1/subscriptions/bulk
     */
    async bulkSubscriptionOperations(req, res) {
        try {
            const { operation, subscriptionIds, data = {} } = req.body;

            if (!operation || !subscriptionIds || !Array.isArray(subscriptionIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Operation and subscription IDs are required'
                });
            }

            const results = [];
            const errors = [];

            for (const subscriptionId of subscriptionIds) {
                try {
                    let result;

                    switch (operation) {
                        case 'cancel':
                            result = await subscriptionManagementService.cancelSubscription(
                                subscriptionId,
                                data
                            );
                            break;
                        case 'pause':
                            result = await subscriptionManagementService.pauseSubscription(
                                subscriptionId,
                                data
                            );
                            break;
                        case 'resume':
                            result = await subscriptionManagementService.resumeSubscription(
                                subscriptionId
                            );
                            break;
                        default:
                            throw new Error(`Unsupported operation: ${operation}`);
                    }

                    results.push({
                        subscriptionId,
                        success: true,
                        result
                    });

                } catch (error) {
                    errors.push({
                        subscriptionId,
                        error: error.message
                    });
                }
            }

            res.status(200).json({
                success: true,
                message: `Bulk ${operation} operation completed`,
                data: {
                    operation,
                    processed: subscriptionIds.length,
                    successful: results.length,
                    failed: errors.length,
                    results,
                    errors
                }
            });

        } catch (error) {
            console.error('Error in bulkSubscriptionOperations controller:', error);
            res.status(500).json({
                success: false,
                message: 'Bulk operation failed',
                error: error.message
            });
        }
    }

    /**
     * Get subscription lifecycle analytics
     * @route GET /api/v1/subscriptions/analytics/lifecycle
     */
    async getSubscriptionLifecycleAnalytics(req, res) {
        try {
            const { dateFrom, dateTo } = req.query;

            const Subscription = require('../models/subscription.model');

            // Build date filter
            const dateFilter = {};
            if (dateFrom || dateTo) {
                dateFilter.createdAt = {};
                if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
                if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
            }

            // Aggregate subscription analytics
            const [
                statusBreakdown,
                billingCycleBreakdown,
                churnAnalysis,
                totalMetrics
            ] = await Promise.all([
                // Status breakdown
                Subscription.aggregate([
                    { $match: dateFilter },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),

                // Billing cycle breakdown  
                Subscription.aggregate([
                    { $match: { ...dateFilter, status: { $in: ['trial', 'active'] } } },
                    { $group: { _id: '$billingCycle', count: { $sum: 1 }, totalMrr: { $sum: '$mrr' } } }
                ]),

                // Churn analysis
                Subscription.aggregate([
                    { $match: { ...dateFilter, status: 'canceled' } },
                    { $group: { _id: '$cancellationReason', count: { $sum: 1 } } }
                ]),

                // Total metrics
                Subscription.aggregate([
                    { $match: dateFilter },
                    {
                        $group: {
                            _id: null,
                            totalSubscriptions: { $sum: 1 },
                            activeSubscriptions: {
                                $sum: { $cond: [{ $in: ['$status', ['trial', 'active']] }, 1, 0] }
                            },
                            totalMrr: {
                                $sum: { $cond: [{ $in: ['$status', ['trial', 'active']] }, '$mrr', 0] }
                            },
                            avgSubscriptionValue: { $avg: '$currentPrice' }
                        }
                    }
                ])
            ]);

            res.status(200).json({
                success: true,
                message: 'Subscription lifecycle analytics retrieved successfully',
                data: {
                    period: { from: dateFrom, to: dateTo },
                    overview: totalMetrics[0] || {},
                    statusBreakdown,
                    billingCycleBreakdown,
                    churnAnalysis,
                    generatedAt: new Date()
                }
            });

        } catch (error) {
            console.error('Error in getSubscriptionLifecycleAnalytics controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get lifecycle analytics',
                error: error.message
            });
        }
    }
}

module.exports = new SubscriptionLifecycleController();