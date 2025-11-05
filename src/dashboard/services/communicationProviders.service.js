const IntegrationConfig = require('../models/integrationConfig.model');
const { logger } = require('../utils/logger');

/**
 * Base Communication Provider
 */
class BaseCommunicationProvider {
  constructor(config) {
    this.config = config;
    this.provider = config.provider;
    this.credentials = config.getDecryptedCredentials();
    this.settings = config.settings;
  }

  // Abstract methods - must be implemented by subclasses
  async sendEmail(emailData) {
    throw new Error('sendEmail method must be implemented');
  }

  async sendSMS(smsData) {
    throw new Error('sendSMS method must be implemented');
  }

  async createTemplate(templateData) {
    throw new Error('createTemplate method must be implemented');
  }

  async updateTemplate(templateId, templateData) {
    throw new Error('updateTemplate method must be implemented');
  }

  async deleteTemplate(templateId) {
    throw new Error('deleteTemplate method must be implemented');
  }

  async getDeliveryStatus(messageId) {
    throw new Error('getDeliveryStatus method must be implemented');
  }

  async verifyWebhook(payload, signature, secret) {
    throw new Error('verifyWebhook method must be implemented');
  }

  async handleWebhook(event) {
    throw new Error('handleWebhook method must be implemented');
  }

  // Common helper methods
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  async logMessage(messageData) {
    logger.info(`Message logged for ${this.provider}:`, messageData);
  }
}

/**
 * SendGrid Email Provider
 */
class SendGridProvider extends BaseCommunicationProvider {
  constructor(config) {
    super(config);
    this.sgMail = require('@sendgrid/mail');
    this.sgClient = require('@sendgrid/client');
    this.sgMail.setApiKey(this.credentials.apiKey);
    this.sgClient.setApiKey(this.credentials.apiKey);
  }

  async sendEmail(emailData) {
    try {
      if (!this.validateEmail(emailData.to)) {
        throw new Error('Invalid recipient email address');
      }

      const message = {
        to: emailData.to,
        from: emailData.from || this.settings.defaultFromEmail,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        templateId: emailData.templateId,
        dynamicTemplateData: emailData.templateData || {},
        categories: emailData.categories || [],
        customArgs: emailData.customArgs || {},
        sendAt: emailData.sendAt,
        batchId: emailData.batchId
      };

      const response = await this.sgMail.send(message);

      await this.config.updateHealth('healthy');
      return {
        messageId: response[0].headers['x-message-id'],
        status: 'sent',
        provider: 'sendgrid',
        to: emailData.to,
        subject: emailData.subject
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`SendGrid email sending failed: ${error.message}`);
    }
  }

  async sendSMS(smsData) {
    // SendGrid doesn't support SMS directly, but can integrate with Twilio
    throw new Error('SendGrid does not support SMS. Use Twilio for SMS functionality.');
  }

  async createTemplate(templateData) {
    try {
      const request = {
        method: 'POST',
        url: '/v3/templates',
        body: {
          name: templateData.name,
          generation: 'dynamic'
        }
      };

      const [response] = await this.sgClient.request(request);
      
      // Create template version
      const versionRequest = {
        method: 'POST',
        url: `/v3/templates/${response.body.id}/versions`,
        body: {
          template_id: response.body.id,
          active: 1,
          name: templateData.name,
          html_content: templateData.htmlContent,
          plain_content: templateData.textContent,
          subject: templateData.subject
        }
      };

      await this.sgClient.request(versionRequest);

      return {
        id: response.body.id,
        name: templateData.name,
        status: 'active'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`SendGrid template creation failed: ${error.message}`);
    }
  }

  async updateTemplate(templateId, templateData) {
    try {
      const request = {
        method: 'PATCH',
        url: `/v3/templates/${templateId}`,
        body: {
          name: templateData.name
        }
      };

      await this.sgClient.request(request);

      // Update active version
      if (templateData.htmlContent || templateData.textContent || templateData.subject) {
        const versionRequest = {
          method: 'PATCH',
          url: `/v3/templates/${templateId}/versions/active`,
          body: {
            html_content: templateData.htmlContent,
            plain_content: templateData.textContent,
            subject: templateData.subject
          }
        };

        await this.sgClient.request(versionRequest);
      }

      return {
        id: templateId,
        status: 'updated'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`SendGrid template update failed: ${error.message}`);
    }
  }

