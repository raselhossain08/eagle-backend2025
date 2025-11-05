const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get top pages data
 * @route   GET /api/analytics/pages
 * @access  Private
 */
const getTopPages = async (req, res) => {
  try {
    const { range = '30d', limit = 10 } = req.query;

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
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter. Must be a number between 1 and 100'
      });
    }

    const topPages = await AnalyticsService.getTopPages(range, limitNum);

    // If no data, provide sample structure
    if (topPages.length === 0) {
      const sampleData = [
        { page: "/dashboard", views: 0, uniqueViews: 0, bounce: 0, avgTime: "0s" },
        { page: "/pricing", views: 0, uniqueViews: 0, bounce: 0, avgTime: "0s" },
        { page: "/features", views: 0, uniqueViews: 0, bounce: 0, avgTime: "0s" }
      ];
      
      return res.json({
        success: true,
        data: sampleData,
        range,
        limit: limitNum,
        message: 'No page data available for the selected period',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: topPages,
      range,
      limit: limitNum,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching top pages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top pages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getTopPages;





