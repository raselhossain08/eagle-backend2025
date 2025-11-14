/**
 * Subscription Dashboard Service
 * Provides subscription management functionality for admin dashboard
 * Works with User model and transforms data for frontend
 */

const User = require('../../user/models/user.model');
const MembershipPlan = require('../models/membershipPlan.model');
const AuditLog = require('../models/auditLog.model');
const mongoose = require('mongoose');

class SubscriptionDashboardService {

    /**
     * Transform User to Subscription format for frontend
     */
    transformUserToSubscription(user, plan = null) {
        const mrr = this.calculateUserMRR(user);

        // Determine the actual plan name to display
        // Priority: plan.name > plan.displayName > user.subscription
        let planName = user.subscription || 'None';
        if (plan) {
            planName = plan.name || plan.displayName || planName;
        }

        return {
            _id: user._id.toString(),
            subscriberId: user._id.toString(),
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            phone: user.phone || null,
            company: user.company || null,
            country: user.country || 'US',
            subscription: planName,
            subscriptionStatus: user.subscriptionStatus || 'none',
            currentPlan: planName,
            currentPlanId: user.subscriptionPlanId?.toString() || '',
            planType: plan?.planType || 'subscription',
            planCategory: plan?.category || 'standard',
            billingCycle: user.billingCycle || 'monthly',
            mrr: mrr,
            totalRevenue: user.totalSpent || 0,
            totalSpent: user.totalSpent || 0,
            lifetimeValue: user.totalSpent || 0,
            churnRisk: { score: 0, level: 'low' },
            openTickets: 0,
            lastLoginAt: user.lastLogin || null,
            createdAt: user.createdAt,
            isActive: user.isActive !== false && user.subscriptionStatus === 'active',
            subscriptionStartDate: user.subscriptionStartDate || user.createdAt,
            subscriptionEndDate: user.subscriptionEndDate || null,
            nextBillingDate: user.nextBillingDate || null,
            lastBillingDate: user.lastBillingDate || null,
            trialEndsAt: user.trialEndDate || null,
            adminNotes: user.notes || '',
            planChangeHistory: user.planChangeHistory || [],
            scheduledPlanChange: user.scheduledPlanChange || null
        };
    }

    /**
     * Calculate MRR for user based on billing cycle
     */
    calculateUserMRR(user) {
        if (!user.subscription || user.subscriptionStatus !== 'active') {
            return 0;
        }

        // Get last payment amount or default pricing
        const amount = user.lastPaymentAmount || 0;
        const cycle = user.billingCycle || 'monthly';

        switch (cycle) {
            case 'annual':
                return amount / 12;
            case 'quarterly':
                return amount / 3;
            case 'monthly':
            default:
                return amount;
        }
    }

