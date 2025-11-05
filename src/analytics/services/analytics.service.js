const { 
  PageView, 
  UserSession, 
  Event, 
  Conversion, 
  AnalyticsSummary 
} = require('../models/analytics.model');

class AnalyticsService {
  
  /**
   * Get date range based on period
   */
  static getDateRange(range = '30d') {
    const now = new Date();
    const endDate = new Date(now);
    let startDate;

    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  /**
   * Get analytics metrics
   */
  static async getMetrics(range = '30d') {
    const { startDate, endDate } = this.getDateRange(range);
    const previousRange = this.getDateRange(range === '7d' ? '14d' : range === '30d' ? '60d' : '180d');

    try {
      // Current period metrics
      const [
        totalPageViews,
        uniqueVisitors,
        sessions,
        avgSessionDuration,
        bounceRate
      ] = await Promise.all([
        PageView.countDocuments({ timestamp: { $gte: startDate, $lte: endDate } }),
        PageView.distinct('sessionId', { timestamp: { $gte: startDate, $lte: endDate } }).then(sessions => sessions.length),
        UserSession.countDocuments({ startTime: { $gte: startDate, $lte: endDate } }),
        UserSession.aggregate([
          { $match: { startTime: { $gte: startDate, $lte: endDate }, duration: { $gt: 0 } } },
          { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]).then(result => result[0]?.avgDuration || 0),
        PageView.aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$sessionId', pageCount: { $sum: 1 } } },
          { $group: { _id: null, bounced: { $sum: { $cond: [{ $eq: ['$pageCount', 1] }, 1, 0] } }, total: { $sum: 1 } } }
        ]).then(result => result[0] ? (result[0].bounced / result[0].total) * 100 : 0)
      ]);

      // Previous period metrics for comparison
      const [
        prevTotalPageViews,
        prevUniqueVisitors,
        prevSessions,
        prevAvgSessionDuration
      ] = await Promise.all([
        PageView.countDocuments({ timestamp: { $gte: previousRange.startDate, $lt: startDate } }),
        PageView.distinct('sessionId', { timestamp: { $gte: previousRange.startDate, $lt: startDate } }).then(sessions => sessions.length),
        UserSession.countDocuments({ startTime: { $gte: previousRange.startDate, $lt: startDate } }),
        UserSession.aggregate([
          { $match: { startTime: { $gte: previousRange.startDate, $lt: startDate }, duration: { $gt: 0 } } },
          { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]).then(result => result[0]?.avgDuration || 0)
      ]);

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      return {
        totalPageViews: {
          value: totalPageViews,
          change: calculateChange(totalPageViews, prevTotalPageViews),
          trend: totalPageViews >= prevTotalPageViews ? 'up' : 'down'
        },
        uniqueVisitors: {
          value: uniqueVisitors,
          change: calculateChange(uniqueVisitors, prevUniqueVisitors),
          trend: uniqueVisitors >= prevUniqueVisitors ? 'up' : 'down'
        },
        sessions: {
          value: sessions,
          change: calculateChange(sessions, prevSessions),
          trend: sessions >= prevSessions ? 'up' : 'down'
        },
        avgSessionDuration: {
          value: Math.round(avgSessionDuration),
          change: calculateChange(avgSessionDuration, prevAvgSessionDuration),
          trend: avgSessionDuration >= prevAvgSessionDuration ? 'up' : 'down'
        },
        bounceRate: {
          value: parseFloat(bounceRate.toFixed(1)),
          change: calculateChange(bounceRate, 0), // TODO: Calculate previous bounce rate
          trend: 'down' // Lower bounce rate is better
        }
      };
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Get traffic sources data
   */
  static async getTrafficSources(range = '30d') {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const trafficData = await PageView.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: '%b', date: '$timestamp' } },
              source: '$trafficSource'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.month',
            organic: { $sum: { $cond: [{ $eq: ['$_id.source', 'organic'] }, '$count', 0] } },
            paid: { $sum: { $cond: [{ $eq: ['$_id.source', 'paid'] }, '$count', 0] } },
            direct: { $sum: { $cond: [{ $eq: ['$_id.source', 'direct'] }, '$count', 0] } },
            social: { $sum: { $cond: [{ $eq: ['$_id.source', 'social'] }, '$count', 0] } },
            referral: { $sum: { $cond: [{ $eq: ['$_id.source', 'referral'] }, '$count', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return trafficData.map(item => ({
        month: item._id,
        organic: item.organic,
        paid: item.paid,
        direct: item.direct,
        social: item.social,
        referral: item.referral
      }));
    } catch (error) {
      throw new Error(`Failed to get traffic sources: ${error.message}`);
    }
  }

  /**
   * Get top pages data
   */
  static async getTopPages(range = '30d', limit = 10) {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const topPages = await PageView.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$page',
            views: { $sum: 1 },
            uniqueViews: { $addToSet: '$sessionId' },
            totalDuration: { $sum: '$duration' },
            bounced: { $sum: { $cond: ['$bounced', 1, 0] } }
          }
        },
        {
          $project: {
            page: '$_id',
            views: 1,
            uniqueViews: { $size: '$uniqueViews' },
            avgDuration: { $divide: ['$totalDuration', '$views'] },
            bounceRate: { $multiply: [{ $divide: ['$bounced', '$views'] }, 100] }
          }
        },
        { $sort: { views: -1 } },
        { $limit: limit }
      ]);

