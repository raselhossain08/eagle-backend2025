const Notification = require('../models/notification.model');

/**
 * @desc Get user notifications
 * @route GET /api/notifications
 * @access Private
 */
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            limit = 10,
            page = 1,
            unreadOnly = false,
            category = null
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = { userId };
        if (unreadOnly === 'true') query.read = false;
        if (category) query.category = category;

        const [notifications, total, unread] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(skip)
                .lean(),
            Notification.countDocuments(query),
            Notification.countDocuments({ userId, read: false })
        ]);

        res.status(200).json({
            success: true,
            message: 'Notifications retrieved successfully',
            data: {
                notifications,
                total,
                unread,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve notifications',
            error: error.message
        });
    }
};

/**
 * @desc Get unread notification count
 * @route GET /api/notifications/unread/count
 * @access Private
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await Notification.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            data: {
                count,
                unread: count
            }
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
};

/**
 * @desc Mark notification as read
 * @route PATCH /api/notifications/:id/read
 * @access Private
 */
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const notification = await Notification.markAsRead(id, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
};

/**
 * @desc Mark all notifications as read
 * @route POST /api/notifications/mark-all-read
 * @access Private
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        const result = await Notification.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
            data: {
                modifiedCount: result.modifiedCount
            }
        });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all as read',
            error: error.message
        });
    }
};

/**
 * @desc Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const notification = await Notification.findOneAndDelete({
            _id: id,
            userId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error.message
        });
    }
};

/**
 * @desc Create notification (Admin only or system)
 * @route POST /api/notifications
 * @access Private/Admin
 */
exports.createNotification = async (req, res) => {
    try {
        const {
            userId,
            title,
            message,
            type,
            link,
            data,
            category,
            priority,
            expiresAt
        } = req.body;

        if (!userId || !title || !message) {
            return res.status(400).json({
                success: false,
                message: 'UserId, title, and message are required'
            });
        }

        const notification = await Notification.createNotification({
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

        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            data: notification
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create notification',
            error: error.message
        });
    }
};

/**
 * @desc Delete all notifications for user
 * @route DELETE /api/notifications/all
 * @access Private
 */
exports.deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const result = await Notification.deleteMany({ userId });

        res.status(200).json({
            success: true,
            message: 'All notifications deleted successfully',
            data: {
                deletedCount: result.deletedCount
            }
        });
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete all notifications',
            error: error.message
        });
    }
};
