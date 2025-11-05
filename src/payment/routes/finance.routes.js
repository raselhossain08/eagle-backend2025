const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');
const { protect } = require('../../middlewares/auth.middleware');
const AdminUser = require('../../admin/models/adminUser.model');

/**
 * @swagger
 * tags:
 *   name: Finance Reports
 *   description: Financial reporting and analytics (Finance Admin only)
 */

const financeController = require('../controllers/finance/reports.controller');

// Apply authentication to all routes
router.use(protect);

// Require Finance Admin role for all finance routes - Note: AdminUser.ROLES may not exist, using strings instead
router.use(rbacMiddleware.checkRole(['super-admin', 'finance-admin']));

// ===============================
// REVENUE & SUBSCRIPTION REPORTS
// ===============================

/**
 * @route GET /api/finance/reports/revenue
 * @desc Get revenue reports with breakdown
 * @access Finance Admin, Super Admin
 */
router.get('/revenue',
  [
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    query('startDate').optional().isISO8601().withMessage('Valid start date required'),
    query('endDate').optional().isISO8601().withMessage('Valid end date required'),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'all']),
    query('includeRefunds').optional().isBoolean()
  ],
  financeController.getRevenueReport
);

/**
 * @route GET /api/finance/reports/subscriptions
 * @desc Get subscription analytics and metrics
 * @access Finance Admin, Super Admin
 */
router.get('/subscriptions',
  [
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('includeTrials').optional().isBoolean(),
    query('includeCanceled').optional().isBoolean()
  ],
  financeController.getSubscriptionReport
);

/**
 * @route GET /api/finance/reports/mrr
 * @desc Get Monthly Recurring Revenue (MRR) analysis
 * @access Finance Admin, Super Admin
 */
router.get('/mrr',
  [
    query('months').optional().isInt({ min: 1, max: 24 }).withMessage('Months must be 1-24'),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'all'])
  ],
  financeController.getMRRReport
);

/**
 * @route GET /api/finance/reports/churn
 * @desc Get churn rate analysis
 * @access Finance Admin, Super Admin
 */
router.get('/churn',
  [
    query('period').optional().isIn(['monthly', 'quarterly', 'yearly']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('includeVoluntary').optional().isBoolean(),
    query('includeInvoluntary').optional().isBoolean()
  ],
  financeController.getChurnReport
);

// ===============================
// PAYMENT & TRANSACTION REPORTS
// ===============================

/**
 * @route GET /api/finance/reports/payments
 * @desc Get payment transaction reports
 * @access Finance Admin, Super Admin
 */
router.get('/payments',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['succeeded', 'failed', 'pending', 'refunded', 'all']),
    query('paymentMethod').optional().isIn(['card', 'paypal', 'bank_transfer', 'all']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'all']),
    query('minAmount').optional().isFloat({ min: 0 }),
    query('maxAmount').optional().isFloat({ min: 0 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 })
  ],
  financeController.getPaymentsReport
);

/**
 * @route GET /api/finance/reports/failed-payments
 * @desc Get failed payment analysis
 * @access Finance Admin, Super Admin
 */
router.get('/failed-payments',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('reason').optional().isString(),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('groupBy').optional().isIn(['reason', 'day', 'week', 'month'])
  ],
  financeController.getFailedPaymentsReport
);

/**
 * @route GET /api/finance/reports/refunds
 * @desc Get refund analysis and trends
 * @access Finance Admin, Super Admin
 */
router.get('/refunds',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('reason').optional().isString(),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('amount').optional().isIn(['full', 'partial', 'all']),
    query('groupBy').optional().isIn(['reason', 'day', 'week', 'month'])
  ],
  financeController.getRefundsReport
);

// ===============================
// TAX & COMPLIANCE REPORTS
// ===============================

/**
 * @route GET /api/finance/reports/tax
 * @desc Get tax collection and compliance reports
 * @access Finance Admin, Super Admin
 */
router.get('/tax',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('jurisdiction').optional().isString(),
    query('taxType').optional().isIn(['VAT', 'GST', 'sales_tax', 'all']),
    query('format').optional().isIn(['summary', 'detailed', 'export'])
  ],
  financeController.getTaxReport
);

/**
 * @route GET /api/finance/reports/tax/export
 * @desc Export tax data for compliance filing
 * @access Finance Admin, Super Admin
 */
