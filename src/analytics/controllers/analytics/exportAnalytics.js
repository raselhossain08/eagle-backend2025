const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Export analytics data in various formats
 * @route   GET /api/analytics/export
 * @access  Private (Admin only)
 */
const exportAnalytics = async (req, res) => {
    try {
        const {
            range = '30d',
            format = 'json',
            type = 'all',
            include = 'all'
        } = req.query;

        // Validate parameters
        const validRanges = ['7d', '30d', '90d', '180d', '365d', 'all'];
        const validFormats = ['json', 'csv', 'xlsx'];
        const validTypes = ['all', 'metrics', 'events', 'sessions', 'pageviews', 'conversions'];
        const validIncludes = ['all', 'summary', 'detailed'];

        if (!validRanges.includes(range)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid range parameter. Must be one of: 7d, 30d, 90d, 180d, 365d, all'
            });
        }

        if (!validFormats.includes(format)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid format parameter. Must be one of: json, csv, xlsx'
            });
        }

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid type parameter. Must be one of: all, metrics, events, sessions, pageviews, conversions'
            });
        }

        // Get export data
        const exportData = await AnalyticsService.exportAnalytics({
            range,
            type,
            include,
            format
        });

        // Set appropriate headers based on format
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
            return res.send(exportData);
        } else if (format === 'xlsx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.xlsx"`);
            return res.send(exportData);
        } else {
            // JSON format
            res.json({
                success: true,
                data: exportData,
                exportInfo: {
                    range,
                    type,
                    include,
                    format,
                    exportedAt: new Date().toISOString(),
                    recordCount: exportData.recordCount || 0
                },
                message: 'Analytics data exported successfully'
            });
        }

    } catch (error) {
        console.error('Error exporting analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export analytics data',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = exportAnalytics;
