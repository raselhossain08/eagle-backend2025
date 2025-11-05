/**
 * Eagle Support Validation Schemas
 * Input validation for support tools functionality
 */

const { body, param, query } = require('express-validator');

// Impersonation validations
const impersonationValidation = {
  startSession: [
    body('targetUserId')
      .notEmpty()
      .withMessage('Target user ID is required')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('reason')
      .notEmpty()
      .withMessage('Reason for impersonation is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Reason must be between 10 and 500 characters'),
    body('sessionType')
      .optional()
      .isIn(['READ_ONLY', 'WRITE_ENABLED'])
      .withMessage('Session type must be READ_ONLY or WRITE_ENABLED')
  ],
  
  extendSession: [
    param('sessionId')
      .isMongoId()
      .withMessage('Invalid session ID format'),
    body('hours')
      .optional()
      .isInt({ min: 1, max: 8 })
      .withMessage('Extension hours must be between 1 and 8')
  ]
};

// Email resend validations
const emailResendValidation = {
  resendVerification: [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('reason')
      .notEmpty()
      .withMessage('Reason for resending is required')
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters')
  ],
  
  resendReceipt: [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('transactionId')
      .notEmpty()
      .withMessage('Transaction ID is required'),
    body('reason')
      .notEmpty()
      .withMessage('Reason for resending is required')
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters')
  ],
  
  resendContractLink: [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('contractId')
      .notEmpty()
      .withMessage('Contract ID is required'),
    body('reason')
      .notEmpty()
      .withMessage('Reason for resending is required')
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters')
  ],
  
  resendPasswordReset: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required'),
    body('reason')
      .notEmpty()
      .withMessage('Reason for resending is required')
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be between 5 and 500 characters')
  ],
  
  bulkResend: [
    body('userIds')
      .isArray({ min: 1, max: 50 })
      .withMessage('User IDs must be an array with 1-50 items'),
    body('userIds.*')
      .isMongoId()
      .withMessage('Each user ID must be valid'),
    body('emailType')
      .isIn(['VERIFICATION', 'WELCOME', 'CONTRACT_LINK'])
      .withMessage('Invalid email type for bulk resend'),
    body('reason')
      .notEmpty()
      .withMessage('Reason is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Reason must be between 10 and 500 characters')
  ]
};

// User notes validations
const userNotesValidation = {
  createNote: [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    body('content')
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ min: 5, max: 2000 })
      .withMessage('Content must be between 5 and 2000 characters'),
    body('noteType')
      .optional()
      .isIn(['GENERAL', 'BILLING', 'SUPPORT', 'COMPLIANCE', 'SECURITY', 'TECHNICAL'])
      .withMessage('Invalid note type'),
    body('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('Invalid priority level'),
    body('visibility')
      .optional()
      .isIn(['SUPPORT', 'FINANCE', 'ADMIN', 'ALL_STAFF'])
      .withMessage('Invalid visibility setting'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Each tag must be maximum 50 characters')
  ],
  
  updateNote: [
    param('noteId')
      .isMongoId()
      .withMessage('Invalid note ID format'),
    body('title')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    body('content')
      .optional()
      .isLength({ min: 5, max: 2000 })
      .withMessage('Content must be between 5 and 2000 characters'),
    body('noteType')
      .optional()
      .isIn(['GENERAL', 'BILLING', 'SUPPORT', 'COMPLIANCE', 'SECURITY', 'TECHNICAL'])
      .withMessage('Invalid note type'),
    body('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('Invalid priority level')
  ],
  
  addFlag: [
    param('userId')
      .isMongoId()
      .withMessage('Invalid user ID format'),
    body('flagType')
      .isIn(['VIP', 'HIGH_VALUE', 'PROBLEMATIC', 'PAYMENT_ISSUES', 'REQUIRES_FOLLOW_UP', 'ESCALATED', 'RESOLVED'])
      .withMessage('Invalid flag type'),
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason must be maximum 500 characters'),
    body('expiresAt')
      .optional()
      .isISO8601()
      .withMessage('Expiration date must be valid ISO date')
  ]
};

// Saved replies validations
const savedRepliesValidation = {
  createReply: [
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    body('category')
      .isIn(['SUPPORT', 'FINANCE', 'TECHNICAL', 'BILLING', 'COMPLIANCE', 'GENERAL'])
      .withMessage('Invalid category'),
    body('content')
      .notEmpty()
      .withMessage('Content is required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Content must be between 10 and 5000 characters'),
    body('subcategory')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Subcategory must be maximum 50 characters'),
    body('subject')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Subject must be maximum 200 characters'),
    body('variables')
      .optional()
      .isArray()
      .withMessage('Variables must be an array'),
    body('variables.*.name')
      .notEmpty()
      .withMessage('Variable name is required'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .isLength({ max: 30 })
      .withMessage('Each tag must be maximum 30 characters'),
    body('language')
      .optional()
      .isLength({ max: 5 })
      .withMessage('Language code must be maximum 5 characters')
  ],
  
  updateReply: [
    param('replyId')
      .isMongoId()
      .withMessage('Invalid reply ID format'),
    body('title')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Title must be between 3 and 100 characters'),
    body('content')
      .optional()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Content must be between 10 and 5000 characters'),
    body('category')
      .optional()
      .isIn(['SUPPORT', 'FINANCE', 'TECHNICAL', 'BILLING', 'COMPLIANCE', 'GENERAL'])
      .withMessage('Invalid category'),
    body('changeReason')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Change reason must be maximum 200 characters')
  ],
  
  useReply: [
    param('replyId')
      .isMongoId()
      .withMessage('Invalid reply ID format'),
    body('variables')
      .optional()
      .isObject()
      .withMessage('Variables must be an object')
  ]
};

// Query validations
const queryValidation = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  
  search: [
    query('query')
      .notEmpty()
      .withMessage('Search query is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Search query must be between 2 and 100 characters')
  ]
};

module.exports = {
  impersonationValidation,
  emailResendValidation,
  userNotesValidation,
  savedRepliesValidation,
  queryValidation
};