router.get('/tax/export',
  // TODO: Add rate limiting middleware for export endpoints
  // rbacMiddleware.rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 10 }),
  [
    query('startDate').isISO8601().withMessage('Start date required'),
    query('endDate').isISO8601().withMessage('End date required'),
    query('jurisdiction').isString().withMessage('Jurisdiction required'),
    query('format').isIn(['csv', 'excel', 'pdf']).withMessage('Valid format required')
  ],
  financeController.exportTaxReport
);

// ===============================
// FINANCIAL DASHBOARD & METRICS
// ===============================

/**
 * @route GET /api/finance/reports/dashboard
 * @desc Get financial dashboard overview
 * @access Finance Admin, Super Admin
 */
router.get('/dashboard',
  [
    query('period').optional().isIn(['today', 'week', 'month', 'quarter', 'year']),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'all']),
    query('compare').optional().isBoolean() // Compare with previous period
  ],
  financeController.getFinanceDashboard
);

/**
 * @route GET /api/finance/reports/kpis
 * @desc Get key financial KPIs
 * @access Finance Admin, Super Admin
 */
router.get('/kpis',
  [
    query('period').optional().isIn(['monthly', 'quarterly', 'yearly']),
    query('months').optional().isInt({ min: 1, max: 24 })
  ],
  financeController.getFinancialKPIs
);

/**
 * @route GET /api/finance/reports/forecasting
 * @desc Get revenue forecasting data
 * @access Finance Admin, Super Admin
 */
router.get('/forecasting',
  [
    query('months').optional().isInt({ min: 1, max: 12 }).withMessage('Forecast months 1-12'),
    query('model').optional().isIn(['linear', 'exponential', 'seasonal']),
    query('confidence').optional().isFloat({ min: 0.5, max: 0.99 })
  ],
  financeController.getRevenueForecast
);

// ===============================
// CUSTOMER LIFETIME VALUE
// ===============================

/**
 * @route GET /api/finance/reports/ltv
 * @desc Get Customer Lifetime Value analysis
 * @access Finance Admin, Super Admin
 */
router.get('/ltv',
  [
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('cohort').optional().isString(), // e.g., '2024-01' for January 2024 cohort
    query('period').optional().isIn(['monthly', 'quarterly', 'yearly']),
    query('includeChurn').optional().isBoolean()
  ],
  financeController.getLTVReport
);

/**
 * @route GET /api/finance/reports/cohort
 * @desc Get cohort analysis for revenue retention
 * @access Finance Admin, Super Admin
 */
router.get('/cohort',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('subscriptionType').optional().isIn(['Basic', 'Diamond', 'Infinity', 'Script', 'all']),
    query('metric').optional().isIn(['revenue', 'retention', 'both'])
  ],
  financeController.getCohortAnalysis
);

// ===============================
// EXPORT & BULK OPERATIONS
// ===============================

/**
 * @route POST /api/finance/reports/export
 * @desc Export financial data in various formats
 * @access Finance Admin, Super Admin
 */
router.post('/export',
  // TODO: Add rate limiting middleware for export endpoints
  // rbacMiddleware.rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 }),
  [
    query('reportType').isIn(['revenue', 'subscriptions', 'payments', 'tax', 'mrr', 'churn']).withMessage('Valid report type required'),
    query('format').isIn(['csv', 'excel', 'pdf']).withMessage('Valid format required'),
    query('startDate').isISO8601().withMessage('Start date required'),
    query('endDate').isISO8601().withMessage('End date required'),
    query('includeDetails').optional().isBoolean()
  ],
  financeController.exportFinanceReport
);

/**
 * @route GET /api/finance/reports/scheduled
 * @desc Get scheduled financial reports
 * @access Finance Admin, Super Admin
 */
router.get('/scheduled',
  financeController.getScheduledReports
);

/**
 * @route POST /api/finance/reports/schedule
 * @desc Schedule automatic financial reports
 * @access Finance Admin, Super Admin
 */
router.post('/schedule',
  [
    query('reportType').isIn(['revenue', 'subscriptions', 'payments', 'tax', 'mrr']).withMessage('Valid report type required'),
    query('frequency').isIn(['daily', 'weekly', 'monthly', 'quarterly']).withMessage('Valid frequency required'),
    query('recipients').isArray({ min: 1 }).withMessage('At least one recipient required'),
    query('format').isIn(['csv', 'excel', 'pdf']).withMessage('Valid format required')
  ],
  financeController.scheduleReport
);

module.exports = router;





