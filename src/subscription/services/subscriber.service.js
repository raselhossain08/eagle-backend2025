const User = require('../../user/models/user.model'); // ✅ Correct User model path
const Subscription = require('../models/subscription.model');
const Invoice = require('../../payment/models/invoice.model');
const Payment = require('../../payment/models/payment.model');
const Discount = require('../../payment/models/discount.model');
const MembershipPlan = require('../models/membershipPlan.model');
const mongoose = require('mongoose');
const paymentWebhookController = require('../../controllers/paymentWebhook.controller');

// Optional models - load if available
let SupportTicket, SignedContract;
try {
  SupportTicket = require('../../dashboard/models/supportTicket.model');
} catch (e) {
  // SupportTicket model optional
}
try {
  SignedContract = require('../../contract/models/signedContract.model');
} catch (e) {
  // SignedContract model optional
}

/**
 * Simplified Subscriber Service using User model
 * No separate Subscriber model - everything through User
 */
class SubscriberService {

  /**
   * Get subscribers (users) with their subscription data
   * Simplified approach using direct queries instead of complex aggregation
   */
  async getSubscribers(filters = {}, pagination = {}) {
    try {
      const {
        q, // search query
        status = [],
        plan_id = [],
        mrr_min,
        mrr_max,
        churn_risk,
        country_code,
        created_after,
        created_before,
        subscription_status = []
      } = filters;

      const {
        page = 1,
        limit = 50,
        sort = '-createdAt'
      } = pagination;

      // Build query for User model
      const query = {};

      // Search query
      if (q) {
        query.$or = [
          { name: { $regex: q, $options: 'i' } },
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ];
      }

      // Status filter
      if (status.length > 0) {
        if (status.includes('active') && !status.includes('inactive')) {
          query.isActive = true;
        } else if (status.includes('inactive') && !status.includes('active')) {
          query.isActive = false;
        }
      }

      // Country filter
      if (country_code) {
        query['address.country'] = country_code;
      }

      // Date range filter
      if (created_after || created_before) {
        query.createdAt = {};
        if (created_after) query.createdAt.$gte = new Date(created_after);
        if (created_before) query.createdAt.$lte = new Date(created_before);
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;

      // Get total count
      const total = await User.countDocuments(query);

      // Get users with populated subscription plan
      const users = await User.find(query)
        .select('_id subscriberId name firstName lastName email phone company address subscription subscriptionStatus subscriptionPlanId subscriptionStartDate subscriptionEndDate nextBillingDate lastBillingDate billingCycle totalSpent lifetimeValue isActive createdAt lastLoginAt')
        .populate('subscriptionPlanId', 'name displayName pricing planType category')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get subscription data for all users
      const userIds = users.map(u => u._id); const [subscriptions, invoices] = await Promise.all([
        // Get active subscriptions
        Subscription.find({
          userId: { $in: userIds },
          status: { $in: ['trial', 'active', 'paused'] }
        }).populate('planId', 'name pricing').lean(),

        // Get paid invoices for revenue
        Invoice.find({
          userId: { $in: userIds },
          status: 'paid'
        }).select('userId total').lean()
      ]);

      // Try to get tickets if model available (non-blocking)
      let tickets = [];
      try {
        if (SupportTicket && typeof SupportTicket.find === 'function') {
          tickets = await SupportTicket.find({
            userId: { $in: userIds },
            status: { $in: ['open', 'in_progress'] }
          }).select('userId').lean();
        }
      } catch (e) {
        // Ignore ticket errors
      }            // Create maps for quick lookup
      const subscriptionMap = new Map();
      subscriptions.forEach(sub => {
        subscriptionMap.set(sub.userId.toString(), sub);
      });

      const revenueMap = new Map();
      invoices.forEach(inv => {
        const userId = inv.userId.toString();
        revenueMap.set(userId, (revenueMap.get(userId) || 0) + (inv.total || 0));
      });

      const ticketMap = new Map();
      tickets.forEach(ticket => {
        const userId = ticket.userId.toString();
        ticketMap.set(userId, (ticketMap.get(userId) || 0) + 1);
      });

      // Transform users to subscriber format with updated User model fields
      const subscribers = users.map(user => {
        const userId = user._id.toString();
        const subscription = subscriptionMap.get(userId);
        const totalRevenue = revenueMap.get(userId) || user.totalSpent || user.lifetimeValue || 0;
        const openTickets = ticketMap.get(userId) || 0;

        // Calculate MRR from User model data
        let mrr = 0;
        if (user.subscriptionPlanId && user.subscriptionPlanId.pricing) {
          const plan = user.subscriptionPlanId;
          const billingCycle = user.billingCycle || 'monthly';

          // Get price based on billing cycle
          let price = 0;
          if (plan.pricing.monthly?.price && billingCycle === 'monthly') {
            price = plan.pricing.monthly.price;
          } else if (plan.pricing.annual?.price && billingCycle === 'annual') {
            price = plan.pricing.annual.price;
          } else if (plan.pricing.oneTime?.price) {
            price = plan.pricing.oneTime.price;
          }

          // Convert to monthly MRR
          const cycleMap = {
            monthly: 1,
            quarterly: 3,
            semiannual: 6,
            annual: 12,
            yearly: 12,
            oneTime: 0
          };
          const divisor = cycleMap[billingCycle] || 1;
          mrr = divisor > 0 ? price / divisor : 0;
        }

        return {
          _id: user._id,
          subscriberId: user.subscriberId,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || null,
          company: user.company || null,
          country: user.address?.country || 'N/A',
          subscription: user.subscription || 'None',
          subscriptionStatus: user.subscriptionStatus || 'none',
          currentPlan: user.subscriptionPlanId?.displayName || user.subscriptionPlanId?.name || 'None',
          currentPlanId: user.subscriptionPlanId?._id || null,
          planType: user.subscriptionPlanId?.planType || 'N/A',
          planCategory: user.subscriptionPlanId?.category || 'N/A',
          billingCycle: user.billingCycle || 'N/A',
          mrr: Math.round(mrr * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalSpent: user.totalSpent || 0,
          lifetimeValue: user.lifetimeValue || 0,
          churnRisk: subscription?.churnRisk || { score: 0, level: 'low' },
          openTickets,
          lastLoginAt: user.lastLoginAt || null,
          createdAt: user.createdAt,
          isActive: user.isActive,
          subscriptionStartDate: user.subscriptionStartDate || null,
          subscriptionEndDate: user.subscriptionEndDate || null,
          nextBillingDate: user.nextBillingDate || null,
          lastBillingDate: user.lastBillingDate || null,
          trialEndsAt: subscription?.trialEndDate || null
        };
      });

      // Apply post-query filters
      let filteredSubscribers = subscribers;

      // Subscription status filter
      if (subscription_status.length > 0) {
        filteredSubscribers = filteredSubscribers.filter(sub =>
          subscription_status.includes(sub.subscriptionStatus)
        );
      }

      // MRR filter
      if (mrr_min !== undefined || mrr_max !== undefined) {
        filteredSubscribers = filteredSubscribers.filter(sub => {
          if (mrr_min !== undefined && sub.mrr < parseFloat(mrr_min)) return false;
          if (mrr_max !== undefined && sub.mrr > parseFloat(mrr_max)) return false;
          return true;
        });
      }

      // Plan filter
      if (plan_id.length > 0) {
        filteredSubscribers = filteredSubscribers.filter(sub =>
          sub.currentPlanId && plan_id.includes(sub.currentPlanId.toString())
        );
      }

      // Churn risk filter
      if (churn_risk) {
        filteredSubscribers = filteredSubscribers.filter(sub =>
          sub.churnRisk.level === churn_risk
        );
      }

      return {
        data: filteredSubscribers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total, // Use database count, not filtered count
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error in getSubscribers:', error);
      throw new Error('Failed to fetch subscribers: ' + error.message);
    }
  }

  /**
   * Get detailed subscriber profile
   */
  async getSubscriberProfile(subscriberId) {
    try {
      const user = await User.findById(subscriberId);

      if (!user) {
        throw new Error('Subscriber not found');
      }

      // Get all related data
      const [subscriptions, invoices, payments, supportTickets, contracts] = await Promise.all([
        Subscription.find({ userId: subscriberId })
          .populate('planId', 'name description pricing')
          .sort({ createdAt: -1 }),
        Invoice.find({ userId: subscriberId }).sort({ createdAt: -1 }).limit(50),
        Payment.find({ userId: subscriberId }).sort({ attemptedAt: -1 }).limit(50),
        SupportTicket.find({ userId: subscriberId }).sort({ createdAt: -1 }).limit(20),
        SignedContract.find({ userId: subscriberId }).sort({ createdAt: -1 })
      ]);

      // Calculate metrics
      const totalRevenue = invoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0);

      const currentSubscription = subscriptions.find(sub =>
        ['trial', 'active'].includes(sub.status)
      );

      // Build timeline
      const timeline = this._buildTimeline(subscriptions, payments, supportTickets);

      return {
        subscriber: user,
        subscriptions,
        currentSubscription,
        invoices,
        payments,
        supportTickets,
        contracts,
        metrics: {
          totalRevenue,
          totalPayments: payments.length,
          successfulPayments: payments.filter(p => p.status === 'succeeded').length,
          failedPayments: payments.filter(p => p.status === 'failed').length,
          totalRefunds: payments.reduce((sum, p) => sum + p.totalRefunded, 0),
          openTickets: supportTickets.filter(t => ['open', 'in_progress'].includes(t.status)).length,
          resolvedTickets: supportTickets.filter(t => t.status === 'resolved').length,
          averageTicketResolutionTime: this._calculateAverageResolutionTime(supportTickets),
          subscriptionAge: currentSubscription ?
            Math.floor((Date.now() - currentSubscription.startDate) / (1000 * 60 * 60 * 24)) : 0,
          churnRisk: currentSubscription?.churnRisk || { score: 0, level: 'low' }
        },
        timeline: timeline.slice(0, 50)
      };

    } catch (error) {
      console.error('Error in getSubscriberProfile:', error);
      throw new Error('Failed to fetch subscriber profile: ' + error.message);
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      const matchStage = {};

      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const [totalUsers, subscriptions] = await Promise.all([
        User.countDocuments({ ...matchStage, isActive: true }),
        Subscription.find(matchStage)
      ]);

      // Calculate stats
      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const totalMRR = activeSubscriptions.reduce((sum, sub) => {
        const cycleMap = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
        const divisor = cycleMap[sub.billingCycle] || 1;
        return sum + (sub.currentPrice / divisor);
      }, 0);

      return {
        totalSubscribers: {
          value: totalUsers,
          change: 0,
          trend: 'up'
        },
        activeThisMonth: {
          value: activeSubscriptions.length,
          change: 0,
          trend: 'up'
        },
        mrr: Math.round(totalMRR * 100) / 100,
        trialUsers: subscriptions.filter(s => s.status === 'trial').length,
        subscriptionBreakdown: this._groupByStatus(subscriptions)
      };

    } catch (error) {
      console.error('Error in getSubscriptionStats:', error);
      throw new Error('Failed to fetch subscription statistics: ' + error.message);
    }
  }

  // Helper methods
  _buildTimeline(subscriptions, payments, tickets) {
    const timeline = [];

    subscriptions.forEach(sub => {
      timeline.push({
        type: 'subscription',
        action: 'created',
        date: sub.createdAt,
        details: { plan: sub.planId?.name, status: sub.status }
      });
    });

    payments.forEach(payment => {
      timeline.push({
        type: 'payment',
        action: payment.status,
        date: payment.attemptedAt,
        details: { amount: payment.amount, currency: payment.currency }
      });
    });

    tickets.forEach(ticket => {
      timeline.push({
        type: 'support',
        action: 'created',
        date: ticket.createdAt,
        details: { subject: ticket.subject, priority: ticket.priority }
      });
    });

    return timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Handle successful subscription payment and create transaction
   */
  async handleSubscriptionPaymentSuccess(paymentData, subscriptionId, userId) {
    try {
      console.log('🔄 Processing subscription payment success...', {
        subscriptionId,
        userId,
        amount: paymentData.amount
      });

      // Get subscription and user data
      const [subscription, userData] = await Promise.all([
        Subscription.findById(subscriptionId),
        User.findById(userId)
      ]);

      if (!subscription || !userData) {
        throw new Error('Subscription or user not found');
      }

      // Create transaction record
      const transactionResult = await paymentWebhookController.handleSubscriptionPayment(
        paymentData,
        subscription,
        userData
      );

      // Update subscription status if needed
      if (subscription.status !== 'active' && paymentData.status === 'succeeded') {
        subscription.status = 'active';
        subscription.lastPaymentDate = new Date();
        subscription.nextBillingDate = this.calculateNextBillingDate(subscription);
        await subscription.save();

        console.log('✅ Subscription activated after successful payment');
      }

      return {
        success: true,
        transaction: transactionResult.transaction,
        subscription
      };

    } catch (error) {
      console.error('❌ Failed to handle subscription payment success:', error);
      throw error;
    }
  }

  /**
   * Calculate next billing date based on billing cycle
   */
  calculateNextBillingDate(subscription) {
    const currentDate = new Date();
    const billingCycle = subscription.billingCycle || 'monthly';

    switch (billingCycle) {
      case 'weekly':
        return new Date(currentDate.getTime() + (7 * 24 * 60 * 60 * 1000));
      case 'monthly':
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(currentDate.getMonth() + 1);
        return nextMonth;
      case 'quarterly':
        const nextQuarter = new Date(currentDate);
        nextQuarter.setMonth(currentDate.getMonth() + 3);
        return nextQuarter;
      case 'yearly':
        const nextYear = new Date(currentDate);
        nextYear.setFullYear(currentDate.getFullYear() + 1);
        return nextYear;
      default:
        return new Date(currentDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days default
    }
  }

  /**
   * Handle failed subscription payment
   */
  async handleSubscriptionPaymentFailed(paymentData, subscriptionId, userId) {
    try {
      console.log('⚠️ Processing subscription payment failure...', {
        subscriptionId,
        userId,
        failureReason: paymentData.failureReason
      });

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Update subscription with payment failure
      subscription.paymentFailures = (subscription.paymentFailures || 0) + 1;
      subscription.lastPaymentFailure = new Date();
      subscription.failureReason = paymentData.failureReason;

      // Set to past_due if too many failures
      if (subscription.paymentFailures >= 3) {
        subscription.status = 'past_due';
        console.log('❌ Subscription marked as past_due due to multiple payment failures');
      }

      await subscription.save();

      return {
        success: true,
        subscription,
        failureCount: subscription.paymentFailures
      };

    } catch (error) {
      console.error('❌ Failed to handle subscription payment failure:', error);
      throw error;
    }
  }

  _calculateAverageResolutionTime(tickets) {
    const resolved = tickets.filter(t => t.resolutionTime);
    if (resolved.length === 0) return 0;
    const total = resolved.reduce((sum, t) => sum + t.resolutionTime, 0);
    return Math.round(total / resolved.length);
  }

  _groupByStatus(subscriptions) {
    const groups = {};
    subscriptions.forEach(sub => {
      groups[sub.status] = (groups[sub.status] || 0) + 1;
    });
    return Object.entries(groups).map(([status, count]) => ({
      _id: status,
      count
    }));
  }
}

module.exports = new SubscriberService();
