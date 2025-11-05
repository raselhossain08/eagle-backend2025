/**
 * Eagle Base Communication Provider
 * Abstract base class for email and SMS providers
 */

const IntegrationSettings = require('../models/integrationSettings.model');

class BaseCommunicationProvider {
  constructor(config) {
    this.config = config;
    this.provider = config.provider;
    this.type = config.type; // 'EMAIL' or 'SMS'
    this.isActive = config.isActive || false;
    this.rateLimiter = new Map();
  }

  // Abstract methods
  async sendEmail(emailData) {
    throw new Error('sendEmail method must be implemented');
  }

  async sendSMS(smsData) {
    throw new Error('sendSMS method must be implemented');
  }

  async validateEmail(email) {
    throw new Error('validateEmail method must be implemented');
  }

  async getDeliveryStatus(messageId) {
    throw new Error('getDeliveryStatus method must be implemented');
  }

  // Common utility methods
  async checkRateLimit(operation) {
    const key = `${this.provider}:${operation}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, []);
    }
    
    const requests = this.rateLimiter.get(key);
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    const limits = this.config.rateLimits || {};
    const maxRequests = limits.requestsPerMinute || 100;
    
    if (recentRequests.length >= maxRequests) {
      throw new Error(`Rate limit exceeded for ${operation}. Max ${maxRequests} per minute.`);
    }
    
    recentRequests.push(now);
    this.rateLimiter.set(key, recentRequests);
  }

  async logUsage(success = true) {
    try {
      const settings = await IntegrationSettings.findOne({
        provider: this.provider,
        category: this.type
      });
      
      if (settings) {
        await settings.updateUsage(success);
      }
    } catch (error) {
      console.error('Error logging usage:', error);
    }
  }

  async updateHealthStatus(status, responseTime, errorMessage = null) {
    try {
      const settings = await IntegrationSettings.findOne({
        provider: this.provider,
        category: this.type
      });
      
      if (settings) {
        await settings.updateHealthStatus(status, responseTime, errorMessage);
      }
    } catch (error) {
      console.error('Error updating health status:', error);
    }
  }

  formatResponse(success, data, error = null) {
    return {
      success,
      provider: this.provider,
      type: this.type,
      data: data || null,
      error: error || null,
      timestamp: new Date().toISOString()
    };
  }

  async executeWithErrorHandling(operation, fn) {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit(operation);
      const result = await fn();
      const responseTime = Date.now() - startTime;
      
      await this.logUsage(true);
      await this.updateHealthStatus('HEALTHY', responseTime);
      
      return this.formatResponse(true, result);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await this.logUsage(false);
      await this.updateHealthStatus('ERROR', responseTime, error.message);
      
      return this.formatResponse(false, null, {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        provider: this.provider
      });
    }
  }

  // Email validation helper
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Phone validation helper
  isValidPhone(phone) {
    const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
    return phoneRegex.test(phone);
  }

  // Template processing
  processTemplate(template, variables = {}) {
    let processed = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(placeholder, value || '');
    });
    
    return processed;
  }

  validateConfig() {
    const requiredFields = this.getRequiredConfigFields();
    const missing = requiredFields.filter(field => !this.config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }
  }

  getRequiredConfigFields() {
    return [];
  }

  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      return {
        status: 'healthy',
        provider: this.provider,
        type: this.type,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = BaseCommunicationProvider;