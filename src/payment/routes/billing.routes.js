const express = require('express');
const { body, query, param } = require('express-validator');
const billingController = require('../controllers/billing.controller');
const { protect: authMiddleware } = require('../../middlewares/auth.middleware');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Billing & Tax
 *   description: Multi-currency billing, tax calculation, and invoice management
 */

// ==================== TAX RATE MANAGEMENT ====================

/**
 * @swagger
 * /api/billing/tax-rates:
 *   post:
 *     summary: Create new tax rate
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - country
 *               - taxType
 *               - rate
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *                 example: "New York State Sales Tax"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               country:
 *                 type: string
 *                 length: 2
 *                 example: "US"
 *               state:
 *                 type: string
 *                 maxLength: 10
 *                 example: "NY"
 *               taxType:
 *                 type: string
 *                 enum: [VAT, GST, SALES_TAX, WITHHOLDING, EXCISE, OTHER]
 *                 example: "SALES_TAX"
 *               rate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 8.25
 *     responses:
 *       201:
 *         description: Tax rate created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/tax-rates',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Name must be between 1 and 200 characters'),
    body('country')
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .toUpperCase()
      .withMessage('Country must be a valid 2-letter ISO code'),
    body('state')
      .optional()
      .isLength({ max: 10 })
      .toUpperCase(),
    body('taxType')
      .isIn(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING', 'EXCISE', 'OTHER'])
      .withMessage('Invalid tax type'),
    body('rate')
      .isFloat({ min: 0, max: 100 })
      .withMessage('Rate must be between 0 and 100'),
    body('applicableToProducts')
      .optional()
      .isArray()
      .withMessage('Applicable products must be an array'),
    body('customerTypes')
      .optional()
      .isArray()
      .withMessage('Customer types must be an array'),
    body('effectiveFrom')
      .optional()
      .isISO8601()
      .withMessage('Effective from must be a valid date'),
    body('effectiveTo')
      .optional()
      .isISO8601()
      .withMessage('Effective to must be a valid date')
  ],
  billingController.createTaxRate
);

/**
 * @swagger
 * /api/billing/tax-rates:
 *   get:
 *     summary: Get tax rates with filtering and pagination
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country code
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state/province
 *       - in: query
 *         name: taxType
 *         schema:
 *           type: string
 *           enum: [VAT, GST, SALES_TAX, WITHHOLDING, EXCISE, OTHER]
 *         description: Filter by tax type
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and description
 *     responses:
 *       200:
 *         description: Tax rates retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.get('/tax-rates',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('country').optional().isAlpha().isLength({ min: 2, max: 2 }),
    query('state').optional().isLength({ max: 10 }),
    query('taxType').optional().isIn(['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING', 'EXCISE', 'OTHER']),
    query('active').optional().isBoolean()
  ],
  billingController.getTaxRates
);

/**
 * @swagger
 * /api/billing/tax-rates/{id}:
 *   put:
 *     summary: Update tax rate
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Tax rate ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               rate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tax rate updated successfully
 *       404:
 *         description: Tax rate not found
 */
router.put('/tax-rates/:id',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    param('id').isMongoId().withMessage('Invalid tax rate ID'),
    body('name').optional().trim().isLength({ min: 1, max: 200 }),
    body('rate').optional().isFloat({ min: 0, max: 100 }),
    body('active').optional().isBoolean()
  ],
  billingController.updateTaxRate
);

/**
 * @swagger
 * /api/billing/tax-rates/{id}:
 *   delete:
 *     summary: Deactivate tax rate
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Tax rate ID
 *     responses:
 *       200:
 *         description: Tax rate deactivated successfully
 *       404:
 *         description: Tax rate not found
 */
router.delete('/tax-rates/:id',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    param('id').isMongoId().withMessage('Invalid tax rate ID')
  ],
  billingController.deleteTaxRate
);

// ==================== TAX CALCULATION ====================

/**
 * @swagger
 * /api/billing/calculate-tax:
 *   post:
 *     summary: Calculate tax for a transaction
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - lineItems
 *               - billingAddress
 *               - currency
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               lineItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     amount:
 *                       type: number
 *                     productType:
 *                       type: string
 *                       enum: [DIGITAL_SERVICES, PHYSICAL_GOODS, SUBSCRIPTIONS, LICENSES]
 *               billingAddress:
 *                 type: object
 *                 required:
 *                   - country
 *                   - city
 *                   - postalCode
 *                 properties:
 *                   country:
 *                     type: string
 *                     example: "US"
 *                   state:
 *                     type: string
 *                     example: "NY"
 *                   city:
 *                     type: string
 *                     example: "New York"
 *                   postalCode:
 *                     type: string
 *                     example: "10001"
 *               currency:
 *                 type: string
 *                 example: "USD"
 *               provider:
 *                 type: string
 *                 enum: [STRIPE_TAX, TAXJAR, AVALARA, MANUAL]
 *                 description: Tax calculation provider
 *     responses:
 *       200:
 *         description: Tax calculated successfully
 *       400:
 *         description: Validation failed
 */
