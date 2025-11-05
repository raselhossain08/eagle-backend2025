const User = require('../../user/models/user.model');
const Subscription = require('../models/subscription.model');
const Invoice = require('../../payment/models/invoice.model');
const Payment = require('../../payment/models/payment.model');
const SupportTicket = require('../../dashboard/models/supportTicket.model');
const Discount = require('../../payment/models/discount.model');
const MembershipPlan = require('../models/membershipPlan.model');
const SignedContract = require('../../contract/models/signedContract.model');
const mongoose = require('mongoose');

class SubscriberService {

  /**
   * Get subscribers with advanced filtering and search
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

      // Build the aggregation pipeline
      const pipeline = [];

      // Match stage for basic user filtering
      const userMatch = {};

      if (q) {
        userMatch.$or = [
          { name: { $regex: q, $options: 'i' } },
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { _id: mongoose.Types.ObjectId.isValid(q) ? mongoose.Types.ObjectId(q) : null }
        ].filter(condition => condition._id !== null);
      }

      if (status.length > 0) {
        userMatch.isActive = status.includes('active');
      }

      if (country_code) {
        userMatch['address.country'] = country_code;
      }

      if (created_after || created_before) {
        userMatch.createdAt = {};
        if (created_after) userMatch.createdAt.$gte = new Date(created_after);
        if (created_before) userMatch.createdAt.$lte = new Date(created_before);
      }

      pipeline.push({ $match: userMatch });

      // Lookup subscriptions
      pipeline.push({
        $lookup: {
          from: 'subscriptions',
          localField: '_id',
          foreignField: 'userId',
          as: 'subscriptions'
        }
      });

      // Lookup current subscription (most recent active)
      pipeline.push({
        $addFields: {
          currentSubscription: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$subscriptions',
                  cond: { $in: ['$$this.status', ['trial', 'active']] }
                }
              },
              0
            ]
          }
        }
      });

      // Lookup membership plans
      pipeline.push({
        $lookup: {
          from: 'membershipplans',
          localField: 'currentSubscription.planId',
          foreignField: '_id',
          as: 'currentPlan'
        }
      });

      // Lookup invoices for financial data
      pipeline.push({
        $lookup: {
          from: 'invoices',
          localField: '_id',
          foreignField: 'userId',
          as: 'invoices'
        }
      });

      // Lookup support tickets
      pipeline.push({
        $lookup: {
          from: 'supporttickets',
          localField: '_id',
          foreignField: 'userId',
          as: 'supportTickets'
        }
      });

      // Calculate derived fields
      pipeline.push({
        $addFields: {
          currentPlanInfo: { $arrayElemAt: ['$currentPlan', 0] },
          mrr: {
            $cond: {
              if: '$currentSubscription',
              then: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$currentSubscription.billingCycle', 'monthly'] }, then: '$currentSubscription.currentPrice' },
                    { case: { $eq: ['$currentSubscription.billingCycle', 'quarterly'] }, then: { $divide: ['$currentSubscription.currentPrice', 3] } },
                    { case: { $eq: ['$currentSubscription.billingCycle', 'semiannual'] }, then: { $divide: ['$currentSubscription.currentPrice', 6] } },
                    { case: { $eq: ['$currentSubscription.billingCycle', 'annual'] }, then: { $divide: ['$currentSubscription.currentPrice', 12] } }
                  ],
                  default: 0
                }
              },
              else: 0
            }
          },
          totalRevenue: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$invoices',
                    cond: { $eq: ['$$this.status', 'paid'] }
                  }
                },
                in: '$$this.total'
              }
            }
          },
          openTickets: {
            $size: {
              $filter: {
                input: '$supportTickets',
                cond: { $in: ['$$this.status', ['open', 'in_progress']] }
              }
            }
          },
          subscriptionStatus: {
            $cond: {
              if: '$currentSubscription',
              then: '$currentSubscription.status',
              else: 'none'
            }
          }
        }
      });

      // Apply subscription-based filters
      const subscriptionMatch = {};

      if (subscription_status.length > 0) {
        subscriptionMatch.subscriptionStatus = { $in: subscription_status };
      }

      if (plan_id.length > 0) {
        subscriptionMatch['currentSubscription.planId'] = {
          $in: plan_id.map(id => mongoose.Types.ObjectId(id))
        };
      }

      if (mrr_min !== undefined || mrr_max !== undefined) {
        subscriptionMatch.mrr = {};
        if (mrr_min !== undefined) subscriptionMatch.mrr.$gte = parseFloat(mrr_min);
        if (mrr_max !== undefined) subscriptionMatch.mrr.$lte = parseFloat(mrr_max);
      }

      if (churn_risk) {
        subscriptionMatch['currentSubscription.churnRisk.level'] = churn_risk;
      }

      if (Object.keys(subscriptionMatch).length > 0) {
        pipeline.push({ $match: subscriptionMatch });
      }

      // Project final fields
      pipeline.push({
        $project: {
          _id: 1,
          subscriberId: 1,
          name: { $ifNull: ['$name', { $concat: ['$firstName', ' ', '$lastName'] }] },
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          company: 1,
          country: '$address.country',
          subscription: '$subscription', // Legacy field
          subscriptionStatus: 1,
          currentPlan: '$currentPlanInfo.name',
          currentPlanId: '$currentSubscription.planId',
          billingCycle: '$currentSubscription.billingCycle',
          mrr: { $round: ['$mrr', 2] },
          totalRevenue: { $round: ['$totalRevenue', 2] },
          churnRisk: '$currentSubscription.churnRisk',
          openTickets: 1,
          lastLoginAt: 1,
          createdAt: 1,
          isActive: 1,
          nextBillingDate: '$currentSubscription.nextBillingDate',
          trialEndsAt: '$currentSubscription.trialEndDate'
        }
      });

      // Add sorting
      const sortStage = {};
      if (sort.startsWith('-')) {
        sortStage[sort.substring(1)] = -1;
      } else {
        sortStage[sort] = 1;
      }
      pipeline.push({ $sort: sortStage });

      // Execute aggregation with pagination
      const skip = (page - 1) * limit;

      // Get total count
      const countPipeline = [...pipeline];
      countPipeline.push({ $count: "total" });
      const countResult = await User.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Get paginated results
      pipeline.push(
        { $skip: skip },
        { $limit: parseInt(limit) }
      );

      const subscribers = await User.aggregate(pipeline);

      return {
        data: subscribers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
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
      const user = await User.findById(subscriberId)
        .populate({
          path: 'loginHistory',
          options: { sort: { timestamp: -1 }, limit: 10 }
        });

      if (!user) {
        throw new Error('Subscriber not found');
      }

      // Get subscription history
      const subscriptions = await Subscription.find({ userId: subscriberId })
        .populate('planId', 'name description pricing')
        .sort({ createdAt: -1 });

      // Get invoice history
      const invoices = await Invoice.find({ userId: subscriberId })
        .sort({ createdAt: -1 })
        .limit(50);

      // Get payment history
      const payments = await Payment.find({ userId: subscriberId })
        .sort({ attemptedAt: -1 })
        .limit(50);

      // Get support tickets
      const supportTickets = await SupportTicket.find({ userId: subscriberId })
        .sort({ createdAt: -1 })
        .limit(20);

      // Get applied discounts
      const appliedDiscounts = await Discount.find({
        'usageHistory.userId': subscriberId
      }).select('code name type value usageHistory.$');

      // Get signed contracts
      const contracts = await SignedContract.find({ userId: subscriberId })
        .sort({ createdAt: -1 });

      // Calculate metrics
      const totalRevenue = invoices
        .filter(invoice => invoice.status === 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0);

      const currentSubscription = subscriptions.find(sub =>
        ['trial', 'active'].includes(sub.status)
      );

      // Create timeline of events
      const timeline = [];

      // Add subscription events
      subscriptions.forEach(sub => {
        timeline.push({
          type: 'subscription',
          action: 'created',
          date: sub.createdAt,
          details: {
            plan: sub.planId?.name,
            status: sub.status,
            billingCycle: sub.billingCycle
          }
        });

        if (sub.canceledAt) {
          timeline.push({
            type: 'subscription',
            action: 'canceled',
            date: sub.canceledAt,
            details: {
              reason: sub.cancellationReason,
              plan: sub.planId?.name
            }
          });
        }
      });

      // Add payment events
      payments.forEach(payment => {
        timeline.push({
          type: 'payment',
          action: payment.status,
          date: payment.attemptedAt,
          details: {
            amount: payment.amount,
            currency: payment.currency,
            method: payment.paymentMethod.type,
            status: payment.status
          }
        });
      });

      // Add support ticket events
      supportTickets.forEach(ticket => {
        timeline.push({
          type: 'support',
          action: 'created',
          date: ticket.createdAt,
          details: {
            subject: ticket.subject,
            category: ticket.category,
            priority: ticket.priority
          }
        });

        if (ticket.resolvedAt) {
          timeline.push({
            type: 'support',
            action: 'resolved',
            date: ticket.resolvedAt,
            details: {
              subject: ticket.subject,
              resolutionTime: ticket.resolutionTime
            }
          });
        }
      });

      // Sort timeline by date
      timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        subscriber: user,
        subscriptions,
        currentSubscription,
        invoices,
        payments,
        supportTickets,
        appliedDiscounts,
        contracts,
        metrics: {
          totalRevenue,
          totalPayments: payments.length,
          successfulPayments: payments.filter(p => p.status === 'succeeded').length,
          failedPayments: payments.filter(p => p.status === 'failed').length,
          totalRefunds: payments.reduce((sum, p) => sum + p.totalRefunded, 0),
          openTickets: supportTickets.filter(t => ['open', 'in_progress'].includes(t.status)).length,
          resolvedTickets: supportTickets.filter(t => t.status === 'resolved').length,
          averageTicketResolutionTime: this.calculateAverageResolutionTime(supportTickets),
          subscriptionAge: currentSubscription ?
            Math.floor((Date.now() - currentSubscription.startDate) / (1000 * 60 * 60 * 24)) : 0,
          churnRisk: currentSubscription?.churnRisk || { score: 0, level: 'low' }
        },
        timeline: timeline.slice(0, 50) // Limit to 50 most recent events
      };

    } catch (error) {
      console.error('Error in getSubscriberProfile:', error);
      throw new Error('Failed to fetch subscriber profile: ' + error.message);
    }
  }

  /**
   * Create new subscription for subscriber
   */
  async createSubscription(subscriberId, subscriptionData) {
    try {
      const { planId, billingCycle, startDate, trialDays, promoCode } = subscriptionData;

      const user = await User.findById(subscriberId);
      if (!user) {
        throw new Error('Subscriber not found');
      }

      const plan = await MembershipPlan.findById(planId);
      if (!plan) {
        throw new Error('Membership plan not found');
      }

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        userId: subscriberId,
        status: { $in: ['trial', 'active'] }
      });

