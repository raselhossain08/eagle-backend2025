const subscriberService = require('../services/subscriber.service');
const Subscription = require('../models/subscription.model');
const User = require('../../user/models/user.model');

/**
 * Subscription Analytics Controller
 * Provides analytics and metrics for subscription data
 */
class SubscriptionAnalyticsController {

    /**
     * Get subscription analytics overview
     * @route GET /api/subscription/analytics
     */
    async getAnalyticsOverview(req, res) {
        try {
            const timeRange = req.query.range || '30d'; // 7d, 30d, 90d, 1y
            const startDate = getStartDate(timeRange);

            // Run all analytics queries in parallel
            const [
                totalSubscribers,
                activeSubscribers,
                canceledSubscribers,
                churnedSubscribers,
                revenueMetrics,
                growthMetrics,
                planDistribution,
                recentActivity
            ] = await Promise.all([
                // Total subscriptions
                Subscription.countDocuments(),

                // Active subscriptions
                Subscription.countDocuments({
                    status: 'active'
                }),

                // Canceled subscriptions
                Subscription.countDocuments({
                    status: 'cancelled'
                }),

                // Churned subscriptions (in time range)
                Subscription.countDocuments({
                    status: { $in: ['cancelled', 'expired', 'suspended'] },
                    updatedAt: { $gte: startDate }
                }),

                // Revenue metrics
                calculateRevenueMetrics(startDate),

                // Growth metrics
                calculateGrowthMetrics(startDate),

                // Plan distribution
                calculatePlanDistribution(),

                // Recent activity
                getRecentActivity(10)
            ]);

            const churnRate = activeSubscribers > 0
                ? ((churnedSubscribers / activeSubscribers) * 100).toFixed(2)
                : 0;

            res.status(200).json({
                success: true,
                message: 'Subscription analytics retrieved successfully',
                data: {
                    overview: {
                        totalSubscribers,
                        activeSubscribers,
                        canceledSubscribers,
                        churnedSubscribers,
                        churnRate: parseFloat(churnRate)
                    },
                    revenue: revenueMetrics,
                    growth: growthMetrics,
                    planDistribution,
                    recentActivity,
                    timeRange,
                    generatedAt: new Date()
                }
            });

        } catch (error) {
            console.error('Error in getAnalyticsOverview:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch subscription analytics',
                error: error.message
            });
        }
    }

    /**
     * Get MRR (Monthly Recurring Revenue) metrics
     * @route GET /api/subscription/analytics/mrr
     */
    async getMRRMetrics(req, res) {
        try {
            const timeRange = req.query.range || '30d';
            const startDate = getStartDate(timeRange);

            const mrrData = await calculateMRROverTime(startDate);

            res.status(200).json({
                success: true,
                message: 'MRR metrics retrieved successfully',
                data: mrrData
            });

        } catch (error) {
            console.error('Error in getMRRMetrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch MRR metrics',
                error: error.message
            });
        }
    }

    /**
     * Get churn analytics
     * @route GET /api/subscription/analytics/churn
     */
    async getChurnAnalytics(req, res) {
        try {
            const timeRange = req.query.range || '30d';
            const startDate = getStartDate(timeRange);

            const churnData = await calculateChurnMetrics(startDate);

            res.status(200).json({
                success: true,
                message: 'Churn analytics retrieved successfully',
                data: churnData
            });

        } catch (error) {
            console.error('Error in getChurnAnalytics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch churn analytics',
                error: error.message
            });
        }
    }

    /**
     * Get subscription growth trends
     * @route GET /api/subscription/analytics/growth
     */
    async getGrowthTrends(req, res) {
        try {
            const timeRange = req.query.range || '90d';
            const startDate = getStartDate(timeRange);

            const growthData = await calculateGrowthTrends(startDate);

            res.status(200).json({
                success: true,
                message: 'Growth trends retrieved successfully',
                data: growthData
            });

        } catch (error) {
            console.error('Error in getGrowthTrends:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch growth trends',
                error: error.message
            });
        }
    }

    /**
     * Get recent subscription activity
     * @route GET /api/subscription/activity/recent
     */
    async getRecentActivityEndpoint(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;

            if (limit < 1 || limit > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Limit must be between 1 and 100'
                });
            }

            const recentActivity = await getRecentActivity(limit);

            res.status(200).json({
                success: true,
                message: 'Recent activity retrieved successfully',
                data: recentActivity,
                count: recentActivity.length
            });

        } catch (error) {
            console.error('Error in getRecentActivityEndpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch recent activity',
                error: error.message
            });
        }
    }
}

// Helper Functions

/**
 * Get start date based on time range
 */
function getStartDate(range) {
    const now = new Date();
    switch (range) {
        case '7d':
            return new Date(now.setDate(now.getDate() - 7));
        case '30d':
            return new Date(now.setDate(now.getDate() - 30));
        case '90d':
            return new Date(now.setDate(now.getDate() - 90));
        case '1y':
            return new Date(now.setFullYear(now.getFullYear() - 1));
        default:
            return new Date(now.setDate(now.getDate() - 30));
    }
}