  async deleteTemplate(templateId) {
    try {
      const request = {
        method: 'DELETE',
        url: `/v3/templates/${templateId}`
      };

      await this.sgClient.request(request);

      return {
        id: templateId,
        status: 'deleted'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`SendGrid template deletion failed: ${error.message}`);
    }
  }

  async getDeliveryStatus(messageId) {
    try {
      const request = {
        method: 'GET',
        url: `/v3/messages`,
        qs: {
          query: `msg_id="${messageId}"`
        }
      };

      const [response] = await this.sgClient.request(request);

      if (response.body.messages && response.body.messages.length > 0) {
        const message = response.body.messages[0];
        return {
          messageId: messageId,
          status: message.status,
          events: message.events || []
        };
      }

      return {
        messageId: messageId,
        status: 'unknown',
        events: []
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`SendGrid delivery status check failed: ${error.message}`);
    }
  }

  async verifyWebhook(payload, signature, secret) {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      return JSON.parse(payload);
    } catch (error) {
      throw new Error(`SendGrid webhook verification failed: ${error.message}`);
    }
  }

  async handleWebhook(events) {
    const startTime = Date.now();
    
    try {
      for (const event of events) {
        switch (event.event) {
          case 'delivered':
            await this.handleEmailDelivered(event);
            break;
          case 'bounce':
            await this.handleEmailBounced(event);
            break;
          case 'open':
            await this.handleEmailOpened(event);
            break;
          case 'click':
            await this.handleEmailClicked(event);
            break;
          default:
            logger.info(`Unhandled SendGrid webhook event: ${event.event}`);
        }
      }

      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('healthy', responseTime);
      
      return { success: true, processed: events.length };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('degraded', responseTime, true);
      throw error;
    }
  }

  async handleEmailDelivered(event) {
    logger.info('Email delivered:', {
      messageId: event.sg_message_id,
      email: event.email,
      timestamp: event.timestamp
    });
  }

  async handleEmailBounced(event) {
    logger.warn('Email bounced:', {
      messageId: event.sg_message_id,
      email: event.email,
      reason: event.reason,
      timestamp: event.timestamp
    });
  }

  async handleEmailOpened(event) {
    logger.info('Email opened:', {
      messageId: event.sg_message_id,
      email: event.email,
      timestamp: event.timestamp
    });
  }

  async handleEmailClicked(event) {
    logger.info('Email link clicked:', {
      messageId: event.sg_message_id,
      email: event.email,
      url: event.url,
      timestamp: event.timestamp
    });
  }
}

/**
 * Postmark Email Provider
 */
class PostmarkProvider extends BaseCommunicationProvider {
  constructor(config) {
    super(config);
    this.postmark = require('postmark');
    this.client = new this.postmark.ServerClient(this.credentials.serverToken);
  }

  async sendEmail(emailData) {
    try {
      if (!this.validateEmail(emailData.to)) {
        throw new Error('Invalid recipient email address');
      }

      const message = {
        From: emailData.from || this.settings.defaultFromEmail,
        To: emailData.to,
        Subject: emailData.subject,
        TextBody: emailData.text,
        HtmlBody: emailData.html,
        TemplateId: emailData.templateId,
        TemplateModel: emailData.templateData || {},
        Tag: emailData.tag,
        Metadata: emailData.metadata || {},
        TrackOpens: emailData.trackOpens !== false,
        TrackLinks: emailData.trackLinks || 'None'
      };

      const response = await this.client.sendEmail(message);

      await this.config.updateHealth('healthy');
      return {
        messageId: response.MessageID,
        status: 'sent',
        provider: 'postmark',
        to: emailData.to,
        subject: emailData.subject
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Postmark email sending failed: ${error.message}`);
    }
  }

  async sendSMS(smsData) {
    // Postmark doesn't support SMS
    throw new Error('Postmark does not support SMS. Use Twilio for SMS functionality.');
  }

  async createTemplate(templateData) {
    try {
      const template = await this.client.createTemplate({
        Name: templateData.name,
        Subject: templateData.subject,
        HtmlBody: templateData.htmlContent,
        TextBody: templateData.textContent,
        Alias: templateData.alias
      });

      return {
        id: template.TemplateId,
        name: template.Name,
        alias: template.Alias,
        status: 'active'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Postmark template creation failed: ${error.message}`);
    }
  }

