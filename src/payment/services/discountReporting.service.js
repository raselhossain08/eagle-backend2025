const DiscountCode = require('../models/discountCode.model');
const DiscountRedemption = require('../models/discountRedemption.model');
const PromotionalCampaign = require('../models/promotionalCampaign.model');

class DiscountReportingService {
  
  constructor() {
    this.reportCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }
  
  // =====================================
  // REDEMPTION ANALYTICS
  // =====================================
  
  /**
   * Get redemption analytics overview
   */
  async getRedemptionOverview(filters = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        campaignId,
        channel,
        discountType,
        country
      } = filters;
      
      // Build query
      const query = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'applied'
      };
      
      if (campaignId) query['attribution.campaignId'] = campaignId;
      if (channel) query['attribution.channel'] = channel;
      if (discountType) query['discountCode.discountType'] = discountType;
      if (country) query['context.country'] = country;
      
      // Aggregate redemption data
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: null,
            totalRedemptions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user.userId' },
            totalRevenue: { $sum: '$transaction.finalAmount.amount' },
            totalDiscountGiven: { $sum: '$transaction.discountAmount.amount' },
            averageOrderValue: { $avg: '$transaction.finalAmount.amount' },
            averageDiscountAmount: { $avg: '$transaction.discountAmount.amount' },
            newCustomers: {
              $sum: {
                $cond: [{ $eq: ['$user.isNewCustomer', true] }, 1, 0]
              }
            },
            mobileRedemptions: {
              $sum: {
                $cond: [{ $eq: ['$context.deviceType', 'mobile'] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            totalRedemptions: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            totalRevenue: 1,
            totalDiscountGiven: 1,
            averageOrderValue: 1,
            averageDiscountAmount: 1,
            newCustomers: 1,
            existingCustomers: { $subtract: ['$totalRedemptions', '$newCustomers'] },
            mobileRedemptions: 1,
            desktopRedemptions: { $subtract: ['$totalRedemptions', '$mobileRedemptions'] },
            discountRate: {
              $multiply: [
                { $divide: ['$totalDiscountGiven', { $add: ['$totalRevenue', '$totalDiscountGiven'] }] },
                100
              ]
            },
            newCustomerRate: {
              $multiply: [
                { $divide: ['$newCustomers', '$totalRedemptions'] },
                100
              ]
            },
            mobileRate: {
              $multiply: [
                { $divide: ['$mobileRedemptions', '$totalRedemptions'] },
                100
              ]
            }
          }
        }
      ];
      
      const [overview] = await DiscountRedemption.aggregate(pipeline);
      
      if (!overview) {
        return {
          success: true,
          data: this.getEmptyOverview(),
          message: 'No redemption data found for the specified period'
        };
      }
      
      // Get period comparison
      const previousPeriod = await this.getPreviousPeriodComparison(startDate, endDate, query);
      
      // Get trending data
      const trends = await this.getRedemptionTrends(startDate, endDate, query);
      
      return {
        success: true,
        data: {
          overview,
          previousPeriod,
          trends,
          period: { startDate, endDate }
        },
        message: 'Redemption overview generated successfully'
      };
      
    } catch (error) {
      console.error('Error getting redemption overview:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Get redemption trends over time
   */
  async getRedemptionTrends(startDate, endDate, baseQuery = {}) {
    try {
      const query = {
        ...baseQuery,
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'applied'
      };
      
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            date: { $first: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
            redemptions: { $sum: 1 },
            revenue: { $sum: '$transaction.finalAmount.amount' },
            discountAmount: { $sum: '$transaction.discountAmount.amount' },
            uniqueUsers: { $addToSet: '$user.userId' },
            newCustomers: {
              $sum: {
                $cond: [{ $eq: ['$user.isNewCustomer', true] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            date: 1,
            redemptions: 1,
            revenue: 1,
            discountAmount: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            newCustomers: 1,
            averageOrderValue: { $divide: ['$revenue', '$redemptions'] },
            discountRate: {
              $multiply: [
                { $divide: ['$discountAmount', { $add: ['$revenue', '$discountAmount'] }] },
                100
              ]
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ];
      
      const trends = await DiscountRedemption.aggregate(pipeline);
      
      return trends;
      
    } catch (error) {
      console.error('Error getting redemption trends:', error);
      throw error;
    }
  }
  
  // =====================================
  // INCREMENTAL REVENUE ANALYSIS
  // =====================================
  
  /**
   * Calculate incremental revenue
   */
  async calculateIncrementalRevenue(filters = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        campaignId,
        discountType,
        customerSegment
      } = filters;
      
      // Get baseline metrics (users without discount)
      const baselineMetrics = await this.getBaselineMetrics(startDate, endDate, filters);
      
      // Get discount metrics
      const discountMetrics = await this.getDiscountMetrics(startDate, endDate, filters);
      
      // Calculate incremental impact
      const incrementalAnalysis = this.calculateIncrementalImpact(baselineMetrics, discountMetrics);
      
      // Get cohort-based incremental revenue
      const cohortIncremental = await this.getCohortIncrementalRevenue(startDate, endDate, filters);
      
      // Calculate cannibalization
      const cannibalizationAnalysis = await this.calculateCannibalization(startDate, endDate, filters);
      
      return {
        success: true,
        data: {
          baseline: baselineMetrics,
          withDiscount: discountMetrics,
          incremental: incrementalAnalysis,
          cohortAnalysis: cohortIncremental,
          cannibalization: cannibalizationAnalysis,
          period: { startDate, endDate }
        },
        message: 'Incremental revenue analysis completed'
      };
      
    } catch (error) {
      console.error('Error calculating incremental revenue:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Calculate cannibalization impact
   */
  async calculateCannibalization(startDate, endDate, filters = {}) {
    try {
      // Get redemptions data
      const query = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'applied'
      };
      
      if (filters.campaignId) query['attribution.campaignId'] = filters.campaignId;
      
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: '$user.isNewCustomer',
            count: { $sum: 1 },
            revenue: { $sum: '$transaction.finalAmount.amount' },
            discount: { $sum: '$transaction.discountAmount.amount' },
            averageOrderValue: { $avg: '$transaction.finalAmount.amount' }
          }
        }
      ];
      
      const results = await DiscountRedemption.aggregate(pipeline);
      
      const analysis = {
        newCustomers: results.find(r => r._id === true) || { count: 0, revenue: 0, discount: 0, averageOrderValue: 0 },
        existingCustomers: results.find(r => r._id === false) || { count: 0, revenue: 0, discount: 0, averageOrderValue: 0 }
      };
      
      // Calculate cannibalization metrics
      const totalRevenue = analysis.newCustomers.revenue + analysis.existingCustomers.revenue;
      const totalCustomers = analysis.newCustomers.count + analysis.existingCustomers.count;
      
      const cannibalizationMetrics = {
        cannibalizationRate: totalCustomers > 0 ? (analysis.existingCustomers.count / totalCustomers) * 100 : 0,
        newCustomerRevenue: analysis.newCustomers.revenue,
        existingCustomerRevenue: analysis.existingCustomers.revenue,
        cannibalizationValue: analysis.existingCustomers.revenue,
        netIncrementalRevenue: analysis.newCustomers.revenue,
        cannibalizationPercentage: totalRevenue > 0 ? (analysis.existingCustomers.revenue / totalRevenue) * 100 : 0,
        riskLevel: this.assessCannibalizationRisk(analysis)
      };
      
      return cannibalizationMetrics;
      
    } catch (error) {
      console.error('Error calculating cannibalization:', error);
      throw error;
    }
  }
  
  // =====================================
  // COHORT PERFORMANCE ANALYSIS
  // =====================================
  
  /**
   * Get cohort performance analysis
   */
  async getCohortPerformance(filters = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        cohortType = 'acquisitionCohort',
        groupBy = 'month'
      } = filters;
      
      // Get cohort data from redemptions
      const cohortData = await DiscountRedemption.getCohortAnalysis({
        startDate,
        endDate,
        cohortType,
        groupBy
      });
      
      // Calculate retention metrics for each cohort
      const cohortRetention = await this.calculateCohortRetention(cohortData);
      
      // Calculate lifetime value by cohort
      const cohortLTV = await this.calculateCohortLTV(cohortData);
      
      // Get cohort progression analysis
      const cohortProgression = await this.getCohortProgression(cohortData);
      
      return {
        success: true,
        data: {
          cohorts: cohortData,
          retention: cohortRetention,
          lifetimeValue: cohortLTV,
          progression: cohortProgression,
          insights: this.generateCohortInsights(cohortData, cohortRetention, cohortLTV)
        },
        message: 'Cohort performance analysis completed'
      };
      
    } catch (error) {
      console.error('Error getting cohort performance:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Calculate cohort retention rates
   */
  async calculateCohortRetention(cohortData) {
    try {
      const retentionData = [];
      
      for (const cohort of cohortData) {
        // Get users from this cohort
        const cohortUsers = await this.getCohortUsers(cohort.cohort);
        
        if (cohortUsers.length === 0) continue;
        
        // Calculate retention for different periods
        const retention = {
          cohort: cohort.cohort,
          cohortSize: cohortUsers.length,
          week1: await this.calculatePeriodRetention(cohortUsers, 7),
          week4: await this.calculatePeriodRetention(cohortUsers, 28),
          week12: await this.calculatePeriodRetention(cohortUsers, 84),
          week24: await this.calculatePeriodRetention(cohortUsers, 168)
        };
        
        retentionData.push(retention);
      }
      
      return retentionData;
      
    } catch (error) {
      console.error('Error calculating cohort retention:', error);
      throw error;
    }
  }
  
  /**
   * Calculate cohort lifetime value
   */
  async calculateCohortLTV(cohortData) {
    try {
      const ltvData = [];
      
      for (const cohort of cohortData) {
        // Get all transactions for cohort users
        const cohortTransactions = await this.getCohortTransactions(cohort.cohort);
        
        const ltv = {
          cohort: cohort.cohort,
          totalRevenue: cohortTransactions.reduce((sum, t) => sum + t.revenue, 0),
          averageLTV: cohortTransactions.length > 0 ? 
            cohortTransactions.reduce((sum, t) => sum + t.revenue, 0) / new Set(cohortTransactions.map(t => t.userId)).size : 0,
          transactionsPerUser: cohortTransactions.length > 0 ? 
            cohortTransactions.length / new Set(cohortTransactions.map(t => t.userId)).size : 0,
          averageTransactionValue: cohortTransactions.length > 0 ? 
            cohortTransactions.reduce((sum, t) => sum + t.revenue, 0) / cohortTransactions.length : 0,
          paybackPeriod: this.calculatePaybackPeriod(cohort, cohortTransactions)
        };
        
        ltvData.push(ltv);
      }
      
      return ltvData;
      
    } catch (error) {
      console.error('Error calculating cohort LTV:', error);
      throw error;
    }
  }
  
  // =====================================
  // FRAUD ANALYTICS
  // =====================================
  
  /**
   * Get fraud analytics
   */
  async getFraudAnalytics(filters = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        riskLevel,
        country
      } = filters;
      
      // Build query
      const query = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      if (riskLevel) query['fraudAnalysis.riskLevel'] = riskLevel;
      if (country) query['context.country'] = country;
      
      // Aggregate fraud data
      const pipeline = [
        { $match: query },
        {
          $group: {
            _id: null,
            totalRedemptions: { $sum: 1 },
            lowRisk: {
              $sum: {
                $cond: [{ $eq: ['$fraudAnalysis.riskLevel', 'low'] }, 1, 0]
              }
            },
            mediumRisk: {
              $sum: {
                $cond: [{ $eq: ['$fraudAnalysis.riskLevel', 'medium'] }, 1, 0]
              }
            },
            highRisk: {
              $sum: {
                $cond: [{ $eq: ['$fraudAnalysis.riskLevel', 'high'] }, 1, 0]
              }
            },
            criticalRisk: {
              $sum: {
                $cond: [{ $eq: ['$fraudAnalysis.riskLevel', 'critical'] }, 1, 0]
              }
            },
            flaggedRedemptions: {
              $sum: {
                $cond: [{ $eq: ['$fraudAnalysis.reviewRequired', true] }, 1, 0]
              }
            },
            blockedRedemptions: {
              $sum: {
                $cond: [{ $eq: ['$status', 'fraud_flagged'] }, 1, 0]
              }
            },
            averageRiskScore: { $avg: '$fraudAnalysis.riskScore' },
            totalRevenue: { $sum: '$transaction.finalAmount.amount' },
            flaggedRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$fraudAnalysis.reviewRequired', true] },
                  '$transaction.finalAmount.amount',
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            totalRedemptions: 1,
            riskDistribution: {
              low: '$lowRisk',
              medium: '$mediumRisk',
              high: '$highRisk',
              critical: '$criticalRisk'
            },
            fraudRate: {
              $multiply: [
                { $divide: ['$blockedRedemptions', '$totalRedemptions'] },
                100
              ]
            },
            flaggedRate: {
              $multiply: [
                { $divide: ['$flaggedRedemptions', '$totalRedemptions'] },
                100
              ]
            },
            averageRiskScore: 1,
            revenueAtRisk: '$flaggedRevenue',
            revenueAtRiskPercentage: {
              $multiply: [
                { $divide: ['$flaggedRevenue', '$totalRevenue'] },
                100
              ]
            }
          }
        }
      ];
      
      const [fraudStats] = await DiscountRedemption.aggregate(pipeline);
      
      // Get fraud patterns
      const fraudPatterns = await this.getFraudPatterns(startDate, endDate);
      
      // Get geographic fraud distribution
      const geoFraud = await this.getGeographicFraudDistribution(startDate, endDate);
      
      // Get velocity analysis
      const velocityAnalysis = await this.getVelocityAnalysis(startDate, endDate);
      
      return {
        success: true,
        data: {
          overview: fraudStats || this.getEmptyFraudStats(),
          patterns: fraudPatterns,
          geographic: geoFraud,
          velocity: velocityAnalysis,
          recommendations: this.generateFraudRecommendations(fraudStats)
        },
        message: 'Fraud analytics generated successfully'
      };
      
    } catch (error) {
      console.error('Error getting fraud analytics:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Get fraud patterns
   */
  async getFraudPatterns(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            'fraudAnalysis.detectedPatterns': { $exists: true, $ne: [] }
          }
        },
        { $unwind: '$fraudAnalysis.detectedPatterns' },
        {
          $group: {
            _id: '$fraudAnalysis.detectedPatterns.pattern',
            count: { $sum: 1 },
            averageConfidence: { $avg: '$fraudAnalysis.detectedPatterns.confidence' },
            totalRevenue: { $sum: '$transaction.finalAmount.amount' },
            countries: { $addToSet: '$context.country' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ];
      
      const patterns = await DiscountRedemption.aggregate(pipeline);
      
      return patterns.map(pattern => ({
        pattern: pattern._id,
        occurrences: pattern.count,
        averageConfidence: Math.round(pattern.averageConfidence),
        revenueImpact: pattern.totalRevenue,
        affectedCountries: pattern.countries.length,
        riskLevel: this.assessPatternRisk(pattern)
      }));
      
    } catch (error) {
      console.error('Error getting fraud patterns:', error);
      throw error;
    }
  }
  
  // =====================================
  // PERFORMANCE REPORTING
  // =====================================
  
  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(filters = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        campaignId,
        includeComparisons = true,
        includeForecasting = false
      } = filters;
      
      // Get all main analytics
      const [
        redemptionOverview,
        incrementalRevenue,
        cohortPerformance,
        fraudAnalytics,
        campaignPerformance
      ] = await Promise.all([
        this.getRedemptionOverview(filters),
        this.calculateIncrementalRevenue(filters),
        this.getCohortPerformance(filters),
        this.getFraudAnalytics(filters),
        campaignId ? this.getCampaignPerformance(campaignId, filters) : null
      ]);
      
      // Get top performing codes
      const topCodes = await this.getTopPerformingCodes(filters);
      
      // Get channel performance
      const channelPerformance = await this.getChannelPerformance(filters);
      
      // Generate insights and recommendations
      const insights = this.generatePerformanceInsights({
        redemptions: redemptionOverview.data,
        incremental: incrementalRevenue.data,
        cohorts: cohortPerformance.data,
        fraud: fraudAnalytics.data,
        campaign: campaignPerformance?.data
      });
      
      const report = {
        reportId: this.generateReportId(),
        generatedAt: new Date(),
        period: { startDate, endDate },
        filters,
        executiveSummary: this.generateExecutiveSummary(insights),
        redemptionAnalytics: redemptionOverview.data,
        incrementalRevenue: incrementalRevenue.data,
        cohortAnalysis: cohortPerformance.data,
        fraudAnalysis: fraudAnalytics.data,
        topPerformingCodes: topCodes,
        channelPerformance: channelPerformance,
        campaignPerformance: campaignPerformance?.data,
        insights: insights,
        recommendations: this.generateRecommendations(insights)
      };
      
      // Add forecasting if requested
      if (includeForecasting) {
        report.forecasting = await this.generateForecast(report);
      }
      
      return {
        success: true,
        data: report,
        message: 'Performance report generated successfully'
      };
      
    } catch (error) {
      console.error('Error generating performance report:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Generate executive summary
   */
  generateExecutiveSummary(insights) {
    return {
      keyMetrics: {
        totalRedemptions: insights.totalRedemptions,
        totalRevenue: insights.totalRevenue,
        incrementalRevenue: insights.incrementalRevenue,
        roi: insights.roi,
        fraudRate: insights.fraudRate
      },
      performance: {
        trend: insights.trend, // 'positive', 'negative', 'stable'
        growthRate: insights.growthRate,
        conversionRate: insights.conversionRate,
        customerAcquisitionCost: insights.cac
      },
      highlights: insights.highlights,
      concerns: insights.concerns,
      recommendations: insights.topRecommendations.slice(0, 3)
    };
  }
  
  // =====================================
  // HELPER METHODS
  // =====================================
  
  /**
   * Generate report ID
   */
  generateReportId() {
    return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  
  /**
   * Get empty overview structure
   */
  getEmptyOverview() {
    return {
      totalRedemptions: 0,
      uniqueUsers: 0,
      totalRevenue: 0,
      totalDiscountGiven: 0,
      averageOrderValue: 0,
      averageDiscountAmount: 0,
      newCustomers: 0,
      existingCustomers: 0,
      mobileRedemptions: 0,
      desktopRedemptions: 0,
      discountRate: 0,
      newCustomerRate: 0,
      mobileRate: 0
    };
  }
  
  /**
   * Assess cannibalization risk
   */
  assessCannibalizationRisk(analysis) {
    const cannibalizationRate = analysis.existingCustomers.count / 
      (analysis.newCustomers.count + analysis.existingCustomers.count);
    
    if (cannibalizationRate > 0.7) return 'high';
    if (cannibalizationRate > 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * Additional helper methods would be implemented here...
   */
  
}

module.exports = DiscountReportingService;





