/**
 * Eagle Base Tax Provider
 * Abstract base class for tax calculation providers
 */

const IntegrationSettings = require('../models/integrationSettings.model');

class BaseTaxProvider {
  constructor(config) {
    this.config = config;
    this.provider = config.provider;
    this.isActive = config.isActive || false;
    this.rateLimiter = new Map();
  }

  // Abstract methods
  async calculateTax(taxData) {
    throw new Error('calculateTax method must be implemented');
  }

  async validateAddress(address) {
    throw new Error('validateAddress method must be implemented');
  }

  async getTaxRates(location) {
    throw new Error('getTaxRates method must be implemented');
  }

  async createTransaction(transactionData) {
    throw new Error('createTransaction method must be implemented');
  }

  async commitTransaction(transactionId) {
    throw new Error('commitTransaction method must be implemented');
  }

  async voidTransaction(transactionId) {
    throw new Error('voidTransaction method must be implemented');
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
        category: 'TAX'
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
        category: 'TAX'
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

  // Address validation helpers
  normalizeAddress(address) {
    return {
      line1: address.line1 || address.street || '',
      line2: address.line2 || address.apartment || '',
      city: address.city || '',
      state: address.state || address.region || '',
      postalCode: address.postalCode || address.zipCode || address.zip || '',
      country: address.country || 'US'
    };
  }

  // Tax calculation helpers
  calculateTotalTax(taxBreakdown) {
    if (!taxBreakdown || !Array.isArray(taxBreakdown)) {
      return 0;
    }
    
    return taxBreakdown.reduce((total, tax) => {
      return total + (tax.amount || 0);
    }, 0);
  }

  formatTaxBreakdown(taxData) {
    if (!taxData || !Array.isArray(taxData)) {
      return [];
    }
    
    return taxData.map(tax => ({
      type: tax.type || 'unknown',
      name: tax.name || tax.description || '',
      rate: parseFloat(tax.rate || 0),
      amount: parseFloat(tax.amount || 0),
      jurisdiction: tax.jurisdiction || '',
      taxable: parseFloat(tax.taxable || 0)
    }));
  }

  // Validation methods
  validateTaxCalculationInput(taxData) {
    const required = ['amount', 'fromAddress', 'toAddress'];
    const missing = required.filter(field => !taxData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (taxData.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate addresses
    this.validateAddress(taxData.fromAddress);
    this.validateAddress(taxData.toAddress);
  }

  validateAddressInput(address) {
    if (!address) {
      throw new Error('Address is required');
    }

    const normalized = this.normalizeAddress(address);
    
    if (!normalized.city && !normalized.postalCode) {
      throw new Error('Either city or postal code is required');
    }

    if (!normalized.country) {
      throw new Error('Country is required');
    }
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

  // Currency helpers
  formatCurrency(amount, currency = 'USD') {
    return {
      amount: parseFloat(amount).toFixed(2),
      currency: currency.toUpperCase()
    };
  }

  // Transaction helpers
  generateTransactionId() {
    return `tx_${this.provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      return {
        status: 'healthy',
        provider: this.provider,
        type: 'TAX',
        timestamp: new Date().toISOString()
      };
    });
  }

  // Compliance helpers
  getComplianceInfo() {
    return {
      provider: this.provider,
      supportedCountries: this.getSupportedCountries(),
      supportedTaxTypes: this.getSupportedTaxTypes(),
      certifications: this.getCertifications(),
      lastUpdated: new Date().toISOString()
    };
  }

  getSupportedCountries() {
    return ['US']; // Default - override in specific providers
  }

  getSupportedTaxTypes() {
    return ['sales', 'use', 'vat']; // Default - override in specific providers
  }

  getCertifications() {
    return []; // Override in specific providers
  }
}

module.exports = BaseTaxProvider;