/**
 * Eagle Tax Manager
 * Manages multiple tax providers with failover support
 */

const IntegrationSettings = require('../models/integrationSettings.model');
const StripeTaxProvider = require('../providers/StripeTaxProvider');
const TaxJarProvider = require('../providers/TaxJarProvider');
const AvalaraProvider = require('../providers/AvalaraProvider');

class TaxManager {
  constructor() {
    this.taxProviders = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load tax providers
      const taxSettings = await IntegrationSettings.find({
        category: 'TAX',
        isActive: true
      }).sort({ isPrimary: -1, priority: 1 });

      for (const setting of taxSettings) {
        await this.loadTaxProvider(setting);
      }

      this.initialized = true;
      console.log(`Tax Manager initialized with ${this.taxProviders.size} tax providers`);
    } catch (error) {
      console.error('Failed to initialize Tax Manager:', error);
      throw error;
    }
  }

  async loadTaxProvider(setting) {
    try {
      let provider;

      switch (setting.provider.toLowerCase()) {
        case 'stripe_tax':
          provider = new StripeTaxProvider({
            apiKey: setting.credentials.apiKey,
            isActive: setting.isActive,
            rateLimits: setting.configuration.rateLimits
          });
          break;

        case 'taxjar':
          provider = new TaxJarProvider({
            apiKey: setting.credentials.apiKey,
            environment: setting.configuration.environment || 'production',
            isActive: setting.isActive,
            rateLimits: setting.configuration.rateLimits
          });
          break;

        case 'avalara':
          provider = new AvalaraProvider({
            accountId: setting.credentials.accountId,
            licenseKey: setting.credentials.licenseKey,
            environment: setting.configuration.environment || 'production',
            companyCode: setting.configuration.companyCode || 'DEFAULT',
            isActive: setting.isActive,
            rateLimits: setting.configuration.rateLimits
          });
          break;

        default:
          console.warn(`Unknown tax provider: ${setting.provider}`);
          return;
      }

      // Test provider health
      const healthCheck = await provider.healthCheck();
      if (healthCheck.success) {
        this.taxProviders.set(setting.provider, {
          provider,
          isPrimary: setting.isPrimary,
          priority: setting.priority,
          setting
        });
        console.log(`Loaded tax provider: ${setting.provider}`);
      } else {
        console.error(`Tax provider ${setting.provider} failed health check:`, healthCheck.error);
      }
    } catch (error) {
      console.error(`Failed to load tax provider ${setting.provider}:`, error);
    }
  }

  async calculateTax(taxData, options = {}) {
    await this.ensureInitialized();

    const { preferredProvider, enableFailover = true } = options;
    const providers = this.getOrderedProviders(preferredProvider);

    if (providers.length === 0) {
      throw new Error('No active tax providers available');
    }

    let lastError;
    
    for (const { provider, setting } of providers) {
      try {
        console.log(`Attempting tax calculation via ${setting.provider}`);
        const result = await provider.calculateTax(taxData);
        
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
        console.error(`Tax provider ${setting.provider} failed:`, error);
        
        if (!enableFailover) break;
        continue;
      }
    }

    return {
      success: false,
      error: lastError || 'All tax providers failed',
      provider: null
    };
  }

  async createTransaction(transactionData, options = {}) {
    await this.ensureInitialized();

    const { preferredProvider, enableFailover = true } = options;
    const providers = this.getOrderedProviders(preferredProvider);

    if (providers.length === 0) {
      throw new Error('No active tax providers available');
    }

    let lastError;
    
    for (const { provider, setting } of providers) {
      try {
        console.log(`Attempting transaction creation via ${setting.provider}`);
        const result = await provider.createTransaction(transactionData);
        
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
        console.error(`Tax provider ${setting.provider} failed:`, error);
        
        if (!enableFailover) break;
        continue;
      }
    }

    return {
      success: false,
      error: lastError || 'All tax providers failed',
      provider: null
    };
  }

  async validateAddress(address, providerName = null) {
    await this.ensureInitialized();

    if (providerName) {
      const providerData = this.taxProviders.get(providerName);
      if (!providerData) {
        throw new Error(`Tax provider ${providerName} not found`);
      }
      return await providerData.provider.validateAddress(address);
    }

    // Use primary tax provider
    const providers = this.getOrderedProviders();
    if (providers.length === 0) {
      throw new Error('No tax providers available');
    }

    return await providers[0].provider.validateAddress(address);
  }

  async getTaxRates(location, providerName = null) {
    await this.ensureInitialized();

    if (providerName) {
      const providerData = this.taxProviders.get(providerName);
      if (!providerData) {
        throw new Error(`Tax provider ${providerName} not found`);
      }
      return await providerData.provider.getTaxRates(location);
    }

    // Use primary tax provider
    const providers = this.getOrderedProviders();
    if (providers.length === 0) {
      throw new Error('No tax providers available');
    }

    return await providers[0].provider.getTaxRates(location);
  }

  async commitTransaction(transactionId, providerName) {
    await this.ensureInitialized();

    const providerData = this.taxProviders.get(providerName);
    if (!providerData) {
      throw new Error(`Tax provider ${providerName} not found`);
    }

    return await providerData.provider.commitTransaction(transactionId);
  }

  async voidTransaction(transactionId, providerName, reason = 'cancelled') {
    await this.ensureInitialized();

    const providerData = this.taxProviders.get(providerName);
    if (!providerData) {
      throw new Error(`Tax provider ${providerName} not found`);
    }

    return await providerData.provider.voidTransaction(transactionId, reason);
  }

  getOrderedProviders(preferredProvider = null) {
    let providers = Array.from(this.taxProviders.values());

    // If preferred provider is specified and available, put it first
    if (preferredProvider && this.taxProviders.has(preferredProvider)) {
      const preferred = this.taxProviders.get(preferredProvider);
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

  async getComplianceInfo(providerName = null) {
    await this.ensureInitialized();

    if (providerName) {
      const providerData = this.taxProviders.get(providerName);
      if (!providerData) {
        throw new Error(`Tax provider ${providerName} not found`);
      }
      return providerData.provider.getComplianceInfo();
    }

    // Get compliance info from all providers
    const complianceInfo = {};
    
    for (const [providerName, { provider }] of this.taxProviders) {
      try {
        complianceInfo[providerName] = provider.getComplianceInfo();
      } catch (error) {
        complianceInfo[providerName] = { error: error.message };
      }
    }

    return complianceInfo;
  }

  async getTaxCodes(providerName = null) {
    await this.ensureInitialized();

    if (providerName) {
      const providerData = this.taxProviders.get(providerName);
      if (!providerData) {
        throw new Error(`Tax provider ${providerName} not found`);
      }
      
      if (typeof providerData.provider.getTaxCodes === 'function') {
        return await providerData.provider.getTaxCodes();
      } else {
        throw new Error(`Tax codes not supported by ${providerName}`);
      }
    }

    // Use primary provider that supports tax codes
    const providers = this.getOrderedProviders();
    
    for (const { provider, setting } of providers) {
      if (typeof provider.getTaxCodes === 'function') {
        try {
          return await provider.getTaxCodes();
        } catch (error) {
          console.error(`Failed to get tax codes from ${setting.provider}:`, error);
          continue;
        }
      }
    }

    throw new Error('No tax providers support tax code retrieval');
  }

  async healthCheckAll() {
    await this.ensureInitialized();

    const results = {
      providers: {},
      overall: 'healthy'
    };

    // Check all tax providers
    for (const [providerName, { provider }] of this.taxProviders) {
      try {
        results.providers[providerName] = await provider.healthCheck();
        if (!results.providers[providerName].success) {
          results.overall = 'degraded';
        }
      } catch (error) {
        results.providers[providerName] = {
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
    this.taxProviders.clear();
    this.initialized = false;
    await this.initialize();
  }

  getAvailableProviders() {
    return Array.from(this.taxProviders.keys());
  }

  // Batch operations for multiple calculations
  async batchCalculateTax(taxDataArray, options = {}) {
    await this.ensureInitialized();

    const results = [];
    const { batchSize = 10, delayMs = 100 } = options;

    // Process in batches to avoid rate limits
    for (let i = 0; i < taxDataArray.length; i += batchSize) {
      const batch = taxDataArray.slice(i, i + batchSize);
      const batchPromises = batch.map(async (taxData, index) => {
        try {
          const result = await this.calculateTax(taxData, options);
          return {
            success: result.success,
            index: i + index,
            data: result.data,
            provider: result.provider,
            error: result.error
          };
        } catch (error) {
          return {
            success: false,
            index: i + index,
            data: null,
            provider: null,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches if specified
      if (delayMs && i + batchSize < taxDataArray.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: taxDataArray.length,
      successful,
      failed,
      results
    };
  }

  // Get provider statistics
  async getProviderStats() {
    await this.ensureInitialized();

    const stats = {};

    for (const [providerName, { setting }] of this.taxProviders) {
      stats[providerName] = {
        provider: providerName,
        category: setting.category,
        isActive: setting.isActive,
        isPrimary: setting.isPrimary,
        priority: setting.priority,
        usage: setting.usage,
        healthStatus: setting.healthStatus,
        lastUsed: setting.usage.lastUsed,
        successRate: setting.usage.totalRequests > 0 
          ? ((setting.usage.successfulRequests / setting.usage.totalRequests) * 100).toFixed(2)
          : 0
      };
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new TaxManager();