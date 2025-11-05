const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Get analytics metrics
 * @route   GET /api/analytics/metrics
 * @access  Private
 */
const getMetrics = async (req, res) => {
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

    const metrics = await AnalyticsService.getMetrics(range);

    // Format the response to match frontend expectations
    const formattedMetrics = [
      {
        title: "Total Page Views",
        value: metrics.totalPageViews.value.toLocaleString(),
        change: `${metrics.totalPageViews.change >= 0 ? '+' : ''}${metrics.totalPageViews.change.toFixed(1)}%`,
        trend: metrics.totalPageViews.trend,
        icon: "BarChart3",
        color: "text-blue-600"
      },
      {
        title: "Unique Visitors",
        value: metrics.uniqueVisitors.value.toLocaleString(),
        change: `${metrics.uniqueVisitors.change >= 0 ? '+' : ''}${metrics.uniqueVisitors.change.toFixed(1)}%`,
        trend: metrics.uniqueVisitors.trend,
        icon: "Users",
        color: "text-green-600"
      },
      {
        title: "Bounce Rate",
        value: `${metrics.bounceRate.value}%`,
        change: `${metrics.bounceRate.change >= 0 ? '+' : ''}${metrics.bounceRate.change.toFixed(1)}%`,
        trend: metrics.bounceRate.value < 40 ? 'up' : 'down', // Lower bounce rate is better
        icon: "TrendingUp",
        color: "text-yellow-600"
      },
      {
        title: "Avg Session Duration",
        value: AnalyticsService.formatDuration(metrics.avgSessionDuration.value),
        change: `${metrics.avgSessionDuration.change >= 0 ? '+' : ''}${metrics.avgSessionDuration.change.toFixed(1)}%`,
        trend: metrics.avgSessionDuration.trend,
        icon: "Activity",
        color: "text-purple-600"
      }
    ];

    res.json({
      success: true,
      data: formattedMetrics,
      range,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getMetrics;





