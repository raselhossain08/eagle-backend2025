const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

/**
 * @swagger
 * tags:
 *   - name: Support
 *     description: Support ticket and saved reply management
 */

// Import controllers
const supportController = require('../controllers/support.controller');
const savedReplyController = require('../controllers/savedReply.controller');
const { getAllSubscribers, getSubscriberById } = require('../controllers/dashboard/subscriberController');

// Import middleware
const { protect, requireRole } = require('../../../middlewares/auth.middleware');
const auth = protect; // Alias for backward compatibility

// =============================================================================
// SUPPORT TICKETS ROUTES
// =============================================================================

// Get all support tickets (with filtering, search, pagination)
router.get('/tickets',
  auth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isLength({ min: 0, max: 200 }),
    query('status').optional().isIn(['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed', 'all']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent', 'all']),
    query('category').optional().isIn(['billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'general', 'all']),
    query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'priority', 'status', 'ageInHours']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  supportController.getAllTickets
);

// Get support statistics
router.get('/tickets/stats',
  auth,
  supportController.getSupportStats
);

// Search tickets
router.get('/tickets/search',
  auth,
  [
    query('q').isLength({ min: 2, max: 200 }).withMessage('Search query must be 2-200 characters')
  ],
  supportController.searchTickets
);

// Get single ticket by ID
router.get('/tickets/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid ticket ID')
  ],
  supportController.getTicketById
);

// Create new support ticket
router.post('/tickets',
  auth,
  [
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    body('subject').isLength({ min: 5, max: 200 }).withMessage('Subject must be 5-200 characters'),
    body('description').isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
    body('category').isIn(['billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'general']).withMessage('Valid category is required'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('source').optional().isIn(['web', 'email', 'phone', 'chat', 'api']),
    body('tags').optional().isArray(),
    body('customFields').optional().isObject()
  ],
  supportController.createTicket
);

// Update ticket
router.put('/tickets/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('subject').optional().isLength({ min: 5, max: 200 }),
    body('description').optional().isLength({ min: 10, max: 5000 }),
    body('category').optional().isIn(['billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'general']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('status').optional().isIn(['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed']),
    body('tags').optional().isArray()
  ],
  supportController.updateTicket
);

// Assign ticket to agent
router.post('/tickets/:id/assign',
  auth,
  requireRole('ADMIN'), // Only admins can assign tickets
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('agentId').isMongoId().withMessage('Valid agent ID is required')
  ],
  supportController.assignTicket
);

// Add message to ticket
router.post('/tickets/:id/messages',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('content').isLength({ min: 1, max: 5000 }).withMessage('Message content must be 1-5000 characters'),
    body('authorType').isIn(['customer', 'agent', 'system']).withMessage('Valid author type is required'),
    body('isInternal').optional().isBoolean(),
    body('attachments').optional().isArray()
  ],
  supportController.addMessage
);

// Resolve ticket
router.post('/tickets/:id/resolve',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('resolution').isLength({ min: 5, max: 2000 }).withMessage('Resolution must be 5-2000 characters')
  ],
  supportController.resolveTicket
);

// Add satisfaction rating to ticket
router.post('/tickets/:id/satisfaction',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('feedback').optional().isLength({ max: 1000 }).withMessage('Feedback must be less than 1000 characters')
  ],
  supportController.addSatisfactionRating
);

// Bulk operations on tickets
router.post('/tickets/bulk',
  auth,
  requireRole('ADMIN'), // Only admins can perform bulk operations
  [
    body('ticketIds').isArray({ min: 1 }).withMessage('At least one ticket ID is required'),
    body('ticketIds.*').isMongoId().withMessage('All ticket IDs must be valid'),
    body('action').isIn(['assign', 'updateStatus', 'updatePriority']).withMessage('Valid action is required'),
    body('data').isObject().withMessage('Data object is required')
  ],
  supportController.bulkUpdateTickets
);

// Get tickets for a specific user
router.get('/users/:userId/tickets',
  auth,
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    query('status').optional().isIn(['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed', 'all']),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  supportController.getUserTickets
);

// =============================================================================
// SAVED REPLIES ROUTES
// =============================================================================