      if (existingSubscription) {
        throw new Error('User already has an active subscription');
      }

      // Calculate price based on billing cycle
      const price = plan.getPriceForCycle(billingCycle);

      // Handle trial period
      const subscriptionStartDate = startDate ? new Date(startDate) : new Date();
      let trialEndDate = null;
      let nextBillingDate = subscriptionStartDate;

      if (trialDays && trialDays > 0) {
        trialEndDate = new Date(subscriptionStartDate);
        trialEndDate.setDate(trialEndDate.getDate() + trialDays);
        nextBillingDate = trialEndDate;
      }

      // Create subscription
      const subscription = new Subscription({
        userId: subscriberId,
        planId,
        status: trialDays > 0 ? 'trial' : 'active',
        billingCycle,
        currentPrice: price,
        startDate: subscriptionStartDate,
        trialStartDate: trialDays > 0 ? subscriptionStartDate : null,
        trialEndDate,
        nextBillingDate
      });

      await subscription.save();

      // Apply promo code if provided
      if (promoCode) {
        try {
          const discount = await Discount.validateCode(promoCode, subscription, user);
          // Apply discount logic here
        } catch (discountError) {
          console.warn('Promo code validation failed:', discountError.message);
        }
      }

      // Update user subscription field (legacy compatibility)
      user.subscription = plan.name;
      await user.save();

