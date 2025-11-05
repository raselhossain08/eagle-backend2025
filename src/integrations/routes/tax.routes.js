/**
 * Eagle Tax Routes
 * HTTP routes for tax calculation and management operations
 */

const express = require('express');
const router = express.Router();
const TaxController = require('../controllers/TaxController');
const { protect } = require('../../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route POST /api/integrations/tax/calculate
 * @desc Calculate tax for a transaction
 * @access Private (Admin only)
 * @body {
 *   amount: number, // Required
 *   currency?: string, // Default: 'USD'
 *   fromAddress: {
 *     line1: string,
 *     line2?: string,
 *     city: string,
 *     state: string,
 *     postalCode: string,
 *     country: string
 *   }, // Required
 *   toAddress: {
 *     line1: string,
 *     line2?: string,
 *     city: string,
 *     state: string,
 *     postalCode: string,
 *     country: string
 *   }, // Required
 *   lineItems?: Array<{
 *     description: string,
 *     amount: number,
 *     quantity?: number,
 *     taxCode?: string,
 *     discount?: number
 *   }>,
 *   customerDetails?: {
 *     taxExempt?: boolean,
 *     exemptionNumber?: string
 *   },
 *   shipping?: {
 *     amount: number,
 *     taxCode?: string
 *   },
 *   preferredProvider?: string,
 *   enableFailover?: boolean
 * }
 */
router.post('/calculate', TaxController.calculateTax);

/**
 * @route POST /api/integrations/tax/batch-calculate
 * @desc Calculate tax for multiple transactions
 * @access Private (Admin only)
 * @body {
 *   transactions: Array<TaxCalculationObject>, // Required
 *   batchSize?: number, // Default: 10
 *   delayMs?: number, // Default: 100
 *   preferredProvider?: string,
 *   enableFailover?: boolean
 * }
 */
router.post('/batch-calculate', TaxController.batchCalculateTax);

/**
 * @route POST /api/integrations/tax/transaction
 * @desc Create a tax transaction
 * @access Private (Admin only)
 * @body {
 *   transactionId?: string,
 *   transactionCode?: string,
 *   type?: string, // Default: 'SalesInvoice'
 *   customerCode?: string,
 *   date?: string, // ISO date
 *   fromAddress: AddressObject, // Required
 *   toAddress: AddressObject, // Required
 *   lineItems: Array<LineItemObject>, // Required
 *   commit?: boolean, // Default: false
 *   preferredProvider?: string,
 *   enableFailover?: boolean
 * }
 */
router.post('/transaction', TaxController.createTransaction);

/**
 * @route POST /api/integrations/tax/transaction/:provider/:transactionId/commit
 * @desc Commit a tax transaction
 * @access Private (Admin only)
 * @params {
 *   provider: string,
 *   transactionId: string
 * }
 */
router.post('/transaction/:provider/:transactionId/commit', TaxController.commitTransaction);

/**
 * @route POST /api/integrations/tax/transaction/:provider/:transactionId/void
 * @desc Void a tax transaction
 * @access Private (Admin only)
 * @params {
 *   provider: string,
 *   transactionId: string
 * }
 * @body {
 *   reason?: string // Default: 'cancelled'
 * }
 */
router.post('/transaction/:provider/:transactionId/void', TaxController.voidTransaction);

/**
 * @route POST /api/integrations/tax/validate-address
 * @desc Validate an address for tax purposes
 * @access Private (Admin only)
 * @query {
 *   provider?: string
 * }
 * @body {
 *   line1?: string,
 *   line2?: string,
 *   city?: string,
 *   state?: string,
 *   postalCode?: string,
 *   country?: string
 * }
 */
router.post('/validate-address', TaxController.validateAddress);

/**
 * @route GET /api/integrations/tax/rates
 * @desc Get tax rates for a location
 * @access Private (Admin only)
 * @query {
 *   city?: string,
 *   state?: string,
 *   postalCode?: string,
 *   country?: string,
 *   provider?: string
 * }
 */
router.get('/rates', TaxController.getTaxRates);

/**
 * @route GET /api/integrations/tax/codes
 * @desc Get available tax codes
 * @access Private (Admin only)
 * @query {
 *   provider?: string
 * }
 */
router.get('/codes', TaxController.getTaxCodes);

/**
 * @route GET /api/integrations/tax/compliance
 * @desc Get compliance information for tax providers
 * @access Private (Admin only)
 * @query {
 *   provider?: string
 * }
 */
router.get('/compliance', TaxController.getComplianceInfo);

/**
 * @route GET /api/integrations/tax/health
 * @desc Health check for all tax providers
 * @access Private (Admin only)
 */
router.get('/health', TaxController.healthCheck);

/**
 * @route GET /api/integrations/tax/providers
 * @desc Get available tax providers
 * @access Private (Admin only)
 */
router.get('/providers', TaxController.getAvailableProviders);

/**
 * @route GET /api/integrations/tax/stats
 * @desc Get tax provider statistics
 * @access Private (Admin only)
 */
router.get('/stats', TaxController.getProviderStats);

/**
 * @route POST /api/integrations/tax/reload
 * @desc Reload tax providers configuration
 * @access Private (Admin only)
 */
router.post('/reload', TaxController.reloadProviders);

/**
 * @route POST /api/integrations/tax/test
 * @desc Test tax calculation with sample data
 * @access Private (Admin only)
 * @body {
 *   provider?: string
 * }
 */
router.post('/test', TaxController.testCalculation);

module.exports = router;