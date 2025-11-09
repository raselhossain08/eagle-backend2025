/**
 * Subscription Management Controller
 * Handles admin dashboard subscription management operations
 * All logic delegated to service layer
 */

const subscriptionDashboardService = require('../services/subscriptionDashboard.service');
const { validationResult } = require('express-validator');
const AuditLog = require('../models/auditLog.model');

/**
 * Get subscription analytics
 * @route GET /api/subscription/analytics
 */
exports.getAnalytics = async (req, res) => {
    try {
        const result = await subscriptionDashboardService.getAnalytics();

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get analytics'
        });
    }
};

/**
 * Get all subscriptions with filtering
 * @route GET /api/subscription
 */
exports.getSubscriptions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            status,
            planType,
            userId,
            planId,
            startDate,
            endDate
        } = req.query;

        const result = await subscriptionDashboardService.getSubscriptions({
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            status,
            planType,
            userId,
            planId,
            startDate,
            endDate
        });

        res.status(200).json({
            success: true,
            data: result.subscriptions,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({
            success: false,
            data: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
            error: error.message || 'Failed to get subscriptions'
        });
    }
};

/**
 * Get single subscription
 * @route GET /api/subscription/:id
 */
exports.getSubscription = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.getSubscription(req.params.id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get subscription'
        });
    }
};

/**
 * Create new subscription
 * @route POST /api/subscription
 */
exports.createSubscription = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.createSubscription(req.body);

        res.status(201).json({
            success: true,
            data: subscription,
            message: 'Subscription created successfully'
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create subscription'
        });
    }
};

/**
 * Update subscription
 * @route PUT /api/subscription/:id
 */
exports.updateSubscription = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.updateSubscription(
            req.params.id,
            req.body
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Subscription updated successfully'
        });
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update subscription'
        });
    }
};

/**
 * Cancel subscription
 * @route POST /api/subscription/:id/cancel
 */
exports.cancelSubscription = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.cancelSubscription(
            req.params.id,
            req.body
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Subscription cancelled successfully'
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel subscription'
        });
    }
};

/**
 * Reactivate subscription
 * @route POST /api/subscription/:id/reactivate
 */
exports.reactivateSubscription = async (req, res) => {
    try {
        const subscription = await subscriptionDashboardService.reactivateSubscription(req.params.id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Subscription reactivated successfully'
        });
    } catch (error) {
        console.error('Reactivate subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to reactivate subscription'
        });
    }
};

/**
 * Suspend subscription
 * @route POST /api/subscription/:id/suspend
 */
exports.suspendSubscription = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.suspendSubscription(
            req.params.id,
            req.body.reason
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Subscription suspended successfully'
        });
    } catch (error) {
        console.error('Suspend subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to suspend subscription'
        });
    }
};

/**
 * Resume subscription
 * @route POST /api/subscription/:id/resume
 */
exports.resumeSubscription = async (req, res) => {
    try {
        const subscription = await subscriptionDashboardService.resumeSubscription(req.params.id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Subscription resumed successfully'
        });
    } catch (error) {
        console.error('Resume subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to resume subscription'
        });
    }
};

/**
 * Pause subscription
 * @route POST /api/subscription/:id/pause
 */
exports.pauseSubscription = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.pauseSubscription(
            req.params.id,
            req.body.pauseDuration,
            req.body.reason
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: `Subscription paused for ${req.body.pauseDuration} days`
        });
    } catch (error) {
        console.error('Pause subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to pause subscription'
        });
    }
};

/**
 * Delete subscription
 * @route DELETE /api/subscription/:id
 */
exports.deleteSubscription = async (req, res) => {
    try {
        const result = await subscriptionDashboardService.deleteSubscription(req.params.id);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Subscription deleted successfully'
        });
    } catch (error) {
        console.error('Delete subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete subscription'
        });
    }
};

/**
 * Change subscription plan
 * @route POST /api/subscription/:id/change-plan
 */
exports.changePlan = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscription = await subscriptionDashboardService.changePlan(
            req.params.id,
            req.body
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: req.body.effectiveDate
                ? 'Plan change scheduled successfully'
                : 'Plan changed successfully'
        });
    } catch (error) {
        console.error('Change plan error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to change plan'
        });
    }
};

/**
 * Cancel scheduled plan change
 * @route POST /api/subscription/:id/cancel-scheduled-change
 */
exports.cancelScheduledPlanChange = async (req, res) => {
    try {
        const subscription = await subscriptionDashboardService.cancelScheduledPlanChange(req.params.id);

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Scheduled plan change cancelled successfully'
        });
    } catch (error) {
        console.error('Cancel scheduled change error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel scheduled change'
        });
    }
};

/**
 * Get user subscriptions
 * @route GET /api/subscription/user/:userId
 */
