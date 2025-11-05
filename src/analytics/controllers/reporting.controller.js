const ReportingService = require('../services/reporting.service');
const AlertService = require('../services/alert.service');
const { RevenueAnalytics, CohortAnalysis, Alert, FamilyPlan, GiftSubscription } = require('../models/reporting.model');
const { Subscription } = require('../models/subscription.model');
const { EnhancedUser } = require('../models/enhancedUser.model');
const { Payment } = require('../models/payment.model');

/**
 * Reporting Controller for Advanced Analytics and Business Intelligence
 */
class ReportingController {
  /**
   * Get comprehensive revenue analytics dashboard
   */
  static async getRevenueDashboard(req, res) {
    try {
      const { 
        period = 'MONTHLY', 
        currency = 'USD', 
        startDate, 
        endDate 
      } = req.query;

      const date = endDate ? new Date(endDate) : new Date();
      
      // Generate current period analytics
      const currentAnalytics = await ReportingService.generateRevenueAnalytics(date, period, currency);
      
      // Get previous period for comparison
      let previousDate;
      switch (period) {
        case 'DAILY':
          previousDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'MONTHLY':
          previousDate = new Date(date.getFullYear(), date.getMonth() - 1, date.getDate());
          break;
        case 'QUARTERLY':
          previousDate = new Date(date.getFullYear(), date.getMonth() - 3, date.getDate());
          break;
        case 'YEARLY':
          previousDate = new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
          break;
        default:
          previousDate = new Date(date.getFullYear(), date.getMonth() - 1, date.getDate());
      }

      const previousAnalytics = await RevenueAnalytics.findOne({
        'period.date': previousDate,
        'period.periodType': period,
        currency
      }).lean();

      // Calculate trends
      const trends = this.calculateTrends(currentAnalytics, previousAnalytics);

      // Get recent alerts
      const recentAlerts = await AlertService.getActiveAlerts({
        category: 'FINANCIAL',
        triggeredAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      res.json({
        success: true,
        data: {
          current: currentAnalytics,
          previous: previousAnalytics,
          trends,
          alerts: recentAlerts,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error getting revenue dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get revenue dashboard',
        error: error.message
      });
    }
  }

  /**
   * Get MRR/ARR trends over time
   */
  static async getMRRTrends(req, res) {
    try {
      const { 
        months = 12, 
        currency = 'USD',
        breakdown = false 
      } = req.query;

      const endDate = new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - parseInt(months), 1);

      // Get monthly analytics data
      const analytics = await RevenueAnalytics.find({
        'period.periodType': 'MONTHLY',
        'period.date': { $gte: startDate, $lte: endDate },
        currency
      }).sort({ 'period.date': 1 }).lean();

      // Format data for charting
      const trendData = analytics.map(item => ({
        date: item.period.date,
        month: new Date(item.period.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        mrr: item.revenue.mrr,
        arr: item.revenue.arr,
        newRevenue: item.revenue.newRevenue,
        churnedRevenue: item.revenue.churnedRevenue,
        netRevenue: item.revenue.netRevenueChange,
        customers: item.customers.totalActive,
        arpu: item.kpis.arpu,
        churnRate: item.kpis.churnRate
      }));

      // Include plan breakdown if requested
      let planBreakdown = null;
      if (breakdown === 'true') {
        const latestAnalytics = analytics[analytics.length - 1];
        planBreakdown = latestAnalytics?.planBreakdown || [];
      }

      res.json({
        success: true,
        data: {
          trends: trendData,
          planBreakdown,
          period: {
            startDate,
            endDate,
            months: parseInt(months)
          },
          currency
        }
      });
    } catch (error) {
      console.error('Error getting MRR trends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get MRR trends',
        error: error.message
      });
    }
  }

  /**
   * Get cohort retention analysis
   */
  static async getCohortAnalysis(req, res) {
    try {
      const { months = 12, currency = 'USD' } = req.query;

      const endDate = new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - parseInt(months), 1);

      // Get or generate cohort analyses
      const cohorts = [];
      
      for (let i = 0; i < parseInt(months); i++) {
        const cohortMonth = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        
        if (cohortMonth < startDate) break;

        let cohortData = await CohortAnalysis.findOne({
          'cohort.cohortMonth': cohortMonth,
          currency
        }).lean();

        if (!cohortData) {
          // Generate cohort analysis if it doesn't exist
          cohortData = await ReportingService.calculateCohortRetention(cohortMonth);
          if (cohortData) {
            await CohortAnalysis.create({ ...cohortData, currency });
          }
        }

        if (cohortData) {
          cohorts.push(cohortData);
        }
      }

      // Create retention matrix for visualization
      const retentionMatrix = this.createRetentionMatrix(cohorts);

      res.json({
        success: true,
        data: {
          cohorts: cohorts.reverse(), // Show oldest first
          retentionMatrix,
          period: {
            startDate,
            endDate,
            months: parseInt(months)
          },
          currency
        }
      });
    } catch (error) {
      console.error('Error getting cohort analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cohort analysis',
        error: error.message
      });
    }
  }

