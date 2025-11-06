const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification management
 */

// All routes require authentication
router.use(protect);

/**
 * @route GET /api/notifications
 * @desc Get user notifications
 * @access Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route GET /api/notifications/unread/count
 * @desc Get unread notification count
 * @access Private
 */
router.get('/unread/count', notificationController.getUnreadCount);

/**
 * @route PATCH /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private
 */
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @route POST /api/notifications/mark-all-read
 * @desc Mark all notifications as read
 * @access Private
 */
router.post('/mark-all-read', notificationController.markAllAsRead);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a notification
 * @access Private
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * @route DELETE /api/notifications/all
 * @desc Delete all notifications
 * @access Private
 */
router.delete('/all', notificationController.deleteAllNotifications);

/**
 * @route POST /api/notifications
 * @desc Create a notification (Admin only)
 * @access Admin
 */
router.post('/', restrictTo('admin'), notificationController.createNotification);

module.exports = router;
