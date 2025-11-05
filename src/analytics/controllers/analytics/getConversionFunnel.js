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

    // Calculate conversion rates
    const processedData = conversionData.map((step, index) => {
      let conversionRate = 0;
      if (index > 0 && conversionData[index - 1].users > 0) {
        conversionRate = ((step.users / conversionData[index - 1].users) * 100);
      } else if (index === 0) {
        conversionRate = 100; // First step is always 100%
      }

      return {
        ...step,
        conversionRate: parseFloat(conversionRate.toFixed(1))
      };
    });

    // If no data, provide sample structure
    if (processedData.every(step => step.users === 0)) {
      const sampleData = [
        { step: "Website Visit", users: 1000, conversionRate: 100 },
        { step: "Sign Up", users: 250, conversionRate: 25 },
        { step: "Trial Start", users: 150, conversionRate: 60 },
        { step: "Purchase", users: 75, conversionRate: 50 },
        { step: "Active User", users: 60, conversionRate: 80 }
      ];
      
      return res.json({
        success: true,
        data: sampleData,
        range,
        message: 'No conversion data available for the selected period, showing sample data',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: processedData,
      range,
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





