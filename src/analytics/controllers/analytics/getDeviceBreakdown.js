const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get device breakdown data
 * @route   GET /api/analytics/devices
 * @access  Private
 */
const getDeviceBreakdown = async (req, res) => {
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

    const deviceData = await AnalyticsService.getDeviceBreakdown(range);

    // If no data, provide default structure
    if (deviceData.length === 0) {
      const defaultData = [
        { name: "Desktop", value: 65, color: "#059669" },
        { name: "Mobile", value: 28, color: "#10b981" },
        { name: "Tablet", value: 7, color: "#84cc16" }
      ];
      
      return res.json({
        success: true,
        data: defaultData,
        range,
        message: 'No device data available for the selected period, showing default distribution',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: deviceData,
      range,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching device breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device breakdown',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getDeviceBreakdown;