    /**
     * Get subscription analytics
     */
    async getAnalytics() {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Get all users with subscriptions
            const allUsers = await User.find({
                role: { $in: ['subscriber', 'user'] }
            }).lean();

            // Active subscribers
            const activeSubscribers = allUsers.filter(user =>
                user.subscriptionStatus === 'active' && user.isActive !== false
            );

            // Cancelled/expired subscribers
            const cancelledSubscribers = allUsers.filter(user =>
                user.subscriptionStatus === 'cancelled' || user.subscriptionStatus === 'expired'
            );

            // New subscribers (last 30 days)
            const newSubscribers = allUsers.filter(user =>
                user.subscriptionStartDate && new Date(user.subscriptionStartDate) >= thirtyDaysAgo
            );

            // Calculate MRR
            const mrr = activeSubscribers.reduce((sum, user) => {
                return sum + this.calculateUserMRR(user);
            }, 0);

            // Calculate ARR
            const arr = mrr * 12;

            // Calculate ARPU
            const arpu = activeSubscribers.length > 0
                ? mrr / activeSubscribers.length
                : 0;

            // Churn rate
            const totalSubscribers = allUsers.length || 1;
            const churnRate = (cancelledSubscribers.length / totalSubscribers) * 100;

            // Growth rate
            const churnedSubscribers = cancelledSubscribers.length;
            const netGrowth = newSubscribers.length - churnedSubscribers;
            const growthRate = totalSubscribers > 0
                ? (netGrowth / totalSubscribers) * 100
                : 0;

            // Recent activity (last 10 subscriptions)
            const recentActivity = await this.getRecentActivity(10);

            return {
                overview: {
                    totalSubscribers: allUsers.length,
                    activeSubscribers: activeSubscribers.length,
                    canceledSubscribers: cancelledSubscribers.length,
                    churnedSubscribers: churnedSubscribers,
                    churnRate: parseFloat(churnRate.toFixed(2))
                },
                revenue: {
                    mrr: parseFloat(mrr.toFixed(2)),
                    arr: parseFloat(arr.toFixed(2)),
                    arpu: parseFloat(arpu.toFixed(2)),
                    activeSubscribers: activeSubscribers.length
                },
                growth: {
                    newSubscribers: newSubscribers.length,
                    churnedSubscribers: churnedSubscribers,
                    netGrowth: netGrowth,
                    growthRate: parseFloat(growthRate.toFixed(2))
                },
                planDistribution: [],
                recentActivity: recentActivity,
                timeRange: '30d',
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Get analytics service error:', error);
            throw error;
        }
    }

