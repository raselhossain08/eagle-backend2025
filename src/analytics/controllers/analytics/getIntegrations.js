const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get analytics integrations status and configuration
 * @route   GET /api/analytics/integrations
 * @access  Private (Admin only)
 */
const getIntegrations = async (req, res) => {
    try {
        const integrationsData = await AnalyticsService.getIntegrations();

        res.json({
            success: true,
            data: integrationsData,
            timestamp: new Date().toISOString(),
            message: 'Analytics integrations retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching analytics integrations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics integrations',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = getIntegrations;
