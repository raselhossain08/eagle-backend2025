/**
 * Eagle Communication Controller
 * Handles HTTP requests for email and SMS operations
 */

const CommunicationManager = require('../managers/CommunicationManager');

class CommunicationController {
  /**
   * Send email through configured providers
   */
  static async sendEmail(req, res) {
    try {
      const {
        to,
        subject,
        html,
        text,
        template,
        templateData,
        attachments,
        replyTo,
        cc,
        bcc,
        preferredProvider,
        enableFailover = true
      } = req.body;

      // Basic validation
      if (!to || !subject || (!html && !text && !template)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, and content (html, text, or template)'
        });
      }

      const result = await CommunicationManager.sendEmail({
        to,
        subject,
        html,
        text,
        template,
        templateData,
        attachments,
        replyTo,
        cc,
        bcc
      }, {
        preferredProvider,
        enableFailover
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Email sent successfully',
          data: {
            provider: result.provider,
            messageId: result.data.messageId,
            status: result.data.status
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send email',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Send email error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Send SMS through configured providers
   */
  static async sendSMS(req, res) {
    try {
      const {
        to,
        message,
        template,
        templateData,
        statusCallback,
        validityPeriod,
        maxPrice,
        preferredProvider,
        enableFailover = true
      } = req.body;

      // Basic validation
      if (!to || (!message && !template)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to and message (or template)'
        });
      }

      const result = await CommunicationManager.sendSMS({
        to,
        message,
        template,
        templateData,
        statusCallback,
        validityPeriod,
        maxPrice
      }, {
        preferredProvider,
        enableFailover
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'SMS sent successfully',
          data: {
            provider: result.provider,
            messageId: result.data.messageId,
            status: result.data.status
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send SMS',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Send SMS error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   */
  static async sendBulkSMS(req, res) {
    try {
      const {
        recipients,
        message,
        template,
        batchSize = 10,
        delayMs = 1000,
        preferredProvider
      } = req.body;

      // Basic validation
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Recipients array is required and must not be empty'
        });
      }

      if (!message && !template) {
        return res.status(400).json({
          success: false,
          error: 'Message or template is required'
        });
      }

      // Get the primary SMS provider or preferred one
      const providers = CommunicationManager.getOrderedProviders('sms', preferredProvider);
      if (providers.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'No SMS providers available'
        });
      }

      const provider = providers[0].provider;
      const result = await provider.sendBulkSMS(recipients, message || template, {
        batchSize,
        delayMs
      });

      res.status(200).json({
        success: true,
        message: 'Bulk SMS operation completed',
        data: result.data || result
      });
    } catch (error) {
      console.error('Send bulk SMS error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Validate email address
   */
  static async validateEmail(req, res) {
    try {
      const { email, provider } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email parameter is required'
        });
      }

      const result = await CommunicationManager.validateEmail(email, provider);

      res.status(200).json({
        success: true,
        data: result.data || result
      });
    } catch (error) {
      console.error('Validate email error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Validate phone number
   */
  static async validatePhone(req, res) {
    try {
      const { phone, provider } = req.query;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'Phone parameter is required'
        });
      }

      const result = await CommunicationManager.validatePhone(phone, provider);

      res.status(200).json({
        success: true,
        data: result.data || result
      });
    } catch (error) {
      console.error('Validate phone error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get delivery status for a message
   */
  static async getDeliveryStatus(req, res) {
    try {
      const { messageId, provider, type = 'email' } = req.params;

      if (!messageId || !provider) {
        return res.status(400).json({
          success: false,
          error: 'Message ID and provider are required'
        });
      }

      const result = await CommunicationManager.getDeliveryStatus(messageId, provider, type);

      res.status(200).json({
        success: true,
        data: result.data || result
      });
    } catch (error) {
      console.error('Get delivery status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get provider statistics
   */
  static async getProviderStats(req, res) {
    try {
      const { type = 'all', startDate, endDate } = req.query;

      const result = await CommunicationManager.getProviderStats(type, startDate, endDate);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get provider stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Health check for all communication providers
   */
  static async healthCheck(req, res) {
    try {
      const result = await CommunicationManager.healthCheckAll();

      const statusCode = result.overall === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: result.overall === 'healthy',
        data: result
      });
    } catch (error) {
      console.error('Communication health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get available providers
   */
  static async getAvailableProviders(req, res) {
    try {
      const result = CommunicationManager.getAvailableProviders();

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get available providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Reload communication providers
   */
  static async reloadProviders(req, res) {
    try {
      await CommunicationManager.reload();

      res.status(200).json({
        success: true,
        message: 'Communication providers reloaded successfully'
      });
    } catch (error) {
      console.error('Reload providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Test email configuration
   */
  static async testEmailConfig(req, res) {
    try {
      const { provider, testEmail } = req.body;

      if (!testEmail) {
        return res.status(400).json({
          success: false,
          error: 'Test email address is required'
        });
      }

      const result = await CommunicationManager.sendEmail({
        to: testEmail,
        subject: 'Eagle Platform - Email Configuration Test',
        html: '<h1>Test Email</h1><p>This is a test email to verify your email configuration is working correctly.</p>',
        text: 'Test Email - This is a test email to verify your email configuration is working correctly.'
      }, {
        preferredProvider: provider,
        enableFailover: false
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Test email sent successfully',
          data: {
            provider: result.provider,
            messageId: result.data.messageId
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send test email',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Test email config error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Test SMS configuration
   */
  static async testSMSConfig(req, res) {
    try {
      const { provider, testPhone } = req.body;

      if (!testPhone) {
        return res.status(400).json({
          success: false,
          error: 'Test phone number is required'
        });
      }

      const result = await CommunicationManager.sendSMS({
        to: testPhone,
        message: 'Eagle Platform - SMS Configuration Test. Your SMS integration is working correctly!'
      }, {
        preferredProvider: provider,
        enableFailover: false
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Test SMS sent successfully',
          data: {
            provider: result.provider,
            messageId: result.data.messageId
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send test SMS',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Test SMS config error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }
}

module.exports = CommunicationController;