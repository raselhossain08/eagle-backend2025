const Subscription = require('../../subscription/models/subscription.model');
const User = require('../../user/models/user.model');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Admin Stripe Subscription Management Controller
 * Dashboard  Stripe subscriptions manage  
 */

/**
 * Get All Stripe Subscriptions
 * @route GET /api/admin/stripe/subscriptions
 * @access Admin
 */
exports.getAllStripeSubscriptions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {
            stripeSubscriptionId: { $exists: true, $ne: null }
        };

        // Filter by status
        if (status && status !== 'all') {
            query.status = status;
        }

        // Search by user email or name
        if (search) {
            const users = await User.find({
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            query.userId = { $in: users.map(u => u._id) };
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const subscriptions = await Subscription.find(query)
            .populate('userId', 'firstName lastName email stripeCustomerId')
            .populate('planId', 'name price billingCycle')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Subscription.countDocuments(query);

        // Get summary statistics
        const stats = await Subscription.aggregate([
            { $match: { stripeSubscriptionId: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalPaid' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                subscriptions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                stats: stats.reduce((acc, stat) => {
                    acc[stat._id] = {
                        count: stat.count,
                        revenue: stat.totalRevenue
                    };
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('❌ Error fetching Stripe subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions',
            error: error.message
        });
    }
};

/**
 * Get Single Stripe Subscription Details
 * @route GET /api/admin/stripe/subscriptions/:id
 * @access Admin
 */
exports.getStripeSubscription = async (req, res) => {
    try {
        const { id } = req.params;

        const subscription = await Subscription.findById(id)
            .populate('userId', 'firstName lastName email phone stripeCustomerId')
            .populate('planId', 'name description price billingCycle features')
            .lean();

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        // Get Stripe subscription details
        let stripeDetails = null;
        if (subscription.stripeSubscriptionId) {
            try {
                stripeDetails = await stripe.subscriptions.retrieve(
                    subscription.stripeSubscriptionId,
                    { expand: ['latest_invoice', 'default_payment_method'] }
                );
            } catch (error) {
                console.error('⚠️ Failed to fetch Stripe details:', error.message);
            }
        }

        // Get payment history from Stripe
        let paymentHistory = [];
        if (subscription.userId.stripeCustomerId) {
            try {
                const invoices = await stripe.invoices.list({
                    customer: subscription.userId.stripeCustomerId,
                    subscription: subscription.stripeSubscriptionId,
                    limit: 10
                });
                paymentHistory = invoices.data;
            } catch (error) {
                console.error('⚠️ Failed to fetch payment history:', error.message);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                subscription,
                stripeDetails,
                paymentHistory
            }
        });

    } catch (error) {
        console.error('❌ Error fetching subscription details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription details',
            error: error.message
        });
    }
};

/**
 * Sync Subscription with Stripe
 * @route POST /api/admin/stripe/subscriptions/:id/sync
 * @access Admin
 */
exports.syncSubscription = async (req, res) => {
    try {
        const { id } = req.params;

        const subscription = await Subscription.findById(id);
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'This subscription is not linked to Stripe'
            });
        }

        // Fetch from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(
            subscription.stripeSubscriptionId
        );

        // Update local database
        subscription.status = mapStripeStatus(stripeSubscription.status);
        subscription.currentPrice = stripeSubscription.items.data[0]?.price.unit_amount / 100;
        subscription.nextBillingDate = new Date(stripeSubscription.current_period_end * 1000);
        subscription.autoRenew = !stripeSubscription.cancel_at_period_end;

        if (stripeSubscription.canceled_at) {
            subscription.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
        }

        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Subscription synced successfully',
            data: subscription
        });

    } catch (error) {
        console.error('❌ Error syncing subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync subscription',
            error: error.message
        });
    }
};

/**
 * Cancel Stripe Subscription
 * @route POST /api/admin/stripe/subscriptions/:id/cancel
 * @access Admin
 */
exports.cancelSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, immediately = false } = req.body;

        const subscription = await Subscription.findById(id)
            .populate('userId', 'email firstName lastName');

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'This subscription is not linked to Stripe'
            });
        }

        // Cancel in Stripe
        const cancelOptions = {
            cancellation_details: {
                comment: reason || 'Canceled by admin'
            }
        };

        let stripeSubscription;
        if (immediately) {
            // Cancel immediately
            stripeSubscription = await stripe.subscriptions.cancel(
                subscription.stripeSubscriptionId,
                cancelOptions
            );
        } else {
            // Cancel at period end
            stripeSubscription = await stripe.subscriptions.update(
                subscription.stripeSubscriptionId,
                {
                    cancel_at_period_end: true,
                    ...cancelOptions
                }
            );
        }

        // Update local database
        subscription.status = immediately ? 'canceled' : 'active';
        subscription.autoRenew = false;
        subscription.canceledAt = new Date();
        subscription.cancellationReason = 'admin_action';
        subscription.cancellationNote = reason;

        if (immediately) {
            subscription.endDate = new Date();
        } else {
            subscription.endDate = new Date(stripeSubscription.current_period_end * 1000);
        }

        await subscription.save();

        res.status(200).json({
            success: true,
            message: immediately
                ? 'Subscription canceled immediately'
                : 'Subscription will cancel at period end',
            data: subscription
        });

    } catch (error) {
        console.error('❌ Error canceling subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: error.message
        });
    }
};