  async updateTemplate(templateId, templateData) {
    try {
      const template = await this.client.editTemplate(templateId, {
        Name: templateData.name,
        Subject: templateData.subject,
        HtmlBody: templateData.htmlContent,
        TextBody: templateData.textContent,
        Alias: templateData.alias
      });

      return {
        id: template.TemplateId,
        status: 'updated'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Postmark template update failed: ${error.message}`);
    }
  }

  async deleteTemplate(templateId) {
    try {
      await this.client.deleteTemplate(templateId);

      return {
        id: templateId,
        status: 'deleted'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Postmark template deletion failed: ${error.message}`);
    }
  }

  async getDeliveryStatus(messageId) {
    try {
      const message = await this.client.getOutboundMessageDetails(messageId);

      return {
        messageId: messageId,
        status: message.Status,
        events: message.MessageEvents || []
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Postmark delivery status check failed: ${error.message}`);
    }
  }

  async verifyWebhook(payload, signature, secret) {
    // Postmark doesn't use signature verification by default
    // You can implement custom verification if needed
    try {
      return JSON.parse(payload);
    } catch (error) {
      throw new Error(`Postmark webhook verification failed: ${error.message}`);
    }
  }

  async handleWebhook(event) {
    const startTime = Date.now();
    
    try {
      switch (event.RecordType) {
        case 'Delivery':
          await this.handleEmailDelivered(event);
          break;
        case 'Bounce':
          await this.handleEmailBounced(event);
          break;
        case 'Open':
          await this.handleEmailOpened(event);
          break;
        case 'Click':
          await this.handleEmailClicked(event);
          break;
        default:
          logger.info(`Unhandled Postmark webhook event: ${event.RecordType}`);
      }

      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('healthy', responseTime);
      
      return { success: true, processed: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('degraded', responseTime, true);
      throw error;
    }
  }

  async handleEmailDelivered(event) {
    logger.info('Email delivered:', {
      messageId: event.MessageID,
      email: event.Recipient,
      timestamp: event.DeliveredAt
    });
  }

  async handleEmailBounced(event) {
    logger.warn('Email bounced:', {
      messageId: event.MessageID,
      email: event.Email,
      bounceId: event.ID,
      type: event.Type,
      description: event.Description,
      timestamp: event.BouncedAt
    });
  }

  async handleEmailOpened(event) {
    logger.info('Email opened:', {
      messageId: event.MessageID,
      email: event.Recipient,
      timestamp: event.ReceivedAt
    });
  }

  async handleEmailClicked(event) {
    logger.info('Email link clicked:', {
      messageId: event.MessageID,
      email: event.Recipient,
      url: event.OriginalLink,
      timestamp: event.ReceivedAt
    });
  }
}

/**
 * Twilio Communication Provider (Email and SMS)
 */
class TwilioProvider extends BaseCommunicationProvider {
  constructor(config) {
    super(config);
    this.twilio = require('twilio')(this.credentials.accountSid, this.credentials.authToken);
  }

  async sendEmail(emailData) {
    try {
      if (!this.validateEmail(emailData.to)) {
        throw new Error('Invalid recipient email address');
      }

      // Twilio SendGrid integration
      const message = {
        from: emailData.from || this.settings.defaultFromEmail,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html
      };

      const response = await this.twilio.messages.create(message);

      await this.config.updateHealth('healthy');
      return {
        messageId: response.sid,
        status: 'sent',
        provider: 'twilio',
        to: emailData.to,
        subject: emailData.subject
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Twilio email sending failed: ${error.message}`);
    }
  }

