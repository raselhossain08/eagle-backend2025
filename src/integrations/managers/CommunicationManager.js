/**
 * Eagle Communication Manager
 * Manages multiple email and SMS providers with failover support
 */

const IntegrationSettings = require('../models/integrationSettings.model');
const SendGridProvider = require('../providers/SendGridProvider');
const PostmarkProvider = require('../providers/PostmarkProvider');
const TwilioProvider = require('../providers/TwilioProvider');

class CommunicationManager {
  constructor() {
    this.emailProviders = new Map();
    this.smsProviders = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load email providers
      const emailSettings = await IntegrationSettings.find({
        category: 'EMAIL',
        isActive: true
      }).sort({ isPrimary: -1, priority: 1 });

      for (const setting of emailSettings) {
        await this.loadEmailProvider(setting);
      }

      // Load SMS providers
      const smsSettings = await IntegrationSettings.find({
        category: 'SMS',
        isActive: true
      }).sort({ isPrimary: -1, priority: 1 });

      for (const setting of smsSettings) {
        await this.loadSMSProvider(setting);
      }

      this.initialized = true;
      console.log(`Communication Manager initialized with ${this.emailProviders.size} email and ${this.smsProviders.size} SMS providers`);
    } catch (error) {
      console.error('Failed to initialize Communication Manager:', error);
      throw error;
    }
  }

  async loadEmailProvider(setting) {
    try {
      let provider;

      switch (setting.provider.toLowerCase()) {
        case 'sendgrid':
          provider = new SendGridProvider({
            apiKey: setting.credentials.apiKey,
            fromEmail: setting.configuration.fromEmail,
            fromName: setting.configuration.fromName,
            isActive: setting.isActive,
            rateLimits: setting.configuration.rateLimits
          });
          break;

        case 'postmark':
          provider = new PostmarkProvider({
            serverToken: setting.credentials.serverToken,
            fromEmail: setting.configuration.fromEmail,
            fromName: setting.configuration.fromName,
            isActive: setting.isActive,
            rateLimits: setting.configuration.rateLimits
          });
          break;

        default:
          console.warn(`Unknown email provider: ${setting.provider}`);
          return;
      }

      // Test provider health
      const healthCheck = await provider.healthCheck();
      if (healthCheck.success) {
        this.emailProviders.set(setting.provider, {
          provider,
          isPrimary: setting.isPrimary,
          priority: setting.priority,
          setting
        });
        console.log(`Loaded email provider: ${setting.provider}`);
      } else {
        console.error(`Email provider ${setting.provider} failed health check:`, healthCheck.error);
      }
    } catch (error) {
      console.error(`Failed to load email provider ${setting.provider}:`, error);
    }
  }

  async loadSMSProvider(setting) {
    try {
      let provider;

      switch (setting.provider.toLowerCase()) {
        case 'twilio':
          provider = new TwilioProvider({
            accountSid: setting.credentials.accountSid,
            authToken: setting.credentials.authToken,
            fromNumber: setting.configuration.fromNumber,
            isActive: setting.isActive,
            rateLimits: setting.configuration.rateLimits
          });
          break;

        default:
          console.warn(`Unknown SMS provider: ${setting.provider}`);
          return;
      }

      // Test provider health
      const healthCheck = await provider.healthCheck();
      if (healthCheck.success) {
        this.smsProviders.set(setting.provider, {
          provider,
          isPrimary: setting.isPrimary,
          priority: setting.priority,
          setting
        });
        console.log(`Loaded SMS provider: ${setting.provider}`);
      } else {
        console.error(`SMS provider ${setting.provider} failed health check:`, healthCheck.error);
      }
    } catch (error) {
      console.error(`Failed to load SMS provider ${setting.provider}:`, error);
    }
  }

  async sendEmail(emailData, options = {}) {
    await this.ensureInitialized();

    const { preferredProvider, enableFailover = true } = options;
    const providers = this.getOrderedProviders('email', preferredProvider);

    if (providers.length === 0) {
      throw new Error('No active email providers available');
    }

    let lastError;
    
    for (const { provider, setting } of providers) {
      try {
        console.log(`Attempting to send email via ${setting.provider}`);
        const result = await provider.sendEmail(emailData);
        
        if (result.success) {
          return {
            success: true,
            provider: setting.provider,
            data: result.data
          };
        } else {
          lastError = result.error;
          if (!enableFailover) break;
        }
      } catch (error) {
        lastError = error;
        console.error(`Email provider ${setting.provider} failed:`, error);
        
        if (!enableFailover) break;
        continue;
      }
    }

    return {
      success: false,
      error: lastError || 'All email providers failed',
      provider: null
    };
  }

  async sendSMS(smsData, options = {}) {
    await this.ensureInitialized();

    const { preferredProvider, enableFailover = true } = options;
    const providers = this.getOrderedProviders('sms', preferredProvider);

    if (providers.length === 0) {
      throw new Error('No active SMS providers available');
    }

    let lastError;
    
    for (const { provider, setting } of providers) {
      try {
        console.log(`Attempting to send SMS via ${setting.provider}`);
        const result = await provider.sendSMS(smsData);
        
        if (result.success) {
          return {
            success: true,
            provider: setting.provider,
            data: result.data
          };
        } else {
          lastError = result.error;
          if (!enableFailover) break;
        }
      } catch (error) {
        lastError = error;
        console.error(`SMS provider ${setting.provider} failed:`, error);
        
        if (!enableFailover) break;
        continue;
      }
    }

    return {
      success: false,
      error: lastError || 'All SMS providers failed',
      provider: null
    };
  }

  getOrderedProviders(type, preferredProvider = null) {
    const providerMap = type === 'email' ? this.emailProviders : this.smsProviders;
    let providers = Array.from(providerMap.values());

    // If preferred provider is specified and available, put it first
    if (preferredProvider && providerMap.has(preferredProvider)) {
      const preferred = providerMap.get(preferredProvider);
      providers = providers.filter(p => p.setting.provider !== preferredProvider);
      providers.unshift(preferred);
    } else {
      // Sort by primary first, then by priority
      providers.sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return a.priority - b.priority;
      });
    }

    return providers;
  }

  async validateEmail(email, providerName = null) {
    await this.ensureInitialized();

    if (providerName) {
      const providerData = this.emailProviders.get(providerName);
      if (!providerData) {
        throw new Error(`Email provider ${providerName} not found`);
      }
      return await providerData.provider.validateEmail(email);
    }

    // Use primary email provider
    const providers = this.getOrderedProviders('email');
    if (providers.length === 0) {
      throw new Error('No email providers available');
    }

    return await providers[0].provider.validateEmail(email);
  }

  async validatePhone(phoneNumber, providerName = null) {
    await this.ensureInitialized();

    if (providerName) {
      const providerData = this.smsProviders.get(providerName);
      if (!providerData) {
        throw new Error(`SMS provider ${providerName} not found`);
      }
      return await providerData.provider.validatePhone(phoneNumber);
    }

    // Use primary SMS provider
    const providers = this.getOrderedProviders('sms');
    if (providers.length === 0) {
      throw new Error('No SMS providers available');
    }

    return await providers[0].provider.validatePhone(phoneNumber);
  }

  async getDeliveryStatus(messageId, providerName, type = 'email') {
    await this.ensureInitialized();

    const providerMap = type === 'email' ? this.emailProviders : this.smsProviders;
    const providerData = providerMap.get(providerName);
    
    if (!providerData) {
      throw new Error(`${type} provider ${providerName} not found`);
    }

    return await providerData.provider.getDeliveryStatus(messageId);
  }

  async getProviderStats(type = 'all', startDate = null, endDate = null) {
    await this.ensureInitialized();

    const stats = {
      email: {},
      sms: {}
    };

    if (type === 'all' || type === 'email') {
      for (const [providerName, { provider, setting }] of this.emailProviders) {
        try {
          if (provider.getEmailStats) {
            stats.email[providerName] = await provider.getEmailStats(startDate, endDate);
          }
        } catch (error) {
          console.error(`Failed to get stats for email provider ${providerName}:`, error);
          stats.email[providerName] = { error: error.message };
        }
      }
    }

    if (type === 'all' || type === 'sms') {
      for (const [providerName, { provider, setting }] of this.smsProviders) {
        try {
          if (provider.getSMSStats) {
            stats.sms[providerName] = await provider.getSMSStats(startDate, endDate);
          }
        } catch (error) {
          console.error(`Failed to get stats for SMS provider ${providerName}:`, error);
          stats.sms[providerName] = { error: error.message };
        }
      }
    }

    return stats;
  }

  async healthCheckAll() {
    await this.ensureInitialized();

    const results = {
      email: {},
      sms: {},
      overall: 'healthy'
    };

    // Check email providers
    for (const [providerName, { provider }] of this.emailProviders) {
      try {
        results.email[providerName] = await provider.healthCheck();
        if (!results.email[providerName].success) {
          results.overall = 'degraded';
        }
      } catch (error) {
        results.email[providerName] = {
          success: false,
          error: error.message
        };
        results.overall = 'degraded';
      }
    }

    // Check SMS providers
    for (const [providerName, { provider }] of this.smsProviders) {
      try {
        results.sms[providerName] = await provider.healthCheck();
        if (!results.sms[providerName].success) {
          results.overall = 'degraded';
        }
      } catch (error) {
        results.sms[providerName] = {
          success: false,
          error: error.message
        };
        results.overall = 'degraded';
      }
    }

    return results;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async reload() {
    this.emailProviders.clear();
    this.smsProviders.clear();
    this.initialized = false;
    await this.initialize();
  }

  getAvailableProviders() {
    return {
      email: Array.from(this.emailProviders.keys()),
      sms: Array.from(this.smsProviders.keys())
    };
  }
}

// Export singleton instance
module.exports = new CommunicationManager();