const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get growth analytics data (trends over time)
 * @route   GET /api/analytics/growth
 * @access  Private
 */
const getGrowth = async (req, res) => {
    try {
        const { range = '30d', metric = 'all' } = req.query;

        // Validate range parameter
        const validRanges = ['7d', '30d', '90d', '180d', '365d'];
        if (!validRanges.includes(range)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid range parameter. Must be one of: 7d, 30d, 90d, 180d, 365d'
            });
        }

        // Validate metric parameter
        const validMetrics = ['all', 'users', 'sessions', 'pageviews', 'conversions'];
        if (!validMetrics.includes(metric)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid metric parameter. Must be one of: all, users, sessions, pageviews, conversions'
            });
        }

        const growthData = await AnalyticsService.getGrowthData(range, metric);

        res.json({
            success: true,
            data: growthData,
            range,
            metric,
            timestamp: new Date().toISOString(),
            message: 'Growth analytics retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching growth analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch growth analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = getGrowth;
