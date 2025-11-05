const { RevenueAnalytics, CohortAnalysis, Alert } = require('../models/reporting.model');
const { Subscription } = require('../../subscription/models/subscription.model');
const { EnhancedUser } = require('../../user/models/enhancedUser.model');
const { Invoice } = require('../../payment/models/billing.model');
const { Payment } = require('../../payment/models/payment.model');

/**
 * Reporting Service for Revenue Analytics and Business Intelligence
 */
class ReportingService {
  /**
   * Calculate Monthly Recurring Revenue (MRR) for a specific period
   */
  static async calculateMRR(date = new Date(), currency = 'USD') {
    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      // Get all active subscriptions for the period
      const activeSubscriptions = await Subscription.find({
        status: 'ACTIVE',
        createdAt: { $lte: endOfMonth },
        $or: [
          { cancelledAt: null },
          { cancelledAt: { $gt: endOfMonth } }
        ]
      }).populate('plan');

      let totalMRR = 0;
      const planBreakdown = {};

      for (const subscription of activeSubscriptions) {
        if (!subscription.plan) continue;

        // Convert subscription amount to monthly recurring revenue
        let monthlyAmount = 0;
        
        switch (subscription.billingCycle) {
          case 'MONTHLY':
            monthlyAmount = subscription.amount;
            break;
          case 'QUARTERLY':
            monthlyAmount = subscription.amount / 3;
            break;
          case 'YEARLY':
            monthlyAmount = subscription.amount / 12;
            break;
          default:
            monthlyAmount = subscription.amount; // Assume monthly if not specified
        }

        // Convert to specified currency if needed
        if (subscription.currency !== currency) {
          monthlyAmount = await this.convertCurrency(monthlyAmount, subscription.currency, currency);
        }

        totalMRR += monthlyAmount;

        // Track plan breakdown
        const planId = subscription.plan._id.toString();
        if (!planBreakdown[planId]) {
          planBreakdown[planId] = {
            planId: subscription.plan._id,
            planName: subscription.plan.name,
            revenue: 0,
            customers: 0,
            arpu: 0
          };
        }
        planBreakdown[planId].revenue += monthlyAmount;
        planBreakdown[planId].customers += 1;
      }

      // Calculate ARPU for each plan
      Object.values(planBreakdown).forEach(plan => {
        plan.arpu = plan.customers > 0 ? plan.revenue / plan.customers : 0;
      });

      return {
        mrr: totalMRR,
        arr: totalMRR * 12,
        planBreakdown: Object.values(planBreakdown),
        totalActiveCustomers: activeSubscriptions.length
      };
    } catch (error) {
      console.error('Error calculating MRR:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue changes (new, expansion, contraction, churn)
   */
  static async calculateRevenueChanges(startDate, endDate, currency = 'USD') {
    try {
      const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      
      // Get subscriptions for current and previous periods
      const currentSubscriptions = await Subscription.find({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const previousSubscriptions = await Subscription.find({
        createdAt: { $gte: previousPeriodStart, $lt: startDate }
      });

      // Calculate new revenue (from new customers)
      let newRevenue = 0;
      for (const sub of currentSubscriptions) {
        const monthlyRevenue = await this.getMonthlyRevenue(sub, currency);
        newRevenue += monthlyRevenue;
      }

      // Calculate churned revenue
      const churnedSubscriptions = await Subscription.find({
        cancelledAt: { $gte: startDate, $lte: endDate },
        status: 'CANCELLED'
      });

      let churnedRevenue = 0;
      for (const sub of churnedSubscriptions) {
        const monthlyRevenue = await this.getMonthlyRevenue(sub, currency);
        churnedRevenue += monthlyRevenue;
      }

      // Calculate expansion and contraction revenue
      // (This would require tracking plan changes - simplified for this example)
      const expansionRevenue = 0; // TODO: Implement plan upgrade tracking
      const contractionRevenue = 0; // TODO: Implement plan downgrade tracking

      const netRevenueChange = newRevenue + expansionRevenue - contractionRevenue - churnedRevenue;

      return {
        newRevenue,
        expansionRevenue,
        contractionRevenue,
        churnedRevenue,
        netRevenueChange
      };
    } catch (error) {
      console.error('Error calculating revenue changes:', error);
      throw error;
    }
  }

  /**
   * Calculate customer metrics
   */
  static async calculateCustomerMetrics(startDate, endDate) {
    try {
      // New customers
      const newCustomers = await EnhancedUser.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      // Churned customers
      const churnedCustomers = await Subscription.countDocuments({
        cancelledAt: { $gte: startDate, $lte: endDate },
        status: 'CANCELLED'
      });

      // Total active customers
      const totalActiveCustomers = await Subscription.countDocuments({
        status: 'ACTIVE'
      });

      // Calculate churn rate
      const previousPeriodCustomers = await Subscription.countDocuments({
        status: { $in: ['ACTIVE', 'CANCELLED'] },
        createdAt: { $lt: startDate }
      });

      const churnRate = previousPeriodCustomers > 0 ? (churnedCustomers / previousPeriodCustomers) * 100 : 0;

      return {
        totalActive: totalActiveCustomers,
        newCustomers,
        churnedCustomers,
        netCustomerChange: newCustomers - churnedCustomers,
        churnRate
      };
    } catch (error) {
      console.error('Error calculating customer metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate cohort retention data
   */
  static async calculateCohortRetention(cohortMonth) {
    try {
      const cohortStart = new Date(cohortMonth);
      const cohortEnd = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + 1, 0);

      // Get initial cohort (customers who started in this month)
      const cohortCustomers = await Subscription.find({
        createdAt: { $gte: cohortStart, $lte: cohortEnd }
      }).select('userId createdAt amount currency billingCycle');

      const cohortSize = cohortCustomers.length;
      if (cohortSize === 0) {
        return null;
      }

      const retentionData = [];
      const revenueRetention = [];
      const customerIds = cohortCustomers.map(sub => sub.userId);

      // Calculate retention for each subsequent month
      const currentDate = new Date();
      const monthsToAnalyze = Math.min(24, Math.floor((currentDate - cohortStart) / (30 * 24 * 60 * 60 * 1000)));

      for (let period = 0; period <= monthsToAnalyze; period++) {
        const periodDate = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + period, 1);
        const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);

        // Count active customers in this period
        const activeSubscriptions = await Subscription.find({
          userId: { $in: customerIds },
          status: 'ACTIVE',
          createdAt: { $lte: periodEnd },
          $or: [
            { cancelledAt: null },
            { cancelledAt: { $gt: periodEnd } }
          ]
        });

        const customersActive = activeSubscriptions.length;
        const retentionRate = (customersActive / cohortSize) * 100;

        // Calculate revenue retention
        let totalRevenue = 0;
        for (const sub of activeSubscriptions) {
          totalRevenue += await this.getMonthlyRevenue(sub, 'USD');
        }

        retentionData.push({
          period,
          periodDate,
          customersActive,
          retentionRate,
          retainedRevenue: totalRevenue,
          revenuePerCustomer: customersActive > 0 ? totalRevenue / customersActive : 0
        });

        // Calculate revenue retention rate
        const initialRevenue = period === 0 ? totalRevenue : retentionData[0].retainedRevenue;
        const revenueRetentionRate = initialRevenue > 0 ? (totalRevenue / initialRevenue) * 100 : 0;

        revenueRetention.push({
          period,
          periodDate,
          totalRevenue,
          revenueRetentionRate,
          expansionRevenue: 0, // TODO: Calculate expansion
          contractionRevenue: 0, // TODO: Calculate contraction
          netRevenueRetention: revenueRetentionRate
        });
      }

      return {
        cohort: {
          cohortMonth: cohortStart,
          cohortSize,
          cohortLabel: cohortStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        },
        retentionData,
        revenueRetention,
        currency: 'USD',
        analysisDate: new Date()
      };
    } catch (error) {
      console.error('Error calculating cohort retention:', error);
      throw error;
    }
  }

  /**
   * Calculate Customer Lifetime Value (LTV)
   */
  static async calculateLTV(userId = null) {
    try {
      const query = userId ? { userId } : {};
      const subscriptions = await Subscription.find(query);

      if (subscriptions.length === 0) {
        return { averageLtv: 0, totalCustomers: 0 };
      }

      let totalLtv = 0;
      const customerLtvs = {};

      for (const subscription of subscriptions) {
        const customerId = subscription.userId.toString();
        
        if (!customerLtvs[customerId]) {
          customerLtvs[customerId] = {
            totalRevenue: 0,
            subscriptionMonths: 0,
            firstSubscription: subscription.createdAt,
            lastActivity: subscription.cancelledAt || new Date()
          };
        }

        // Calculate total revenue from this subscription
        const monthlyRevenue = await this.getMonthlyRevenue(subscription, 'USD');
        const subscriptionLifespan = this.getSubscriptionLifespan(subscription);
        const subscriptionRevenue = monthlyRevenue * subscriptionLifespan;

        customerLtvs[customerId].totalRevenue += subscriptionRevenue;
        customerLtvs[customerId].subscriptionMonths += subscriptionLifespan;
      }

      // Calculate LTV for each customer
      for (const [customerId, data] of Object.entries(customerLtvs)) {
        const customerLifespan = (data.lastActivity - data.firstSubscription) / (30 * 24 * 60 * 60 * 1000);
        const avgMonthlyRevenue = data.subscriptionMonths > 0 ? data.totalRevenue / data.subscriptionMonths : 0;
        
        // Simple LTV calculation: Average Monthly Revenue * Average Lifespan
        const ltv = avgMonthlyRevenue * Math.max(customerLifespan, data.subscriptionMonths);
        totalLtv += ltv;
      }

      const totalCustomers = Object.keys(customerLtvs).length;
      const averageLtv = totalCustomers > 0 ? totalLtv / totalCustomers : 0;

      return userId ? totalLtv : { averageLtv, totalCustomers };
    } catch (error) {
      console.error('Error calculating LTV:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive revenue analytics for a period
   */
  static async generateRevenueAnalytics(date, periodType = 'MONTHLY', currency = 'USD') {
    try {
      const { mrr, arr, planBreakdown, totalActiveCustomers } = await this.calculateMRR(date, currency);
      
      const startDate = this.getPeriodStart(date, periodType);
      const endDate = this.getPeriodEnd(date, periodType);
      
      const revenueChanges = await this.calculateRevenueChanges(startDate, endDate, currency);
      const customerMetrics = await this.calculateCustomerMetrics(startDate, endDate);
      const { averageLtv } = await this.calculateLTV();

      // Calculate KPIs
      const arpu = totalActiveCustomers > 0 ? mrr / totalActiveCustomers : 0;
      const arpa = arpu; // Same as ARPU for subscription business

      // Net Revenue Retention (simplified calculation)
      const netRevenueRetention = revenueChanges.newRevenue > 0 
        ? ((revenueChanges.newRevenue + revenueChanges.expansionRevenue - revenueChanges.contractionRevenue) / revenueChanges.newRevenue) * 100
        : 0;

      const grossRevenueRetention = revenueChanges.newRevenue > 0
        ? ((revenueChanges.newRevenue - revenueChanges.contractionRevenue) / revenueChanges.newRevenue) * 100
        : 0;

      const analyticsData = {
        period: {
          date,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          periodType
        },
        revenue: {
          mrr,
          arr,
          ...revenueChanges
        },
        customers: customerMetrics,
        kpis: {
          arpu,
          arpa,
          churnRate: customerMetrics.churnRate,
          revenueChurnRate: 0, // TODO: Calculate revenue churn rate
          netRevenueRetention,
          grossRevenueRetention,
          cac: 0, // TODO: Calculate Customer Acquisition Cost
          ltv: averageLtv,
          ltvToCacRatio: 0 // Will be calculated when CAC is available
        },
        currency,
        planBreakdown,
        geographicBreakdown: [], // TODO: Implement geographic analysis
        calculatedAt: new Date(),
        calculationVersion: '1.0'
      };

      // Save to database
      const existingAnalytics = await RevenueAnalytics.findOne({
        'period.date': date,
        'period.periodType': periodType,
        currency
      });

      if (existingAnalytics) {
        await RevenueAnalytics.findByIdAndUpdate(existingAnalytics._id, analyticsData);
      } else {
        await RevenueAnalytics.create(analyticsData);
      }

      return analyticsData;
    } catch (error) {
      console.error('Error generating revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Create alert for business metrics
   */
  static async createAlert(alertData) {
    try {
      const alert = new Alert({
        alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...alertData,
        triggeredAt: new Date()
      });

      await alert.save();
      
      // Execute alert actions
      await this.executeAlertActions(alert);
      
      return alert;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Monitor for failed payment spikes
   */
  static async monitorFailedPayments() {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Count failed payments in last 24 hours
      const recentFailures = await Payment.countDocuments({
        status: 'FAILED',
        createdAt: { $gte: last24Hours }
      });

      // Calculate average daily failures over last 7 days
      const weeklyFailures = await Payment.countDocuments({
        status: 'FAILED',
        createdAt: { $gte: last7Days }
      });

      const averageDailyFailures = weeklyFailures / 7;
      const spikeThreshold = averageDailyFailures * 2; // 200% increase

      if (recentFailures > spikeThreshold && recentFailures > 5) {
        await this.createAlert({
          type: 'FAILED_PAYMENT_SPIKE',
          category: 'FINANCIAL',
          title: 'Failed Payment Spike Detected',
          description: `Unusual spike in failed payments: ${recentFailures} failures in last 24 hours (${Math.round((recentFailures / averageDailyFailures - 1) * 100)}% increase)`,
          severity: recentFailures > averageDailyFailures * 3 ? 'CRITICAL' : 'HIGH',
          data: {
            currentValue: recentFailures,
            threshold: spikeThreshold,
            previousValue: averageDailyFailures,
            changePercentage: ((recentFailures / averageDailyFailures - 1) * 100),
            timePeriod: '24 hours'
          }
        });
      }
    } catch (error) {
      console.error('Error monitoring failed payments:', error);
    }
  }

  /**
   * Monitor churn rate thresholds
   */
  static async monitorChurnThresholds() {
    try {
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      
      const currentMetrics = await this.calculateCustomerMetrics(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
        new Date()
      );

      const churnThreshold = 5; // 5% monthly churn threshold

      if (currentMetrics.churnRate > churnThreshold) {
        await this.createAlert({
          type: 'CHURN_THRESHOLD_EXCEEDED',
          category: 'OPERATIONAL',
          title: 'Churn Rate Threshold Exceeded',
          description: `Monthly churn rate of ${currentMetrics.churnRate.toFixed(1)}% exceeds threshold of ${churnThreshold}%`,
          severity: currentMetrics.churnRate > churnThreshold * 2 ? 'CRITICAL' : 'HIGH',
          data: {
            currentValue: currentMetrics.churnRate,
            threshold: churnThreshold,
            timePeriod: 'monthly',
            affectedEntities: [`${currentMetrics.churnedCustomers} customers`]
          },
          impact: {
            customersAffected: currentMetrics.churnedCustomers,
            businessImpact: currentMetrics.churnRate > churnThreshold * 2 ? 'CRITICAL' : 'HIGH'
          }
        });
      }
    } catch (error) {
      console.error('Error monitoring churn thresholds:', error);
    }
  }

  /**
   * Execute alert actions
   */
  static async executeAlertActions(alert) {
    try {
      const actions = [];

      // Email notification for high/critical alerts
      if (['HIGH', 'CRITICAL'].includes(alert.severity)) {
        actions.push({
          actionType: 'EMAIL',
          actionTarget: 'admin@company.com', // Configure as needed
          executedAt: new Date(),
          status: 'PENDING'
        });
      }

      // Webhook for critical alerts
      if (alert.severity === 'CRITICAL') {
        actions.push({
          actionType: 'WEBHOOK',
          actionTarget: process.env.CRITICAL_ALERT_WEBHOOK,
          executedAt: new Date(),
          status: 'PENDING'
        });
      }

      if (actions.length > 0) {
        alert.actions = actions;
        await alert.save();
      }

      return actions;
    } catch (error) {
      console.error('Error executing alert actions:', error);
    }
  }

  /**
   * Helper method to get monthly revenue from subscription
   */
  static async getMonthlyRevenue(subscription, targetCurrency = 'USD') {
    let monthlyAmount = subscription.amount;

    switch (subscription.billingCycle) {
      case 'QUARTERLY':
        monthlyAmount = subscription.amount / 3;
        break;
      case 'YEARLY':
        monthlyAmount = subscription.amount / 12;
        break;
    }

    if (subscription.currency !== targetCurrency) {
      monthlyAmount = await this.convertCurrency(monthlyAmount, subscription.currency, targetCurrency);
    }

    return monthlyAmount;
  }

  /**
   * Helper method to get subscription lifespan in months
   */
  static getSubscriptionLifespan(subscription) {
    const startDate = subscription.createdAt;
    const endDate = subscription.cancelledAt || new Date();
    const lifespanMs = endDate.getTime() - startDate.getTime();
    return Math.max(1, lifespanMs / (30 * 24 * 60 * 60 * 1000)); // At least 1 month
  }

  /**
   * Helper method to convert currency (placeholder)
   */
  static async convertCurrency(amount, fromCurrency, toCurrency) {
    // In a real implementation, you would use a currency conversion service
    // For now, return the same amount
    if (fromCurrency === toCurrency) {
      return amount;
    }
    
    // Placeholder conversion rates
    const conversionRates = {
      'USD': { 'EUR': 0.85, 'GBP': 0.73, 'JPY': 110 },
      'EUR': { 'USD': 1.18, 'GBP': 0.86, 'JPY': 129 },
      'GBP': { 'USD': 1.37, 'EUR': 1.16, 'JPY': 151 }
    };

    const rate = conversionRates[fromCurrency]?.[toCurrency] || 1;
    return amount * rate;
  }

  /**
   * Helper methods for period calculations
   */
  static getPeriodStart(date, periodType) {
    switch (periodType) {
      case 'DAILY':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      case 'MONTHLY':
        return new Date(date.getFullYear(), date.getMonth(), 1);
      case 'QUARTERLY':
        const quarter = Math.floor(date.getMonth() / 3);
        return new Date(date.getFullYear(), quarter * 3, 1);
      case 'YEARLY':
        return new Date(date.getFullYear(), 0, 1);
      default:
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }
  }

  static getPeriodEnd(date, periodType) {
    switch (periodType) {
      case 'DAILY':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      case 'MONTHLY':
        return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      case 'QUARTERLY':
        const quarter = Math.floor(date.getMonth() / 3);
        return new Date(date.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
      case 'YEARLY':
        return new Date(date.getFullYear(), 11, 31, 23, 59, 59);
      default:
        return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    }
  }
}

module.exports = ReportingService;





