/**
 * Eagle Base Payment Processor Adapter
 * Abstract base class for all payment processors
 */

const crypto = require('crypto');
const IntegrationSettings = require('../models/integrationSettings.model');

class BasePaymentProcessor {
  constructor(config) {
    this.config = config;
    this.provider = config.provider;
    this.isActive = config.isActive || false;
    this.rateLimiter = new Map(); // Simple in-memory rate limiter
  }

  // Abstract methods that must be implemented by subclasses
  async createCustomer(customerData) {
    throw new Error('createCustomer method must be implemented');
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    throw new Error('createPaymentMethod method must be implemented');
  }

  async createPayment(paymentData) {
    throw new Error('createPayment method must be implemented');
  }

  async createSubscription(subscriptionData) {
    throw new Error('createSubscription method must be implemented');
  }

  async cancelSubscription(subscriptionId, reason) {
    throw new Error('cancelSubscription method must be implemented');
  }

  async processRefund(paymentId, amount, reason) {
    throw new Error('processRefund method must be implemented');
  }

  async verifyWebhookSignature(payload, signature, secret) {
    throw new Error('verifyWebhookSignature method must be implemented');
  }

  async processWebhook(payload, signature) {
    throw new Error('processWebhook method must be implemented');
  }

  // Common utility methods
  generateIdempotencyKey(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString + Date.now()).digest('hex');
  }

  async checkRateLimit(operation) {
    const key = `${this.provider}:${operation}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, []);
    }
    
    const requests = this.rateLimiter.get(key);
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    const limits = this.config.rateLimits || {};
    const maxRequests = limits.requestsPerMinute || 60;
    
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
        category: 'PAYMENT'
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
        category: 'PAYMENT'
      });
      
      if (settings) {
        await settings.updateHealthStatus(status, responseTime, errorMessage);
      }
    } catch (error) {
      console.error('Error updating health status:', error);
    }
  }

  // Standardized response format
  formatResponse(success, data, error = null) {
    return {
      success,
      provider: this.provider,
      data: data || null,
      error: error || null,
      timestamp: new Date().toISOString()
    };
  }

  // Error handling wrapper
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

  // Health check
  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      // Default implementation - can be overridden
      return {
        status: 'healthy',
        provider: this.provider,
        timestamp: new Date().toISOString()
      };
    });
  }

  // Configuration validation
  validateConfig() {
    const requiredFields = this.getRequiredConfigFields();
    const missing = requiredFields.filter(field => !this.config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }
  }

  getRequiredConfigFields() {
    // Override in subclasses
    return [];
  }

  // Webhook event types
  getWebhookEventTypes() {
    return [
      'payment.succeeded',
      'payment.failed',
      'subscription.created',
      'subscription.updated',
      'subscription.canceled',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.created',
      'customer.updated'
    ];
  }
}

module.exports = BasePaymentProcessor;