/**
 * Resume/Reactivate Stripe Subscription
 * @route POST /api/admin/stripe/subscriptions/:id/resume
 * @access Admin
 */
exports.resumeSubscription = async (req, res) => {
    try {
        const { id } = req.params;

        const subscription = await Subscription.findById(id);
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'This subscription is not linked to Stripe'
            });
        }

        // Resume in Stripe (remove cancel_at_period_end)
        const stripeSubscription = await stripe.subscriptions.update(
            subscription.stripeSubscriptionId,
            { cancel_at_period_end: false }
        );

        // Update local database
        subscription.status = 'active';
        subscription.autoRenew = true;
        subscription.canceledAt = null;
        subscription.endDate = null;

        await subscription.save();

        res.status(200).json({
            success: true,
            message: 'Subscription resumed successfully',
            data: subscription
        });

    } catch (error) {
        console.error('❌ Error resuming subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resume subscription',
            error: error.message
        });
    }
};

/**
 * Refund Last Payment
 * @route POST /api/admin/stripe/subscriptions/:id/refund
 * @access Admin
 */
exports.refundLastPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, reason = 'requested_by_customer' } = req.body;

        const subscription = await Subscription.findById(id)
            .populate('userId', 'stripeCustomerId email');

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        if (!subscription.stripeSubscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'This subscription is not linked to Stripe'
            });
        }

        // Get latest invoice
        const invoices = await stripe.invoices.list({
            customer: subscription.userId.stripeCustomerId,
            subscription: subscription.stripeSubscriptionId,
            limit: 1
        });

        if (invoices.data.length === 0 || !invoices.data[0].payment_intent) {
            return res.status(404).json({
                success: false,
                message: 'No payment found to refund'
            });
        }

        // Create refund
        const refund = await stripe.refunds.create({
            payment_intent: invoices.data[0].payment_intent,
            amount: amount ? Math.round(amount * 100) : undefined, // Full refund if amount not specified
            reason: reason,
            metadata: {
                subscriptionId: subscription._id.toString(),
                refundedBy: req.user._id.toString(),
                refundedByEmail: req.user.email
            }
        });

        res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: {
                refund,
                amount: refund.amount / 100,
                currency: refund.currency
            }
        });

    } catch (error) {
        console.error('❌ Error processing refund:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund',
            error: error.message
        });
    }
};

/**
 * Get Stripe Dashboard Statistics
 * @route GET /api/admin/stripe/stats
 * @access Admin
 */
exports.getStripeStats = async (req, res) => {
    try {
        // Get subscription statistics
        const subscriptionStats = await Subscription.aggregate([
            { $match: { stripeSubscriptionId: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: null,
                    totalSubscriptions: { $sum: 1 },
                    activeSubscriptions: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    trialSubscriptions: {
                        $sum: { $cond: [{ $eq: ['$status', 'trial'] }, 1, 0] }
                    },
                    pastDueSubscriptions: {
                        $sum: { $cond: [{ $eq: ['$status', 'past_due'] }, 1, 0] }
                    },
                    canceledSubscriptions: {
                        $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] }
                    },
                    totalRevenue: { $sum: '$totalPaid' },
                    averageRevenue: { $avg: '$totalPaid' }
                }
            }
        ]);

        // Get MRR (Monthly Recurring Revenue)
        const mrrStats = await Subscription.aggregate([
            {
                $match: {
                    stripeSubscriptionId: { $exists: true, $ne: null },
                    status: { $in: ['active', 'trial'] }
                }
            },
            {
                $project: {
                    mrr: {
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
            },
            {
                $group: {
                    _id: null,
                    totalMRR: { $sum: '$mrr' }
                }
            }
        ]);

        // Get recent activities
        const recentSubscriptions = await Subscription.find({
            stripeSubscriptionId: { $exists: true, $ne: null }
        })
            .populate('userId', 'firstName lastName email')
            .populate('planId', 'name price')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        res.status(200).json({
            success: true,
            data: {
                stats: subscriptionStats[0] || {},
                mrr: mrrStats[0]?.totalMRR || 0,
                recentSubscriptions
            }
        });

    } catch (error) {
        console.error('❌ Error fetching Stripe stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

/**
 * Helper function to map Stripe status to our status
 */
function mapStripeStatus(stripeStatus) {
    const statusMap = {
        'incomplete': 'incomplete',
        'incomplete_expired': 'incomplete_expired',
        'trialing': 'trial',
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'canceled',
        'unpaid': 'suspended'
    };
    return statusMap[stripeStatus] || 'active';
}