/**
 * Calculate revenue metrics
 */
async function calculateRevenueMetrics(startDate) {
    const activeSubscriptions = await Subscription.find({
        status: 'active'
    }).select('plan billingCycle mrr pricing');

    let totalMRR = 0;
    let totalARR = 0;

    activeSubscriptions.forEach(sub => {
        const mrr = sub.mrr || 0;
        totalMRR += mrr;

        // Calculate ARR based on billing cycle
        if (sub.billingCycle === 'monthly') {
            totalARR += mrr * 12;
        } else if (sub.billingCycle === 'yearly') {
            totalARR += mrr;
        }
    });

    // Calculate ARPU (Average Revenue Per User)
    const arpu = activeSubscriptions.length > 0
        ? totalMRR / activeSubscriptions.length
        : 0;

    return {
        mrr: parseFloat(totalMRR.toFixed(2)),
        arr: parseFloat(totalARR.toFixed(2)),
        arpu: parseFloat(arpu.toFixed(2)),
        activeSubscribers: activeSubscriptions.length
    };
}

/**
 * Calculate growth metrics
 */
async function calculateGrowthMetrics(startDate) {
    const newSubscriptions = await Subscription.countDocuments({
        createdAt: { $gte: startDate },
        status: 'active'
    });

    const churnedSubscriptions = await Subscription.countDocuments({
        status: { $in: ['cancelled', 'expired', 'suspended'] },
        updatedAt: { $gte: startDate }
    });

    const netGrowth = newSubscriptions - churnedSubscriptions;
    const growthRate = newSubscriptions > 0
        ? ((netGrowth / newSubscriptions) * 100).toFixed(2)
        : 0;

    return {
        newSubscribers: newSubscriptions,
        churnedSubscribers: churnedSubscriptions,
        netGrowth,
        growthRate: parseFloat(growthRate)
    };
}

/**
 * Calculate plan distribution
 */
async function calculatePlanDistribution() {
    const distribution = await Subscription.aggregate([
        {
            $match: { status: 'active' }
        },
        {
            $group: {
                _id: '$plan',
                count: { $sum: 1 },
                totalRevenue: { $sum: '$mrr' }
            }
        },
        {
            $sort: { count: -1 }
        },
        {
            $limit: 10
        }
    ]);

    return distribution.map(item => ({
        planId: item._id || 'Unknown',
        subscribers: item.count,
        revenue: parseFloat((item.totalRevenue || 0).toFixed(2))
    }));
}

/**
 * Get recent activity
 */
async function getRecentActivity(limit = 10) {
    const recentSubscriptions = await Subscription.find()
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('userId plan status billingCycle mrr createdAt updatedAt')
        .populate('userId', 'firstName lastName email');

    return recentSubscriptions.map(sub => ({
        id: sub._id,
        email: sub.userId?.email || 'N/A',
        userName: sub.userId ? `${sub.userId.firstName} ${sub.userId.lastName}` : 'N/A',
        status: sub.status,
        planId: sub.plan || 'N/A',
        billingCycle: sub.billingCycle,
        mrr: sub.mrr || 0,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt
    }));
}

/**
 * Calculate MRR over time
 */
async function calculateMRROverTime(startDate) {
    const mrrByDate = await Subscription.aggregate([
        {
            $match: {
                status: 'active',
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                mrr: { $sum: '$mrr' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
    ]);

    return {
        timeline: mrrByDate.map(item => ({
            date: new Date(item._id.year, item._id.month - 1, item._id.day),
            mrr: parseFloat((item.mrr || 0).toFixed(2)),
            subscribers: item.count
        })),
        summary: {
            startDate,
            endDate: new Date(),
            dataPoints: mrrByDate.length
        }
    };
}

/**
 * Calculate churn metrics
 */
async function calculateChurnMetrics(startDate) {
    const churnByReason = await Subscription.aggregate([
        {
            $match: {
                status: { $in: ['cancelled', 'expired', 'suspended'] },
                updatedAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: '$cancellationReason',
                count: { $sum: 1 }
            }
        },
        {
            $sort: { count: -1 }
        }
    ]);

    const totalChurned = churnByReason.reduce((sum, item) => sum + item.count, 0);

    return {
        totalChurned,
        byReason: churnByReason.map(item => ({
            reason: item._id || 'Unknown',
            count: item.count,
            percentage: totalChurned > 0
                ? parseFloat(((item.count / totalChurned) * 100).toFixed(2))
                : 0
        }))
    };
}

/**
 * Calculate growth trends
 */
async function calculateGrowthTrends(startDate) {
    const trends = await Subscription.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    status: '$status'
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);

    return {
        monthly: trends.map(item => ({
            date: new Date(item._id.year, item._id.month - 1),
            status: item._id.status,
            count: item.count
        }))
    };
}

// Export controller instance
const subscriptionAnalyticsController = new SubscriptionAnalyticsController();
module.exports = subscriptionAnalyticsController;