router.post('/calculate-tax',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    body('customerId').isMongoId().withMessage('Invalid customer ID'),
    body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
    body('lineItems.*.id').isString().withMessage('Line item ID is required'),
    body('lineItems.*.description').isString().withMessage('Line item description is required'),
    body('lineItems.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be positive'),
    body('lineItems.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
    body('lineItems.*.amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('billingAddress.country').isLength({ min: 2, max: 2 }).withMessage('Valid country code required'),
    body('billingAddress.city').isString().withMessage('City is required'),
    body('billingAddress.postalCode').isString().withMessage('Postal code is required'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Valid currency code required'),
    body('provider').optional().isIn(['STRIPE_TAX', 'TAXJAR', 'AVALARA', 'MANUAL'])
  ],
  billingController.calculateTax
);

/**
 * @swagger
 * /api/billing/applicable-tax-rates:
 *   get:
 *     summary: Get applicable tax rates for location and product
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State/province code
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: City name
 *       - in: query
 *         name: customerType
 *         schema:
 *           type: string
 *           enum: [INDIVIDUAL, BUSINESS, NONPROFIT, GOVERNMENT]
 *         description: Customer type
 *       - in: query
 *         name: productType
 *         schema:
 *           type: string
 *           enum: [DIGITAL_SERVICES, PHYSICAL_GOODS, SUBSCRIPTIONS, LICENSES]
 *         description: Product type
 *       - in: query
 *         name: amount
 *         schema:
 *           type: number
 *         description: Transaction amount
 *     responses:
 *       200:
 *         description: Applicable tax rates retrieved successfully
 */
router.get('/applicable-tax-rates',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    query('country').isLength({ min: 2, max: 2 }).withMessage('Valid country code required'),
    query('customerType').optional().isIn(['INDIVIDUAL', 'BUSINESS', 'NONPROFIT', 'GOVERNMENT']),
    query('productType').optional().isIn(['DIGITAL_SERVICES', 'PHYSICAL_GOODS', 'SUBSCRIPTIONS', 'LICENSES']),
    query('amount').optional().isFloat({ min: 0 })
  ],
  billingController.getApplicableTaxRates
);

// ==================== INVOICE MANAGEMENT ====================

/**
 * @swagger
 * /api/billing/invoices:
 *   post:
 *     summary: Create new invoice
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - currency
 *               - lineItems
 *               - billingAddress
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               subscriptionId:
 *                 type: string
 *               currency:
 *                 type: string
 *                 example: "USD"
 *               lineItems:
 *                 type: array
 *               billingAddress:
 *                 type: object
 *               generatePdf:
 *                 type: boolean
 *                 default: true
 *               sendEmail:
 *                 type: boolean
 *                 default: false
 *               templateId:
 *                 type: string
 *                 enum: [default, modern, classic]
 *                 default: "default"
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Validation failed
 */
router.post('/invoices',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    body('customerId').isMongoId().withMessage('Invalid customer ID'),
    body('currency').isLength({ min: 3, max: 3 }).withMessage('Valid currency code required'),
    body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
    body('billingAddress').isObject().withMessage('Billing address is required'),
    body('generatePdf').optional().isBoolean(),
    body('sendEmail').optional().isBoolean(),
    body('templateId').optional().isIn(['default', 'modern', 'classic'])
  ],
  billingController.createInvoice
);

/**
 * @swagger
 * /api/billing/invoices:
 *   get:
 *     summary: Get invoices with filtering and pagination
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE]
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 */
router.get('/invoices',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('customerId').optional().isMongoId(),
    query('status').optional().isIn(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']),
    query('currency').optional().isLength({ min: 3, max: 3 }),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  billingController.getInvoices
);

/**
 * @swagger
 * /api/billing/invoices/{id}:
 *   get:
 *     summary: Get single invoice
 *     tags: [Billing & Tax]
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
 *         description: Invoice retrieved successfully
 *       404:
 *         description: Invoice not found
 */
router.get('/invoices/:id',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID')
  ],
  billingController.getInvoice
);

/**
 * @swagger
 * /api/billing/invoices/{id}:
 *   put:
 *     summary: Update invoice
 *     tags: [Billing & Tax]
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
 *         description: Invoice updated successfully
 *       404:
 *         description: Invoice not found
 */
router.put('/invoices/:id',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID')
  ],
  billingController.updateInvoice
);

/**
 * @swagger
 * /api/billing/invoices/{id}/void:
 *   post:
 *     summary: Void invoice
 *     tags: [Billing & Tax]
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
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for voiding the invoice
 *     responses:
 *       200:
 *         description: Invoice voided successfully
 *       400:
 *         description: Cannot void invoice
 *       404:
 *         description: Invoice not found
 */
router.post('/invoices/:id/void',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID'),
    body('reason').isString().isLength({ min: 1 }).withMessage('Void reason is required')
  ],
  billingController.voidInvoice
);

