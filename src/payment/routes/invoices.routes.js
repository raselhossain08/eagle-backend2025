const express = require('express');
const { body, query, param } = require('express-validator');
const invoiceController = require('../../subscription/controllers/invoice.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Invoices
 *     description: Invoice management and financial operations
 */

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
 * @swagger
 * /api/invoices:
 *   get:
 *     summary: Get invoices with filtering (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscriber_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of invoices
 *   post:
 *     summary: Create new invoice (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - items
 *             properties:
 *               userId:
 *                 type: string
 *               subscriptionId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     totalPrice:
 *                       type: number
 *     responses:
 *       201:
 *         description: Invoice created
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

router.post('/',
  protect,
  restrictTo('admin', 'manager'),
  validateInvoiceCreate,
  invoiceController.createInvoice
);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     summary: Get single invoice (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details
 */
router.get('/:id',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  invoiceController.getInvoice
);

/**
 * @swagger
 * /api/invoices/{id}/refund:
 *   post:
 *     summary: Process refund for invoice (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed
 */
router.post('/:id/refund',
  protect,
  restrictTo('admin'), // Only admin can process refunds
  validateMongoId,
  validateRefund,
  invoiceController.processRefund
);

/**
 * @swagger
 * /api/invoices/{id}/pdf:
 *   get:
 *     summary: Generate and download invoice PDF (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF generated
 */
router.get('/:id/pdf',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  invoiceController.generateInvoicePDF
);

/**
 * @swagger
 * /api/invoices/{id}/send:
 *   post:
 *     summary: Send invoice via email (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipient:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent
 */
router.post('/:id/send',
  protect,
  restrictTo('admin', 'manager'),
  validateMongoId,
  validateEmailSend,
  invoiceController.sendInvoiceEmail
);

/**
 * @swagger
 * /api/invoices/export/financials:
 *   get:
 *     summary: Export financial data (Admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Financial data exported
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