      return topPages.map(page => ({
        page: page.page,
        views: page.views,
        uniqueViews: page.uniqueViews,
        bounce: parseFloat(page.bounceRate.toFixed(1)),
        avgTime: this.formatDuration(page.avgDuration)
      }));
    } catch (error) {
      throw new Error(`Failed to get top pages: ${error.message}`);
    }
  }

  /**
   * Get device breakdown
   */
  static async getDeviceBreakdown(range = '30d') {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const deviceData = await PageView.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$deviceType',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = deviceData.reduce((sum, item) => sum + item.count, 0);
      
      const deviceMap = {
        desktop: { name: 'Desktop', color: '#059669' },
        mobile: { name: 'Mobile', color: '#10b981' },
        tablet: { name: 'Tablet', color: '#84cc16' }
      };

      return deviceData.map(item => ({
        name: deviceMap[item._id]?.name || item._id,
        value: Math.round((item.count / total) * 100),
        color: deviceMap[item._id]?.color || '#6b7280'
      }));
    } catch (error) {
      throw new Error(`Failed to get device breakdown: ${error.message}`);
    }
  }

  /**
   * Get conversion funnel data
   */
  static async getConversionFunnel(range = '30d') {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const funnelData = await Conversion.aggregate([
        { $match: { completedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$funnelStep',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const stepOrder = ['visit', 'signup', 'trial', 'purchase', 'active_user'];
      const stepLabels = {
        visit: 'Website Visit',
        signup: 'Sign Up',
        trial: 'Trial Start',
        purchase: 'Purchase',
        active_user: 'Active User'
      };

      return stepOrder.map(step => {
        const stepData = funnelData.find(item => item._id === step);
        return {
          step: stepLabels[step],
          users: stepData ? stepData.count : 0,
          conversionRate: 0 // Calculate based on previous step
        };
      });
    } catch (error) {
      throw new Error(`Failed to get conversion funnel: ${error.message}`);
    }
  }

  /**
   * Get events data
   */
  static async getEvents(range = '30d', limit = 100) {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const events = await Event.aggregate([
        { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              category: '$eventCategory',
              action: '$eventAction'
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        {
          $project: {
            eventName: { $concat: ['$_id.category', ' - ', '$_id.action'] },
            count: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      return events;
    } catch (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }
  }

  /**
   * Track a page view
   */
  static async trackPageView(data) {
    try {
      const pageView = new PageView(data);
      return await pageView.save();
    } catch (error) {
      throw new Error(`Failed to track page view: ${error.message}`);
    }
  }

  /**
   * Track an event
   */
  static async trackEvent(data) {
    try {
      const event = new Event(data);
      return await event.save();
    } catch (error) {
      throw new Error(`Failed to track event: ${error.message}`);
    }
  }

  /**
   * Create or update user session
   */
  static async updateSession(sessionId, data) {
    try {
      return await UserSession.findOneAndUpdate(
        { sessionId },
        { $set: data },
        { upsert: true, new: true }
      );
    } catch (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Helper method to format duration
   */
  static formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    } else {
      return `${minutes}m ${remainingSeconds}s`;
    }
  }

  /**
   * Generate sample data for testing (remove in production)
   */
  static async generateSampleData() {
    try {
      const now = new Date();
      const sampleData = [];

      // Generate sample page views for the last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dailyViews = Math.floor(Math.random() * 100) + 50;

        for (let j = 0; j < dailyViews; j++) {
          const sessionId = `session_${date.getTime()}_${j}`;
          const pages = ['/dashboard', '/pricing', '/features', '/signup', '/login'];
          const sources = ['organic', 'paid', 'direct', 'social'];
          const devices = ['desktop', 'mobile', 'tablet'];

          sampleData.push({
            sessionId,
            page: pages[Math.floor(Math.random() * pages.length)],
            deviceType: devices[Math.floor(Math.random() * devices.length)],
            trafficSource: sources[Math.floor(Math.random() * sources.length)],
            duration: Math.floor(Math.random() * 300) + 30,
            bounced: Math.random() < 0.3,
            timestamp: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000)
          });
        }
      }

      await PageView.insertMany(sampleData);
      console.log(`Generated ${sampleData.length} sample page views`);
      return sampleData.length;
    } catch (error) {
      throw new Error(`Failed to generate sample data: ${error.message}`);
    }
  }
}

module.exports = AnalyticsService;