// Get all saved replies
router.get('/replies',
  auth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isLength({ min: 0, max: 200 }),
    query('category').optional().isIn(['general', 'billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'welcome', 'follow_up', 'escalation', 'closing', 'all']),
    query('sortBy').optional().isIn(['title', 'category', 'usageCount', 'createdAt', 'updatedAt']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  savedReplyController.getAllReplies
);

// Get saved reply statistics
router.get('/replies/stats',
  auth,
  savedReplyController.getReplyStats
);

// Get popular saved replies
router.get('/replies/popular',
  auth,
  [
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  savedReplyController.getPopularReplies
);

// Search saved replies
router.get('/replies/search',
  auth,
  [
    query('q').isLength({ min: 2, max: 200 }).withMessage('Search query must be 2-200 characters'),
    query('category').optional().isIn(['general', 'billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'welcome', 'follow_up', 'escalation', 'closing', 'all'])
  ],
  savedReplyController.searchReplies
);

// Get replies by category
router.get('/replies/category/:category',
  auth,
  [
    param('category').isIn(['general', 'billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'welcome', 'follow_up', 'escalation', 'closing']).withMessage('Valid category is required')
  ],
  savedReplyController.getRepliesByCategory
);

// Get single saved reply by ID
router.get('/replies/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid reply ID')
  ],
  savedReplyController.getReplyById
);

// Create new saved reply
router.post('/replies',
  auth,
  [
    body('title').isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),
    body('content').isLength({ min: 10, max: 2000 }).withMessage('Content must be 10-2000 characters'),
    body('category').isIn(['general', 'billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'welcome', 'follow_up', 'escalation', 'closing']).withMessage('Valid category is required'),
    body('tags').optional().isArray(),
    body('variables').optional().isArray(),
    body('isPublic').optional().isBoolean(),
    body('departmentRestricted').optional().isArray()
  ],
  savedReplyController.createReply
);

// Update saved reply
router.put('/replies/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid reply ID'),
    body('title').optional().isLength({ min: 3, max: 100 }),
    body('content').optional().isLength({ min: 10, max: 2000 }),
    body('category').optional().isIn(['general', 'billing', 'technical', 'account', 'subscription', 'refund', 'cancellation', 'feature_request', 'bug_report', 'welcome', 'follow_up', 'escalation', 'closing']),
    body('tags').optional().isArray(),
    body('variables').optional().isArray(),
    body('isPublic').optional().isBoolean(),
    body('departmentRestricted').optional().isArray()
  ],
  savedReplyController.updateReply
);

// Delete saved reply
router.delete('/replies/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid reply ID')
  ],
  savedReplyController.deleteReply
);

// Use a saved reply (increment usage and process variables)
router.post('/replies/:id/use',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid reply ID'),
    body('variables').optional().isObject()
  ],
  savedReplyController.useReply
);

// Bulk operations on saved replies
router.post('/replies/bulk',
  auth,
  requireRole('ADMIN'), // Only admins can perform bulk operations
  [
    body('replyIds').isArray({ min: 1 }).withMessage('At least one reply ID is required'),
    body('replyIds.*').isMongoId().withMessage('All reply IDs must be valid'),
    body('action').isIn(['activate', 'deactivate', 'updateCategory', 'makePublic', 'makePrivate']).withMessage('Valid action is required'),
    body('data').optional().isObject()
  ],
  savedReplyController.bulkUpdateReplies
);

// =============================================================================
// SUPPORT NOTES ROUTES
// =============================================================================

// Get all support notes
router.get('/notes',
  auth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('subscriberId').optional().isMongoId(),
    query('subscriberEmail').optional().isEmail(),
    query('type').optional().isIn(['note', 'flag']),
    query('flagType').optional().isIn(['important', 'warning', 'billing', 'technical']),
    query('createdBy').optional().isMongoId(),
    query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'type']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  supportController.getAllNotes
);

// Get single note by ID
router.get('/notes/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid note ID')
  ],
  supportController.getNoteById
);

// Create new support note
router.post('/notes',
  auth,
  [
    body('subscriberId').optional().isMongoId().withMessage('Valid subscriber ID required if provided'),
    body('subscriberEmail').optional().isEmail().withMessage('Valid subscriber email required if provided'),
    body('content').isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
    body('type').isIn(['note', 'flag']).withMessage('Type must be note or flag'),
    body('flagType').optional().isIn(['important', 'warning', 'billing', 'technical']).withMessage('Valid flag type required for flags'),
    body('isPrivate').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  supportController.createNote
);

// Update support note
router.put('/notes/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid note ID'),
    body('content').optional().isLength({ min: 1, max: 2000 }),
    body('type').optional().isIn(['note', 'flag']),
    body('flagType').optional().isIn(['important', 'warning', 'billing', 'technical']),
    body('isPrivate').optional().isBoolean(),
    body('tags').optional().isArray()
  ],
  supportController.updateNote
);

// Delete support note
router.delete('/notes/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid note ID')
  ],
  supportController.deleteNote
);

// =============================================================================
// EMAIL AND QUICK ACTIONS ROUTES
// =============================================================================

// Send email
router.post('/emails/send',
  auth,
  [
    body('to').isEmail().withMessage('Valid recipient email is required'),
    body('subject').isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
    body('message').isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),
    body('isHtml').optional().isBoolean()
  ],
  supportController.sendEmail
);

// Quick Actions
router.post('/actions/resend-welcome',
  auth,
  [
    body('subscriberId').isMongoId().withMessage('Valid subscriber ID is required')
  ],
  supportController.resendWelcomeEmail
);

router.post('/actions/reset-password',
  auth,
  [
    body('subscriberId').isMongoId().withMessage('Valid subscriber ID is required')
  ],
  supportController.resetPassword
);

router.post('/actions/impersonate',
  auth,
  requireRole('ADMIN'), // Only admins can impersonate
  [
    body('subscriberId').isMongoId().withMessage('Valid subscriber ID is required')
  ],
  supportController.impersonateUser
);

// =============================================================================
// SUBSCRIBER LOOKUP ROUTES (Re-using existing subscriber controller)
// =============================================================================

// Get all subscribers (for support lookup)
router.get('/subscribers',
  auth,
  getAllSubscribers
);

// Get single subscriber by ID
router.get('/subscribers/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid subscriber ID')
  ],
  getSubscriberById
);

// =============================================================================
// SUPPORT DASHBOARD OVERVIEW
// =============================================================================

// Get support dashboard overview (combines multiple stats)
router.get('/dashboard',
  auth,
  async (req, res) => {
    try {
      const [supportStats, replyStats] = await Promise.all([
        supportController.getSupportStats(req, res, () => { }),
        savedReplyController.getReplyStats(req, res, () => { })
      ]);

      // This is a simplified version - in practice you'd want to create a dedicated service
      res.status(200).json(new (require('../../../utils/ApiResponse'))(200, {
        tickets: supportStats.data,
        replies: replyStats.data
      }, "Support dashboard data retrieved successfully"));
    } catch (error) {
      console.error("Error fetching support dashboard:", error);
      throw new (require('../../../utils/ApiError'))(500, "Failed to fetch support dashboard data");
    }
  }
);

module.exports = router;





