const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get traffic sources data
 * @route   GET /api/analytics/traffic
 * @access  Private
 */
const getTrafficSources = async (req, res) => {
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

    const trafficData = await AnalyticsService.getTrafficSources(range);

    // If no data, provide sample structure
    if (trafficData.length === 0) {
      const sampleData = [
        { month: "Jan", organic: 0, paid: 0, direct: 0, social: 0, referral: 0 },
        { month: "Feb", organic: 0, paid: 0, direct: 0, social: 0, referral: 0 },
        { month: "Mar", organic: 0, paid: 0, direct: 0, social: 0, referral: 0 }
      ];
      
      return res.json({
        success: true,
        data: sampleData,
        range,
        message: 'No traffic data available for the selected period',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: trafficData,
      range,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching traffic sources:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch traffic sources',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getTrafficSources;





