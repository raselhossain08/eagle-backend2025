const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
  // Basic Information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'exhausted', 'scheduled'],
    default: 'active',
    index: true
  },
  
  // Discount Configuration
  discountType: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_trial_days', 'first_period_only', 'recurring_discount'],
    required: true,
    index: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  
  // Application Scope
  applicationType: {
    type: String,
    enum: ['subscription', 'invoice', 'plan_specific', 'order_level'],
    default: 'subscription',
    index: true
  },
  applicablePlans: [{
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    },
    planName: String
  }],
  excludedPlans: [{
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    },
    planName: String
  }],
  
  // Recurrence Settings
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSettings: {
    type: {
      type: String,
      enum: ['forever', 'limited_cycles', 'time_based']
    },
    maxCycles: Number,
    duration: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months', 'years']
      }
    }
  },
  
  // Usage Controls
  usageType: {
    type: String,
    enum: ['single_use', 'multi_use', 'unlimited'],
    default: 'single_use',
    index: true
  },
  maxUsesGlobal: {
    type: Number,
    min: 1
  },
  maxUsesPerUser: {
    type: Number,
    min: 1,
    default: 1
  },
  currentUsageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Stackability Rules
  stackable: {
    type: Boolean,
    default: false
  },
  stackingPriority: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },
  conflictingCodes: [{
    codeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscountCode'
    },
    code: String
  }],
  
  // Eligibility Rules
  eligibility: {
    customerType: {
      type: String,
      enum: ['all', 'new_only', 'existing_only', 'returning', 'specific_segment'],
      default: 'all'
    },
    customerSegments: [{
      segmentId: String,
      segmentName: String
    }],
    countries: [{
      code: String,
      name: String
    }],
    excludedCountries: [{
      code: String,
      name: String
    }],
    emailDomains: [{
      domain: String,
      type: {
        type: String,
        enum: ['allowed', 'blocked']
      }
    }],
    minimumOrderValue: {
      amount: Number,
      currency: String
    },
    maximumOrderValue: {
      amount: Number,
      currency: String
    },
    subscriptionAge: {
      min: Number, // days
      max: Number  // days
    }
  },
  
  // Validity Period
  validity: {
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      index: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    gracePeriod: {
      value: Number,
      unit: {
        type: String,
        enum: ['hours', 'days']
      }
    }
  },
  
  // Campaign Association
  campaign: {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign'
    },
    campaignName: String,
    channel: {
      type: String,
      enum: ['email', 'social', 'paid_ads', 'affiliate', 'referral', 'direct', 'partnership', 'influencer'],
      index: true
    },
    source: String,
    medium: String,
    tags: [String]
  },
  
  // Affiliate & Referral Tracking
  attribution: {
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    affiliateName: String,
    referralCode: String,
    trackingUrl: String,
    utmParameters: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    },
    commissionRate: {
      type: Number,
      min: 0,
      max: 100
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed_amount']
    }
  },
  
  // Fraud Controls
  fraudControls: {
    maxRedemptionsPerHour: {
      type: Number,
      default: 100
    },
    maxRedemptionsPerDay: {
      type: Number,
      default: 1000
    },
    velocityChecks: {
      enabled: {
        type: Boolean,
        default: true
      },
      maxPerIP: {
        type: Number,
        default: 5
      },
      timeWindow: {
        type: Number,
        default: 3600 // seconds
      }
    },
    geoRestrictions: {
      enabled: {
        type: Boolean,
        default: false
      },
      allowedCountries: [String],
      blockedCountries: [String],
      vpnDetection: {
        type: Boolean,
        default: false
      }
    },
    botMitigation: {
      enabled: {
        type: Boolean,
        default: true
      },
      captchaRequired: {
        type: Boolean,
        default: false
      },
      honeypotFields: {
        type: Boolean,
        default: true
      }
    },
    suspiciousPatterns: {
      enabled: {
        type: Boolean,
        default: true
      },
      patterns: [{
        type: String,
        description: String,
        action: {
          type: String,
          enum: ['flag', 'block', 'require_verification']
        }
      }]
    }
  },
  
  // Analytics & Tracking
  analytics: {
    totalRedemptions: {
      type: Number,
      default: 0
    },
    uniqueUsers: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    totalDiscountGiven: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    averageOrderValue: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    fraudAttempts: {
      type: Number,
      default: 0
    },
    lastRedemption: Date,
    performanceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  
  // Generation Information
  generation: {
    method: {
      type: String,
      enum: ['manual', 'bulk_generated', 'imported', 'api_created'],
      default: 'manual'
    },
    batchId: String,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pattern: String,
    prefix: String,
    suffix: String
  },
  
  // Metadata
  metadata: {
    internalNotes: String,
    customerFacingMessage: String,
    termsAndConditions: String,
    helpText: String,
    displayName: String,
    icon: String,
    color: String,
    priority: {
      type: Number,
      default: 0
    },
    featured: {
      type: Boolean,
      default: false
    },
    hidden: {
      type: Boolean,
      default: false
    }
  },
  
  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedAt: Date,
  
  // Versioning
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    changes: mongoose.Schema.Types.Mixed,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: Date
  }]
}, {
  timestamps: true,
  collection: 'discount_codes'
});

