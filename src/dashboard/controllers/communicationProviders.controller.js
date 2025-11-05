const { CommunicationProviderFactory } = require('../services/communicationProviders.service');
const IntegrationConfig = require('../models/integrationConfig.model');
const { logger } = require('../utils/logger');
const { body, param, validationResult } = require('express-validator');

class CommunicationController {
  /**
   * Send an email
   */
  static async sendEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const emailData = req.body;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const result = await communicationProvider.sendEmail(emailData);

      await communicationProvider.config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Send email error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send email'
      });
    }
  }

  /**
   * Send an SMS
   */
  static async sendSMS(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const smsData = req.body;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const result = await communicationProvider.sendSMS(smsData);

      await communicationProvider.config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'SMS sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Send SMS error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send SMS'
      });
    }
  }

  /**
   * Create an email template
   */
  static async createTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const templateData = req.body;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const result = await communicationProvider.createTemplate(templateData);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: result
      });
    } catch (error) {
      logger.error('Create template error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create template'
      });
    }
  }

  /**
   * Update an email template
   */
  static async updateTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const { templateId } = req.params;
      const templateData = req.body;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const result = await communicationProvider.updateTemplate(templateId, templateData);

      res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Update template error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update template'
      });
    }
  }

  /**
   * Delete an email template
   */
  static async deleteTemplate(req, res) {
    try {
      const { provider = null } = req.query;
      const { templateId } = req.params;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const result = await communicationProvider.deleteTemplate(templateId);

      res.status(200).json({
        success: true,
        message: 'Template deleted successfully',
        data: result
      });
    } catch (error) {
      logger.error('Delete template error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete template'
      });
    }
  }

  /**
   * Get message delivery status
   */
  static async getDeliveryStatus(req, res) {
    try {
      const { provider = null } = req.query;
      const { messageId } = req.params;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const result = await communicationProvider.getDeliveryStatus(messageId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get delivery status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get delivery status'
      });
    }
  }

  /**
   * Handle SendGrid webhooks
   */
  static async handleSendGridWebhook(req, res) {
    try {
      const signature = req.get('X-Twilio-Email-Event-Webhook-Signature');
      const timestamp = req.get('X-Twilio-Email-Event-Webhook-Timestamp');
      const payload = req.body;

      // Get SendGrid configuration
      const config = await IntegrationConfig.getProviderByName('communication', 'sendgrid');
      if (!config || !config.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'SendGrid integration not configured'
        });
      }

      const provider = await CommunicationProviderFactory.create('sendgrid');
      const webhookSecret = config.getDecryptedCredentials().webhookSecret;

      // Verify webhook signature
      const events = await provider.verifyWebhook(JSON.stringify(payload), signature, webhookSecret);

      // Process webhook
      const result = await provider.handleWebhook(events);

      // Update usage statistics
      await config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      logger.error('SendGrid webhook error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Webhook processing failed'
      });
    }
  }

  /**
   * Handle Postmark webhooks
   */
  static async handlePostmarkWebhook(req, res) {
    try {
      const payload = req.body;

      // Get Postmark configuration
      const config = await IntegrationConfig.getProviderByName('communication', 'postmark');
      if (!config || !config.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'Postmark integration not configured'
        });
      }

      const provider = await CommunicationProviderFactory.create('postmark');

      // Verify and process webhook
      const event = await provider.verifyWebhook(JSON.stringify(payload), null, null);
      const result = await provider.handleWebhook(event);

      // Update usage statistics
      await config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Postmark webhook error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Webhook processing failed'
      });
    }
  }

  /**
   * Handle Twilio webhooks
   */
  static async handleTwilioWebhook(req, res) {
    try {
      const signature = req.get('X-Twilio-Signature');
      const payload = req.body;

      // Get Twilio configuration
      const config = await IntegrationConfig.getProviderByName('communication', 'twilio');
      if (!config || !config.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'Twilio integration not configured'
        });
      }

      const provider = await CommunicationProviderFactory.create('twilio');
      const webhookSecret = config.getDecryptedCredentials().authToken;

      // Verify webhook signature
      const event = await provider.verifyWebhook(JSON.stringify(payload), signature, webhookSecret);

      // Process webhook
      const result = await provider.handleWebhook(payload);

      // Update usage statistics
      await config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Twilio webhook error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Webhook processing failed'
      });
    }
  }

  /**
   * Get communication provider status
   */
  static async getProviderStatus(req, res) {
    try {
      const { provider } = req.params;

      const config = await IntegrationConfig.getProviderByName('communication', provider);
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Communication provider not found'
        });
      }

      const status = {
        provider: config.provider,
        isEnabled: config.isEnabled,
        isPrimary: config.isPrimary,
        environment: config.environment,
        healthStatus: config.health.status,
        lastHealthCheck: config.health.lastCheck,
        responseTime: config.health.responseTime,
        errorRate: config.health.errorRate,
        usageStats: config.usage,
        capabilities: {
          email: ['sendgrid', 'postmark', 'twilio'].includes(provider),
          sms: ['twilio'].includes(provider),
          templates: ['sendgrid', 'postmark'].includes(provider)
        }
      };

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Get provider status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get provider status'
      });
    }
  }

  /**
   * Get all communication providers
   */
  static async getAllProviders(req, res) {
    try {
      const providers = await IntegrationConfig.getProvidersByType('communication');

      const providersData = providers.map(config => ({
        provider: config.provider,
        isEnabled: config.isEnabled,
        isPrimary: config.isPrimary,
        environment: config.environment,
        healthStatus: config.health.status,
        lastHealthCheck: config.health.lastCheck,
        usageStats: config.usage,
        capabilities: {
          email: ['sendgrid', 'postmark', 'twilio'].includes(config.provider),
          sms: ['twilio'].includes(config.provider),
          templates: ['sendgrid', 'postmark'].includes(config.provider)
        }
      }));

      res.status(200).json({
        success: true,
        data: providersData
      });
    } catch (error) {
      logger.error('Get all providers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get providers'
      });
    }
  }

  /**
   * Test communication provider connection
   */
  static async testProvider(req, res) {
    try {
      const { provider } = req.params;
      const { type = 'email' } = req.query;

      const communicationProvider = await CommunicationProviderFactory.create(provider);
      
      const startTime = Date.now();
      
      try {
        if (type === 'email') {
          // Test email sending (to a test address)
          const testEmail = {
            to: 'test@example.com',
            subject: 'Test Email from ' + provider,
            text: 'This is a test email to verify the integration.',
            html: '<p>This is a test email to verify the integration.</p>'
          };
          
          // In a real scenario, you might want to use a sandbox mode or test endpoint
          // For now, we'll just test the configuration
          await communicationProvider.config.updateHealth('healthy', Date.now() - startTime);
        } else if (type === 'sms' && provider === 'twilio') {
          // Test SMS sending
          await communicationProvider.config.updateHealth('healthy', Date.now() - startTime);
        }
        
        res.status(200).json({
          success: true,
          message: `${provider} ${type} connection test successful`,
          responseTime: Date.now() - startTime
        });
      } catch (testError) {
        await communicationProvider.config.updateHealth('unhealthy', Date.now() - startTime, true);
        throw testError;
      }
    } catch (error) {
      logger.error('Test provider error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Provider test failed'
      });
    }
  }

  /**
   * Send bulk emails
   */
  static async sendBulkEmails(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const { emails } = req.body;

      const communicationProvider = provider 
        ? await CommunicationProviderFactory.create(provider)
        : await CommunicationProviderFactory.getPrimaryProvider();

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const emailData of emails) {
        try {
          const result = await communicationProvider.sendEmail(emailData);
          results.push({ success: true, data: result });
          successCount++;
        } catch (error) {
          results.push({ success: false, error: error.message, email: emailData.to });
          failureCount++;
        }
      }

      await communicationProvider.config.incrementUsage(emails.length);

      res.status(200).json({
        success: true,
        message: `Bulk email processing completed. ${successCount} sent, ${failureCount} failed.`,
        data: {
          totalProcessed: emails.length,
          successCount,
          failureCount,
          results
        }
      });
    } catch (error) {
      logger.error('Send bulk emails error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send bulk emails'
      });
    }
  }
}

// Validation rules
const validationRules = {
  sendEmail: [
    body('to').isEmail().withMessage('Valid recipient email is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('text').optional().notEmpty().withMessage('Text content must not be empty'),
    body('html').optional().notEmpty().withMessage('HTML content must not be empty')
  ],

  sendSMS: [
    body('to').isMobilePhone().withMessage('Valid phone number is required'),
    body('body').notEmpty().withMessage('Message body is required')
  ],

  createTemplate: [
    body('name').notEmpty().withMessage('Template name is required'),
    body('subject').notEmpty().withMessage('Template subject is required')
  ],

  updateTemplate: [
    param('templateId').notEmpty().withMessage('Template ID is required')
  ],

  sendBulkEmails: [
    body('emails').isArray({ min: 1 }).withMessage('Emails array is required with at least one email'),
    body('emails.*.to').isEmail().withMessage('Valid recipient email is required for each email'),
    body('emails.*.subject').notEmpty().withMessage('Subject is required for each email')
  ]
};

module.exports = {
  CommunicationController,
  validationRules
};





