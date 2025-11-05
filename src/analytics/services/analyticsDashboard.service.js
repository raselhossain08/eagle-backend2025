const VisitorSession = require('../models/visitorSession.model');
const AnalyticsEvent = require('../models/analyticsEvent.model');
const PrivacyConsent = require('../models/privacyConsent.model');

class AnalyticsDashboardService {
  
  /**
   * Get overview dashboard data
   */
  async getOverviewDashboard(startDate, endDate, filters = {}) {
    try {
      const dateRange = {
        startTime: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };
      
      // Apply additional filters
      const sessionQuery = { ...dateRange, ...filters };
      const eventQuery = {
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
        ...filters
      };
      
      // Get basic metrics
      const [sessionMetrics, eventMetrics, pageViewData, topPages] = await Promise.all([
        this.getSessionMetrics(sessionQuery),
        this.getEventMetrics(eventQuery),
        this.getPageViewMetrics(eventQuery),
        this.getTopPages(startDate, endDate, 10)
      ]);
      
      // Calculate derived metrics
      const bounceRate = sessionMetrics.totalSessions > 0 ? 
        (sessionMetrics.bouncedSessions / sessionMetrics.totalSessions) * 100 : 0;
      
      const conversionRate = sessionMetrics.totalSessions > 0 ? 
        (sessionMetrics.convertedSessions / sessionMetrics.totalSessions) * 100 : 0;
      
      const avgSessionDuration = sessionMetrics.totalSessions > 0 ? 
        sessionMetrics.totalDuration / sessionMetrics.totalSessions : 0;
      
      return {
        overview: {
          users: sessionMetrics.uniqueVisitors,
          sessions: sessionMetrics.totalSessions,
          pageViews: pageViewData.totalPageViews,
          events: eventMetrics.totalEvents,
          bounceRate: Math.round(bounceRate * 100) / 100,
          avgSessionDuration: Math.round(avgSessionDuration),
          conversionRate: Math.round(conversionRate * 100) / 100,
          revenue: sessionMetrics.totalRevenue
        },
        trends: await this.getTrends(startDate, endDate, filters),
        topPages,
        deviceBreakdown: await this.getDeviceBreakdown(sessionQuery),
        trafficSources: await this.getTrafficSources(sessionQuery),
        geographicData: await this.getGeographicBreakdown(sessionQuery)
      };
      
    } catch (error) {
      console.error('Error getting overview dashboard:', error);
      throw error;
    }
  }
  
