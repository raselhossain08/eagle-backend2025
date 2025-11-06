const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get real-time analytics data
 * @route   GET /api/analytics/realtime
 * @access  Private
 */
const getRealtime = async (req, res) => {
    try {
        const realtimeData = await AnalyticsService.getRealtimeAnalytics();

        res.json({
            success: true,
            data: realtimeData,
            timestamp: new Date().toISOString(),
            message: 'Real-time analytics retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching real-time analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch real-time analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = getRealtime;
