/**
 * Eagle Integration Settings Routes
 * HTTP routes for managing integration configurations
 */

const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Integration Settings
 *     description: Integration Settings API endpoints
 */
const IntegrationController = require('../controllers/IntegrationController');
const { protect } = require('../../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route POST /api/integrations/settings/configure
 * @desc Configure a new integration provider
 * @access Private (Admin only)
 * @body {
 *   provider: string, // Required (e.g., 'stripe', 'sendgrid', 'twilio')
 *   category: string, // Required ('PAYMENT', 'EMAIL', 'SMS', 'TAX', 'ANALYTICS')
 *   credentials: object, // Required (provider-specific credentials)
 *   configuration: object, // Required (provider-specific configuration)
 *   isPrimary?: boolean,
 *   isActive?: boolean,
 *   priority?: number
 * }
 */
router.post('/configure', IntegrationController.configureProvider);

/**
 * @route GET /api/integrations/settings/list
 * @desc Get list of configured integrations
 * @access Private (Admin only)
 * @query {
 *   category?: string,
 *   provider?: string,
 *   isActive?: boolean
 * }
 */
router.get('/list', IntegrationController.listIntegrations);

/**
 * @route GET /api/integrations/settings/:id
 * @desc Get specific integration configuration
 * @access Private (Admin only)
 */
router.get('/:id', IntegrationController.getIntegration);

/**
 * @route PUT /api/integrations/settings/:id
 * @desc Update integration configuration
 * @access Private (Admin only)
 * @body {
 *   credentials?: object,
 *   configuration?: object,
 *   isPrimary?: boolean,
 *   isActive?: boolean,
 *   priority?: number
 * }
 */
router.put('/:id', IntegrationController.updateIntegration);

/**
 * @route DELETE /api/integrations/settings/:id
 * @desc Delete integration configuration
 * @access Private (Admin only)
 */
router.delete('/:id', IntegrationController.deleteIntegration);

/**
 * @route POST /api/integrations/settings/:id/test
 * @desc Test integration configuration
 * @access Private (Admin only)
 */
router.post('/:id/test', IntegrationController.testIntegration);

/**
 * @route POST /api/integrations/settings/:id/toggle
 * @desc Toggle integration active status
 * @access Private (Admin only)
 */
router.post('/:id/toggle', IntegrationController.toggleIntegration);

/**
 * @route POST /api/integrations/settings/:id/primary
 * @desc Set integration as primary for its category
 * @access Private (Admin only)
 */
router.post('/:id/primary', IntegrationController.setPrimary);

/**
 * @route GET /api/integrations/settings/:id/usage
 * @desc Get integration usage statistics
 * @access Private (Admin only)
 * @query {
 *   startDate?: string (ISO date),
 *   endDate?: string (ISO date)
 * }
 */
router.get('/:id/usage', IntegrationController.getUsageStats);

/**
 * @route GET /api/integrations/settings/:id/health
 * @desc Get integration health status
 * @access Private (Admin only)
 */
router.get('/:id/health', IntegrationController.getHealthStatus);

/**
 * @route POST /api/integrations/settings/bulk/configure
 * @desc Configure multiple integrations at once
 * @access Private (Admin only)
 * @body {
 *   integrations: Array<{
 *     provider: string,
 *     category: string,
 *     credentials: object,
 *     configuration: object,
 *     isPrimary?: boolean,
 *     isActive?: boolean,
 *     priority?: number
 *   }>
 * }
 */
router.post('/bulk/configure', IntegrationController.bulkConfigure);

/**
 * @route GET /api/integrations/settings/categories/list
 * @desc Get available integration categories
 * @access Private (Admin only)
 */
router.get('/categories/list', IntegrationController.getCategories);

/**
 * @route GET /api/integrations/settings/providers/list
 * @desc Get available providers by category
 * @access Private (Admin only)
 * @query {
 *   category?: string
 * }
 */
router.get('/providers/list', IntegrationController.getProviders);

module.exports = router;