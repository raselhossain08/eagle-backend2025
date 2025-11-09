const {
  PageView,
  UserSession,
  Event,
  Conversion,
  AnalyticsSummary
} = require('../models/analytics.model');

const mongoose = require('mongoose');

// Get SimpleAnalyticsEvent model
const getSimpleAnalyticsModel = () => {
  return mongoose.models.SimpleAnalyticsEvent || mongoose.model('SimpleAnalyticsEvent', new mongoose.Schema({
    type: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  }, { timestamps: true, collection: 'simple_analytics_events' }));
};

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
      case '180d':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '365d':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
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
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      // Current period metrics
      const [
        totalPageViews,
        uniqueVisitors,
        avgSessionDuration,
        bounceRateData
      ] = await Promise.all([
        // Total page views
        SimpleAnalyticsEvent.countDocuments({
          type: 'page_view',
          timestamp: { $gte: startDate, $lte: endDate }
        }),

        // Unique visitors (distinct sessions)
        SimpleAnalyticsEvent.distinct('sessionId', {
          timestamp: { $gte: startDate, $lte: endDate }
        }).then(sessions => sessions.length),

        // Average session duration from page view durations
        SimpleAnalyticsEvent.aggregate([
          {
            $match: {
              type: 'page_view',
              timestamp: { $gte: startDate, $lte: endDate },
              'properties.duration': { $exists: true, $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: '$properties.duration' }
            }
          }
        ]).then(result => result[0]?.avgDuration || 0),

        // Bounce rate (sessions with only 1 page view)
        SimpleAnalyticsEvent.aggregate([
          {
            $match: {
              type: 'page_view',
              timestamp: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$sessionId',
              pageCount: { $sum: 1 }
            }
          },
          {
            $group: {
              _id: null,
              bounced: { $sum: { $cond: [{ $eq: ['$pageCount', 1] }, 1, 0] } },
              total: { $sum: 1 }
            }
          }
        ]).then(result => result[0] ? (result[0].bounced / result[0].total) * 100 : 0)
      ]);

      // Previous period metrics for comparison
      const [
        prevTotalPageViews,
        prevUniqueVisitors,
        prevAvgSessionDuration
      ] = await Promise.all([
        SimpleAnalyticsEvent.countDocuments({
          type: 'page_view',
          timestamp: { $gte: previousRange.startDate, $lt: startDate }
        }),

        SimpleAnalyticsEvent.distinct('sessionId', {
          timestamp: { $gte: previousRange.startDate, $lt: startDate }
        }).then(sessions => sessions.length),

        SimpleAnalyticsEvent.aggregate([
          {
            $match: {
              type: 'page_view',
              timestamp: { $gte: previousRange.startDate, $lt: startDate },
              'properties.duration': { $exists: true, $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: '$properties.duration' }
            }
          }
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
          value: uniqueVisitors, // Same as unique visitors for now
          change: calculateChange(uniqueVisitors, prevUniqueVisitors),
          trend: uniqueVisitors >= prevUniqueVisitors ? 'up' : 'down'
        },
        avgSessionDuration: {
          value: Math.round(avgSessionDuration),
          change: calculateChange(avgSessionDuration, prevAvgSessionDuration),
          trend: avgSessionDuration >= prevAvgSessionDuration ? 'up' : 'down'
        },
        bounceRate: {
          value: parseFloat(bounceRateData.toFixed(1)),
          change: 0, // TODO: Calculate previous bounce rate
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
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      const trafficData = await SimpleAnalyticsEvent.aggregate([
        {
          $match: {
            type: 'page_view',
            timestamp: { $gte: startDate, $lte: endDate },
            'properties.trafficSource': { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: '%b', date: '$timestamp' } },
              source: '$properties.trafficSource'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.month',
            google: { $sum: { $cond: [{ $eq: ['$_id.source', 'google'] }, '$count', 0] } },
            facebook: { $sum: { $cond: [{ $eq: ['$_id.source', 'facebook'] }, '$count', 0] } },
            twitter: { $sum: { $cond: [{ $eq: ['$_id.source', 'twitter'] }, '$count', 0] } },
            direct: { $sum: { $cond: [{ $eq: ['$_id.source', 'direct'] }, '$count', 0] } },
            referral: { $sum: { $cond: [{ $eq: ['$_id.source', 'referral'] }, '$count', 0] } },
            other: { $sum: { $cond: [{ $not: { $in: ['$_id.source', ['google', 'facebook', 'twitter', 'direct', 'referral']] } }, '$count', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return trafficData.map(item => ({
        month: item._id,
        organic: item.google + item.other, // Combine google and other as organic
        paid: 0, // No paid data yet
        direct: item.direct,
        social: item.facebook + item.twitter, // Combine social sources
        referral: item.referral
      }));
    } catch (error) {
      console.error('Error in getTrafficSources:', error);
      return [];
    }
  }

  /**
   * Get top pages data
   */
  static async getTopPages(range = '30d', limit = 10) {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      const topPages = await SimpleAnalyticsEvent.aggregate([
        {
          $match: {
            type: 'page_view',
            timestamp: { $gte: startDate, $lte: endDate },
            'properties.path': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$properties.path',
            views: { $sum: 1 },
            uniqueViews: { $addToSet: '$sessionId' },
            totalDuration: { $sum: '$properties.duration' }
          }
        },
        {
          $project: {
            page: '$_id',
            views: 1,
            uniqueViews: { $size: '$uniqueViews' },
            avgDuration: { $cond: [{ $gt: ['$views', 0] }, { $divide: ['$totalDuration', '$views'] }, 0] },
            bounce: 0 // TODO: Calculate bounce rate per page
          }
        },
        { $sort: { views: -1 } },
        { $limit: limit }
      ]);

      return topPages.map(page => ({
        page: page.page || '/',
        views: page.views,
        uniqueViews: page.uniqueViews,
        bounce: parseFloat(page.bounce.toFixed(1)),
        avgTime: this.formatDuration(page.avgDuration)
      }));
    } catch (error) {
      console.error('Error in getTopPages:', error);
      return [];
    }
  }

  /**
   * Get device breakdown
   */
  static async getDeviceBreakdown(range = '30d') {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      const deviceData = await SimpleAnalyticsEvent.aggregate([
        {
          $match: {
            type: 'page_view',
            timestamp: { $gte: startDate, $lte: endDate },
            'properties.deviceType': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$properties.deviceType',
            count: { $sum: 1 }
          }
        }
      ]);

      const total = deviceData.reduce((sum, item) => sum + item.count, 0);

      if (total === 0) {
        return [];
      }

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
      console.error('Error in getDeviceBreakdown:', error);
      return [];
    }
  }

  /**
   * Get conversion funnel data
   */
  static async getConversionFunnel(range = '30d') {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      // Get visit count (unique sessions)
      const visits = await SimpleAnalyticsEvent.distinct('sessionId', {
        timestamp: { $gte: startDate, $lte: endDate }
      }).then(sessions => sessions.length);

      // Get signup events
      const signups = await SimpleAnalyticsEvent.countDocuments({
        type: { $in: ['signup_completed', 'signup', 'user_signup', 'user_action'] },
        timestamp: { $gte: startDate, $lte: endDate }
      });

      // Get trial events
      const trials = await SimpleAnalyticsEvent.countDocuments({
        type: { $in: ['trial_started', 'trial', 'subscription_trial', 'subscription_viewed'] },
        timestamp: { $gte: startDate, $lte: endDate }
      });

      // Get purchase/payment events
      const purchases = await SimpleAnalyticsEvent.countDocuments({
        type: { $in: ['payment_completed', 'purchase', 'subscription_created', 'payment_started'] },
        timestamp: { $gte: startDate, $lte: endDate }
      });

      // Get active users (users with multiple sessions or repeated visits)
      const activeUsers = await SimpleAnalyticsEvent.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            userId: { $ne: null, $exists: true }
          }
        },
        {
          $group: {
            _id: '$userId',
            sessionCount: { $addToSet: '$sessionId' }
          }
        },
        {
          $match: {
            'sessionCount.1': { $exists: true } // Users with at least 2 sessions
          }
        }
      ]).then(result => result.length);

      const stepData = [
        {
          step: 'Website Visit',
          users: visits,
          conversionRate: 100
        },
        {
          step: 'Sign Up',
          users: signups,
          conversionRate: visits > 0 ? parseFloat((signups / visits * 100).toFixed(1)) : 0
        },
        {
          step: 'Trial Start',
          users: trials,
          conversionRate: signups > 0 ? parseFloat((trials / signups * 100).toFixed(1)) : 0
        },
        {
          step: 'Purchase',
          users: purchases,
          conversionRate: trials > 0 ? parseFloat((purchases / trials * 100).toFixed(1)) : 0
        },
        {
          step: 'Active User',
          users: activeUsers,
          conversionRate: purchases > 0 ? parseFloat((activeUsers / purchases * 100).toFixed(1)) : 0
        }
      ];

      return stepData;
    } catch (error) {
      console.error('Error in getConversionFunnel:', error);
      // Return empty funnel structure on error
      return [
        { step: 'Website Visit', users: 0, conversionRate: 100 },
        { step: 'Sign Up', users: 0, conversionRate: 0 },
        { step: 'Trial Start', users: 0, conversionRate: 0 },
        { step: 'Purchase', users: 0, conversionRate: 0 },
        { step: 'Active User', users: 0, conversionRate: 0 }
      ];
    }
  }

  /**
   * Get events data
   */
  static async getEvents(range = '30d', limit = 100) {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      const events = await SimpleAnalyticsEvent.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            type: { $ne: 'page_view' } // Exclude page views from events
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$sessionId' }
          }
        },
        {
          $project: {
            eventName: '$_id',
            count: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: limit }
      ]);

      return events;
    } catch (error) {
      console.error('Error in getEvents:', error);
      return [];
    }
  }

  /**
   * Get recent events
   */
  static async getRecentEvents(range = '30d', limit = 10) {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      const events = await SimpleAnalyticsEvent.find({
        timestamp: { $gte: startDate, $lte: endDate }
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('type timestamp properties sessionId userId')
        .lean();

      return events.map(event => ({
        type: event.type || 'Event',
        action: event.type || 'Unknown',
        label: event.properties?.path || event.properties?.page || '',
        timestamp: event.timestamp,
        userId: event.userId,
        sessionId: event.sessionId
      }));
    } catch (error) {
      console.error('Failed to get recent events:', error);
      // Return empty array instead of throwing to prevent overview from failing
      return [];
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

  /**
   * Get growth data over time
   */
  static async getGrowthData(range = '30d', metric = 'all') {
    const { startDate, endDate } = this.getDateRange(range);

    try {
      // Determine the grouping interval based on range
      let dateFormat, intervalDays;
      switch (range) {
        case '7d':
          dateFormat = '%Y-%m-%d';
          intervalDays = 1;
          break;
        case '30d':
          dateFormat = '%Y-%m-%d';
          intervalDays = 1;
          break;
        case '90d':
          dateFormat = '%Y-%W'; // Week
          intervalDays = 7;
          break;
        case '180d':
        case '365d':
          dateFormat = '%Y-%m'; // Month
          intervalDays = 30;
          break;
        default:
          dateFormat = '%Y-%m-%d';
          intervalDays = 1;
      }

      const growthData = {
        labels: [],
        datasets: []
      };

      // Get page views over time
      if (metric === 'all' || metric === 'pageviews') {
        const pageViewsData = await PageView.aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: '$timestamp' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        growthData.datasets.push({
          label: 'Page Views',
          data: pageViewsData.map(item => item.count),
          color: '#3b82f6'
        });

        if (growthData.labels.length === 0) {
          growthData.labels = pageViewsData.map(item => item._id);
        }
      }

      // Get unique visitors over time
      if (metric === 'all' || metric === 'users') {
        const visitorsData = await PageView.aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: {
                date: { $dateToString: { format: dateFormat, date: '$timestamp' } },
                sessionId: '$sessionId'
              }
            }
          },
          {
            $group: {
              _id: '$_id.date',
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        growthData.datasets.push({
          label: 'Unique Visitors',
          data: visitorsData.map(item => item.count),
          color: '#10b981'
        });

        if (growthData.labels.length === 0) {
          growthData.labels = visitorsData.map(item => item._id);
        }
      }

      // Get sessions over time
      if (metric === 'all' || metric === 'sessions') {
        const sessionsData = await UserSession.aggregate([
          { $match: { startTime: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: '$startTime' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        growthData.datasets.push({
          label: 'Sessions',
          data: sessionsData.map(item => item.count),
          color: '#8b5cf6'
        });

        if (growthData.labels.length === 0) {
          growthData.labels = sessionsData.map(item => item._id);
        }
      }

      // Get conversions over time
      if (metric === 'all' || metric === 'conversions') {
        const conversionsData = await Conversion.aggregate([
          { $match: { completedAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $dateToString: { format: dateFormat, date: '$completedAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        growthData.datasets.push({
          label: 'Conversions',
          data: conversionsData.map(item => item.count),
          color: '#f59e0b'
        });

        if (growthData.labels.length === 0) {
          growthData.labels = conversionsData.map(item => item._id);
        }
      }

      // If no data, return sample data for visualization
      if (growthData.labels.length === 0) {
        const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const samplePoints = Math.min(daysInRange, 30);

        growthData.labels = Array.from({ length: samplePoints }, (_, i) => {
          const date = new Date(startDate.getTime() + i * (1000 * 60 * 60 * 24));
          return date.toISOString().split('T')[0];
        });

        growthData.datasets = [
          {
            label: 'Page Views',
            data: Array.from({ length: samplePoints }, () => Math.floor(Math.random() * 100) + 50),
            color: '#3b82f6'
          },
          {
            label: 'Unique Visitors',
            data: Array.from({ length: samplePoints }, () => Math.floor(Math.random() * 50) + 20),
            color: '#10b981'
          },
          {
            label: 'Sessions',
            data: Array.from({ length: samplePoints }, () => Math.floor(Math.random() * 60) + 25),
            color: '#8b5cf6'
          },
          {
            label: 'Conversions',
            data: Array.from({ length: samplePoints }, () => Math.floor(Math.random() * 20) + 5),
            color: '#f59e0b'
          }
        ];

        growthData.isSampleData = true;
      }

      return growthData;
    } catch (error) {
      console.error('Failed to get growth data:', error);
      throw new Error(`Failed to get growth data: ${error.message}`);
    }
  }

  /**
   * Get real-time analytics (last 30 minutes)
   */
  static async getRealtimeAnalytics() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    try {
      const SimpleAnalyticsEvent = getSimpleAnalyticsModel();

      const [
        // Active users in last 5 minutes (count unique sessions)
        recentSessions,
        // All events in last 30 minutes
        allRecentEvents,
        // Top pages aggregation
        topPagesResult,
        // Device breakdown
        devicesResult,
        // Previous period for trend calculation
        previousPeriodSessions
      ] = await Promise.all([
        // Recent unique sessions (active users)
        SimpleAnalyticsEvent.distinct('sessionId', {
          timestamp: { $gte: fiveMinutesAgo }
        }),

        // All recent events
        SimpleAnalyticsEvent.find({
          timestamp: { $gte: thirtyMinutesAgo }
        }).lean(),

        // Top pages
        SimpleAnalyticsEvent.aggregate([
          {
            $match: {
              timestamp: { $gte: thirtyMinutesAgo },
              type: 'page_view',
              'properties.path': { $exists: true }
            }
          },
          {
            $group: {
              _id: '$properties.path',
              activeUsers: { $addToSet: '$sessionId' },
              views: { $sum: 1 }
            }
          },
          {
            $project: {
              page: '$_id',
              activeUsers: { $size: '$activeUsers' },
              views: 1
            }
          },
          { $sort: { activeUsers: -1, views: -1 } },
          { $limit: 5 }
        ]),

        // Device breakdown
        SimpleAnalyticsEvent.aggregate([
          {
            $match: {
              timestamp: { $gte: thirtyMinutesAgo },
              type: 'page_view',
              'properties.deviceType': { $exists: true }
            }
          },
          {
            $group: {
              _id: '$properties.deviceType',
              sessions: { $addToSet: '$sessionId' }
            }
          },
          {
            $project: {
              device: '$_id',
              users: { $size: '$sessions' }
            }
          }
        ]),

        // Previous period sessions for trend
        SimpleAnalyticsEvent.distinct('sessionId', {
          timestamp: {
            $gte: new Date(Date.now() - 30 * 60 * 1000),
            $lt: fiveMinutesAgo
          }
        })
      ]);

      // Calculate metrics
      const activeUsers = recentSessions.length;
      const activeSessions = recentSessions.length; // For now, same as active users
      const recentPageViews = allRecentEvents.filter(e => e.type === 'page_view').length;
      const recentEvents = allRecentEvents.length;

      // Calculate trend
      const previousPeriodUsers = previousPeriodSessions.length;
      const trend = previousPeriodUsers > 0
        ? ((activeUsers - previousPeriodUsers) / previousPeriodUsers) * 100
        : activeUsers > 0 ? 100 : 0;

      // Get location data from metadata if available
      const locationsMap = new Map();
      allRecentEvents.forEach(event => {
        if (event.metadata && event.metadata.country && event.sessionId) {
          const country = event.metadata.country;
          if (!locationsMap.has(country)) {
            locationsMap.set(country, new Set());
          }
          locationsMap.get(country).add(event.sessionId);
        }
      });

      const activeLocations = Array.from(locationsMap.entries())
        .map(([country, sessions]) => ({
          country,
          users: sessions.size
        }))
        .sort((a, b) => b.users - a.users)
        .slice(0, 5);

      const realtimeData = {
        current: {
          activeUsers,
          activeSessions,
          pageViews: recentPageViews,
          events: recentEvents,
          trend: trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1)
        },
        topPages: topPagesResult.map(page => ({
          page: page.page || 'Unknown',
          activeUsers: page.activeUsers,
          views: page.views
        })),
        devices: devicesResult.map(device => ({
          type: device.device || 'Unknown',
          users: device.users
        })),
        locations: activeLocations.length > 0 ? activeLocations : [
          { country: 'Unknown', users: activeUsers }
        ],
        timestamp: new Date().toISOString(),
        period: 'last_30_minutes',
        isSampleData: false
      };

      return realtimeData;
    } catch (error) {
      console.error('Failed to get real-time analytics:', error);

      // Return empty data structure on error
      return {
        current: {
          activeUsers: 0,
          activeSessions: 0,
          pageViews: 0,
          events: 0,
          trend: '0'
        },
        topPages: [],
        devices: [],
        locations: [],
        timestamp: new Date().toISOString(),
        period: 'last_30_minutes',
        error: error.message,
        isSampleData: false
      };
    }
  }

  /**
   * Get analytics integrations status and configuration
   */
  static async getIntegrations() {
    try {
      // Check available integrations and their status
      const integrations = [
        {
          id: 'google-analytics',
          name: 'Google Analytics',
          description: 'Web analytics and reporting from Google',
          status: 'available',
          enabled: false,
          icon: '📊',
          category: 'Analytics',
          features: [
            'Page view tracking',
            'User behavior analysis',
            'Conversion tracking',
            'Real-time reporting'
          ],
          config: {
            trackingId: process.env.GA_TRACKING_ID || null,
            measurementId: process.env.GA_MEASUREMENT_ID || null
          }
        },
        {
          id: 'mixpanel',
          name: 'Mixpanel',
          description: 'Advanced product analytics platform',
          status: 'available',
          enabled: false,
          icon: '📈',
          category: 'Analytics',
          features: [
            'Event tracking',
            'User segmentation',
            'Funnel analysis',
            'Retention reports'
          ],
          config: {
            projectToken: process.env.MIXPANEL_TOKEN || null
          }
        },
        {
          id: 'segment',
          name: 'Segment',
          description: 'Customer data platform',
          status: 'available',
          enabled: false,
          icon: '🔄',
          category: 'CDP',
          features: [
            'Data collection',
            'Multiple destination routing',
            'Event standardization',
            'Data warehouse sync'
          ],
          config: {
            writeKey: process.env.SEGMENT_WRITE_KEY || null
          }
        },
        {
          id: 'hotjar',
          name: 'Hotjar',
          description: 'User behavior insights with heatmaps',
          status: 'available',
          enabled: false,
          icon: '🔥',
          category: 'UX Analytics',
          features: [
            'Heatmaps',
            'Session recordings',
            'Feedback polls',
            'User surveys'
          ],
          config: {
            siteId: process.env.HOTJAR_SITE_ID || null
          }
        },
        {
          id: 'amplitude',
          name: 'Amplitude',
          description: 'Product analytics for growth',
          status: 'available',
          enabled: false,
          icon: '📉',
          category: 'Analytics',
          features: [
            'Behavioral analytics',
            'Cohort analysis',
            'Predictive analytics',
            'A/B testing'
          ],
          config: {
            apiKey: process.env.AMPLITUDE_API_KEY || null
          }
        },
        {
          id: 'internal',
          name: 'Internal Analytics',
          description: 'Built-in analytics system',
          status: 'active',
          enabled: true,
          icon: '⚡',
          category: 'Analytics',
          features: [
            'Real-time tracking',
            'Custom events',
            'Privacy-focused',
            'No external dependencies'
          ],
          config: {
            dataRetentionDays: 365,
            privacyMode: 'strict'
          }
        },
        {
          id: 'facebook-pixel',
          name: 'Facebook Pixel',
          description: 'Facebook advertising analytics',
          status: 'available',
          enabled: false,
          icon: '👤',
          category: 'Advertising',
          features: [
            'Conversion tracking',
            'Custom audiences',
            'Ad optimization',
            'Attribution'
          ],
          config: {
            pixelId: process.env.FACEBOOK_PIXEL_ID || null
          }
        },
        {
          id: 'google-tag-manager',
          name: 'Google Tag Manager',
          description: 'Tag management system',
          status: 'available',
          enabled: false,
          icon: '🏷️',
          category: 'Tag Management',
          features: [
            'Tag deployment',
            'Version control',
            'Multiple tag support',
            'Debugging tools'
          ],
          config: {
            containerId: process.env.GTM_CONTAINER_ID || null
          }
        },
        {
          id: 'plausible',
          name: 'Plausible Analytics',
          description: 'Simple and privacy-friendly analytics',
          status: 'available',
          enabled: false,
          icon: '🔒',
          category: 'Analytics',
          features: [
            'Privacy-focused',
            'Lightweight script',
            'GDPR compliant',
            'No cookies'
          ],
          config: {
            domain: process.env.PLAUSIBLE_DOMAIN || null
          }
        },
        {
          id: 'matomo',
          name: 'Matomo',
          description: 'Self-hosted analytics platform',
          status: 'available',
          enabled: false,
          icon: '🎯',
          category: 'Analytics',
          features: [
            'Self-hosted option',
            'Complete data ownership',
            'GDPR compliant',
            'Customizable'
          ],
          config: {
            siteId: process.env.MATOMO_SITE_ID || null,
            trackerUrl: process.env.MATOMO_TRACKER_URL || null
          }
        }
      ];

      // Count enabled integrations
      const enabledCount = integrations.filter(i => i.enabled).length;
      const totalCount = integrations.length;

      // Get stats from internal analytics
      const stats = {
        totalEvents: await Event.countDocuments(),
        totalPageViews: await PageView.countDocuments(),
        totalSessions: await UserSession.countDocuments(),
        dataRetentionDays: 365,
        lastUpdated: new Date().toISOString()
      };

      return {
        integrations,
        summary: {
          total: totalCount,
          enabled: enabledCount,
          available: totalCount - enabledCount,
          categories: {
            analytics: integrations.filter(i => i.category === 'Analytics').length,
            advertising: integrations.filter(i => i.category === 'Advertising').length,
            cdp: integrations.filter(i => i.category === 'CDP').length,
            uxAnalytics: integrations.filter(i => i.category === 'UX Analytics').length,
            tagManagement: integrations.filter(i => i.category === 'Tag Management').length
          }
        },
        stats,
        recommendations: [
          {
            title: 'Enable Google Analytics',
            description: 'Get industry-standard analytics with minimal setup',
            priority: 'high',
            integrationId: 'google-analytics'
          },
          {
            title: 'Consider Privacy-Focused Analytics',
            description: 'Use Plausible or Matomo for GDPR compliance',
            priority: 'medium',
            integrationId: 'plausible'
          },
          {
            title: 'Add Heatmaps',
            description: 'Understand user behavior with visual insights',
            priority: 'medium',
            integrationId: 'hotjar'
          }
        ]
      };
    } catch (error) {
      console.error('Failed to get integrations:', error);
      throw new Error(`Failed to get integrations: ${error.message}`);
    }
  }

  /**
   * Export analytics data in various formats
   */
  static async exportAnalytics(options = {}) {
    const { range = '30d', type = 'all', include = 'all', format = 'json' } = options;
    const { startDate, endDate } = this.getDateRange(range);

    try {
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            range
          },
          dataType: type,
          includeLevel: include,
          format
        },
        data: {}
      };

      // Export metrics summary
      if (type === 'all' || type === 'metrics') {
        const metrics = await this.getMetrics(range);
        exportData.data.metrics = {
          totalPageViews: metrics.totalPageViews.value,
          uniqueVisitors: metrics.uniqueVisitors.value,
          sessions: metrics.sessions.value,
          avgSessionDuration: metrics.avgSessionDuration.value,
          bounceRate: metrics.bounceRate.value
        };
      }

      // Export page views
      if (type === 'all' || type === 'pageviews') {
        const pageViews = await PageView.find({
          timestamp: { $gte: startDate, $lte: endDate }
        })
          .select('sessionId page deviceType trafficSource timestamp duration bounced')
          .lean()
          .limit(include === 'summary' ? 1000 : 50000);

        exportData.data.pageViews = pageViews;
        exportData.recordCount = (exportData.recordCount || 0) + pageViews.length;
      }

      // Export sessions
      if (type === 'all' || type === 'sessions') {
        const sessions = await UserSession.find({
          startTime: { $gte: startDate, $lte: endDate }
        })
          .select('sessionId startTime endTime duration pageViews events')
          .lean()
          .limit(include === 'summary' ? 500 : 10000);

        exportData.data.sessions = sessions;
        exportData.recordCount = (exportData.recordCount || 0) + sessions.length;
      }

      // Export events
      if (type === 'all' || type === 'events') {
        const events = await Event.find({
          timestamp: { $gte: startDate, $lte: endDate }
        })
          .select('sessionId eventType eventCategory eventAction eventLabel timestamp')
          .lean()
          .limit(include === 'summary' ? 1000 : 50000);

        exportData.data.events = events;
        exportData.recordCount = (exportData.recordCount || 0) + events.length;
      }

      // Export conversions
      if (type === 'all' || type === 'conversions') {
        const conversions = await Conversion.find({
          completedAt: { $gte: startDate, $lte: endDate }
        })
          .select('userId sessionId funnelStep conversionValue completedAt')
          .lean()
          .limit(include === 'summary' ? 500 : 5000);

        exportData.data.conversions = conversions;
        exportData.recordCount = (exportData.recordCount || 0) + conversions.length;
      }

      // Add analytics summary
      if (include === 'all' || include === 'summary') {
        exportData.summary = {
          totalRecords: exportData.recordCount || 0,
          dataTypes: Object.keys(exportData.data),
          dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          exportSize: JSON.stringify(exportData).length
        };
      }

      // Format conversion
      if (format === 'csv') {
        return this.convertToCSV(exportData);
      } else if (format === 'xlsx') {
        return this.convertToXLSX(exportData);
      }

      return exportData;
    } catch (error) {
      console.error('Failed to export analytics:', error);
      throw new Error(`Failed to export analytics: ${error.message}`);
    }
  }

  /**
   * Convert export data to CSV format
   */
  static convertToCSV(exportData) {
    let csv = '';

    // Add metadata header
    csv += 'Analytics Export\n';
    csv += `Exported At: ${exportData.metadata.exportedAt}\n`;
    csv += `Date Range: ${exportData.metadata.dateRange.start} to ${exportData.metadata.dateRange.end}\n`;
    csv += `Range: ${exportData.metadata.dateRange.range}\n\n`;

    // Add metrics
    if (exportData.data.metrics) {
      csv += 'METRICS\n';
      csv += 'Metric,Value\n';
      Object.entries(exportData.data.metrics).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
      });
      csv += '\n';
    }

    // Add page views
    if (exportData.data.pageViews && exportData.data.pageViews.length > 0) {
      csv += 'PAGE VIEWS\n';
      csv += 'Session ID,Page,Device Type,Traffic Source,Timestamp,Duration,Bounced\n';
      exportData.data.pageViews.forEach(pv => {
        csv += `${pv.sessionId},${pv.page},${pv.deviceType},${pv.trafficSource},${pv.timestamp},${pv.duration || 0},${pv.bounced || false}\n`;
      });
      csv += '\n';
    }

    // Add sessions
    if (exportData.data.sessions && exportData.data.sessions.length > 0) {
      csv += 'SESSIONS\n';
      csv += 'Session ID,Start Time,End Time,Duration,Page Views,Events\n';
      exportData.data.sessions.forEach(session => {
        csv += `${session.sessionId},${session.startTime},${session.endTime || 'ongoing'},${session.duration || 0},${session.pageViews || 0},${session.events || 0}\n`;
      });
      csv += '\n';
    }

    // Add events
    if (exportData.data.events && exportData.data.events.length > 0) {
      csv += 'EVENTS\n';
      csv += 'Session ID,Event Type,Category,Action,Label,Timestamp\n';
      exportData.data.events.forEach(event => {
        csv += `${event.sessionId},${event.eventType},${event.eventCategory},${event.eventAction},${event.eventLabel || ''},${event.timestamp}\n`;
      });
      csv += '\n';
    }

    // Add conversions
    if (exportData.data.conversions && exportData.data.conversions.length > 0) {
      csv += 'CONVERSIONS\n';
      csv += 'User ID,Session ID,Funnel Step,Conversion Value,Completed At\n';
      exportData.data.conversions.forEach(conv => {
        csv += `${conv.userId || 'N/A'},${conv.sessionId},${conv.funnelStep},${conv.conversionValue || 0},${conv.completedAt}\n`;
      });
      csv += '\n';
    }

    // Add summary
    if (exportData.summary) {
      csv += 'SUMMARY\n';
      csv += `Total Records: ${exportData.summary.totalRecords}\n`;
      csv += `Data Types: ${exportData.summary.dataTypes.join(', ')}\n`;
      csv += `Export Size: ${exportData.summary.exportSize} bytes\n`;
    }

    return csv;
  }

  /**
   * Convert export data to XLSX format (placeholder - requires xlsx library)
   */
  static convertToXLSX(exportData) {
    // Note: This is a placeholder. For production, use 'xlsx' or 'exceljs' library
    // For now, return JSON representation with a note
    return JSON.stringify({
      note: 'XLSX export requires xlsx library installation',
      data: exportData,
      instructions: 'Install xlsx package: npm install xlsx'
    }, null, 2);
  }
}

module.exports = AnalyticsService;





