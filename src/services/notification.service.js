const Notification = require('../models/notification.model');

/**
 * Notification Service
 * Helper service for creating notifications across the application
 */
class NotificationService {
    /**
     * Create a notification for a user
     */
    static async createNotification({
        userId,
        title,
        message,
        type = 'info',
        link = null,
        data = null,
        category = 'general',
        priority = 'normal',
        expiresAt = null
    }) {
        try {
            return await Notification.createNotification({
                userId,
                title,
                message,
                type,
                link,
                data,
                category,
                priority,
                expiresAt
            });
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }

    /**
     * Notify user of new subscription
     */
    static async notifyNewSubscription(userId, subscriptionData) {
        return await this.createNotification({
            userId,
            title: 'New Subscription',
            message: `You have successfully subscribed to the ${subscriptionData.planName} plan`,
            type: 'success',
            link: '/subscriptions',
            category: 'subscription',
            data: subscriptionData
        });
    }

    /**
     * Notify user of payment received
     */
    static async notifyPaymentReceived(userId, paymentData) {
        return await this.createNotification({
            userId,
            title: 'Payment Received',
            message: `Payment of $${paymentData.amount} has been received`,
            type: 'success',
            link: '/transactions',
            category: 'payment',
            data: paymentData
        });
    }

    /**
     * Notify user of payment failed
     */
    static async notifyPaymentFailed(userId, paymentData) {
        return await this.createNotification({
            userId,
            title: 'Payment Failed',
            message: `Payment of $${paymentData.amount} failed. Please update your payment method`,
            type: 'error',
            link: '/payment',
            category: 'payment',
            priority: 'high',
            data: paymentData
        });
    }

    /**
     * Notify user of subscription expiring soon
     */
    static async notifySubscriptionExpiring(userId, subscriptionData) {
        return await this.createNotification({
            userId,
            title: 'Subscription Expiring Soon',
            message: `Your ${subscriptionData.planName} subscription will expire in ${subscriptionData.daysLeft} days`,
            type: 'warning',
            link: '/subscriptions',
            category: 'subscription',
            priority: 'high',
            data: subscriptionData
        });
    }

    /**
     * Notify user of subscription cancelled
     */
    static async notifySubscriptionCancelled(userId, subscriptionData) {
        return await this.createNotification({
            userId,
            title: 'Subscription Cancelled',
            message: `Your ${subscriptionData.planName} subscription has been cancelled`,
            type: 'warning',
            link: '/subscriptions',
            category: 'subscription',
            data: subscriptionData
        });
    }

    /**
     * Notify user of invoice generated
     */
    static async notifyInvoiceGenerated(userId, invoiceData) {
        return await this.createNotification({
            userId,
            title: 'New Invoice',
            message: `Invoice #${invoiceData.invoiceNumber} for $${invoiceData.amount} has been generated`,
            type: 'info',
            link: `/invoices/${invoiceData.invoiceId}`,
            category: 'payment',
            data: invoiceData
        });
    }

    /**
     * Notify admin of new user registration
     */
    static async notifyNewUserRegistration(adminUserId, userData) {
        return await this.createNotification({
            userId: adminUserId,
            title: 'New User Registration',
            message: `${userData.name} (${userData.email}) has registered`,
            type: 'info',
            link: `/users/${userData.userId}`,
            category: 'user',
            data: userData
        });
    }

    /**
     * Notify user of system update
     */
    static async notifySystemUpdate(userId, updateData) {
        return await this.createNotification({
            userId,
            title: 'System Update',
            message: updateData.message,
            type: 'info',
            category: 'system',
            data: updateData
        });
    }

    /**
     * Notify user of support ticket response
     */
    static async notifySupportResponse(userId, ticketData) {
        return await this.createNotification({
            userId,
            title: 'Support Ticket Update',
            message: `Your support ticket #${ticketData.ticketNumber} has been updated`,
            type: 'info',
            link: `/support/tickets/${ticketData.ticketId}`,
            category: 'support',
            data: ticketData
        });
    }

    /**
     * Send bulk notifications to multiple users
     */
    static async sendBulkNotifications(userIds, notificationData) {
        const notifications = userIds.map(userId => ({
            userId,
            ...notificationData
        }));

        try {
            return await Notification.insertMany(notifications);
        } catch (error) {
            console.error('Error sending bulk notifications:', error);
            return null;
        }
    }

    /**
     * Clean up old read notifications
     */
    static async cleanupOldNotifications(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await Notification.deleteMany({
                read: true,
                createdAt: { $lt: cutoffDate }
            });

            console.log(`Cleaned up ${result.deletedCount} old notifications`);
            return result;
        } catch (error) {
            console.error('Error cleaning up notifications:', error);
            return null;
        }
    }
}

module.exports = NotificationService;