      return subscription.populate('planId');

    } catch (error) {
      console.error('Error in createSubscription:', error);
      throw new Error('Failed to create subscription: ' + error.message);
    }
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(subscriptionId, updateData) {
    try {
      const { newPlanId, changeType = 'immediate', prorationBehavior = 'create_prorations' } = updateData;

      const subscription = await Subscription.findById(subscriptionId)
        .populate('planId')
        .populate('userId');

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!['trial', 'active'].includes(subscription.status)) {
        throw new Error('Can only update active or trial subscriptions');
      }

      const newPlan = await MembershipPlan.findById(newPlanId);
      if (!newPlan) {
        throw new Error('New plan not found');
      }

      const oldPrice = subscription.currentPrice;
      const newPrice = newPlan.getPriceForCycle(subscription.billingCycle);

      if (changeType === 'immediate') {
        // Calculate proration if needed
        if (prorationBehavior === 'create_prorations' && subscription.nextBillingDate) {
          const daysRemaining = Math.ceil(
            (subscription.nextBillingDate - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const totalDaysInCycle = this.getDaysInBillingCycle(subscription.billingCycle);
          const proratedCredit = (oldPrice * daysRemaining) / totalDaysInCycle;
          const proratedCharge = (newPrice * daysRemaining) / totalDaysInCycle;

          subscription.proratedCredits = proratedCredit - proratedCharge;
        }

        // Update subscription immediately
        subscription.planId = newPlanId;
        subscription.currentPrice = newPrice;
      } else if (changeType === 'end_of_period') {
        // Schedule change for end of current billing period
        subscription.scheduledChanges.push({
          changeType: 'plan_change',
          newPlanId,
          scheduledDate: subscription.nextBillingDate,
          status: 'scheduled'
        });
      }

      await subscription.save();

      // Update user subscription field (legacy compatibility)
      subscription.userId.subscription = newPlan.name;
      await subscription.userId.save();

      return subscription.populate('planId');

    } catch (error) {
      console.error('Error in updateSubscription:', error);
      throw new Error('Failed to update subscription: ' + error.message);
    }
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(subscriptionId, reason) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'active') {
        throw new Error('Can only pause active subscriptions');
      }

      subscription.status = 'paused';
      subscription.pausedAt = new Date();
      subscription.pauseReason = reason;

      await subscription.save();
      return subscription;

    } catch (error) {
      console.error('Error in pauseSubscription:', error);
      throw new Error('Failed to pause subscription: ' + error.message);
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(subscriptionId) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'paused') {
        throw new Error('Can only resume paused subscriptions');
      }

      subscription.status = 'active';
      subscription.resumedAt = new Date();
      subscription.pauseReason = null;
      subscription.pausedUntil = null;

      // Recalculate next billing date
      const pausedDuration = Date.now() - subscription.pausedAt;
      if (subscription.nextBillingDate) {
        subscription.nextBillingDate = new Date(subscription.nextBillingDate.getTime() + pausedDuration);
      }

      await subscription.save();
      return subscription;

    } catch (error) {
      console.error('Error in resumeSubscription:', error);
      throw new Error('Failed to resume subscription: ' + error.message);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, cancellationData) {
    try {
      const { reason, effectiveDate = 'immediately', offerCode } = cancellationData;

      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!['trial', 'active', 'paused'].includes(subscription.status)) {
        throw new Error('Cannot cancel subscription in current status');
      }

      if (effectiveDate === 'immediately') {
        subscription.status = 'canceled';
        subscription.canceledAt = new Date();
      } else if (effectiveDate === 'end_of_period') {
        subscription.scheduledChanges.push({
          changeType: 'cancellation',
          scheduledDate: subscription.nextBillingDate || new Date(),
          status: 'scheduled'
        });
      }

      subscription.cancellationReason = reason;
      subscription.cancellationNote = `Canceled: ${reason}`;

      await subscription.save();
      return subscription;

    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      throw new Error('Failed to cancel subscription: ' + error.message);
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

      // Get total subscribers
      const totalSubscribersResult = await User.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            current: { $sum: 1 },
            active: {
              $sum: {
                $cond: [{ $eq: ['$isActive', true] }, 1, 0]
              }
            }
          }
        }
      ]);

      // Get subscription status breakdown
      const subscriptionStats = await Subscription.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalMrr: {
              $sum: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$billingCycle', 'monthly'] }, then: '$currentPrice' },
                    { case: { $eq: ['$billingCycle', 'quarterly'] }, then: { $divide: ['$currentPrice', 3] } },
                    { case: { $eq: ['$billingCycle', 'semiannual'] }, then: { $divide: ['$currentPrice', 6] } },
                    { case: { $eq: ['$billingCycle', 'annual'] }, then: { $divide: ['$currentPrice', 12] } }
                  ],
                  default: 0
                }
              }
            }
          }
        }
      ]);

      // Calculate previous period for comparison
      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(startDate);
      const periodDuration = endDate ? new Date(endDate) - new Date(startDate) : 30 * 24 * 60 * 60 * 1000;
      previousPeriodStart.setTime(previousPeriodStart.getTime() - periodDuration);

      const previousStats = await User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: previousPeriodStart,
              $lte: previousPeriodEnd
            }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);

      const currentTotal = totalSubscribersResult[0]?.current || 0;
      const previousTotal = previousStats[0]?.count || 0;
      const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

      // Get churn statistics
      const churnStats = await Subscription.aggregate([
        {
          $match: {
            status: 'canceled',
            canceledAt: {
              $gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              $lte: endDate ? new Date(endDate) : new Date()
            }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]);

      const activeSubscriptions = subscriptionStats.find(s => s._id === 'active') || { count: 0, totalMrr: 0 };
      const trialSubscriptions = subscriptionStats.find(s => s._id === 'trial') || { count: 0 };
      const churnedCount = churnStats[0]?.count || 0;

      return {
        totalSubscribers: {
          value: currentTotal,
          change: Math.round(change * 10) / 10,
          trend: change >= 0 ? 'up' : 'down'
        },
        activeThisMonth: {
          value: activeSubscriptions.count,
          change: 0, // Would need historical data to calculate
          trend: 'up'
        },
        atRisk: {
          value: 0, // Would need churn risk calculation
          change: 0,
          trend: 'down'
        },
        churnedThisMonth: {
          value: churnedCount,
          change: 0, // Would need previous period comparison
          trend: 'down'
        },
        mrr: Math.round(activeSubscriptions.totalMrr * 100) / 100,
        trialUsers: trialSubscriptions.count,
        subscriptionBreakdown: subscriptionStats
      };

    } catch (error) {
      console.error('Error in getSubscriptionStats:', error);
      throw new Error('Failed to fetch subscription statistics: ' + error.message);
    }
  }

  // Helper methods
  calculateAverageResolutionTime(tickets) {
    const resolvedTickets = tickets.filter(t => t.resolutionTime);
    if (resolvedTickets.length === 0) return 0;

    const totalTime = resolvedTickets.reduce((sum, t) => sum + t.resolutionTime, 0);
    return Math.round(totalTime / resolvedTickets.length);
  }

  getDaysInBillingCycle(billingCycle) {
    const cycleMap = {
      monthly: 30,
      quarterly: 90,
      semiannual: 180,
      annual: 365
    };
    return cycleMap[billingCycle] || 30;
  }

  /**
   * Export subscribers data
   */
  async exportSubscribers(format = 'csv', filters = {}) {
    try {
      const { data } = await this.getSubscribers(filters, { limit: 10000 }); // Get all for export

      const exportData = data.map(subscriber => ({
        ID: subscriber._id,
        Name: subscriber.name,
        Email: subscriber.email,
        Phone: subscriber.phone || 'N/A',
        Company: subscriber.company || 'N/A',
        Country: subscriber.country || 'N/A',
        'Current Plan': subscriber.currentPlan || 'None',
        'Subscription Status': subscriber.subscriptionStatus,
        'Billing Cycle': subscriber.billingCycle || 'N/A',
        'MRR': subscriber.mrr || 0,
        'Total Revenue': subscriber.totalRevenue || 0,
        'Churn Risk': subscriber.churnRisk?.level || 'low',
        'Open Tickets': subscriber.openTickets || 0,
        'Created At': subscriber.createdAt,
        'Last Login': subscriber.lastLoginAt || 'Never',
        'Next Billing': subscriber.nextBillingDate || 'N/A'
      }));

      let content;
      let contentType;
      let extension;

      switch (format.toLowerCase()) {
        case 'csv':
          content = this.convertToCSV(exportData);
          contentType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          contentType = 'application/json';
          extension = 'json';
          break;
        case 'excel':
          // For Excel, we'll use CSV format for simplicity
          // In a real implementation, you'd use a library like xlsx
          content = this.convertToCSV(exportData);
          contentType = 'application/vnd.ms-excel';
          extension = 'csv';
          break;
        default:
          throw new Error('Unsupported export format');
      }

      return {
        content,
        contentType,
        extension,
        filename: `subscribers-${new Date().toISOString().split('T')[0]}.${extension}`
      };

    } catch (error) {
      console.error('Error in exportSubscribers:', error);
      throw new Error('Failed to export subscribers: ' + error.message);
    }
  }

  convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Create a new subscriber
   */
  async createSubscriber(subscriberData) {
    try {
      const {
        firstName,
        lastName,
        name,
        email,
        phone,
        company,
        country,
        subscription = 'None',
        status = 'active'
      } = subscriberData;

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create new user
      const userData = {
        email,
        phone,
        company,
        subscription,
        isActive: status === 'active',
        isEmailVerified: true, // Auto-verify for admin-created users
        address: {
          country
        }
      };

      // Handle name fields
      if (name) {
        userData.name = name;
        // Try to split name into first/last if not provided separately
        if (!firstName && !lastName) {
          const nameParts = name.split(' ');
          userData.firstName = nameParts[0] || '';
          userData.lastName = nameParts.slice(1).join(' ') || '';
        } else {
          userData.firstName = firstName || '';
          userData.lastName = lastName || '';
        }
      } else {
        userData.firstName = firstName || '';
        userData.lastName = lastName || '';
        userData.name = `${firstName || ''} ${lastName || ''}`.trim();
      }

      // Generate a temporary password
      userData.password = Math.random().toString(36).slice(-12);
      userData.isPendingUser = true; // Mark as pending until they set their own password

      const user = new User(userData);
      await user.save();

      return user;

    } catch (error) {
      console.error('Error in createSubscriber:', error);
      throw new Error('Failed to create subscriber: ' + error.message);
    }
  }

  /**
   * Update subscriber
   */
  async updateSubscriber(subscriberId, updateData) {
    try {
      const user = await User.findById(subscriberId);
      if (!user) {
        throw new Error('Subscriber not found');
      }

      // Update allowed fields
      const allowedFields = [
        'firstName', 'lastName', 'name', 'phone', 'company',
        'bio', 'location', 'website', 'discordUsername', 'isActive', 'plan'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          user[field] = updateData[field];
        }
      });

      // Handle address updates
      if (updateData.country) {
        user.address.country = updateData.country;
      }

      // Handle subscription status updates
      if (updateData.status !== undefined) {
        // Map frontend status to backend fields
        switch (updateData.status) {
          case 'active':
            user.isActive = true;
            break;
          case 'inactive':
          case 'cancelled':
          case 'suspended':
            user.isActive = false;
            break;
          case 'trial':
            user.isActive = true; // Trial users are considered active
            break;
          default:
            user.isActive = updateData.status === 'active';
        }
      }

      // Handle plan updates
      if (updateData.plan) {
        user.subscription = updateData.plan;
      }

      await user.save();
      return user;

    } catch (error) {
      console.error('Error in updateSubscriber:', error);
      throw new Error('Failed to update subscriber: ' + error.message);
    }
  }

  /**
   * Delete subscriber
   */
  async deleteSubscriber(subscriberId) {
    try {
      const user = await User.findById(subscriberId);
      if (!user) {
        throw new Error('Subscriber not found');
      }

      // Check for active subscriptions
      const activeSubscription = await Subscription.findOne({
        userId: subscriberId,
        status: { $in: ['trial', 'active'] }
      });

      if (activeSubscription) {
        throw new Error('Cannot delete subscriber with active subscription. Please cancel subscription first.');
      }

      // Soft delete by setting isActive to false
      user.isActive = false;
      user.email = `deleted_${Date.now()}_${user.email}`;
      await user.save();

      return { message: 'Subscriber deleted successfully' };

    } catch (error) {
      console.error('Error in deleteSubscriber:', error);
      throw new Error('Failed to delete subscriber: ' + error.message);
    }
  }
}

module.exports = new SubscriberService();