  /**
   * Get customer lifetime value analysis
   */
  static async getLTVAnalysis(req, res) {
    try {
      const { segment, currency = 'USD' } = req.query;

      // Calculate overall LTV
      const { averageLtv, totalCustomers } = await ReportingService.calculateLTV();

      // Get LTV by plan (simplified - in practice you'd want more sophisticated segmentation)
      const ltvByPlan = await Subscription.aggregate([
        {
          $match: { status: { $in: ['ACTIVE', 'CANCELLED'] } }
        },
        {
          $lookup: {
            from: 'membershipplans',
            localField: 'plan',
            foreignField: '_id',
            as: 'planDetails'
          }
        },
        {
          $unwind: '$planDetails'
        },
        {
          $group: {
            _id: {
              planId: '$plan',
              planName: '$planDetails.name'
            },
            totalRevenue: { $sum: '$amount' },
            customerCount: { $sum: 1 },
            avgLifespan: {
              $avg: {
                $divide: [
                  { $subtract: [
                    { $ifNull: ['$cancelledAt', new Date()] },
                    '$createdAt'
                  ]},
                  1000 * 60 * 60 * 24 * 30 // Convert to months
                ]
              }
            }
          }
        },
        {
          $project: {
            planId: '$_id.planId',
            planName: '$_id.planName',
            totalRevenue: 1,
            customerCount: 1,
            avgLifespan: 1,
            avgLtv: { $divide: ['$totalRevenue', '$customerCount'] },
            avgMonthlyRevenue: { $divide: ['$totalRevenue', { $multiply: ['$customerCount', '$avgLifespan'] }] }
          }
        },
        {
          $sort: { avgLtv: -1 }
        }
      ]);

      // Calculate LTV trends over time (by cohort)
      const ltvTrends = await CohortAnalysis.aggregate([
        {
          $match: {
            currency,
            'cohort.cohortMonth': { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $project: {
            cohortMonth: '$cohort.cohortMonth',
            cohortSize: '$cohort.cohortSize',
            predictedLtv: '$insights.predictedLtv',
            qualityScore: '$insights.qualityScore'
          }
        },
        {
          $sort: { cohortMonth: 1 }
        }
      ]);

      res.json({
        success: true,
        data: {
          overall: {
            averageLtv,
            totalCustomers,
            currency
          },
          byPlan: ltvByPlan,
          trends: ltvTrends,
          insights: {
            highestValuePlan: ltvByPlan[0],
            totalLtvPotential: averageLtv * totalCustomers
          }
        }
      });
    } catch (error) {
      console.error('Error getting LTV analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get LTV analysis',
        error: error.message
      });
    }
  }

  /**
   * Get real-time alerts and monitoring dashboard
   */
  static async getAlertsDashboard(req, res) {
    try {
      const { status, severity, category, limit = 50 } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      if (category) filters.category = category;

      // Get alerts with pagination
      const alerts = await Alert.find(filters)
        .sort({ triggeredAt: -1 })
        .limit(parseInt(limit))
        .populate('acknowledgedBy resolvedBy', 'email name')
        .lean();

      // Get alert statistics
      const stats = await Alert.aggregate([
        {
          $match: {
            triggeredAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } },
            acknowledged: { $sum: { $cond: [{ $eq: ['$status', 'ACKNOWLEDGED'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
            critical: { $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$severity', 'MEDIUM'] }, 1, 0] } },
            low: { $sum: { $cond: [{ $eq: ['$severity', 'LOW'] }, 1, 0] } }
          }
        }
      ]);

      // Get alert trends by day
      const trends = await Alert.aggregate([
        {
          $match: {
            triggeredAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$triggeredAt' } },
              severity: '$severity'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            critical: { $sum: { $cond: [{ $eq: ['$_id.severity', 'CRITICAL'] }, '$count', 0] } },
            high: { $sum: { $cond: [{ $eq: ['$_id.severity', 'HIGH'] }, '$count', 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$_id.severity', 'MEDIUM'] }, '$count', 0] } },
            low: { $sum: { $cond: [{ $eq: ['$_id.severity', 'LOW'] }, '$count', 0] } },
            total: { $sum: '$count' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      res.json({
        success: true,
        data: {
          alerts,
          statistics: stats[0] || {
            total: 0, open: 0, acknowledged: 0, resolved: 0,
            critical: 0, high: 0, medium: 0, low: 0
          },
          trends,
          filters: { status, severity, category, limit }
        }
      });
    } catch (error) {
      console.error('Error getting alerts dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get alerts dashboard',
        error: error.message
      });
    }
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { userId } = req.user;

      const alert = await AlertService.acknowledgeAlert(alertId, userId);

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        data: alert
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to acknowledge alert',
        error: error.message
      });
    }
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { resolution } = req.body;
      const { userId } = req.user;

      const alert = await AlertService.resolveAlert(alertId, userId, resolution);

      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: alert
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve alert',
        error: error.message
      });
    }
  }

  /**
   * Get plan mix analytics
   */
  static async getPlanMixAnalysis(req, res) {
    try {
      const { currency = 'USD', period = 'MONTHLY' } = req.query;

      const date = new Date();
      const analytics = await RevenueAnalytics.findOne({
        'period.date': { $lte: date },
        'period.periodType': period,
        currency
      }).sort({ 'period.date': -1 }).lean();

      if (!analytics) {
        // Generate analytics if not found
        const generatedAnalytics = await ReportingService.generateRevenueAnalytics(date, period, currency);
        
        res.json({
          success: true,
          data: {
            planBreakdown: generatedAnalytics.planBreakdown,
            totalRevenue: generatedAnalytics.revenue.mrr,
            totalCustomers: generatedAnalytics.customers.totalActive,
            currency,
            period
          }
        });
        return;
      }

      // Calculate percentages and trends
      const totalRevenue = analytics.revenue.mrr;
      const totalCustomers = analytics.customers.totalActive;

      const planMix = analytics.planBreakdown.map(plan => ({
        ...plan,
        revenuePercentage: totalRevenue > 0 ? (plan.revenue / totalRevenue) * 100 : 0,
        customerPercentage: totalCustomers > 0 ? (plan.customers / totalCustomers) * 100 : 0
      }));

      res.json({
        success: true,
        data: {
          planBreakdown: planMix,
          totalRevenue,
          totalCustomers,
          currency,
          period,
          insights: {
            topRevenueDriver: planMix.sort((a, b) => b.revenue - a.revenue)[0],
            mostPopularPlan: planMix.sort((a, b) => b.customers - a.customers)[0],
            highestArpu: planMix.sort((a, b) => b.arpu - a.arpu)[0]
          }
        }
      });
    } catch (error) {
      console.error('Error getting plan mix analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get plan mix analysis',
        error: error.message
      });
    }
  }

  /**
   * Family plan analytics
   */
  static async getFamilyPlanAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;

      const startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      // Get family plan statistics
      const stats = await FamilyPlan.aggregate([
        {
          $group: {
            _id: null,
            totalFamilyPlans: { $sum: 1 },
            activeFamilyPlans: { $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] } },
            totalMembers: { $sum: '$settings.currentMembers' },
            avgMembersPerFamily: { $avg: '$settings.currentMembers' },
            totalRevenue: { $sum: '$billing.basePrice' }
          }
        }
      ]);

      // Get sharing detection insights
      const sharingIssues = await FamilyPlan.aggregate([
        { $unwind: '$sharingDetection.suspiciousActivity' },
        {
          $group: {
            _id: '$sharingDetection.suspiciousActivity.type',
            count: { $sum: 1 },
            severity: { $first: '$sharingDetection.suspiciousActivity.severity' }
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: stats[0] || {
            totalFamilyPlans: 0,
            activeFamilyPlans: 0,
            totalMembers: 0,
            avgMembersPerFamily: 0,
            totalRevenue: 0
          },
          sharingDetection: {
            issues: sharingIssues,
            totalIssues: sharingIssues.reduce((sum, issue) => sum + issue.count, 0)
          }
        }
      });
    } catch (error) {
      console.error('Error getting family plan analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get family plan analytics',
        error: error.message
      });
    }
  }

  /**
   * Gift subscription analytics
   */
  static async getGiftSubscriptionAnalytics(req, res) {
    try {
      const { period = '30d' } = req.query;

      const startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      // Get gift subscription statistics
      const stats = await GiftSubscription.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalGifts: { $sum: 1 },
            totalRevenue: { $sum: '$payment.amount' },
            redeemed: { $sum: { $cond: [{ $eq: ['$status', 'REDEEMED'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
            expired: { $sum: { $cond: [{ $eq: ['$status', 'EXPIRED'] }, 1, 0] } },
            avgGiftValue: { $avg: '$payment.amount' }
          }
        }
      ]);

      // Get redemption rate trends
      const redemptionTrends = await GiftSubscription.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              week: { $week: '$createdAt' },
              year: { $year: '$createdAt' }
            },
            totalGifts: { $sum: 1 },
            redeemed: { $sum: { $cond: [{ $ne: ['$redemption.redeemedAt', null] }, 1, 0] } }
          }
        },
        {
          $project: {
            week: '$_id.week',
            year: '$_id.year',
            totalGifts: 1,
            redeemed: 1,
            redemptionRate: { $multiply: [{ $divide: ['$redeemed', '$totalGifts'] }, 100] }
          }
        },
        {
          $sort: { year: 1, week: 1 }
        }
      ]);

      res.json({
        success: true,
        data: {
          overview: stats[0] || {
            totalGifts: 0,
            totalRevenue: 0,
            redeemed: 0,
            pending: 0,
            expired: 0,
            avgGiftValue: 0
          },
          redemptionRate: stats[0] ? (stats[0].redeemed / stats[0].totalGifts) * 100 : 0,
          trends: redemptionTrends
        }
      });
    } catch (error) {
      console.error('Error getting gift subscription analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get gift subscription analytics',
        error: error.message
      });
    }
  }

  /**
   * Helper method to calculate trends between periods
   */
  static calculateTrends(current, previous) {
    if (!previous) {
      return {
        mrr: { change: 0, trend: 'stable' },
        arr: { change: 0, trend: 'stable' },
        customers: { change: 0, trend: 'stable' },
        churnRate: { change: 0, trend: 'stable' },
        arpu: { change: 0, trend: 'stable' }
      };
    }

    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const getTrend = (change) => {
      if (Math.abs(change) < 1) return 'stable';
      return change > 0 ? 'up' : 'down';
    };

    const mrrChange = calculateChange(current.revenue.mrr, previous.revenue.mrr);
    const arrChange = calculateChange(current.revenue.arr, previous.revenue.arr);
    const customersChange = calculateChange(current.customers.totalActive, previous.customers.totalActive);
    const churnChange = calculateChange(current.kpis.churnRate, previous.kpis.churnRate);
    const arpuChange = calculateChange(current.kpis.arpu, previous.kpis.arpu);

    return {
      mrr: { change: mrrChange, trend: getTrend(mrrChange) },
      arr: { change: arrChange, trend: getTrend(arrChange) },
      customers: { change: customersChange, trend: getTrend(customersChange) },
      churnRate: { change: churnChange, trend: getTrend(-churnChange) }, // Lower churn is better
      arpu: { change: arpuChange, trend: getTrend(arpuChange) }
    };
  }

  /**
   * Helper method to create retention matrix for cohort visualization
   */
  static createRetentionMatrix(cohorts) {
    const matrix = [];
    
    cohorts.forEach((cohort, cohortIndex) => {
      const row = {
        cohortLabel: cohort.cohort.cohortLabel,
        cohortSize: cohort.cohort.cohortSize,
        periods: []
      };

      // Fill in retention rates for each period
      for (let period = 0; period < 12; period++) {
        const retentionData = cohort.retentionData.find(r => r.period === period);
        row.periods.push({
          period,
          retentionRate: retentionData ? retentionData.retentionRate : null,
          customersActive: retentionData ? retentionData.customersActive : null
        });
      }

      matrix.push(row);
    });

    return matrix;
  }
}

module.exports = ReportingController;