  async sendSMS(smsData) {
    try {
      if (!this.validatePhone(smsData.to)) {
        throw new Error('Invalid recipient phone number');
      }

      const message = await this.twilio.messages.create({
        body: smsData.body,
        from: smsData.from || this.credentials.phoneNumber,
        to: smsData.to,
        mediaUrl: smsData.mediaUrl
      });

      await this.config.updateHealth('healthy');
      return {
        messageId: message.sid,
        status: message.status,
        provider: 'twilio',
        to: smsData.to,
        direction: message.direction
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Twilio SMS sending failed: ${error.message}`);
    }
  }

  async createTemplate(templateData) {
    // Twilio doesn't have traditional email templates, but supports content templates
    // This would depend on whether you're using Twilio's Programmable Messaging or SendGrid
    throw new Error('Template management not supported for Twilio provider');
  }

  async updateTemplate(templateId, templateData) {
    throw new Error('Template management not supported for Twilio provider');
  }

  async deleteTemplate(templateId) {
    throw new Error('Template management not supported for Twilio provider');
  }

  async getDeliveryStatus(messageId) {
    try {
      const message = await this.twilio.messages(messageId).fetch();

      return {
        messageId: messageId,
        status: message.status,
        direction: message.direction,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Twilio delivery status check failed: ${error.message}`);
    }
  }

  async verifyWebhook(payload, signature, secret) {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(Buffer.from(payload, 'utf-8'))
        .digest('base64');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      return payload; // Twilio sends form-encoded data
    } catch (error) {
      throw new Error(`Twilio webhook verification failed: ${error.message}`);
    }
  }

  async handleWebhook(event) {
    const startTime = Date.now();
    
    try {
      switch (event.MessageStatus || event.SmsStatus) {
        case 'delivered':
          await this.handleMessageDelivered(event);
          break;
        case 'failed':
          await this.handleMessageFailed(event);
          break;
        case 'undelivered':
          await this.handleMessageUndelivered(event);
          break;
        default:
          logger.info(`Unhandled Twilio webhook status: ${event.MessageStatus || event.SmsStatus}`);
      }

      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('healthy', responseTime);
      
      return { success: true, processed: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('degraded', responseTime, true);
      throw error;
    }
  }

  async handleMessageDelivered(event) {
    logger.info('Message delivered:', {
      messageId: event.MessageSid || event.SmsSid,
      to: event.To,
      status: event.MessageStatus || event.SmsStatus
    });
  }

  async handleMessageFailed(event) {
    logger.error('Message failed:', {
      messageId: event.MessageSid || event.SmsSid,
      to: event.To,
      errorCode: event.ErrorCode,
      errorMessage: event.ErrorMessage
    });
  }

  async handleMessageUndelivered(event) {
    logger.warn('Message undelivered:', {
      messageId: event.MessageSid || event.SmsSid,
      to: event.To,
      errorCode: event.ErrorCode
    });
  }
}

/**
 * Communication Provider Factory
 */
class CommunicationProviderFactory {
  static async create(providerName) {
    const config = await IntegrationConfig.getProviderByName('communication', providerName);
    if (!config || !config.isEnabled) {
      throw new Error(`Communication provider ${providerName} not found or not enabled`);
    }

    switch (providerName) {
      case 'sendgrid':
        return new SendGridProvider(config);
      case 'postmark':
        return new PostmarkProvider(config);
      case 'twilio':
        return new TwilioProvider(config);
      default:
        throw new Error(`Unsupported communication provider: ${providerName}`);
    }
  }

  static async getPrimaryProvider() {
    const config = await IntegrationConfig.getPrimaryProvider('communication');
    if (!config) {
      throw new Error('No primary communication provider configured');
    }

    return await this.create(config.provider);
  }

  static getSupportedProviders() {
    return ['sendgrid', 'postmark', 'twilio'];
  }
}

module.exports = {
  BaseCommunicationProvider,
  SendGridProvider,
  PostmarkProvider,
  TwilioProvider,
  CommunicationProviderFactory
};





