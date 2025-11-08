const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get conversion funnel data
 * @route   GET /api/analytics/conversion
 * @access  Private
 */
const getConversionFunnel = async (req, res) => {
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

    const conversionData = await AnalyticsService.getConversionFunnel(range);

    // The service already calculates conversion rates, but ensure they're properly formatted
    const processedData = conversionData.map((step, index) => ({
      step: step.step,
      users: step.users || 0,
      conversionRate: typeof step.conversionRate === 'string'
        ? parseFloat(step.conversionRate)
        : parseFloat((step.conversionRate || 0).toFixed(1))
    }));

    res.json({
      success: true,
      data: processedData,
      range,
      message: processedData.every(step => step.users === 0)
        ? 'No conversion data available for the selected period'
        : 'Conversion funnel data retrieved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching conversion funnel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversion funnel',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getConversionFunnel;





