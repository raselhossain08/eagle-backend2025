/**
 * Eagle Saved Replies Routes
 * Routes for saved replies library functionality
 */

const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Saved Replies
 *     description: Saved Replies API endpoints
 */

// Controllers
const savedRepliesController = require('../controllers/savedReplies.controller');

// Middlewares
const { protect, adminOnly } = require('../../middlewares/auth.middleware');

// All routes require authentication and admin privileges
router.use(protect);
router.use(adminOnly);

/**
 * @route   POST /api/support/saved-replies
 * @desc    Create a new saved reply
 * @access  Admin
 */
router.post('/', savedRepliesController.createReply);

/**
 * @route   GET /api/support/saved-replies/categories
 * @desc    Get available categories and subcategories
 * @access  Admin
 */
router.get('/categories', savedRepliesController.getCategories);

/**
 * @route   GET /api/support/saved-replies/category/:category
 * @desc    Get saved replies by category
 * @access  Admin
 */
router.get('/category/:category', savedRepliesController.getRepliesByCategory);

/**
 * @route   GET /api/support/saved-replies/search
 * @desc    Search saved replies
 * @access  Admin
 */
router.get('/search', savedRepliesController.searchReplies);

/**
 * @route   GET /api/support/saved-replies/popular
 * @desc    Get popular saved replies
 * @access  Admin
 */
router.get('/popular', savedRepliesController.getPopularReplies);

/**
 * @route   GET /api/support/saved-replies/stats
 * @desc    Get saved reply statistics
 * @access  Admin
 */
router.get('/stats', savedRepliesController.getReplyStats);

/**
 * @route   GET /api/support/saved-replies/:replyId
 * @desc    Get a specific saved reply
 * @access  Admin
 */
router.get('/:replyId', savedRepliesController.getReply);

/**
 * @route   PUT /api/support/saved-replies/:replyId
 * @desc    Update a saved reply
 * @access  Admin (or reply creator)
 */
router.put('/:replyId', savedRepliesController.updateReply);

/**
 * @route   DELETE /api/support/saved-replies/:replyId
 * @desc    Delete a saved reply
 * @access  Admin (or reply creator)
 */
router.delete('/:replyId', savedRepliesController.deleteReply);

/**
 * @route   POST /api/support/saved-replies/:replyId/use
 * @desc    Use a saved reply (render with variables)
 * @access  Admin
 */
router.post('/:replyId/use', savedRepliesController.useReply);

/**
 * @route   GET /api/support/saved-replies/:replyId/history
 * @desc    Get version history for a reply
 * @access  Admin (or reply creator)
 */
router.get('/:replyId/history', savedRepliesController.getReplyHistory);

module.exports = router;