    /**
     * Get subscriptions with filtering and pagination
     */
    async getSubscriptions(params) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                status,
                planType,
                userId,
                planId,
                startDate,
                endDate
            } = params;

            // Build query - show all subscribers
            const query = {
                role: { $in: ['subscriber', 'user'] },
                isDeleted: { $ne: true },
                $or: [
                    { isPendingUser: { $ne: true } }, // Non-pending users
                    { subscriptionStatus: 'active' }, // OR users with active subscriptions
                    { subscription: { $ne: 'None' } }, // OR users with any subscription
                    { subscriptionPlanId: { $exists: true, $ne: null } } // OR users with a plan ID
                ]
            };

            if (status && status !== 'all') {
                query.subscriptionStatus = status;
            }

            if (userId) {
                query._id = userId;
            }

            if (planId) {
                query.subscriptionPlanId = planId;
            }

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Calculate pagination
            const skip = (page - 1) * limit;
            const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

            // Execute query
            const [users, total] = await Promise.all([
                User.find(query)
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                User.countDocuments(query)
            ]);

            // Get all unique plan IDs
            const planIds = [...new Set(users.map(u => u.subscriptionPlanId).filter(Boolean))];

            // Fetch plans in one query
            const plans = await MembershipPlan.find({
                _id: { $in: planIds }
            }).lean();

            const planMap = new Map(plans.map(p => [p._id.toString(), p]));

            // Transform to match frontend interface
            const subscriptions = users.map(user => {
                const plan = planMap.get(user.subscriptionPlanId?.toString());
                return this.transformUserToSubscription(user, plan);
            });

            // Apply client-side planType filter if needed
            let filteredSubscriptions = subscriptions;
            if (planType && planType !== 'all') {
                filteredSubscriptions = subscriptions.filter(sub =>
                    sub.planType === planType
                );
            }

            return {
                subscriptions: filteredSubscriptions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Get subscriptions service error:', error);
            throw error;
        }
    }

    /**
     * Get single subscription
     */
    async getSubscription(id) {
        try {
            const user = await User.findById(id).lean();
            if (!user || user.isDeleted) {
                return null;
            }

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user, plan);
        } catch (error) {
            console.error('Get subscription service error:', error);
            throw error;
        }
    }

    /**
     * Create new subscription
     */
    async createSubscription(data) {
        try {
            const { userId, planId, billingCycle, price, startDate, endDate } = data;

            // Get user and plan details
            const [user, plan] = await Promise.all([
                User.findById(userId),
                MembershipPlan.findById(planId)
            ]);

            if (!user) throw new Error('User not found');
            if (!plan) throw new Error('Plan not found');

            // Calculate subscription dates
            const subscriptionStartDate = startDate ? new Date(startDate) : new Date();
            let subscriptionEndDate = null;

            if (endDate) {
                subscriptionEndDate = new Date(endDate);
            } else if (billingCycle === 'monthly') {
                subscriptionEndDate = new Date(subscriptionStartDate);
                subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
            } else if (billingCycle === 'annual') {
                subscriptionEndDate = new Date(subscriptionStartDate);
                subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
            }

            // Update user subscription
            user.subscription = plan.displayName || plan.name;
            user.subscriptionPlanId = planId;
            user.subscriptionStatus = 'active';
            user.billingCycle = billingCycle;
            user.subscriptionStartDate = subscriptionStartDate;
            user.subscriptionEndDate = subscriptionEndDate;
            user.nextBillingDate = subscriptionEndDate;
            user.lastPaymentAmount = price || 0;

            await user.save();

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Create subscription service error:', error);
            throw error;
        }
    }

    /**
     * Update subscription
     */
    async updateSubscription(id, updates) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            // Update fields
            if (updates.status) user.subscriptionStatus = updates.status;
            if (updates.price !== undefined) {
                user.lastPaymentAmount = updates.price;
            }
            if (updates.billingCycle) user.billingCycle = updates.billingCycle;
            if (updates.adminNotes) user.notes = updates.adminNotes;
            if (updates.endDate) user.subscriptionEndDate = new Date(updates.endDate);

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Update subscription service error:', error);
            throw error;
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(id, data) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            user.subscriptionStatus = 'cancelled';
            user.cancellationReason = data.reason;
            user.cancelledAt = new Date();

            if (data.immediate) {
                user.subscriptionEndDate = new Date();
            }

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Cancel subscription service error:', error);
            throw error;
        }
    }

    /**
     * Reactivate subscription
     */
    async reactivateSubscription(id) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            user.subscriptionStatus = 'active';
            user.cancelledAt = null;
            user.cancellationReason = null;

            // Extend subscription if needed
            if (!user.subscriptionEndDate || new Date(user.subscriptionEndDate) < new Date()) {
                const newEndDate = new Date();
                if (user.billingCycle === 'monthly') {
                    newEndDate.setMonth(newEndDate.getMonth() + 1);
                } else if (user.billingCycle === 'annual') {
                    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                }
                user.subscriptionEndDate = newEndDate;
                user.nextBillingDate = newEndDate;
            }

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Reactivate subscription service error:', error);
            throw error;
        }
    }

    /**
     * Suspend subscription
     */
    async suspendSubscription(id, reason) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            user.subscriptionStatus = 'suspended';
            user.suspensionReason = reason;
            user.suspendedAt = new Date();

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Suspend subscription service error:', error);
            throw error;
        }
    }

    /**
     * Resume subscription
     */
    async resumeSubscription(id) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            user.subscriptionStatus = 'active';
            user.suspensionReason = null;
            user.suspendedAt = null;

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Resume subscription service error:', error);
            throw error;
        }
    }

    /**
     * Pause subscription
     */
    async pauseSubscription(id, duration, reason) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            const pauseUntil = new Date();
            pauseUntil.setDate(pauseUntil.getDate() + duration);

            user.subscriptionStatus = 'paused';
            user.pauseReason = reason;
            user.pausedAt = new Date();
            user.pausedUntil = pauseUntil;

            // Extend subscription end date by pause duration
            if (user.subscriptionEndDate) {
                const endDate = new Date(user.subscriptionEndDate);
                endDate.setDate(endDate.getDate() + duration);
                user.subscriptionEndDate = endDate;
            }

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Pause subscription service error:', error);
            throw error;
        }
    }

    /**
     * Delete subscription (soft delete)
     */
    async deleteSubscription(id) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            user.isDeleted = true;
            user.deletedAt = new Date();
            await user.save();

            return true;
        } catch (error) {
            console.error('Delete subscription service error:', error);
            throw error;
        }
    }

    /**
     * Change subscription plan
     */
    async changePlan(id, data) {
        try {
            const { newPlanId, billingCycle, effectiveDate, prorationMode } = data;

            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            const newPlan = await MembershipPlan.findById(newPlanId);
            if (!newPlan) {
                throw new Error('Plan not found');
            }

            // If scheduled for future
            if (effectiveDate) {
                user.scheduledPlanChange = {
                    newPlanId,
                    newPlanName: newPlan.displayName || newPlan.name,
                    newBillingCycle: billingCycle,
                    effectiveDate: new Date(effectiveDate),
                    scheduledAt: new Date()
                };
            } else {
                // Immediate change
                const oldPlan = user.subscription;
                const oldBillingCycle = user.billingCycle;

                user.subscriptionPlanId = newPlanId;
                user.subscription = newPlan.displayName || newPlan.name;
                user.billingCycle = billingCycle;

                // Calculate new price
                const pricing = newPlan.pricing[billingCycle];
                const newPrice = pricing?.price || 0;
                user.lastPaymentAmount = billingCycle === 'annual' ? newPrice / 12 : newPrice;

                // Add to plan change history
                if (!user.planChangeHistory) {
                    user.planChangeHistory = [];
                }
                user.planChangeHistory.push({
                    fromPlan: oldPlan,
                    toPlan: user.subscription,
                    fromBillingCycle: oldBillingCycle,
                    toBillingCycle: billingCycle,
                    changeDate: new Date(),
                    priceChange: newPrice
                });
            }

            await user.save();

            return this.transformUserToSubscription(user.toObject(), newPlan);
        } catch (error) {
            console.error('Change plan service error:', error);
            throw error;
        }
    }

    /**
     * Cancel scheduled plan change
     */
    async cancelScheduledPlanChange(id) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            user.scheduledPlanChange = null;
            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Cancel scheduled change service error:', error);
            throw error;
        }
    }

    /**
     * Get user subscriptions
     */
    async getUserSubscriptions(userId) {
        try {
            const user = await User.findById(userId).lean();
            if (!user || user.isDeleted) {
                return [];
            }

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return [this.transformUserToSubscription(user, plan)];
        } catch (error) {
            console.error('Get user subscriptions service error:', error);
            throw error;
        }
    }

    /**
     * Get plan subscriptions
     */
    async getPlanSubscriptions(planId) {
        try {
            const users = await User.find({
                subscriptionPlanId: planId,
                isDeleted: { $ne: true }
            }).lean();

            const plan = await MembershipPlan.findById(planId).lean();

            return users.map(user => this.transformUserToSubscription(user, plan));
        } catch (error) {
            console.error('Get plan subscriptions service error:', error);
            throw error;
        }
    }

    /**
     * Get expiring subscriptions
     */
    async getExpiringSoon(days = 7) {
        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + days);

            const users = await User.find({
                subscriptionStatus: 'active',
                subscriptionEndDate: {
                    $gte: new Date(),
                    $lte: futureDate
                },
                isDeleted: { $ne: true }
            }).lean();

            // Get all unique plan IDs
            const planIds = [...new Set(users.map(u => u.subscriptionPlanId).filter(Boolean))];
            const plans = await MembershipPlan.find({ _id: { $in: planIds } }).lean();
            const planMap = new Map(plans.map(p => [p._id.toString(), p]));

            return users.map(user => {
                const plan = planMap.get(user.subscriptionPlanId?.toString());
                return this.transformUserToSubscription(user, plan);
            });
        } catch (error) {
            console.error('Get expiring subscriptions service error:', error);
            throw error;
        }
    }

    /**
     * Get subscriptions due for renewal
     */
    async getDueForRenewal() {
        try {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

            const users = await User.find({
                subscriptionStatus: 'active',
                nextBillingDate: {
                    $lte: threeDaysFromNow
                },
                isDeleted: { $ne: true }
            }).lean();

            // Get all unique plan IDs
            const planIds = [...new Set(users.map(u => u.subscriptionPlanId).filter(Boolean))];
            const plans = await MembershipPlan.find({ _id: { $in: planIds } }).lean();
            const planMap = new Map(plans.map(p => [p._id.toString(), p]));

            return users.map(user => {
                const plan = planMap.get(user.subscriptionPlanId?.toString());
                return this.transformUserToSubscription(user, plan);
            });
        } catch (error) {
            console.error('Get due for renewal service error:', error);
            throw error;
        }
    }

    /**
     * Get recent activity
     */
    async getRecentActivity(limit = 10) {
        try {
            const users = await User.find({
                role: { $in: ['subscriber', 'user'] },
                isDeleted: { $ne: true }
            })
                .sort({ updatedAt: -1 })
                .limit(limit)
                .lean();

            return users.map(user => ({
                id: user._id.toString(),
                email: user.email,
                userName: user.name || user.email,
                status: user.subscriptionStatus || 'pending',
                planId: user.subscription || 'Basic',
                billingCycle: user.billingCycle || 'monthly',
                mrr: this.calculateUserMRR(user),
                createdAt: user.createdAt,
                updatedAt: user.updatedAt || user.createdAt
            }));
        } catch (error) {
            console.error('Get recent activity service error:', error);
            throw error;
        }
    }

    /**
     * Process renewal
     */
    async processRenewal(id, paymentId) {
        try {
            const user = await User.findById(id);
            if (!user || user.isDeleted) {
                return null;
            }

            // Update billing dates
            const nextBillingDate = new Date(user.nextBillingDate || new Date());

            if (user.billingCycle === 'monthly') {
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            } else if (user.billingCycle === 'annual') {
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            }

            user.lastBillingDate = new Date();
            user.nextBillingDate = nextBillingDate;
            user.subscriptionEndDate = nextBillingDate;
            user.subscriptionStatus = 'active';

            await user.save();

            const plan = user.subscriptionPlanId
                ? await MembershipPlan.findById(user.subscriptionPlanId).lean()
                : null;

            return this.transformUserToSubscription(user.toObject(), plan);
        } catch (error) {
            console.error('Process renewal service error:', error);
            throw error;
        }
    }

    /**
     * Create sample subscriptions for testing
     */
    async createSampleData() {
        try {
            // Get or create sample plans first
            let basicPlan = await MembershipPlan.findOne({ name: 'Basic' });
            let proPlan = await MembershipPlan.findOne({ name: 'Professional' });
            let enterprisePlan = await MembershipPlan.findOne({ name: 'Enterprise' });

            // Create sample users with different subscription states
            const sampleUsers = [
                {
                    name: 'John Doe',
                    email: 'john.doe@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Basic',
                    subscriptionStatus: 'active',
                    subscriptionPlanId: basicPlan?._id,
                    billingCycle: 'monthly',
                    lastPaymentAmount: 29,
                    subscriptionStartDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
                    subscriptionEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                    nextBillingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Jane Smith',
                    email: 'jane.smith@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Professional',
                    subscriptionStatus: 'active',
                    subscriptionPlanId: proPlan?._id,
                    billingCycle: 'annual',
                    lastPaymentAmount: 990,
                    subscriptionStartDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000),
                    nextBillingDate: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Bob Johnson',
                    email: 'bob.johnson@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Basic',
                    subscriptionStatus: 'cancelled',
                    subscriptionPlanId: basicPlan?._id,
                    billingCycle: 'monthly',
                    lastPaymentAmount: 29,
                    subscriptionStartDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    cancelledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    cancellationReason: 'Not using enough'
                },
                {
                    name: 'Alice Williams',
                    email: 'alice.williams@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Professional',
                    subscriptionStatus: 'active',
                    subscriptionPlanId: proPlan?._id,
                    billingCycle: 'monthly',
                    lastPaymentAmount: 99,
                    subscriptionStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                    nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Charlie Brown',
                    email: 'charlie.brown@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Enterprise',
                    subscriptionStatus: 'active',
                    subscriptionPlanId: enterprisePlan?._id,
                    billingCycle: 'annual',
                    lastPaymentAmount: 2490,
                    subscriptionStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
                    nextBillingDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Diana Prince',
                    email: 'diana.prince@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Basic',
                    subscriptionStatus: 'suspended',
                    subscriptionPlanId: basicPlan?._id,
                    billingCycle: 'monthly',
                    lastPaymentAmount: 29,
                    subscriptionStartDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                    suspendedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    suspensionReason: 'Payment failed'
                },
                {
                    name: 'Ethan Hunt',
                    email: 'ethan.hunt@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Professional',
                    subscriptionStatus: 'active',
                    subscriptionPlanId: proPlan?._id,
                    billingCycle: 'monthly',
                    lastPaymentAmount: 99,
                    subscriptionStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Expiring soon!
                    nextBillingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Fiona Green',
                    email: 'fiona.green@sample.com',
                    password: 'Sample@123',
                    role: 'subscriber',
                    subscription: 'Basic',
                    subscriptionStatus: 'paused',
                    subscriptionPlanId: basicPlan?._id,
                    billingCycle: 'monthly',
                    lastPaymentAmount: 29,
                    subscriptionStartDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                    subscriptionEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                    pausedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                    pausedUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                    pauseReason: 'Vacation'
                }
            ];

            const createdUsers = [];

            for (const userData of sampleUsers) {
                // Check if user already exists
                const existing = await User.findOne({ email: userData.email });
                if (!existing) {
                    const user = await User.create(userData);
                    createdUsers.push(user);
                }
            }

            return {
                success: true,
                message: `Sample data created: ${createdUsers.length} subscriptions`,
                data: {
                    created: createdUsers.length,
                    total: sampleUsers.length
                }
            };
        } catch (error) {
            console.error('Create sample data service error:', error);
            throw error;
        }
    }

    /**
     * Create sample audit logs for testing
     */
    async createSampleAuditLogs() {
        try {
            // Get sample admin user for actor
            const adminUser = await User.findOne({ role: { $in: ['admin', 'superAdmin'] } });
            if (!adminUser) {
                throw new Error('No admin user found for creating sample logs');
            }

            // Get some sample subscriptions
            const sampleSubscriptions = await User.find({
                role: { $in: ['subscriber', 'user'] }
            }).limit(5);

            if (sampleSubscriptions.length === 0) {
                throw new Error('No subscriptions found. Please create sample data first.');
            }

            const actions = ['CREATE', 'UPDATE', 'CANCEL', 'REACTIVATE', 'SUSPEND', 'RESUME', 'PAUSE', 'RENEW', 'PLAN_CHANGE'];
            const createdLogs = [];

            for (let i = 0; i < 20; i++) {
                const action = actions[i % actions.length];
                const subscription = sampleSubscriptions[i % sampleSubscriptions.length];
                const hoursAgo = i * 2; // Spread logs over time

                const log = await AuditLog.logAction({
                    action,
                    resource: 'subscription',
                    resourceId: subscription._id,
                    resourceType: 'User',
                    actor: adminUser._id,
                    actorEmail: adminUser.email,
                    actorName: adminUser.name || adminUser.email,
                    actorRole: adminUser.role,
                    description: `${action} subscription for ${subscription.name || subscription.email}`,
                    changes: {
                        status: subscription.subscriptionStatus,
                        plan: subscription.subscription
                    },
                    metadata: {
                        ipAddress: '127.0.0.1',
                        userAgent: 'Sample Data Generator',
                        endpoint: '/api/subscription/' + subscription._id,
                        method: 'POST',
                        duration: Math.floor(Math.random() * 500),
                        success: true
                    },
                    timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
                });

                if (log) createdLogs.push(log);
            }

            return {
                success: true,
                message: `Created ${createdLogs.length} sample audit logs`,
                data: {
                    created: createdLogs.length
                }
            };
        } catch (error) {
            console.error('Create sample audit logs service error:', error);
            throw error;
        }
    }
}

module.exports = new SubscriptionDashboardService();