// Indexes
discountCodeSchema.index({ code: 1, status: 1 });
discountCodeSchema.index({ 'validity.startDate': 1, 'validity.endDate': 1 });
discountCodeSchema.index({ 'campaign.channel': 1, status: 1 });
discountCodeSchema.index({ discountType: 1, applicationType: 1 });
discountCodeSchema.index({ 'eligibility.customerType': 1 });
discountCodeSchema.index({ 'attribution.affiliateId': 1 });
discountCodeSchema.index({ createdAt: -1 });
discountCodeSchema.index({ 'analytics.totalRedemptions': -1 });
discountCodeSchema.index({ 'analytics.performanceScore': -1 });
discountCodeSchema.index({ 'generation.batchId': 1 });

// Virtual for checking if code is currently valid
discountCodeSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  const startDate = this.validity.startDate;
  const endDate = this.validity.endDate;
  
  if (this.status !== 'active') return false;
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  if (this.maxUsesGlobal && this.currentUsageCount >= this.maxUsesGlobal) return false;
  
  return true;
});

// Virtual for usage percentage
discountCodeSchema.virtual('usagePercentage').get(function() {
  if (!this.maxUsesGlobal) return 0;
  return Math.round((this.currentUsageCount / this.maxUsesGlobal) * 100);
});

// Virtual for days until expiry
discountCodeSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.validity.endDate) return null;
  const now = new Date();
  const diffTime = this.validity.endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for revenue impact
discountCodeSchema.virtual('revenueImpact').get(function() {
  const revenue = this.analytics.totalRevenue.amount || 0;
  const discount = this.analytics.totalDiscountGiven.amount || 0;
  return {
    gross: revenue + discount,
    net: revenue,
    discount: discount,
    discountPercentage: revenue > 0 ? Math.round((discount / (revenue + discount)) * 100) : 0
  };
});

// Methods
discountCodeSchema.methods.checkEligibility = function(user, order, context = {}) {
  const eligibility = this.eligibility;
  const results = {
    eligible: true,
    reasons: [],
    warnings: []
  };
  
  // Check customer type
  if (eligibility.customerType === 'new_only' && user && user.subscriptionHistory?.length > 0) {
    results.eligible = false;
    results.reasons.push('Code is for new customers only');
  }
  
  // Check country eligibility
  if (eligibility.countries?.length > 0) {
    const userCountry = context.country || user?.billingAddress?.country;
    if (userCountry && !eligibility.countries.some(c => c.code === userCountry)) {
      results.eligible = false;
      results.reasons.push('Code not available in your country');
    }
  }
  
  // Check excluded countries
  if (eligibility.excludedCountries?.length > 0) {
    const userCountry = context.country || user?.billingAddress?.country;
    if (userCountry && eligibility.excludedCountries.some(c => c.code === userCountry)) {
      results.eligible = false;
      results.reasons.push('Code not available in your country');
    }
  }
  
  // Check email domain
  if (eligibility.emailDomains?.length > 0 && user?.email) {
    const userDomain = user.email.split('@')[1]?.toLowerCase();
    const domainRule = eligibility.emailDomains.find(d => d.domain === userDomain);
    
    if (domainRule) {
      if (domainRule.type === 'blocked') {
        results.eligible = false;
        results.reasons.push('Code not available for your email domain');
      }
    } else {
      // If domains are specified but user's domain isn't in allowed list
      const hasAllowedDomains = eligibility.emailDomains.some(d => d.type === 'allowed');
      if (hasAllowedDomains) {
        results.eligible = false;
        results.reasons.push('Code not available for your email domain');
      }
    }
  }
  
  // Check minimum order value
  if (eligibility.minimumOrderValue && order) {
    if (order.total < eligibility.minimumOrderValue.amount) {
      results.eligible = false;
      results.reasons.push(`Minimum order value of ${eligibility.minimumOrderValue.currency} ${eligibility.minimumOrderValue.amount} required`);
    }
  }
  
  // Check maximum order value
  if (eligibility.maximumOrderValue && order) {
    if (order.total > eligibility.maximumOrderValue.amount) {
      results.eligible = false;
      results.reasons.push(`Maximum order value of ${eligibility.maximumOrderValue.currency} ${eligibility.maximumOrderValue.amount} exceeded`);
    }
  }
  
  return results;
};

