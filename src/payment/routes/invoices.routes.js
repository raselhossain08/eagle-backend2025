const express = require('express');
const { body, query, param } = require('express-validator');
const invoiceController = require('../../subscription/controllers/subscription/invoice.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

const router = express.Router();

// Validation middleware
const validateInvoiceCreate = [
  body('userId').isMongoId().withMessage('Valid user ID is required'),
  body('subscriptionId').optional().isMongoId().withMessage('Invalid subscription ID'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').isString().isLength({ min: 1, max: 200 }).withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0 }).withMessage('Item quantity must be positive'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be positive'),
  body('items.*.totalPrice').isFloat({ min: 0 }).withMessage('Item total price must be positive'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be max 1000 characters')
];

const validateRefund = [
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Refund amount must be positive'),
  body('reason').isString().isLength({ min: 1, max: 200 }).withMessage('Refund reason is required (max 200 characters)')
];

const validateEmailSend = [
  body('recipient').optional().isEmail().withMessage('Invalid recipient email'),
  body('subject').optional().isString().isLength({ max: 200 }).withMessage('Subject must be max 200 characters'),
  body('message').optional().isString().isLength({ max: 2000 }).withMessage('Message must be max 2000 characters')
];

const validateMongoId = [
  param('id').isMongoId().withMessage('Invalid invoice ID format')
];

// Routes

/**
 * @route   GET /api/v1/invoices
 * @desc    Get invoices with filtering
 * @access  Admin
 */
router.get('/',
  protect,
  restrictTo('admin', 'manager'),
  query('subscriber_id').optional().isMongoId().withMessage('Invalid subscriber ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  invoiceController.getInvoices
);

/**
 * @route   POST /api/v1/invoices
 * @desc    Create new invoice
 * @access  Admin
 */
router.post('/',
  protect,
  restrictTo('admin', 'manager'),
  validateInvoiceCreate,
  invoiceController.createInvoice
);

/**
 * @route   GET /api/v1/invoices/:id
 * @desc    Get single invoice
 * @access  Admin
 */
router.get('/:id',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  invoiceController.getInvoice
);

/**
 * @route   POST /api/v1/invoices/:id/refund
 * @desc    Process refund for invoice
 * @access  Admin (role-gated)
 */
router.post('/:id/refund',
  protect,
  restrictTo('admin'), // Only admin can process refunds
  validateMongoId,
  validateRefund,
  invoiceController.processRefund
);

/**
 * @route   GET /api/v1/invoices/:id/pdf
 * @desc    Generate and download invoice PDF
 * @access  Admin
 */
router.get('/:id/pdf',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  invoiceController.generateInvoicePDF
);

/**
 * @route   POST /api/v1/invoices/:id/send
 * @desc    Send invoice via email
 * @access  Admin
 */
router.post('/:id/send',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  validateEmailSend,
  invoiceController.sendInvoiceEmail
);

/**
 * @route   GET /api/v1/export/financials
 * @desc    Export financial data
 * @access  Admin
 */
router.get('/export/financials',
  protect,
  restrictTo('admin', 'manager'),
  query('format').optional().isIn(['csv', 'json']).withMessage('Invalid export format'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('include_invoices').optional().isBoolean().withMessage('Invalid include_invoices value'),
  query('include_payments').optional().isBoolean().withMessage('Invalid include_payments value'),
  query('include_refunds').optional().isBoolean().withMessage('Invalid include_refunds value'),
  invoiceController.exportFinancialData
);

module.exports = router;





