const DiscountCode = require('../models/discountCode.model');
const DiscountRedemption = require('../models/discountRedemption.model');
const PromotionalCampaign = require('../models/promotionalCampaign.model');
const crypto = require('crypto');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class DiscountManagementService {
  
  constructor() {
    this.fraudCache = new Map(); // In production, use Redis
    this.velocityTracker = new Map(); // In production, use Redis
  }
  
  // =====================================
  // DISCOUNT CODE CREATION & MANAGEMENT
  // =====================================
  
  /**
   * Create a new discount code
   */
  async createDiscountCode(codeData, createdBy) {
    try {
      // Validate required fields
      this.validateCodeData(codeData);
      
      // Check if code already exists
      if (codeData.code) {
        const existingCode = await DiscountCode.findOne({ 
          code: codeData.code.toUpperCase() 
        });
        if (existingCode) {
          throw new Error('Discount code already exists');
        }
      } else {
        // Generate code if not provided
        codeData.code = await this.generateUniqueCode(codeData.generation || {});
      }
      
      // Set defaults and process data
      const processedData = this.processCodeData(codeData, createdBy);
      
      // Create the discount code
      const discountCode = new DiscountCode(processedData);
      await discountCode.save();
      
      return {
        success: true,
        data: discountCode,
        message: 'Discount code created successfully'
      };
      
    } catch (error) {
      console.error('Error creating discount code:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Bulk generate discount codes
   */
  async bulkGenerateDiscountCodes(bulkData, createdBy) {
    try {
      const {
        count = 100,
        baseConfig,
        generation = {},
        prefix = '',
        suffix = '',
        length = 8,
        pattern = 'ALPHANUMERIC'
      } = bulkData;
      
      if (count > 10000) {
        throw new Error('Cannot generate more than 10,000 codes at once');
      }
      
      const batchId = this.generateBatchId();
      const codes = [];
      const errors = [];
      
      for (let i = 0; i < count; i++) {
        try {
          const uniqueCode = await this.generateUniqueCode({
            prefix: `${prefix}${i < 10 ? '0' : ''}`,
            suffix,
            length,
            pattern
          });
          
          const codeData = {
            ...baseConfig,
            code: uniqueCode,
            generation: {
              method: 'bulk_generated',
              batchId,
              generatedBy: createdBy,
              pattern,
              prefix,
              suffix
            }
          };
          
          const processedData = this.processCodeData(codeData, createdBy);
          const discountCode = new DiscountCode(processedData);
          await discountCode.save();
          
          codes.push(discountCode);
          
        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        data: {
          batchId,
          generated: codes.length,
          errors: errors.length,
          codes: codes.map(c => ({
            id: c._id,
            code: c.code,
            status: c.status
          })),
          errorDetails: errors
        },
        message: `Generated ${codes.length} discount codes${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
      };
      
    } catch (error) {
      console.error('Error bulk generating discount codes:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Import discount codes from CSV
   */
  async importDiscountCodesFromCSV(filePath, importConfig, createdBy) {
    try {
      const {
        mapping = {},
        skipErrors = true,
        validateData = true
      } = importConfig;
      
      const codes = [];
      const errors = [];
      const batchId = this.generateBatchId();
      
      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', async (row) => {
            try {
              // Map CSV columns to code data structure
              const codeData = this.mapCsvRowToCodeData(row, mapping);
              
              if (validateData) {
                this.validateCodeData(codeData);
              }
              
              // Add import metadata
              codeData.generation = {
                method: 'imported',
                batchId,
                generatedBy: createdBy
              };
              
              const processedData = this.processCodeData(codeData, createdBy);
              const discountCode = new DiscountCode(processedData);
              await discountCode.save();
              
              codes.push(discountCode);
              
            } catch (error) {
              const errorEntry = {
                row: codes.length + errors.length + 1,
                data: row,
                error: error.message
              };
              
              errors.push(errorEntry);
              
              if (!skipErrors) {
                reject(new Error(`Import failed at row ${errorEntry.row}: ${error.message}`));
                return;
              }
            }
          })
          .on('end', () => {
            resolve({
              success: true,
              data: {
                batchId,
                imported: codes.length,
                errors: errors.length,
                codes: codes.map(c => ({
                  id: c._id,
                  code: c.code,
                  status: c.status
                })),
                errorDetails: errors
              },
              message: `Imported ${codes.length} discount codes${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
            });
          })
          .on('error', (error) => {
            reject({
              success: false,
              error: error.message,
              data: null
            });
          });
      });
      
    } catch (error) {
      console.error('Error importing discount codes:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Export discount codes to CSV
   */
  async exportDiscountCodesToCSV(filters = {}, options = {}) {
    try {
      const {
        format = 'detailed',
        includeAnalytics = true,
        filename = `discount-codes-${Date.now()}.csv`
      } = options;
      
      // Build query
      const query = this.buildDiscountQuery(filters);
      
      // Fetch codes
      const codes = await DiscountCode.find(query)
        .populate('campaign.campaignId', 'name type')
        .sort({ createdAt: -1 });
      
      // Define CSV structure based on format
      const csvHeaders = this.getCsvHeaders(format, includeAnalytics);
      
      // Transform data for CSV
      const csvData = codes.map(code => this.transformCodeForCsv(code, format, includeAnalytics));
      
      // Create CSV file
      const filePath = path.join(process.cwd(), 'exports', filename);
      
      // Ensure exports directory exists
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      
      const csvWriter = createCsvWriter({
        path: filePath,
        header: csvHeaders
      });
      
      await csvWriter.writeRecords(csvData);
      
      return {
        success: true,
        data: {
          filename,
          filePath,
          recordCount: codes.length,
          exportedAt: new Date(),
          format,
          filters
        },
        message: `Exported ${codes.length} discount codes to CSV`
      };
      
    } catch (error) {
      console.error('Error exporting discount codes:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  // =====================================
  // DISCOUNT VALIDATION & APPLICATION
  // =====================================
  
  /**
   * Validate discount code
   */
  async validateDiscountCode(code, context = {}) {
    try {
      const {
        userId,
        userEmail,
        orderData = {},
        country,
        ipAddress,
        userAgent
      } = context;
      
      // Find the discount code
      const discountCode = await DiscountCode.findOne({ 
        code: code.toUpperCase() 
      }).populate('campaign.campaignId');
      
      if (!discountCode) {
        return {
          valid: false,
          error: 'Invalid discount code',
          code: 'INVALID_CODE'
        };
      }
      
      // Check basic validity
      if (!discountCode.isCurrentlyValid) {
        return {
          valid: false,
          error: this.getInvalidReason(discountCode),
          code: this.getInvalidCode(discountCode),
          discountCode
        };
      }
      
      // Check fraud controls
      const fraudCheck = await this.checkFraudControls(discountCode, {
        userId,
        ipAddress,
        userAgent,
        country
      });
      
      if (!fraudCheck.allowed) {
        return {
          valid: false,
          error: 'Discount code blocked by fraud prevention',
          code: 'FRAUD_BLOCKED',
          requiresVerification: fraudCheck.requiresVerification,
          discountCode
        };
      }
      
      // Check user eligibility
      const user = userId ? await this.getUserData(userId) : { email: userEmail };
      const eligibilityCheck = discountCode.checkEligibility(user, orderData, context);
      
      if (!eligibilityCheck.eligible) {
        return {
          valid: false,
          error: eligibilityCheck.reasons[0] || 'Not eligible for this discount',
          code: 'NOT_ELIGIBLE',
          reasons: eligibilityCheck.reasons,
          discountCode
        };
      }
      
      // Check usage limits
      const usageCheck = await this.checkUsageLimits(discountCode, userId, userEmail);
      
      if (!usageCheck.allowed) {
        return {
          valid: false,
          error: usageCheck.reason,
          code: 'USAGE_LIMIT_EXCEEDED',
          discountCode
        };
      }
      
      // Calculate discount amount
      const discountCalculation = discountCode.calculateDiscount(
        orderData.total || 0,
        { isFirstPeriod: orderData.isFirstPeriod }
      );
      
      return {
        valid: true,
        discountCode,
        discountAmount: discountCalculation.amount,
        discountType: discountCalculation.type,
        freeTrialDays: discountCalculation.freeTrialDays,
        currency: discountCalculation.currency,
        eligibilityWarnings: eligibilityCheck.warnings,
        usageInfo: {
          currentUsage: discountCode.currentUsageCount,
          maxUsage: discountCode.maxUsesGlobal,
          usagePercentage: discountCode.usagePercentage
        }
      };
      
    } catch (error) {
      console.error('Error validating discount code:', error);
      return {
        valid: false,
        error: 'Validation service error',
        code: 'VALIDATION_ERROR'
      };
    }
  }
  
  /**
   * Apply discount code to transaction
   */
  async applyDiscountCode(code, transactionData, context = {}) {
    try {
      // First validate the code
      const validation = await this.validateDiscountCode(code, context);
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: validation.code,
          data: validation
        };
      }
      
      const discountCode = validation.discountCode;
      
      // Check for stacking conflicts
      if (context.existingDiscounts && context.existingDiscounts.length > 0) {
        const stackingCheck = this.checkStackingRules(discountCode, context.existingDiscounts);
        
        if (!stackingCheck.allowed) {
          return {
            success: false,
            error: stackingCheck.reason,
            code: 'STACKING_NOT_ALLOWED'
          };
        }
      }
      
      // Create redemption record
      const redemption = await this.createRedemptionRecord(
        discountCode,
        transactionData,
        context
      );
      
      // Update discount code usage
      await discountCode.incrementUsage(context.userId, {
        revenue: transactionData.finalAmount,
        discountAmount: validation.discountAmount
      });
      
      // Update campaign analytics if associated
      if (discountCode.campaign?.campaignId) {
        await this.updateCampaignAnalytics(discountCode.campaign.campaignId, {
          conversions: 1,
          revenue: transactionData.finalAmount,
          discountAmount: validation.discountAmount
        });
      }
      
      // Record velocity for fraud prevention
      this.recordVelocity(context.ipAddress, discountCode._id);
      
      return {
        success: true,
        data: {
          redemptionId: redemption.redemptionId,
          discountAmount: validation.discountAmount,
          discountType: validation.discountType,
          freeTrialDays: validation.freeTrialDays,
          finalAmount: transactionData.originalAmount - validation.discountAmount,
          savings: validation.discountAmount,
          discountCode: {
            id: discountCode._id,
            code: discountCode.code,
            name: discountCode.name,
            description: discountCode.description
          },
          redemption
        },
        message: 'Discount code applied successfully'
      };
      
    } catch (error) {
      console.error('Error applying discount code:', error);
      return {
        success: false,
        error: 'Failed to apply discount code',
        code: 'APPLICATION_ERROR'
      };
    }
  }
  
  /**
   * Remove/refund applied discount
   */
  async removeAppliedDiscount(redemptionId, reason = 'user_request') {
    try {
      // Find the redemption
      const redemption = await DiscountRedemption.findOne({ redemptionId });
      
      if (!redemption) {
        return {
          success: false,
          error: 'Redemption not found',
          code: 'REDEMPTION_NOT_FOUND'
        };
      }
      
      if (redemption.status === 'cancelled' || redemption.status === 'refunded') {
        return {
          success: false,
          error: 'Redemption already cancelled/refunded',
          code: 'ALREADY_CANCELLED'
        };
      }
      
      // Update redemption status
      redemption.status = 'cancelled';
      redemption.notes.push({
        content: `Discount removed: ${reason}`,
        type: 'customer_service',
        createdAt: new Date()
      });
      await redemption.save();
      
      // Revert discount code usage
      const discountCode = await DiscountCode.findById(redemption.discountCode.codeId);
      if (discountCode) {
        discountCode.currentUsageCount = Math.max(0, discountCode.currentUsageCount - 1);
        discountCode.analytics.totalRedemptions = Math.max(0, discountCode.analytics.totalRedemptions - 1);
        discountCode.analytics.totalRevenue.amount -= redemption.transaction.finalAmount.amount;
        discountCode.analytics.totalDiscountGiven.amount -= redemption.transaction.discountAmount.amount;
        
        // Update status if was exhausted
        if (discountCode.status === 'exhausted' && 
            discountCode.currentUsageCount < discountCode.maxUsesGlobal) {
          discountCode.status = 'active';
        }
        
        await discountCode.save();
      }
      
      // Update campaign analytics if associated
      if (redemption.attribution?.campaignId) {
        await this.updateCampaignAnalytics(redemption.attribution.campaignId, {
          conversions: -1,
          revenue: -redemption.transaction.finalAmount.amount,
          discountAmount: -redemption.transaction.discountAmount.amount
        });
      }
      
      return {
        success: true,
        data: {
          redemptionId,
          originalAmount: redemption.transaction.originalAmount.amount,
          refundedDiscount: redemption.transaction.discountAmount.amount,
          reason
        },
        message: 'Discount code removed successfully'
      };
      
    } catch (error) {
      console.error('Error removing discount code:', error);
      return {
        success: false,
        error: 'Failed to remove discount code',
        code: 'REMOVAL_ERROR'
      };
    }
  }
  
  // =====================================
  // FRAUD DETECTION & PREVENTION
  // =====================================
  
  /**
   * Check fraud controls
   */
  async checkFraudControls(discountCode, context) {
    try {
      const { userId, ipAddress, userAgent, country } = context;
      const fraud = discountCode.fraudControls;
      
      const results = {
        allowed: true,
        reasons: [],
        requiresVerification: false,
        riskScore: 0
      };
      
      // Velocity checks
      if (fraud.velocityChecks?.enabled) {
        const velocityCheck = this.checkVelocityLimits(ipAddress, discountCode._id, fraud.velocityChecks);
        
        if (!velocityCheck.allowed) {
          results.allowed = false;
          results.reasons.push('Velocity limit exceeded');
          results.riskScore += 40;
        }
      }
      
      // Geographic restrictions
      if (fraud.geoRestrictions?.enabled && country) {
        const geoCheck = this.checkGeoRestrictions(country, fraud.geoRestrictions);
        
        if (!geoCheck.allowed) {
          results.allowed = false;
          results.reasons.push('Geographic restriction');
          results.riskScore += 50;
        }
      }
      
      // Bot detection
      if (fraud.botMitigation?.enabled && userAgent) {
        const botCheck = this.checkBotPatterns(userAgent, fraud.botMitigation);
        
        if (!botCheck.allowed) {
          results.allowed = false;
          results.reasons.push('Bot detection');
          results.riskScore += 60;
        }
        
        if (botCheck.requiresVerification) {
          results.requiresVerification = true;
        }
      }
      
      // Suspicious patterns
      if (fraud.suspiciousPatterns?.enabled) {
        const patternCheck = await this.checkSuspiciousPatterns(context, fraud.suspiciousPatterns);
        
        results.riskScore += patternCheck.riskScore;
        
        if (patternCheck.requiresVerification) {
          results.requiresVerification = true;
        }
        
        if (patternCheck.blocked) {
          results.allowed = false;
          results.reasons.push('Suspicious pattern detected');
        }
      }
      
      // Daily usage limits
      const dailyUsage = await this.getDailyCodeUsage(discountCode._id);
      if (dailyUsage >= fraud.maxRedemptionsPerDay) {
        results.allowed = false;
        results.reasons.push('Daily usage limit exceeded');
      }
      
      // Hourly usage limits
      const hourlyUsage = await this.getHourlyCodeUsage(discountCode._id);
      if (hourlyUsage >= fraud.maxRedemptionsPerHour) {
        results.allowed = false;
        results.reasons.push('Hourly usage limit exceeded');
      }
      
      return results;
      
    } catch (error) {
      console.error('Error checking fraud controls:', error);
      return {
        allowed: false,
        reasons: ['Fraud check failed'],
        requiresVerification: true,
        riskScore: 100
      };
    }
  }
  
  /**
   * Check velocity limits
   */
  checkVelocityLimits(ipAddress, codeId, velocitySettings) {
    const key = `${ipAddress}:${codeId}`;
    const now = Date.now();
    const timeWindow = velocitySettings.timeWindow * 1000; // Convert to milliseconds
    
    // Get or initialize velocity data
    let velocityData = this.velocityTracker.get(key) || {
      attempts: [],
      lastCleanup: now
    };
    
    // Clean old attempts
    velocityData.attempts = velocityData.attempts.filter(
      attempt => now - attempt < timeWindow
    );
    
    // Check if limit exceeded
    if (velocityData.attempts.length >= velocitySettings.maxPerIP) {
      return {
        allowed: false,
        reason: 'Too many attempts from this IP',
        nextAllowedAt: new Date(velocityData.attempts[0] + timeWindow)
      };
    }
    
    // Record this attempt
    velocityData.attempts.push(now);
    this.velocityTracker.set(key, velocityData);
    
    return {
      allowed: true,
      attemptsRemaining: velocitySettings.maxPerIP - velocityData.attempts.length
    };
  }
  
  /**
   * Check geographic restrictions
   */
  checkGeoRestrictions(country, geoSettings) {
    // Check blocked countries
    if (geoSettings.blockedCountries?.includes(country)) {
      return {
        allowed: false,
        reason: 'Country is blocked'
      };
    }
    
    // Check allowed countries (if specified)
    if (geoSettings.allowedCountries?.length > 0 && 
        !geoSettings.allowedCountries.includes(country)) {
      return {
        allowed: false,
        reason: 'Country not in allowed list'
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Check bot patterns
   */
  checkBotPatterns(userAgent, botSettings) {
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /postman/i
    ];
    
    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    
    if (isBot) {
      return {
        allowed: false,
        reason: 'Bot user agent detected',
        requiresVerification: botSettings.captchaRequired
      };
    }
    
    return {
      allowed: true,
      requiresVerification: botSettings.captchaRequired && Math.random() < 0.1 // 10% random verification
    };
  }
  
  /**
   * Check suspicious patterns
   */
  async checkSuspiciousPatterns(context, patternSettings) {
    let riskScore = 0;
    let requiresVerification = false;
    let blocked = false;
    
    // Check for multiple attempts with different codes
    if (context.userId) {
      const recentAttempts = await this.getRecentUserAttempts(context.userId, 24); // 24 hours
      
      if (recentAttempts > 10) {
        riskScore += 30;
        requiresVerification = true;
      }
      
      if (recentAttempts > 20) {
        blocked = true;
      }
    }
    
    // Check for IP reputation
    if (context.ipAddress) {
      const ipRisk = await this.checkIpReputation(context.ipAddress);
      riskScore += ipRisk.score;
      
      if (ipRisk.blocked) {
        blocked = true;
      }
    }
    
    return {
      riskScore,
      requiresVerification,
      blocked
    };
  }
  
  // =====================================
  // HELPER METHODS
  // =====================================
  
  /**
   * Validate code data
   */
  validateCodeData(codeData) {
    const required = ['discountType', 'discountValue', 'validity'];
    
    for (const field of required) {
      if (!codeData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    if (codeData.discountType === 'percentage' && codeData.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }
    
    if (codeData.discountValue < 0) {
      throw new Error('Discount value cannot be negative');
    }
    
    if (codeData.validity?.startDate && codeData.validity?.endDate) {
      if (new Date(codeData.validity.startDate) >= new Date(codeData.validity.endDate)) {
        throw new Error('End date must be after start date');
      }
    }
  }
  
  /**
   * Process code data before saving
   */
  processCodeData(codeData, createdBy) {
    return {
      ...codeData,
      code: codeData.code.toUpperCase(),
      createdBy,
      updatedBy: createdBy,
      analytics: {
        totalRedemptions: 0,
        uniqueUsers: 0,
        totalRevenue: { amount: 0, currency: codeData.currency || 'USD' },
        totalDiscountGiven: { amount: 0, currency: codeData.currency || 'USD' },
        averageOrderValue: { amount: 0, currency: codeData.currency || 'USD' },
        conversionRate: 0,
        fraudAttempts: 0,
        performanceScore: 0
      }
    };
  }
  
  /**
   * Generate unique discount code
   */
  async generateUniqueCode(options = {}) {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const code = DiscountCode.generateCode(options);
      
      const existingCode = await DiscountCode.findOne({ code });
      if (!existingCode) {
        return code;
      }
      
      attempts++;
    }
    
    throw new Error('Unable to generate unique code after maximum attempts');
  }
  
  /**
   * Generate batch ID
   */
  generateBatchId() {
    return `BATCH_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  
  /**
   * Get invalid reason for discount code
   */
  getInvalidReason(discountCode) {
    const now = new Date();
    
    if (discountCode.status === 'inactive') return 'Discount code is inactive';
    if (discountCode.status === 'expired') return 'Discount code has expired';
    if (discountCode.status === 'exhausted') return 'Discount code usage limit reached';
    if (discountCode.validity.startDate && now < discountCode.validity.startDate) return 'Discount code is not yet active';
    if (discountCode.validity.endDate && now > discountCode.validity.endDate) return 'Discount code has expired';
    
    return 'Discount code is not valid';
  }
  
  /**
   * Get invalid code for discount code
   */
  getInvalidCode(discountCode) {
    const now = new Date();
    
    if (discountCode.status === 'inactive') return 'INACTIVE';
    if (discountCode.status === 'expired') return 'EXPIRED';
    if (discountCode.status === 'exhausted') return 'EXHAUSTED';
    if (discountCode.validity.startDate && now < discountCode.validity.startDate) return 'NOT_ACTIVE';
    if (discountCode.validity.endDate && now > discountCode.validity.endDate) return 'EXPIRED';
    
    return 'INVALID';
  }
  
  /**
   * Build discount query from filters
   */
  buildDiscountQuery(filters) {
    const query = {};
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.discountType) {
      query.discountType = filters.discountType;
    }
    
    if (filters.channel) {
      query['campaign.channel'] = filters.channel;
    }
    
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }
    
    if (filters.search) {
      query.$or = [
        { code: new RegExp(filters.search, 'i') },
        { name: new RegExp(filters.search, 'i') },
        { description: new RegExp(filters.search, 'i') }
      ];
    }
    
    return query;
  }
  
  /**
   * Create redemption record
   */
  async createRedemptionRecord(discountCode, transactionData, context) {
    const redemptionData = {
      discountCode: {
        codeId: discountCode._id,
        code: discountCode.code,
        discountType: discountCode.discountType,
        discountValue: discountCode.discountValue
      },
      user: {
        userId: context.userId,
        email: context.userEmail,
        isNewCustomer: context.isNewCustomer || false
      },
      transaction: {
        transactionId: transactionData.transactionId,
        subscriptionId: transactionData.subscriptionId,
        invoiceId: transactionData.invoiceId,
        originalAmount: {
          amount: transactionData.originalAmount,
          currency: transactionData.currency || 'USD'
        },
        discountAmount: {
          amount: transactionData.discountAmount,
          currency: transactionData.currency || 'USD'
        },
        finalAmount: {
          amount: transactionData.finalAmount,
          currency: transactionData.currency || 'USD'
        }
      },
      context: {
        ipAddress: context.ipAddress,
        country: context.country,
        userAgent: context.userAgent,
        deviceType: context.deviceType || 'unknown'
      },
      attribution: discountCode.attribution,
      status: 'applied',
      validation: {
        isValid: true,
        eligibilityPassed: true,
        fraudChecksPassed: true,
        validatedAt: new Date()
      }
    };
    
    const redemption = new DiscountRedemption(redemptionData);
    await redemption.save();
    
    return redemption;
  }
  
  /**
   * Record velocity for fraud prevention
   */
  recordVelocity(ipAddress, codeId) {
    // In production, this would use Redis with TTL
    const key = `velocity:${ipAddress}:${codeId}`;
    const now = Date.now();
    
    let velocityData = this.velocityTracker.get(key) || [];
    velocityData.push(now);
    
    // Keep only last hour
    velocityData = velocityData.filter(timestamp => now - timestamp < 3600000);
    
    this.velocityTracker.set(key, velocityData);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupVelocityTracker();
    }
  }
  
  /**
   * Clean up velocity tracker
   */
  cleanupVelocityTracker() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    for (const [key, timestamps] of this.velocityTracker.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > oneHourAgo);
      
      if (validTimestamps.length === 0) {
        this.velocityTracker.delete(key);
      } else {
        this.velocityTracker.set(key, validTimestamps);
      }
    }
  }
  
  /**
   * Additional helper methods would go here...
   */
  
}

module.exports = DiscountManagementService;