discountCodeSchema.methods.calculateDiscount = function(orderValue, context = {}) {
  if (!this.isCurrentlyValid) {
    return { amount: 0, error: 'Code is not valid' };
  }
  
  let discountAmount = 0;
  
  switch (this.discountType) {
    case 'percentage':
      discountAmount = (orderValue * this.discountValue) / 100;
      if (this.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
      }
      break;
      
    case 'fixed_amount':
      discountAmount = Math.min(this.discountValue, orderValue);
      break;
      
    case 'free_trial_days':
      // This would be handled differently in subscription logic
      return { 
        amount: 0, 
        freeTrialDays: this.discountValue,
        type: 'free_trial'
      };
      
    case 'first_period_only':
      discountAmount = context.isFirstPeriod ? 
        (this.discountValue > 1 ? 
          Math.min(this.discountValue, orderValue) : 
          (orderValue * this.discountValue)) : 0;
      break;
      
    default:
      discountAmount = 0;
  }
  
  return {
    amount: Math.round(discountAmount * 100) / 100,
    type: this.discountType,
    currency: this.currency
  };
};

discountCodeSchema.methods.incrementUsage = async function(userId, context = {}) {
  this.currentUsageCount += 1;
  this.analytics.totalRedemptions += 1;
  this.analytics.lastRedemption = new Date();
  
  if (context.revenue) {
    this.analytics.totalRevenue.amount += context.revenue;
  }
  
  if (context.discountAmount) {
    this.analytics.totalDiscountGiven.amount += context.discountAmount;
  }
  
  // Update status if exhausted
  if (this.maxUsesGlobal && this.currentUsageCount >= this.maxUsesGlobal) {
    this.status = 'exhausted';
  }
  
  return this.save();
};

discountCodeSchema.methods.checkFraudControls = function(context = {}) {
  const fraud = this.fraudControls;
  const results = {
    allowed: true,
    reasons: [],
    requiresVerification: false
  };
  
  // Check velocity limits
  if (fraud.velocityChecks?.enabled) {
    // This would need to be implemented with Redis or similar for rate limiting
    // Placeholder for rate limiting logic
  }
  
  // Check geo restrictions
  if (fraud.geoRestrictions?.enabled && context.country) {
    if (fraud.geoRestrictions.blockedCountries?.includes(context.country)) {
      results.allowed = false;
      results.reasons.push('Geographic restriction');
    }
    
    if (fraud.geoRestrictions.allowedCountries?.length > 0 && 
        !fraud.geoRestrictions.allowedCountries.includes(context.country)) {
      results.allowed = false;
      results.reasons.push('Geographic restriction');
    }
  }
  
  // Check for bot patterns
  if (fraud.botMitigation?.enabled) {
    if (context.userAgent && context.userAgent.includes('bot')) {
      results.allowed = false;
      results.reasons.push('Bot detection');
    }
    
    if (fraud.botMitigation.captchaRequired) {
      results.requiresVerification = true;
    }
  }
  
  return results;
};

// Statics
discountCodeSchema.statics.generateCode = function(options = {}) {
  const {
    prefix = '',
    suffix = '',
    length = 8,
    pattern = 'ALPHANUMERIC'
  } = options;
  
  let chars = '';
  switch (pattern) {
    case 'ALPHANUMERIC':
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      break;
    case 'ALPHABETIC':
      chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      break;
    case 'NUMERIC':
      chars = '0123456789';
      break;
    default:
      chars = pattern;
  }
  
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += suffix;
  
  return result;
};

discountCodeSchema.statics.findValidCodes = function(filters = {}) {
  const query = {
    status: 'active',
    'validity.startDate': { $lte: new Date() },
    $or: [
      { 'validity.endDate': { $exists: false } },
      { 'validity.endDate': { $gte: new Date() } }
    ]
  };
  
  if (filters.channel) {
    query['campaign.channel'] = filters.channel;
  }
  
  if (filters.discountType) {
    query.discountType = filters.discountType;
  }
  
  return this.find(query);
};

// Pre-save middleware
discountCodeSchema.pre('save', function(next) {
  // Auto-update status based on validity and usage
  const now = new Date();
  
  if (this.validity.endDate && now > this.validity.endDate) {
    this.status = 'expired';
  }
  
  if (this.validity.startDate && now < this.validity.startDate && this.status === 'active') {
    this.status = 'scheduled';
  }
  
  if (this.maxUsesGlobal && this.currentUsageCount >= this.maxUsesGlobal) {
    this.status = 'exhausted';
  }
  
  // Calculate performance score
  if (this.analytics.totalRedemptions > 0) {
    const conversionRate = this.analytics.conversionRate || 0;
    const revenueImpact = this.analytics.totalRevenue.amount || 0;
    const fraudRate = this.analytics.fraudAttempts / this.analytics.totalRedemptions;
    
    this.analytics.performanceScore = Math.round(
      (conversionRate * 0.4) + 
      (Math.min(revenueImpact / 1000, 50) * 0.4) + 
      ((1 - fraudRate) * 20)
    );
  }
  
  next();
});

module.exports = mongoose.model('DiscountCode', discountCodeSchema);