  /**
   * Get conversion funnel analysis
   */
  async getConversionFunnel(startDate, endDate, funnelSteps = null, filters = {}) {
    try {
      // Default funnel steps if not provided
      if (!funnelSteps) {
        funnelSteps = ['visit', 'signup', 'trial', 'purchase', 'contract_signed'];
      }
      
      const dateQuery = {
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };
      
      // Get funnel data
      const funnelData = await AnalyticsEvent.aggregate([
        {
          $match: {
            ...dateQuery,
            $or: [
              { category: 'page_view' },
              { 'conversion.isConversion': true }
            ],
            ...filters
          }
        },
        {
          $group: {
            _id: '$visitorId',
            events: {
              $push: {
                name: '$name',
                category: '$category',
                timestamp: '$timestamp',
                conversion: '$conversion',
                page: '$page.path'
              }
            }
          }
        },
        {
          $project: {
            visitorId: '$_id',
            hasVisit: {
              $anyElementTrue: {
                $map: {
                  input: '$events',
                  as: 'event',
                  in: { $eq: ['$$event.category', 'page_view'] }
                }
              }
            },
            hasSignup: {
              $anyElementTrue: {
                $map: {
                  input: '$events',
                  as: 'event',
                  in: { $eq: ['$$event.conversion.conversionType', 'signup'] }
                }
              }
            },
            hasTrial: {
              $anyElementTrue: {
                $map: {
                  input: '$events',
                  as: 'event',
                  in: { $eq: ['$$event.conversion.conversionType', 'trial'] }
                }
              }
            },
            hasPurchase: {
              $anyElementTrue: {
                $map: {
                  input: '$events',
                  as: 'event',
                  in: { $eq: ['$$event.conversion.conversionType', 'purchase'] }
                }
              }
            },
            hasContract: {
              $anyElementTrue: {
                $map: {
                  input: '$events',
                  as: 'event',
                  in: { $eq: ['$$event.conversion.conversionType', 'contract_signed'] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            visits: { $sum: { $cond: ['$hasVisit', 1, 0] } },
            signups: { $sum: { $cond: ['$hasSignup', 1, 0] } },
            trials: { $sum: { $cond: ['$hasTrial', 1, 0] } },
            purchases: { $sum: { $cond: ['$hasPurchase', 1, 0] } },
            contracts: { $sum: { $cond: ['$hasContract', 1, 0] } }
          }
        }
      ]);
      
      const data = funnelData[0] || {
        visits: 0, signups: 0, trials: 0, purchases: 0, contracts: 0
      };
      
      // Calculate conversion rates and drop-offs
      const funnel = [
        {
          step: 'Visit',
          users: data.visits,
          conversionRate: 100,
          dropOff: 0
        },
        {
          step: 'Signup',
          users: data.signups,
          conversionRate: data.visits > 0 ? (data.signups / data.visits) * 100 : 0,
          dropOff: data.visits - data.signups
        },
        {
          step: 'Trial',
          users: data.trials,
          conversionRate: data.signups > 0 ? (data.trials / data.signups) * 100 : 0,
          dropOff: data.signups - data.trials
        },
        {
          step: 'Purchase',
          users: data.purchases,
          conversionRate: data.trials > 0 ? (data.purchases / data.trials) * 100 : 0,
          dropOff: data.trials - data.purchases
        },
        {
          step: 'Contract',
          users: data.contracts,
          conversionRate: data.purchases > 0 ? (data.contracts / data.purchases) * 100 : 0,
          dropOff: data.purchases - data.contracts
        }
      ];
      
      // Get drop-off analysis
      const dropOffAnalysis = await this.getDropOffAnalysis(startDate, endDate, filters);
      
      return {
        funnel,
        dropOffAnalysis,
        totalConversionRate: data.visits > 0 ? (data.contracts / data.visits) * 100 : 0,
        topDropOffPoints: this.identifyTopDropOffPoints(funnel)
      };
      
    } catch (error) {
      console.error('Error getting conversion funnel:', error);
      throw error;
    }
  }
  
  /**
   * Get growth analytics
   */
  async getGrowthAnalytics(startDate, endDate, filters = {}) {
    try {
      // Channel performance
      const channelPerformance = await this.getChannelPerformance(startDate, endDate, filters);
      
      // Cohort analysis
      const cohortAnalysis = await this.getCohortRetention(startDate, endDate);
      
      // LTV by channel
      const ltvByChannel = await this.getLTVByChannel(startDate, endDate);
      
      // Growth trends
      const growthTrends = await this.getGrowthTrends(startDate, endDate, filters);
      
      return {
        channelPerformance,
        cohortAnalysis,
        ltvByChannel,
        growthTrends,
        summary: {
          totalAcquisition: channelPerformance.reduce((sum, channel) => sum + channel.sessions, 0),
          bestPerformingChannel: channelPerformance[0]?.channel || 'N/A',
          avgLTV: ltvByChannel.reduce((sum, channel) => sum + channel.ltv, 0) / ltvByChannel.length || 0
        }
      };
      
    } catch (error) {
      console.error('Error getting growth analytics:', error);
      throw error;
    }
  }
  
  /**
   * Get real-time dashboard
   */
  async getRealTimeDashboard() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Active users (last 5 minutes)
      const activeSessions = await VisitorSession.find({
        isActive: true,
        lastActivity: { $gte: fiveMinutesAgo }
      });
      
      // Recent events
      const recentEvents = await AnalyticsEvent.find({
        timestamp: { $gte: fiveMinutesAgo }
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('name action page.path timestamp visitorId');
      
      // Top pages (last hour)
      const topPagesRealTime = await AnalyticsEvent.aggregate([
        {
          $match: {
            category: 'page_view',
            timestamp: { $gte: oneHourAgo }
          }
        },
        {
          $group: {
            _id: '$page.path',
            views: { $sum: 1 },
            uniqueVisitors: { $addToSet: '$visitorId' }
          }
        },
        {
          $addFields: {
            uniqueVisitors: { $size: '$uniqueVisitors' }
          }
        },
        {
          $sort: { views: -1 }
        },
        {
          $limit: 10
        }
      ]);
      
      // Recent conversions
      const recentConversions = await AnalyticsEvent.find({
        'conversion.isConversion': true,
        timestamp: { $gte: oneHourAgo }
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('conversion timestamp visitorId value currency');
      
      // Geographic distribution of active users
      const activeUserGeo = activeSessions.reduce((acc, session) => {
        const country = session.geo.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});
      
      return {
        activeUsers: activeSessions.length,
        activeUsersByCountry: Object.entries(activeUserGeo)
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count),
        topPages: topPagesRealTime,
        recentEvents: recentEvents,
        recentConversions: recentConversions,
        summary: {
          eventsLastMinute: recentEvents.filter(e => 
            e.timestamp >= new Date(Date.now() - 60 * 1000)
          ).length,
          pageViewsLastHour: topPagesRealTime.reduce((sum, page) => sum + page.views, 0),
          conversionsLastHour: recentConversions.length,
          revenueLastHour: recentConversions.reduce((sum, conv) => sum + (conv.value || 0), 0)
        }
      };
      
    } catch (error) {
      console.error('Error getting real-time dashboard:', error);
      throw error;
    }
  }
  
  /**
   * Get event explorer data
   */
  async getEventExplorer(startDate, endDate, filters = {}) {
    try {
      const query = {
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
        ...filters
      };
      
      // Get event breakdown
      const eventBreakdown = await AnalyticsEvent.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              category: '$category',
              name: '$name',
              action: '$action'
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$visitorId' },
            totalValue: { $sum: '$value' },
            avgValue: { $avg: '$value' }
          }
        },
        {
          $addFields: {
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 100
        }
      ]);
      
      // Get event timeline
      const timeline = await this.getEventTimeline(startDate, endDate, filters);
      
      // Get event properties analysis
      const propertyAnalysis = await this.getEventPropertyAnalysis(startDate, endDate, filters);
      
      return {
        events: eventBreakdown,
        timeline,
        propertyAnalysis,
        summary: {
          totalEvents: eventBreakdown.reduce((sum, event) => sum + event.count, 0),
          uniqueEventTypes: eventBreakdown.length,
          mostPopularEvent: eventBreakdown[0] || null
        }
      };
      
    } catch (error) {
      console.error('Error getting event explorer:', error);
      throw error;
    }
  }
  
  /**
   * Export analytics data for BI
   */
  async exportAnalyticsData(startDate, endDate, format = 'json', dataTypes = ['sessions', 'events']) {
    try {
      const exportData = {};
      
      if (dataTypes.includes('sessions')) {
        exportData.sessions = await VisitorSession.find({
          startTime: { $gte: new Date(startDate), $lte: new Date(endDate) }
        })
        .select('-__v')
        .lean();
      }
      
      if (dataTypes.includes('events')) {
        exportData.events = await AnalyticsEvent.find({
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
        })
        .select('-__v')
        .lean();
      }
      
      if (dataTypes.includes('consents')) {
        exportData.consents = await PrivacyConsent.find({
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
        })
        .select('-__v')
        .lean();
      }
      
      // Add metadata
      exportData.metadata = {
        exportDate: new Date(),
        dateRange: { startDate, endDate },
        dataTypes,
        recordCounts: {
          sessions: exportData.sessions?.length || 0,
          events: exportData.events?.length || 0,
          consents: exportData.consents?.length || 0
        }
      };
      
      return exportData;
      
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw error;
    }
  }
  
  // Helper Methods
  
  async getSessionMetrics(query) {
    const metrics = await VisitorSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorId' },
          bouncedSessions: { $sum: { $cond: ['$metrics.bounced', 1, 0] } },
          convertedSessions: { $sum: { $cond: ['$metrics.converted', 1, 0] } },
          totalDuration: { $sum: '$duration' },
          totalPageViews: { $sum: '$metrics.pageViews' },
          totalRevenue: { $sum: '$metrics.revenue' }
        }
      },
      {
        $addFields: {
          uniqueVisitors: { $size: '$uniqueVisitors' }
        }
      }
    ]);
    
    return metrics[0] || {
      totalSessions: 0,
      uniqueVisitors: 0,
      bouncedSessions: 0,
      convertedSessions: 0,
      totalDuration: 0,
      totalPageViews: 0,
      totalRevenue: 0
    };
  }
  
  async getEventMetrics(query) {
    const metrics = await AnalyticsEvent.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          uniqueUsers: { $addToSet: '$visitorId' },
          totalValue: { $sum: '$value' },
          conversions: { $sum: { $cond: ['$conversion.isConversion', 1, 0] } }
        }
      },
      {
        $addFields: {
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      }
    ]);
    
    return metrics[0] || {
      totalEvents: 0,
      uniqueUsers: 0,
      totalValue: 0,
      conversions: 0
    };
  }
  
  async getPageViewMetrics(query) {
    const pageViewQuery = { ...query, category: 'page_view' };
    const metrics = await AnalyticsEvent.aggregate([
      { $match: pageViewQuery },
      {
        $group: {
          _id: null,
          totalPageViews: { $sum: 1 },
          uniquePageViews: { $addToSet: { visitorId: '$visitorId', path: '$page.path' } }
        }
      },
      {
        $addFields: {
          uniquePageViews: { $size: '$uniquePageViews' }
        }
      }
    ]);
    
    return metrics[0] || { totalPageViews: 0, uniquePageViews: 0 };
  }
  
  async getTopPages(startDate, endDate, limit = 10) {
    return await AnalyticsEvent.getTopPages(startDate, endDate, limit);
  }
  
  async getTrends(startDate, endDate, filters = {}) {
    const dateQuery = {
      startTime: { $gte: new Date(startDate), $lte: new Date(endDate) },
      ...filters
    };
    
    return await VisitorSession.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' },
            day: { $dayOfMonth: '$startTime' }
          },
          sessions: { $sum: 1 },
          users: { $addToSet: '$visitorId' },
          pageViews: { $sum: '$metrics.pageViews' },
          conversions: { $sum: { $cond: ['$metrics.converted', 1, 0] } }
        }
      },
      {
        $addFields: {
          users: { $size: '$users' },
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);
  }
  
  async getDeviceBreakdown(query) {
    return await VisitorSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$device.type',
          sessions: { $sum: 1 },
          users: { $addToSet: '$visitorId' }
        }
      },
      {
        $addFields: {
          users: { $size: '$users' }
        }
      },
      {
        $sort: { sessions: -1 }
      }
    ]);
  }
  
  async getTrafficSources(query) {
    return await VisitorSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            source: '$utm.source',
            medium: '$utm.medium',
            type: '$referrer.type'
          },
          sessions: { $sum: 1 },
          users: { $addToSet: '$visitorId' },
          conversions: { $sum: { $cond: ['$metrics.converted', 1, 0] } }
        }
      },
      {
        $addFields: {
          users: { $size: '$users' },
          conversionRate: {
            $cond: [
              { $gt: ['$sessions', 0] },
              { $multiply: [{ $divide: ['$conversions', '$sessions'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: { sessions: -1 }
      }
    ]);
  }
  
  async getGeographicBreakdown(query) {
    return await VisitorSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$geo.country',
          sessions: { $sum: 1 },
          users: { $addToSet: '$visitorId' }
        }
      },
      {
        $addFields: {
          users: { $size: '$users' }
        }
      },
      {
        $sort: { sessions: -1 }
      },
      {
        $limit: 20
      }
    ]);
  }
  
  async getDropOffAnalysis(startDate, endDate, filters = {}) {
    // Implementation for detailed drop-off analysis
    return await AnalyticsEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
          category: 'page_view',
          ...filters
        }
      },
      {
        $group: {
          _id: '$page.path',
          views: { $sum: 1 },
          exits: { $sum: { $cond: [{ $eq: ['$name', 'page_exit'] }, 1, 0] } },
          avgTimeOnPage: { $avg: '$interaction.timeOnPage' }
        }
      },
      {
        $addFields: {
          exitRate: {
            $cond: [
              { $gt: ['$views', 0] },
              { $multiply: [{ $divide: ['$exits', '$views'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: { exitRate: -1 }
      }
    ]);
  }
  
  identifyTopDropOffPoints(funnel) {
    return funnel
      .slice(1) // Skip first step (no drop-off from start)
      .map((step, index) => ({
        fromStep: funnel[index].step,
        toStep: step.step,
        dropOff: step.dropOff,
        dropOffRate: 100 - step.conversionRate
      }))
      .sort((a, b) => b.dropOffRate - a.dropOffRate)
      .slice(0, 3);
  }
  
  async getChannelPerformance(startDate, endDate, filters = {}) {
    return await VisitorSession.aggregate([
      {
        $match: {
          startTime: { $gte: new Date(startDate), $lte: new Date(endDate) },
          ...filters
        }
      },
      {
        $group: {
          _id: {
            source: { $ifNull: ['$utm.source', '$referrer.type'] },
            medium: '$utm.medium'
          },
          sessions: { $sum: 1 },
          users: { $addToSet: '$visitorId' },
          conversions: { $sum: { $cond: ['$metrics.converted', 1, 0] } },
          revenue: { $sum: '$metrics.revenue' }
        }
      },
      {
        $addFields: {
          users: { $size: '$users' },
          conversionRate: {
            $cond: [
              { $gt: ['$sessions', 0] },
              { $multiply: [{ $divide: ['$conversions', '$sessions'] }, 100] },
              0
            ]
          },
          revenuePerSession: {
            $cond: [
              { $gt: ['$sessions', 0] },
              { $divide: ['$revenue', '$sessions'] },
              0
            ]
          }
        }
      },
      {
        $project: {
          channel: { $concat: [{ $ifNull: ['$_id.source', 'unknown'] }, ' / ', { $ifNull: ['$_id.medium', 'none'] }] },
          sessions: 1,
          users: 1,
          conversions: 1,
          revenue: 1,
          conversionRate: 1,
          revenuePerSession: 1
        }
      },
      {
        $sort: { sessions: -1 }
      }
    ]);
  }
  
  async getCohortRetention(startDate, endDate) {
    // Simplified cohort analysis - can be enhanced based on requirements
    return await VisitorSession.aggregate([
      {
        $match: {
          startTime: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: {
            cohort: {
              $dateToString: {
                format: '%Y-%m',
                date: '$startTime'
              }
            },
            user: '$visitorId'
          },
          firstSession: { $min: '$startTime' }
        }
      },
      {
        $group: {
          _id: '$_id.cohort',
          users: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
  }
  
  async getLTVByChannel(startDate, endDate) {
    return await VisitorSession.aggregate([
      {
        $match: {
          startTime: { $gte: new Date(startDate), $lte: new Date(endDate) },
          'metrics.converted': true
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$utm.source', '$referrer.type'] },
          totalRevenue: { $sum: '$metrics.revenue' },
          customers: { $addToSet: '$visitorId' }
        }
      },
      {
        $addFields: {
          customers: { $size: '$customers' },
          ltv: {
            $cond: [
              { $gt: ['$customers', 0] },
              { $divide: ['$totalRevenue', '$customers'] },
              0
            ]
          }
        }
      },
      {
        $project: {
          channel: '$_id',
          totalRevenue: 1,
          customers: 1,
          ltv: 1
        }
      },
      {
        $sort: { ltv: -1 }
      }
    ]);
  }
  
  async getGrowthTrends(startDate, endDate, filters = {}) {
    return await VisitorSession.aggregate([
      {
        $match: {
          startTime: { $gte: new Date(startDate), $lte: new Date(endDate) },
          ...filters
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$startTime' },
            week: { $week: '$startTime' }
          },
          newUsers: { $addToSet: '$visitorId' },
          sessions: { $sum: 1 },
          conversions: { $sum: { $cond: ['$metrics.converted', 1, 0] } }
        }
      },
      {
        $addFields: {
          newUsers: { $size: '$newUsers' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.week': 1 }
      }
    ]);
  }
  
  async getEventTimeline(startDate, endDate, filters = {}) {
    return await AnalyticsEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
          ...filters
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' }
          },
          events: { $sum: 1 }
        }
      },
      {
        $addFields: {
          timestamp: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
              hour: '$_id.hour'
            }
          }
        }
      },
      {
        $sort: { timestamp: 1 }
      }
    ]);
  }
  
  async getEventPropertyAnalysis(startDate, endDate, filters = {}) {
    // Analyze common event properties and their values
    return await AnalyticsEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
          ...filters
        }
      },
      {
        $project: {
          category: 1,
          name: 1,
          properties: { $objectToArray: '$properties' }
        }
      },
      {
        $unwind: '$properties'
      },
      {
        $group: {
          _id: {
            category: '$category',
            name: '$name',
            property: '$properties.k'
          },
          count: { $sum: 1 },
          values: { $addToSet: '$properties.v' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 50
      }
    ]);
  }
}

module.exports = AnalyticsDashboardService;