exports.getUserSubscriptions = async (req, res) => {
    try {
        const subscriptions = await subscriptionDashboardService.getUserSubscriptions(req.params.userId);

        res.status(200).json({
            success: true,
            data: subscriptions,
            pagination: { page: 1, limit: 100, total: subscriptions.length, pages: 1 }
        });
    } catch (error) {
        console.error('Get user subscriptions error:', error);
        res.status(500).json({
            success: false,
            data: [],
            pagination: { page: 1, limit: 100, total: 0, pages: 0 },
            error: error.message || 'Failed to get user subscriptions'
        });
    }
};

/**
 * Get plan subscriptions
 * @route GET /api/subscription/plan/:planId
 */
exports.getPlanSubscriptions = async (req, res) => {
    try {
        const subscriptions = await subscriptionDashboardService.getPlanSubscriptions(req.params.planId);

        res.status(200).json({
            success: true,
            data: subscriptions,
            pagination: { page: 1, limit: 100, total: subscriptions.length, pages: 1 }
        });
    } catch (error) {
        console.error('Get plan subscriptions error:', error);
        res.status(500).json({
            success: false,
            data: [],
            pagination: { page: 1, limit: 100, total: 0, pages: 0 },
            error: error.message || 'Failed to get plan subscriptions'
        });
    }
};

/**
 * Get expiring subscriptions
 * @route GET /api/subscription/expiring-soon
 */
exports.getExpiringSoon = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const subscriptions = await subscriptionDashboardService.getExpiringSoon(days);

        res.status(200).json({
            success: true,
            data: subscriptions,
            pagination: { page: 1, limit: 100, total: subscriptions.length, pages: 1 }
        });
    } catch (error) {
        console.error('Get expiring subscriptions error:', error);
        res.status(500).json({
            success: false,
            data: [],
            pagination: { page: 1, limit: 100, total: 0, pages: 0 },
            error: error.message || 'Failed to get expiring subscriptions'
        });
    }
};

/**
 * Get subscriptions due for renewal
 * @route GET /api/subscription/due-for-renewal
 */
exports.getDueForRenewal = async (req, res) => {
    try {
        const subscriptions = await subscriptionDashboardService.getDueForRenewal();

        res.status(200).json({
            success: true,
            data: subscriptions,
            pagination: { page: 1, limit: 100, total: subscriptions.length, pages: 1 }
        });
    } catch (error) {
        console.error('Get due for renewal error:', error);
        res.status(500).json({
            success: false,
            data: [],
            pagination: { page: 1, limit: 100, total: 0, pages: 0 },
            error: error.message || 'Failed to get renewals'
        });
    }
};

/**
 * Get recent activity
 * @route GET /api/subscription/activity/recent
 */
exports.getRecentActivity = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        // Get audit logs instead of user updates
        const auditLogs = await AuditLog.getRecentActivity(limit, {
            resource: 'subscription'
        });

        // Transform to match frontend expectations
        const activities = auditLogs.map(log => ({
            id: log._id.toString(),
            action: log.action,
            description: log.description,
            actor: log.actorName,
            resource: `${log.resource}:${log.resourceId}`,
            timestamp: log.timestamp,
            changes: log.formatChanges ? log.formatChanges() : (log.changes ? JSON.stringify(log.changes) : 'No changes recorded')
        }));

        res.status(200).json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({
            success: false,
            data: [],
            error: error.message || 'Failed to get recent activity'
        });
    }
};

/**
 * Process renewal
 * @route POST /api/subscription/:id/renew
 */
exports.processRenewal = async (req, res) => {
    try {
        const subscription = await subscriptionDashboardService.processRenewal(
            req.params.id,
            req.body.paymentId
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Subscription not found'
            });
        }

        res.status(200).json({
            success: true,
            data: subscription,
            message: 'Subscription renewed successfully'
        });
    } catch (error) {
        console.error('Process renewal error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process renewal'
        });
    }
};

/**
 * Create sample subscriptions for testing
 * @route POST /api/subscription/create-sample-data
 */
exports.createSampleData = async (req, res) => {
    try {
        const result = await subscriptionDashboardService.createSampleData();

        res.status(200).json({
            success: true,
            message: result.message || 'Sample data created successfully',
            data: result.data
        });
    } catch (error) {
        console.error('Create sample data error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create sample data'
        });
    }
};

/**
 * Create sample audit logs for testing
 * @route POST /api/subscription/create-sample-audit-logs
 */
exports.createSampleAuditLogs = async (req, res) => {
    try {
        const result = await subscriptionDashboardService.createSampleAuditLogs();

        res.status(200).json({
            success: true,
            message: result.message || 'Sample audit logs created successfully',
            data: result.data
        });
    } catch (error) {
        console.error('Create sample audit logs error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create sample audit logs'
        });
    }
};
