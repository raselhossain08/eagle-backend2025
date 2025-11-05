/**
 * Contract Utilities Service
 * Helper functions for contract operations
 */

const { SignedContract, ContractTemplate } = require('../models/contract.model');
const crypto = require('crypto');

class ContractUtils {
  
  /**
   * Generate unique contract ID
   */
  static generateContractId(prefix = 'contract') {
    const timestamp = Date.now().toString(36);
    const randomId = Math.random().toString(36).substr(2, 5);
    return `${prefix}_${timestamp}_${randomId}`;
  }

  /**
   * Generate document hash for integrity verification
   */
  static generateDocumentHash(content, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number (basic validation)
   */
  static validatePhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Sanitize contract data
   */
  static sanitizeContractData(data) {
    const sanitized = { ...data };
    
    // Remove any script tags or potential XSS
    const textFields = ['name', 'email', 'streetAddress', 'townCity', 'stateCounty'];
    textFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = sanitized[field]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });
    
    return sanitized;
  }

  /**
   * Get contract status display name
   */
  static getStatusDisplayName(status) {
    const statusMap = {
      'draft': 'Draft',
      'sent': 'Sent for Signature',
      'partially_signed': 'Partially Signed',
      'fully_signed': 'Fully Signed',
      'completed': 'Completed',
      'declined': 'Declined',
      'expired': 'Expired',
      'voided': 'Voided'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Calculate contract completion percentage
   */
  static calculateCompletionPercentage(contract) {
    if (!contract.signers || contract.signers.length === 0) return 0;
    
    const signedCount = contract.signers.filter(s => s.status === 'signed').length;
    return Math.round((signedCount / contract.signers.length) * 100);
  }

  /**
   * Check if contract is expired
   */
  static isExpired(contract) {
    if (!contract.dates?.expires) return false;
    return new Date() > new Date(contract.dates.expires);
  }

  /**
   * Get days until expiration
   */
  static getDaysUntilExpiration(contract) {
    if (!contract.dates?.expires) return null;
    
    const expirationDate = new Date(contract.dates.expires);
    const now = new Date();
    const diffTime = expirationDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Generate signing URL
   */
  static generateSigningUrl(contractId, signerId, baseUrl = process.env.CLIENT_URL) {
    const token = crypto.randomBytes(32).toString('hex');
    return `${baseUrl}/sign/${contractId}?signer=${signerId}&token=${token}`;
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Get product pricing information
   */
  static getProductPricing(productType) {
    const pricing = {
      'basic': { monthly: 35, yearly: 350, name: 'Basic Package' },
      'diamond': { monthly: 76, yearly: 760, name: 'Diamond Package' },
      'infinity': { monthly: 99, yearly: 999, name: 'Infinity Package' },
      'script': { monthly: 29, yearly: 299, name: 'Script Package' },
      'investment-advising': { monthly: 79, yearly: 799, name: 'Investment Advising' },
      'trading-tutor': { monthly: 79, yearly: 799, name: 'Trading Tutor' },
      'ultimate': { monthly: 199, yearly: 1999, name: 'Ultimate Package' },
      'basic-subscription': { monthly: 35, yearly: 350, name: 'Basic Subscription' },
      'diamond-subscription': { monthly: 76, yearly: 760, name: 'Diamond Subscription' },
      'infinity-subscription': { monthly: 99, yearly: 999, name: 'Infinity Subscription' },
      'mentorship-package': { monthly: 79, yearly: 799, name: 'Mentorship Package' },
      'product-purchase': { monthly: 99, yearly: 999, name: 'Product Purchase' },
      'eagle-ultimate': { monthly: 199, yearly: 1999, name: 'Eagle Ultimate' },
      'trading-tutoring': { monthly: 79, yearly: 799, name: 'Trading Tutoring' }
    };
    
    return pricing[productType] || null;
  }

  /**
   * Generate evidence collection data structure
   */
  static generateEvidenceStructure(req, additionalData = {}) {
    return {
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      timestamp: new Date(),
      referer: req.headers.referer || null,
      
      // Device information
      device: {
        type: this.getDeviceType(req.headers['user-agent']),
        os: this.getOS(req.headers['user-agent']),
        browser: this.getBrowser(req.headers['user-agent'])
      },
      
      // Additional evidence data
      ...additionalData
    };
  }

  /**
   * Extract device type from user agent
   */
  static getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Extract OS from user agent
   */
  static getOS(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    if (ua.includes('android')) return 'android';
    if (ua.includes('ios')) return 'ios';
    
    return 'unknown';
  }

  /**
   * Extract browser from user agent
   */
  static getBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome') && !ua.includes('edg')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('edg')) return 'edge';
    if (ua.includes('opera')) return 'opera';
    
    return 'unknown';
  }

  /**
   * Validate contract signing requirements
   */
  static validateSigningRequirements(contractData) {
    const errors = [];
    
    // Required fields
    const requiredFields = ['name', 'email', 'signature', 'productType'];
    requiredFields.forEach(field => {
      if (!contractData[field]) {
        errors.push(`${field} is required`);
      }
    });
    
    // Email validation
    if (contractData.email && !this.validateEmail(contractData.email)) {
      errors.push('Invalid email format');
    }
    
    // Phone validation (if provided)
    if (contractData.phone && !this.validatePhone(contractData.phone)) {
      errors.push('Invalid phone format');
    }
    
    // Product type validation
    const validProductTypes = [
      'basic', 'diamond', 'infinity', 'script', 'investment-advising',
      'trading-tutor', 'ultimate', 'basic-subscription', 'diamond-subscription',
      'infinity-subscription', 'mentorship-package', 'product-purchase',
      'eagle-ultimate', 'trading-tutoring'
    ];
    
    if (contractData.productType && !validProductTypes.includes(contractData.productType)) {
      errors.push('Invalid product type');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate contract summary
   */
  static generateContractSummary(contract) {
    const pricing = this.getProductPricing(contract.productType);
    const completion = this.calculateCompletionPercentage(contract);
    const daysUntilExpiration = this.getDaysUntilExpiration(contract);
    
    return {
      id: contract._id,
      contractId: contract.contractId,
      customerName: contract.name,
      customerEmail: contract.email,
      productType: contract.productType,
      productName: pricing?.name || contract.productType,
      subscriptionType: contract.subscriptionType,
      amount: pricing ? (contract.subscriptionType === 'yearly' ? pricing.yearly : pricing.monthly) : 0,
      currency: 'USD',
      status: contract.status || 'pending',
      statusDisplay: this.getStatusDisplayName(contract.status),
      completionPercentage: completion,
      createdAt: contract.createdAt,
      signedAt: contract.signedAt,
      expiresAt: contract.expiresAt,
      daysUntilExpiration: daysUntilExpiration,
      isExpired: this.isExpired(contract)
    };
  }

  /**
   * Search contracts with advanced filtering
   */
  static buildSearchQuery(filters) {
    const query = {};
    
    // Text search
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { productType: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (filters.status) {
      query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
    }
    
    // Product type filter
    if (filters.productType) {
      query.productType = filters.productType;
    }
    
    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    // Email filter
    if (filters.email) {
      query.email = filters.email;
    }
    
    return query;
  }

  /**
   * Generate audit log entry
   */
  static generateAuditLogEntry(action, details, userId = null) {
    return {
      action,
      userId,
      timestamp: new Date(),
      ipAddress: details.ipAddress || 'Unknown',
      userAgent: details.userAgent || 'Unknown',
      details: {
        ...details,
        timestamp: new Date()
      }
    };
  }

  /**
   * Calculate contract statistics
   */
  static async calculateStatistics(dateRange = null) {
    try {
      const query = {};
      if (dateRange) {
        query.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const [
        totalContracts,
        signedContracts,
        pendingContracts,
        statusBreakdown,
        productBreakdown
      ] = await Promise.all([
        SignedContract.countDocuments(query),
        SignedContract.countDocuments({ ...query, status: 'completed' }),
        SignedContract.countDocuments({ ...query, status: { $in: ['pending', 'sent', 'partially_signed'] } }),
        
        // Status breakdown
        SignedContract.aggregate([
          { $match: query },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        
        // Product breakdown
        SignedContract.aggregate([
          { $match: query },
          { $group: { _id: '$productType', count: { $sum: 1 } } }
        ])
      ]);

      return {
        totalContracts,
        signedContracts,
        pendingContracts,
        completionRate: totalContracts > 0 ? ((signedContracts / totalContracts) * 100).toFixed(2) : 0,
        statusBreakdown: statusBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        productBreakdown: productBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error calculating contract statistics:', error);
      throw error;
    }
  }
}

module.exports = ContractUtils;