/**
 * @swagger
 * /api/billing/invoices/{id}/mark-paid:
 *   post:
 *     summary: Mark invoice as paid
 *     tags: [Billing & Tax]
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
 *             required:
 *               - paymentAmount
 *               - paymentDate
 *             properties:
 *               paymentAmount:
 *                 type: number
 *                 minimum: 0
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [CARD, BANK_TRANSFER, PAYPAL, CRYPTO, CHECK, CASH, OTHER]
 *               transactionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice marked as paid successfully
 *       400:
 *         description: Cannot mark invoice as paid
 *       404:
 *         description: Invoice not found
 */
router.post('/invoices/:id/mark-paid',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID'),
    body('paymentAmount').isFloat({ min: 0 }).withMessage('Valid payment amount required'),
    body('paymentDate').isISO8601().withMessage('Valid payment date required'),
    body('paymentMethod').optional().isIn(['CARD', 'BANK_TRANSFER', 'PAYPAL', 'CRYPTO', 'CHECK', 'CASH', 'OTHER'])
  ],
  billingController.markInvoicePaid
);

// ==================== PDF AND EMAIL OPERATIONS ====================

/**
 * @swagger
 * /api/billing/invoices/{id}/generate-pdf:
 *   post:
 *     summary: Generate invoice PDF
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateId:
 *                 type: string
 *                 enum: [default, modern, classic]
 *                 default: "default"
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *       404:
 *         description: Invoice not found
 */
router.post('/invoices/:id/generate-pdf',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID'),
    body('templateId').optional().isIn(['default', 'modern', 'classic'])
  ],
  billingController.generateInvoicePDF
);

/**
 * @swagger
 * /api/billing/invoices/{id}/send-email:
 *   post:
 *     summary: Send invoice via email
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *               cc:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *               subject:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       404:
 *         description: Invoice not found
 */
router.post('/invoices/:id/send-email',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID'),
    body('to').optional().isEmail().withMessage('Valid email address required'),
    body('cc').optional().isArray(),
    body('subject').optional().isString()
  ],
  billingController.sendInvoiceEmail
);

/**
 * @swagger
 * /api/billing/invoices/{id}/resend-email:
 *   post:
 *     summary: Resend invoice email
 *     tags: [Billing & Tax]
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
 *         description: Email resent successfully
 *       404:
 *         description: Invoice not found
 */
router.post('/invoices/:id/resend-email',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    param('id').isMongoId().withMessage('Invalid invoice ID')
  ],
  billingController.resendInvoiceEmail
);

// ==================== RECEIPTS ====================

/**
 * @swagger
 * /api/billing/receipts:
 *   get:
 *     summary: Get receipts with filtering
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: invoiceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [CARD, BANK_TRANSFER, PAYPAL, CRYPTO, CHECK, CASH, OTHER]
 *     responses:
 *       200:
 *         description: Receipts retrieved successfully
 */
router.get('/receipts',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('customerId').optional().isMongoId(),
    query('invoiceId').optional().isMongoId(),
    query('paymentMethod').optional().isIn(['CARD', 'BANK_TRANSFER', 'PAYPAL', 'CRYPTO', 'CHECK', 'CASH', 'OTHER'])
  ],
  billingController.getReceipts
);

/**
 * @swagger
 * /api/billing/receipts/{id}/resend-email:
 *   post:
 *     summary: Resend receipt email
 *     tags: [Billing & Tax]
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
 *         description: Receipt email sent successfully
 *       404:
 *         description: Receipt not found
 */
router.post('/receipts/:id/resend-email',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  [
    param('id').isMongoId().withMessage('Invalid receipt ID')
  ],
  billingController.resendReceiptEmail
);

// ==================== FINANCIAL REPORTING ====================

/**
 * @swagger
 * /api/billing/dashboard:
 *   get:
 *     summary: Get billing dashboard analytics
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 365d]
 *           default: "30d"
 *         description: Analytics period
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    query('period').optional().isIn(['7d', '30d', '90d', '365d']),
    query('currency').optional().isLength({ min: 3, max: 3 })
  ],
  billingController.getBillingDashboard
);

/**
 * @swagger
 * /api/billing/export:
 *   get:
 *     summary: Export financial data
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [CSV, JSON]
 *         description: Export format
 *       - in: query
 *         name: dataType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [invoices, receipts]
 *         description: Data type to export
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for export
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for export
 *       - in: query
 *         name: currency
 *         schema:
 *           type: string
 *         description: Filter by currency
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE]
 *         description: Filter by status (invoices only)
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Invalid export parameters
 */
router.get('/export',
  rbacMiddleware.checkRole(['admin', 'finance']),
  [
    query('format').isIn(['CSV', 'JSON']).withMessage('Format must be CSV or JSON'),
    query('dataType').isIn(['invoices', 'receipts']).withMessage('Data type must be invoices or receipts'),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('currency').optional().isLength({ min: 3, max: 3 }),
    query('status').optional().isIn(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'])
  ],
  billingController.exportFinancialData
);

// ==================== CURRENCY MANAGEMENT ====================

/**
 * @swagger
 * /api/billing/currencies:
 *   get:
 *     summary: Get supported currencies
 *     tags: [Billing & Tax]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supported currencies retrieved successfully
 */
router.get('/currencies',
  rbacMiddleware.checkRole(['admin', 'finance', 'support']),
  billingController.getSupportedCurrencies
);

module.exports = router;





