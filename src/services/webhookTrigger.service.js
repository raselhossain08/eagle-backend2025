const Webhook = require('../models/Webhook');
const { deliverWebhook } = require('../controllers/webhookController');

/**
 * Webhook Trigger Service
 * Automatically triggers webhooks when specific events occur in the system
 */
class WebhookTriggerService {

    /**
     * Trigger webhooks for a specific event
     * @param {string} eventName - Name of the event (e.g., 'payment.created')
     * @param {object} payload - Event payload data
     * @param {string} userId - Optional user ID who triggered the event
     */
    async triggerEvent(eventName, payload, userId = null) {
        try {
            console.log(`🔔 Webhook Event: ${eventName}`);

            // Find all enabled webhooks that are subscribed to this event
            const webhooks = await Webhook.find({
                events: eventName,
                enabled: true,
                status: 'active'
            });

            if (webhooks.length === 0) {
                console.log(`No active webhooks found for event: ${eventName}`);
                return {
                    success: true,
                    webhooksTriggered: 0,
                    message: 'No active webhooks for this event'
                };
            }

            console.log(`Found ${webhooks.length} webhook(s) for event: ${eventName}`);

            // Prepare event payload
            const eventPayload = {
                event: eventName,
                timestamp: new Date().toISOString(),
                data: payload,
                triggeredBy: userId
            };

            // Trigger all webhooks (don't wait for completion)
            const deliveryPromises = webhooks.map(webhook =>
                deliverWebhook(webhook, eventName, eventPayload)
                    .catch(error => {
                        console.error(`Failed to deliver webhook ${webhook.name}:`, error.message);
                        return { success: false, error: error.message };
                    })
            );

            // Don't block - fire and forget (webhooks are async)
            Promise.all(deliveryPromises).then(results => {
                const successCount = results.filter(r => r.success).length;
                console.log(`✅ Webhooks delivered: ${successCount}/${webhooks.length} for event: ${eventName}`);
            });

            return {
                success: true,
                webhooksTriggered: webhooks.length,
                message: `${webhooks.length} webhook(s) triggered`
            };

        } catch (error) {
            console.error(`Error triggering webhook event ${eventName}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Payment Events
     */
    async onPaymentCreated(payment) {
        return this.triggerEvent('payment.created', {
            id: payment._id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            userId: payment.user,
            planId: payment.plan,
            metadata: payment.metadata
        }, payment.user);
    }

    async onPaymentUpdated(payment) {
        return this.triggerEvent('payment.updated', {
            id: payment._id,
            amount: payment.amount,
            status: payment.status,
            previousStatus: payment.previousStatus,
            userId: payment.user
        }, payment.user);
    }

    async onPaymentCompleted(payment) {
        return this.triggerEvent('payment.completed', {
            id: payment._id,
            amount: payment.amount,
            currency: payment.currency,
            userId: payment.user,
            planId: payment.plan,
            completedAt: new Date().toISOString()
        }, payment.user);
    }

    async onPaymentFailed(payment, reason) {
        return this.triggerEvent('payment.failed', {
            id: payment._id,
            amount: payment.amount,
            userId: payment.user,
            reason: reason,
            failedAt: new Date().toISOString()
        }, payment.user);
    }

    /**
     * Subscription Events
     */
    async onSubscriptionCreated(subscription) {
        return this.triggerEvent('subscription.created', {
            id: subscription._id,
            userId: subscription.userId,
            planId: subscription.planId,
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            amount: subscription.amount
        }, subscription.userId);
    }

    async onSubscriptionUpdated(subscription, changes) {
        return this.triggerEvent('subscription.updated', {
            id: subscription._id,
            userId: subscription.userId,
            status: subscription.status,
            changes: changes,
            updatedAt: new Date().toISOString()
        }, subscription.userId);
    }

    async onSubscriptionCancelled(subscription, reason) {
        return this.triggerEvent('subscription.cancelled', {
            id: subscription._id,
            userId: subscription.userId,
            planId: subscription.planId,
            cancelledAt: new Date().toISOString(),
            reason: reason
        }, subscription.userId);
    }

    async onSubscriptionExpired(subscription) {
        return this.triggerEvent('subscription.expired', {
            id: subscription._id,
            userId: subscription.userId,
            planId: subscription.planId,
            expiredAt: new Date().toISOString()
        }, subscription.userId);
    }

    /**
     * User Events
     */
    async onUserCreated(user) {
        return this.triggerEvent('user.created', {
            id: user._id,
            email: user.email,
            name: user.name || user.fullName,
            role: user.role,
            source: user.source,
            createdAt: user.createdAt
        });
    }

    async onUserUpdated(user, changes) {
        return this.triggerEvent('user.updated', {
            id: user._id,
            email: user.email,
            changes: changes,
            updatedAt: new Date().toISOString()
        }, user._id);
    }

    async onUserDeleted(userId, email) {
        return this.triggerEvent('user.deleted', {
            id: userId,
            email: email,
            deletedAt: new Date().toISOString()
        });
    }

    /**
     * Transaction Events
     */
    async onTransactionCreated(transaction) {
        return this.triggerEvent('transaction.created', {
            id: transaction._id,
            userId: transaction.userId,
            amount: transaction.amount,
            type: transaction.type,
            status: transaction.status,
            gateway: transaction.paymentGateway,
            createdAt: transaction.createdAt
        }, transaction.userId);
    }

    async onTransactionCompleted(transaction) {
        return this.triggerEvent('transaction.completed', {
            id: transaction._id,
            userId: transaction.userId,
            amount: transaction.amount,
            type: transaction.type,
            gateway: transaction.paymentGateway,
            completedAt: new Date().toISOString()
        }, transaction.userId);
    }

    /**
     * Batch trigger for multiple events
     */
    async triggerMultipleEvents(events) {
        const results = [];

        for (const event of events) {
            const result = await this.triggerEvent(event.eventName, event.payload, event.userId);
            results.push({
                event: event.eventName,
                ...result
            });
        }

        return results;
    }

    /**
     * Get webhook trigger statistics
     */
    async getTriggerStats(startDate, endDate) {
        const deliveries = await require('../models/WebhookDelivery').aggregate([
            {
                $match: {
                    deliveredAt: {
                        $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                        $lte: endDate || new Date()
                    }
                }
            },
            {
                $group: {
                    _id: '$event',
                    count: { $sum: 1 },
                    successful: {
                        $sum: { $cond: ['$success', 1, 0] }
                    },
                    failed: {
                        $sum: { $cond: ['$success', 0, 1] }
                    },
                    avgDuration: { $avg: '$duration' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        return deliveries;
    }
}

module.exports = new WebhookTriggerService();
