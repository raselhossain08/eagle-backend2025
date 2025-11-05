const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get events data
 * @route   GET /api/analytics/events
 * @access  Private
 */
const getEvents = async (req, res) => {
  try {
    const { range = '30d', limit = 50 } = req.query;

    // Validate range parameter
    const validRanges = ['7d', '30d', '90d'];
    if (!validRanges.includes(range)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid range parameter. Must be one of: 7d, 30d, 90d'
      });
    }

    // Validate limit parameter
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter. Must be a number between 1 and 200'
      });
    }

    const eventsData = await AnalyticsService.getEvents(range, limitNum);

    // If no data, provide sample structure
    if (eventsData.length === 0) {
      const sampleData = [
        { eventName: "User - Login", count: 0, uniqueUsers: 0 },
        { eventName: "Navigation - Dashboard Click", count: 0, uniqueUsers: 0 },
        { eventName: "Subscription - Plan View", count: 0, uniqueUsers: 0 },
        { eventName: "User - Profile Update", count: 0, uniqueUsers: 0 }
      ];
      
      return res.json({
        success: true,
        data: sampleData,
        range,
        limit: limitNum,
        message: 'No events data available for the selected period',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: eventsData,
      range,
      limit: limitNum,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getEvents;





