const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    link: {
        type: String,
        trim: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed
    },
    category: {
        type: String,
        enum: ['subscription', 'payment', 'system', 'user', 'support', 'general'],
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function () {
    return this.expiresAt && this.expiresAt < new Date();
});

// Static method to create notification
notificationSchema.statics.createNotification = async function (notificationData) {
    try {
        const notification = await this.create(notificationData);
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function (userId, options = {}) {
    const {
        limit = 10,
        skip = 0,
        unreadOnly = false,
        category = null
    } = options;

    const query = { userId };
    if (unreadOnly) query.read = false;
    if (category) query.category = category;

    const notifications = await this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

    return notifications;
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
    return await this.countDocuments({ userId, read: false });
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function (notificationId, userId) {
    return await this.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
    );
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function (userId) {
    return await this.updateMany(
        { userId, read: false },
        { read: true }
    );
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function () {
    this.read = true;
    return await this.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
