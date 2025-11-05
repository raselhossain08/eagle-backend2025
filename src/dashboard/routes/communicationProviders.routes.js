const express = require('express');
const { CommunicationController, validationRules } = require('../controllers/communicationProviders.controller');
const { protect: authenticateToken } = require('../../../middlewares/auth.middleware');
const rbac = require('../../../middlewares/rbac.middleware');

const router = express.Router();

// Email operations routes (protected)
router.post('/email/send',
  authenticateToken,
  checkPermission('communication:write'),
  validationRules.sendEmail,
  CommunicationController.sendEmail
);

router.post('/email/send-bulk',
  authenticateToken,
  checkPermission('communication:write'),
  validationRules.sendBulkEmails,
  CommunicationController.sendBulkEmails
);

// SMS operations routes (protected)
router.post('/sms/send',
  authenticateToken,
  checkPermission('communication:write'),
  validationRules.sendSMS,
  CommunicationController.sendSMS
);

// Template management routes (protected)
router.post('/templates',
  authenticateToken,
  checkPermission('communication:write'),
  validationRules.createTemplate,
  CommunicationController.createTemplate
);

router.put('/templates/:templateId',
  authenticateToken,
  checkPermission('communication:write'),
  validationRules.updateTemplate,
  CommunicationController.updateTemplate
);

router.delete('/templates/:templateId',
  authenticateToken,
  checkPermission('communication:write'),
  CommunicationController.deleteTemplate
);

// Message tracking routes (protected)
router.get('/messages/:messageId/status',
  authenticateToken,
  checkPermission('communication:read'),
  CommunicationController.getDeliveryStatus
);

// Provider management routes (admin only)
router.get('/providers',
  authenticateToken,
  checkPermission('communication:admin'),
  CommunicationController.getAllProviders
);

router.get('/providers/:provider/status',
  authenticateToken,
  checkPermission('communication:admin'),
  CommunicationController.getProviderStatus
);

router.post('/providers/:provider/test',
  authenticateToken,
  checkPermission('communication:admin'),
  CommunicationController.testProvider
);

// Webhook endpoints (public, but verified internally)
router.post('/webhooks/sendgrid',
  express.json(),
  CommunicationController.handleSendGridWebhook
);

router.post('/webhooks/postmark',
  express.json(),
  CommunicationController.handlePostmarkWebhook
);

router.post('/webhooks/twilio',
  express.urlencoded({ extended: false }),
  CommunicationController.handleTwilioWebhook
);

module.exports = router;





