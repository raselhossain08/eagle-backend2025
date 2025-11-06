const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get comprehensive analytics overview dashboard data
 * @route   GET /api/analytics/overview
 * @access  Private
 */
const getOverview = async (req, res) => {
    try {
        const { range = '30d' } = req.query;

        // Validate range parameter
        const validRanges = ['7d', '30d', '90d'];
        if (!validRanges.includes(range)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid range parameter. Must be one of: 7d, 30d, 90d'
            });
        }

        // Fetch all analytics data in parallel for better performance
        // Use Promise.allSettled to handle failures gracefully
        const results = await Promise.allSettled([
            AnalyticsService.getMetrics(range),
            AnalyticsService.getTrafficSources(range),
            AnalyticsService.getTopPages(range, 10),
            AnalyticsService.getDeviceBreakdown(range),
            AnalyticsService.getConversionFunnel(range),
            AnalyticsService.getRecentEvents(range, 10)
        ]);

        // Extract data with fallbacks
        const metrics = results[0].status === 'fulfilled' ? results[0].value : null;
        const trafficSources = results[1].status === 'fulfilled' ? results[1].value : [];
        const topPages = results[2].status === 'fulfilled' ? results[2].value : [];
        const deviceBreakdown = results[3].status === 'fulfilled' ? results[3].value : [];
        const conversionFunnel = results[4].status === 'fulfilled' ? results[4].value : [];
        const recentEvents = results[5].status === 'fulfilled' ? results[5].value : [];

        // Format the comprehensive overview response
        const overview = {
            // Key metrics cards
            metrics: metrics ? [
                {
                    title: "Total Page Views",
                    value: metrics.totalPageViews.value.toLocaleString(),
                    change: `${metrics.totalPageViews.change >= 0 ? '+' : ''}${metrics.totalPageViews.change.toFixed(1)}%`,
                    trend: metrics.totalPageViews.trend,
                    icon: "BarChart3",
                    color: "text-blue-600"
                },
                {
                    title: "Unique Visitors",
                    value: metrics.uniqueVisitors.value.toLocaleString(),
                    change: `${metrics.uniqueVisitors.change >= 0 ? '+' : ''}${metrics.uniqueVisitors.change.toFixed(1)}%`,
                    trend: metrics.uniqueVisitors.trend,
                    icon: "Users",
                    color: "text-green-600"
                },
                {
                    title: "Bounce Rate",
                    value: `${metrics.bounceRate.value}%`,
                    change: `${metrics.bounceRate.change >= 0 ? '+' : ''}${metrics.bounceRate.change.toFixed(1)}%`,
                    trend: metrics.bounceRate.value < 40 ? 'up' : 'down',
                    icon: "TrendingUp",
                    color: "text-yellow-600"
                },
                {
                    title: "Avg Session Duration",
                    value: AnalyticsService.formatDuration(metrics.avgSessionDuration.value),
                    change: `${metrics.avgSessionDuration.change >= 0 ? '+' : ''}${metrics.avgSessionDuration.change.toFixed(1)}%`,
                    trend: metrics.avgSessionDuration.trend,
                    icon: "Activity",
                    color: "text-purple-600"
                }
            ] : [],

            // Traffic sources breakdown
            trafficSources: {
                data: trafficSources,
                total: trafficSources.reduce((sum, source) => sum + (source.sessions || source.organic || source.paid || source.direct || source.social || source.referral || 0), 0)
            },

            // Top performing pages
            topPages: {
                data: topPages,
                total: topPages.reduce((sum, page) => sum + (page.views || 0), 0)
            },

            // Device breakdown
            devices: {
                data: deviceBreakdown,
                total: deviceBreakdown.reduce((sum, device) => sum + (device.value || 0), 0)
            },

            // Conversion funnel
            conversion: {
                funnel: conversionFunnel,
                conversionRate: conversionFunnel.length > 0 && conversionFunnel[0]?.users > 0
                    ? ((conversionFunnel[conversionFunnel.length - 1]?.users || 0) / conversionFunnel[0].users * 100).toFixed(2)
                    : 0
            },

            // Recent events/activities
            recentEvents: {
                data: recentEvents,
                count: recentEvents.length
            },

            // Additional overview stats
            stats: {
                totalSessions: metrics?.sessions?.value || 0,
                totalPageViews: metrics?.totalPageViews?.value || 0,
                uniqueVisitors: metrics?.uniqueVisitors?.value || 0,
                bounceRate: metrics?.bounceRate?.value || 0,
                avgSessionDuration: metrics?.avgSessionDuration?.value || 0
            }
        };

        res.json({
            success: true,
            data: overview,
            range,
            timestamp: new Date().toISOString(),
            message: 'Analytics overview retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics overview',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = getOverview;
