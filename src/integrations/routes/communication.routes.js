/**
 * Eagle Communication Routes
 * HTTP routes for email and SMS operations
 */

const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Communication Integrations
 *     description: Communication Integrations API endpoints
 */
const CommunicationController = require('../controllers/CommunicationController');
const { protect } = require('../../middlewares/auth.middleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route POST /api/integrations/communication/email/send
 * @desc Send email through configured providers
 * @access Private (Admin only)
 * @body {
 *   to: string | string[], // Required
 *   subject: string, // Required
 *   html?: string,
 *   text?: string,
 *   template?: { id: string, alias?: string },
 *   templateData?: object,
 *   attachments?: Array<{ filename: string, content: string, type?: string }>,
 *   replyTo?: string,
 *   cc?: string | string[],
 *   bcc?: string | string[],
 *   preferredProvider?: string,
 *   enableFailover?: boolean
 * }
 */
router.post('/email/send', CommunicationController.sendEmail);

/**
 * @route POST /api/integrations/communication/sms/send
 * @desc Send SMS through configured providers
 * @access Private (Admin only)
 * @body {
 *   to: string, // Required (E.164 format)
 *   message?: string,
 *   template?: string,
 *   templateData?: object,
 *   statusCallback?: string,
 *   validityPeriod?: number,
 *   maxPrice?: number,
 *   preferredProvider?: string,
 *   enableFailover?: boolean
 * }
 */
router.post('/sms/send', CommunicationController.sendSMS);

/**
 * @route POST /api/integrations/communication/sms/bulk
 * @desc Send bulk SMS to multiple recipients
 * @access Private (Admin only)
 * @body {
 *   recipients: Array<{ phone: string, data?: object }>, // Required
 *   message?: string,
 *   template?: string,
 *   batchSize?: number,
 *   delayMs?: number,
 *   preferredProvider?: string
 * }
 */
router.post('/sms/bulk', CommunicationController.sendBulkSMS);

/**
 * @route GET /api/integrations/communication/email/validate
 * @desc Validate email address
 * @access Private (Admin only)
 * @query {
 *   email: string, // Required
 *   provider?: string
 * }
 */
router.get('/email/validate', CommunicationController.validateEmail);

/**
 * @route GET /api/integrations/communication/phone/validate
 * @desc Validate phone number
 * @access Private (Admin only)
 * @query {
 *   phone: string, // Required (E.164 format)
 *   provider?: string
 * }
 */
router.get('/phone/validate', CommunicationController.validatePhone);

/**
 * @route GET /api/integrations/communication/status/:type/:provider/:messageId
 * @desc Get delivery status for a message
 * @access Private (Admin only)
 * @params {
 *   type: 'email' | 'sms',
 *   provider: string,
 *   messageId: string
 * }
 */
router.get('/status/:type/:provider/:messageId', CommunicationController.getDeliveryStatus);

/**
 * @route GET /api/integrations/communication/stats
 * @desc Get provider statistics
 * @access Private (Admin only)
 * @query {
 *   type?: 'all' | 'email' | 'sms',
 *   startDate?: string (ISO date),
 *   endDate?: string (ISO date)
 * }
 */
router.get('/stats', CommunicationController.getProviderStats);

/**
 * @route GET /api/integrations/communication/health
 * @desc Health check for all communication providers
 * @access Private (Admin only)
 */
router.get('/health', CommunicationController.healthCheck);

/**
 * @route GET /api/integrations/communication/providers
 * @desc Get available communication providers
 * @access Private (Admin only)
 */
router.get('/providers', CommunicationController.getAvailableProviders);

/**
 * @route POST /api/integrations/communication/reload
 * @desc Reload communication providers configuration
 * @access Private (Admin only)
 */
router.post('/reload', CommunicationController.reloadProviders);

/**
 * @route POST /api/integrations/communication/test/email
 * @desc Test email configuration
 * @access Private (Admin only)
 * @body {
 *   provider?: string,
 *   testEmail: string // Required
 * }
 */
router.post('/test/email', CommunicationController.testEmailConfig);

/**
 * @route POST /api/integrations/communication/test/sms
 * @desc Test SMS configuration
 * @access Private (Admin only)
 * @body {
 *   provider?: string,
 *   testPhone: string // Required (E.164 format)
 * }
 */
router.post('/test/sms', CommunicationController.testSMSConfig);

module.exports = router;