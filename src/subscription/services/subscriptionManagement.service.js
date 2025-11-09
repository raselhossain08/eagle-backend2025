/**
 * Subscription Dashboard Management Service
 * Works with User model to provide subscription management for admin dashboard
 * Transforms User data to match frontend subscription interface
 */

const User = require('../../user/models/user.model');
const MembershipPlan = require('../models/membershipPlan.model');
const Subscription = require('../models/subscription.model');
const mongoose = require('mongoose');

class SubscriptionManagementService {

    /**
     * Transform User to Subscription format for frontend
     */
    transformUserToSubscription(user, plan = null) {
        const mrr = this.calculateUserMRR(user);

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
            subscription: user.subscription || 'Basic',
            subscriptionStatus: user.subscriptionStatus || 'pending',
            currentPlan: user.subscription || 'Basic',
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
            planChangeHistory: [],
            scheduledPlanChange: null
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
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

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
     * Process subscription renewal
     */
    async processSubscriptionRenewal(subscriptionId, paymentData = {}) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            console.log('🔄 Processing subscription renewal...', { subscriptionId });

            const subscription = await Subscription.findById(subscriptionId)
                .populate('planId')
                .populate('userId')
                .session(session);

            if (!subscription) {
                throw new Error('Subscription not found');
            }

            if (!['active', 'past_due', 'trial'].includes(subscription.status)) {
                throw new Error('Subscription is not renewable');
            }

            // Calculate new billing period
            const currentDate = new Date();
            const nextBillingDate = this.calculateNextBillingDate(
                currentDate,
                subscription.billingCycle
            );

            // Update subscription
            subscription.lastBillingDate = currentDate;
            subscription.nextBillingDate = nextBillingDate;
            subscription.status = 'active';
            subscription.billingAttempts = 0; // Reset billing attempts

            await subscription.save({ session });

            // Create renewal transaction
            let renewalTransaction = null;
            if (paymentData.amount && paymentData.amount > 0) {
                const paymentTransactionService = new PaymentTransactionService();
                const transactionResult = await paymentTransactionService.createSubscriptionTransaction(
                    {
                        ...paymentData,
                        type: 'renewal'
                    },
                    {
                        _id: subscription._id,
                        planName: subscription.planId.name,
                        planId: subscription.planId._id,
                        billingCycle: subscription.billingCycle,
                        amount: subscription.currentPrice
                    },
                    subscription.userId
                );
                renewalTransaction = transactionResult.transaction;
            }

            // Update user billing info
            await User.findByIdAndUpdate(
                subscription.userId._id,
                {
                    nextBillingDate,
                    lastBillingDate: currentDate,
                    subscriptionEndDate: nextBillingDate
                },
                { session }
            );

            await session.commitTransaction();

            console.log('✅ Subscription renewed successfully:', {
                subscriptionId: subscription._id,
                nextBillingDate,
                transactionId: renewalTransaction?.transactionId
            });

            return {
                success: true,
                subscription,
                transaction: renewalTransaction,
                message: 'Subscription renewed successfully'
            };

        } catch (error) {
            await session.abortTransaction();
            console.error('❌ Failed to renew subscription:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(subscriptionId, cancellationData = {}) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            console.log('⏹️ Canceling subscription...', { subscriptionId });

            const subscription = await Subscription.findById(subscriptionId)
                .populate('planId')
                .populate('userId')
                .session(session);

            if (!subscription) {
                throw new Error('Subscription not found');
            }

            if (subscription.status === 'canceled') {
                throw new Error('Subscription is already canceled');
            }

            const cancelDate = new Date();
            const { reason = 'voluntary', note, effectiveDate } = cancellationData;

            // Determine cancellation effective date
            let cancelEffectiveDate = cancelDate;
            if (effectiveDate) {
                cancelEffectiveDate = new Date(effectiveDate);
            } else if (subscription.planId.subscriptionRules.cancellationPolicy === 'end_of_period') {
                cancelEffectiveDate = subscription.nextBillingDate || subscription.endDate;
            }

            // Update subscription
            subscription.status = cancelEffectiveDate <= cancelDate ? 'canceled' : 'active';
            subscription.canceledAt = cancelDate;
            subscription.cancellationReason = reason;
            subscription.cancellationNote = note;
            subscription.endDate = cancelEffectiveDate;
            subscription.autoRenew = false;

            // Add cancellation to scheduled changes if future date
            if (cancelEffectiveDate > cancelDate) {
                subscription.scheduledChanges.push({
                    changeType: 'cancellation',
                    scheduledDate: cancelEffectiveDate,
                    reason: `Cancellation scheduled: ${reason}`,
                    createdBy: cancellationData.userId || null
                });
            }

            await subscription.save({ session });

            // Update user subscription info
            await User.findByIdAndUpdate(
                subscription.userId._id,
                {
                    subscriptionStatus: subscription.status,
                    subscriptionEndDate: cancelEffectiveDate
                },
                { session }
            );

            await session.commitTransaction();

            console.log('✅ Subscription canceled successfully:', {
                subscriptionId: subscription._id,
                cancelDate,
                effectiveDate: cancelEffectiveDate,
                reason
            });

            return {
                success: true,
                subscription,
                canceledAt: cancelDate,
                effectiveDate: cancelEffectiveDate,
                message: `Subscription ${cancelEffectiveDate <= cancelDate ? 'canceled immediately' : 'scheduled for cancellation'}`
            };

        } catch (error) {
            await session.abortTransaction();
            console.error('❌ Failed to cancel subscription:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Upgrade subscription to higher plan
     */
    async upgradeSubscription(subscriptionId, newPlanId, upgradeData = {}) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            console.log('⬆️ Upgrading subscription...', { subscriptionId, newPlanId });

            const [subscription, newPlan] = await Promise.all([
                Subscription.findById(subscriptionId)
                    .populate('planId')
                    .populate('userId')
                    .session(session),
                MembershipPlan.findById(newPlanId).session(session)
            ]);

            if (!subscription || !newPlan) {
                throw new Error('Subscription or new plan not found');
            }

            if (!subscription.isActive()) {
                throw new Error('Only active subscriptions can be upgraded');
            }

            const currentPlan = subscription.planId;
            const newPrice = newPlan.getPriceForCycle(subscription.billingCycle);
            const currentPrice = subscription.currentPrice;

            // Calculate proration if immediate upgrade
            let proratedCredit = 0;
            let immediateCharge = 0;

            if (newPlan.subscriptionRules.upgradePolicy === 'immediate' || upgradeData.immediate) {
                const remainingDays = this.calculateRemainingDays(subscription.nextBillingDate);
                const totalDaysInCycle = this.getDaysInBillingCycle(subscription.billingCycle);

                // Credit for unused portion of current plan
                proratedCredit = (currentPrice * remainingDays) / totalDaysInCycle;

                // Charge for new plan prorated
                immediateCharge = (newPrice * remainingDays) / totalDaysInCycle;

                // Net charge
                const netCharge = immediateCharge - proratedCredit;
                immediateCharge = Math.max(0, netCharge);
            }

            // Update subscription
            subscription.planId = newPlan._id;
            subscription.currentPrice = newPrice;
            subscription.proratedCredits += proratedCredit;

            // Add to metadata
            subscription.metadata.set('previousPlan', currentPlan.name);
            subscription.metadata.set('upgradeDate', new Date().toISOString());
            subscription.metadata.set('upgradeReason', upgradeData.reason || 'user_request');

            await subscription.save({ session });

            // Update user plan info
            await User.findByIdAndUpdate(
                subscription.userId._id,
                {
                    subscriptionPlanId: newPlan._id,
                    subscription: newPlan.name
                },
                { session }
            );

            // Process immediate payment if required
            let upgradeTransaction = null;
            if (immediateCharge > 0 && upgradeData.paymentData) {
                const paymentTransactionService = new PaymentTransactionService();
                const transactionResult = await paymentTransactionService.createSubscriptionTransaction(
                    {
                        ...upgradeData.paymentData,
                        amount: Math.round(immediateCharge * 100), // Convert to cents
                        type: 'upgrade'
                    },
                    {
                        _id: subscription._id,
                        planName: newPlan.name,
                        planId: newPlan._id,
                        billingCycle: subscription.billingCycle,
                        amount: immediateCharge
                    },
                    subscription.userId
                );
                upgradeTransaction = transactionResult.transaction;
            }

            await session.commitTransaction();

            console.log('✅ Subscription upgraded successfully:', {
                subscriptionId: subscription._id,
                fromPlan: currentPlan.name,
                toPlan: newPlan.name,
                immediateCharge,
                proratedCredit
            });

            return {
                success: true,
                subscription,
                transaction: upgradeTransaction,
                upgrade: {
                    fromPlan: currentPlan.name,
                    toPlan: newPlan.name,
                    proratedCredit,
                    immediateCharge
                },
                message: 'Subscription upgraded successfully'
            };

        } catch (error) {
            await session.abortTransaction();
            console.error('❌ Failed to upgrade subscription:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Downgrade subscription to lower plan
     */
    async downgradeSubscription(subscriptionId, newPlanId, downgradeData = {}) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            console.log('⬇️ Downgrading subscription...', { subscriptionId, newPlanId });

            const [subscription, newPlan] = await Promise.all([
                Subscription.findById(subscriptionId)
                    .populate('planId')
                    .populate('userId')
                    .session(session),
                MembershipPlan.findById(newPlanId).session(session)
            ]);

            if (!subscription || !newPlan) {
                throw new Error('Subscription or new plan not found');
            }

            if (!subscription.isActive()) {
                throw new Error('Only active subscriptions can be downgraded');
            }

            const currentPlan = subscription.planId;
            const newPrice = newPlan.getPriceForCycle(subscription.billingCycle);

            // Determine downgrade timing
            const downgradePolicy = currentPlan.subscriptionRules.downgradePolicy || 'end_of_period';
            const immediateDowngrade = downgradePolicy === 'immediate' || downgradeData.immediate;

            if (immediateDowngrade) {
                // Immediate downgrade
                subscription.planId = newPlan._id;
                subscription.currentPrice = newPrice;

                // Calculate credit for remaining period
                const remainingDays = this.calculateRemainingDays(subscription.nextBillingDate);
                const totalDaysInCycle = this.getDaysInBillingCycle(subscription.billingCycle);
                const currentPrice = subscription.currentPrice;

                const currentPlanCredit = (currentPrice * remainingDays) / totalDaysInCycle;
                const newPlanCharge = (newPrice * remainingDays) / totalDaysInCycle;
                const netCredit = currentPlanCredit - newPlanCharge;

                subscription.proratedCredits += Math.max(0, netCredit);

                await subscription.save({ session });

                // Update user immediately
                await User.findByIdAndUpdate(
                    subscription.userId._id,
                    {
                        subscriptionPlanId: newPlan._id,
                        subscription: newPlan.name
                    },
                    { session }
                );

            } else {
                // Schedule downgrade for end of current period
                const effectiveDate = subscription.nextBillingDate;

                subscription.scheduledChanges.push({
                    changeType: 'plan_change',
                    newPlanId: newPlan._id,
                    scheduledDate: effectiveDate,
                    reason: `Downgrade to ${newPlan.name}`,
                    createdBy: downgradeData.userId || null
                });

                await subscription.save({ session });
            }

            // Add metadata
            subscription.metadata.set('previousPlan', currentPlan.name);
            subscription.metadata.set('downgradeDate', new Date().toISOString());
            subscription.metadata.set('downgradeType', immediateDowngrade ? 'immediate' : 'scheduled');

            await subscription.save({ session });

            await session.commitTransaction();

            console.log('✅ Subscription downgrade processed:', {
                subscriptionId: subscription._id,
                fromPlan: currentPlan.name,
                toPlan: newPlan.name,
                type: immediateDowngrade ? 'immediate' : 'scheduled'
            });

            return {
                success: true,
                subscription,
                downgrade: {
                    fromPlan: currentPlan.name,
                    toPlan: newPlan.name,
                    type: immediateDowngrade ? 'immediate' : 'scheduled',
                    effectiveDate: immediateDowngrade ? new Date() : subscription.nextBillingDate
                },
                message: `Subscription ${immediateDowngrade ? 'downgraded immediately' : 'scheduled for downgrade'}`
            };

        } catch (error) {
            await session.abortTransaction();
            console.error('❌ Failed to downgrade subscription:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Pause subscription
     */
    async pauseSubscription(subscriptionId, pauseData = {}) {
        try {
            console.log('⏸️ Pausing subscription...', { subscriptionId });

            const subscription = await Subscription.findById(subscriptionId);
            if (!subscription) {
                throw new Error('Subscription not found');
            }

            if (!subscription.isActive()) {
                throw new Error('Only active subscriptions can be paused');
            }

            const pauseDate = new Date();
            const { reason, pausedUntil } = pauseData;

            subscription.status = 'paused';
            subscription.pausedAt = pauseDate;
            subscription.pauseReason = reason;
            subscription.pausedUntil = pausedUntil ? new Date(pausedUntil) : null;
            subscription.autoRenew = false;

            await subscription.save();

            // Update user status
            await User.findByIdAndUpdate(subscription.userId, {
                subscriptionStatus: 'paused'
            });

            console.log('✅ Subscription paused successfully:', {
                subscriptionId: subscription._id,
                pausedAt: pauseDate,
                pausedUntil
            });

            return {
                success: true,
                subscription,
                pausedAt: pauseDate,
                pausedUntil,
                message: 'Subscription paused successfully'
            };

        } catch (error) {
            console.error('❌ Failed to pause subscription:', error);
            throw error;
        }
    }

    /**
     * Resume subscription
     */
    async resumeSubscription(subscriptionId) {
        try {
            console.log('▶️ Resuming subscription...', { subscriptionId });

            const subscription = await Subscription.findById(subscriptionId);
            if (!subscription) {
                throw new Error('Subscription not found');
            }

            if (subscription.status !== 'paused') {
                throw new Error('Only paused subscriptions can be resumed');
            }

            const resumeDate = new Date();

            subscription.status = 'active';
            subscription.resumedAt = resumeDate;
            subscription.pausedAt = null;
            subscription.pauseReason = null;
            subscription.pausedUntil = null;
            subscription.autoRenew = true;

            // Recalculate next billing date if needed
            if (!subscription.nextBillingDate || subscription.nextBillingDate <= resumeDate) {
                subscription.nextBillingDate = this.calculateNextBillingDate(
                    resumeDate,
                    subscription.billingCycle
                );
            }

            await subscription.save();

            // Update user status
            await User.findByIdAndUpdate(subscription.userId, {
                subscriptionStatus: 'active',
                nextBillingDate: subscription.nextBillingDate
            });

            console.log('✅ Subscription resumed successfully:', {
                subscriptionId: subscription._id,
                resumedAt: resumeDate,
                nextBillingDate: subscription.nextBillingDate
            });

            return {
                success: true,
                subscription,
                resumedAt: resumeDate,
                message: 'Subscription resumed successfully'
            };

        } catch (error) {
            console.error('❌ Failed to resume subscription:', error);
            throw error;
        }
    }

    /**
     * Get subscriptions due for renewal
     */
    async getSubscriptionsDueForRenewal(lookAheadDays = 3) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() + lookAheadDays);

            const dueSubscriptions = await Subscription.find({
                status: 'active',
                autoRenew: true,
                nextBillingDate: { $lte: cutoffDate }
            })
                .populate('userId', 'name email')
                .populate('planId', 'name pricing')
                .sort({ nextBillingDate: 1 });

            return {
                success: true,
                count: dueSubscriptions.length,
                subscriptions: dueSubscriptions,
                cutoffDate
            };

        } catch (error) {
            console.error('❌ Failed to get due renewals:', error);
            throw error;
        }
    }

    // Helper Methods

    /**
     * Calculate next billing date based on cycle
     */
    calculateNextBillingDate(fromDate, billingCycle, trialEndDate = null) {
        const startDate = trialEndDate || fromDate;
        const nextDate = new Date(startDate);

        switch (billingCycle) {
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'quarterly':
                nextDate.setMonth(nextDate.getMonth() + 3);
                break;
            case 'semiannual':
                nextDate.setMonth(nextDate.getMonth() + 6);
                break;
            case 'annual':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            default:
                nextDate.setMonth(nextDate.getMonth() + 1);
        }

        return nextDate;
    }

    /**
     * Calculate remaining days until next billing
     */
    calculateRemainingDays(nextBillingDate) {
        const now = new Date();
        const timeDiff = new Date(nextBillingDate).getTime() - now.getTime();
        return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    }

    /**
     * Get total days in billing cycle
     */
    getDaysInBillingCycle(billingCycle) {
        switch (billingCycle) {
            case 'weekly': return 7;
            case 'monthly': return 30;
            case 'quarterly': return 90;
            case 'semiannual': return 180;
            case 'annual': return 365;
            default: return 30;
        }
    }
}

module.exports = new SubscriptionManagementService();