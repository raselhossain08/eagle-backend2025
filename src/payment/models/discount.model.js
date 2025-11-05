const mongoose = require("mongoose");

// Enhanced Discount Code Schema with Enterprise Features
const discountCodeSchema = new mongoose.Schema({
  // Core Information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]+$/.test(v); // Only alphanumeric uppercase
      },
      message: 'Code must contain only uppercase letters and numbers'
    }
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
  internalNotes: {
    type: String,
    trim: true
  },
  
  // Discount Configuration
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_trial_days', 'free_months', 'shipping_discount', 'buy_x_get_y'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscountAmount: { // Cap for percentage discounts
    type: Number,
    min: 0
  },
  
  // Buy X Get Y Configuration (for BXGY type)
  bxgyConfig: {
    buyQuantity: Number,
    getQuantity: Number,
    getDiscountPercent: Number,
    applicableProducts: [String] // Product IDs or plan IDs
  },
  
  // Validity Period
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  startDate: {
    type: Date,
    default: Date.now,
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
  
  // Usage Limits
  usageLimits: {
    totalUses: {
      type: Number,
      min: 0
    },
    perCustomer: {
      type: Number,
      default: 1,
      min: 0
    },
    perDay: Number,
    perHour: Number,
    perSession: {
      type: Number,
      default: 1
    }
  },
  
  // Current Usage Tracking
  usage: {
    totalCount: {
      type: Number,
      default: 0,
      index: true
    },
    uniqueCustomers: {
      type: Number,
      default: 0
    },
    lastUsedAt: Date,
    dailyUsage: [{
      date: Date,
      count: Number
    }],
    hourlyUsage: [{
      hour: Date,
      count: Number
    }]
  },
  
  // Eligibility Criteria
  eligibility: {
    // Customer Criteria
    customerSegments: [String], // Customer segment IDs
    newCustomersOnly: {
      type: Boolean,
      default: false
    },
    existingCustomersOnly: {
      type: Boolean,
      default: false
    },
    customerTiers: [String], // VIP, Premium, etc.
    excludedCustomers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    
    // Geographic Restrictions
    allowedCountries: [String], // ISO country codes
    excludedCountries: [String],
    allowedRegions: [String],
    excludedRegions: [String],
    
    // Product/Plan Restrictions
    applicablePlans: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    }],
    excludedPlans: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    }],
    billingCycles: [{
      type: String,
      enum: ['monthly', 'quarterly', 'semiannual', 'annual']
    }],
    
    // Purchase Requirements
    minimumPurchaseAmount: {
      type: Number,
      min: 0
    },
    maximumPurchaseAmount: Number,
    minimumQuantity: Number,
    requiredProducts: [String], // Must have these in cart
    
    // Subscription Requirements
    subscriptionStatus: [String], // active, cancelled, expired, etc.
    subscriptionDuration: {
      operator: {
        type: String,
        enum: ['gt', 'gte', 'lt', 'lte', 'eq']
      },
      value: Number, // in months
      unit: {
        type: String,
        enum: ['days', 'months', 'years'],
        default: 'months'
      }
    }
  },
  
  // Fraud Prevention
  fraudPrevention: {
    velocityLimits: {
      maxAttemptsPerMinute: {
        type: Number,
        default: 5
      },
      maxAttemptsPerHour: {
        type: Number,
        default: 20
      },
      maxAttemptsPerDay: {
        type: Number,
        default: 50
      }
    },
    deviceFingerprinting: {
      enabled: {
        type: Boolean,
        default: true
      },
      maxDevicesPerCustomer: Number
    },
    ipRestrictions: {
      enabled: {
        type: Boolean,
        default: false
      },
      allowedIPs: [String],
      blockedIPs: [String],
      maxIPsPerCustomer: Number
    },
    geoValidation: {
      enabled: {
        type: Boolean,
        default: false
      },
      strictMode: Boolean // Require exact location match
    },
    botDetection: {
      enabled: {
        type: Boolean,
        default: true
      },
      challengeThreshold: {
        type: Number,
        default: 3 // Failed attempts before challenge
      }
    },
    anomalyDetection: {
      enabled: {
        type: Boolean,
        default: true
      },
      suspiciousPatterns: [String],
      riskScore: {
        threshold: {
          type: Number,
          default: 70
        },
        factors: [{
          name: String,
          weight: Number,
          enabled: Boolean
        }]
      }
    }
  },
  
  // Stacking and Combination Rules
  stacking: {
    allowStacking: {
      type: Boolean,
      default: false
    },
    stackableWith: [String], // Specific code types or IDs
    exclusiveWith: [String], // Cannot be used with these
    priority: {
      type: Number,
      default: 0 // Higher number = higher priority
    },
    maxStackedDiscount: Number, // Maximum combined discount
    stackingBehavior: {
      type: String,
      enum: ['additive', 'multiplicative', 'best_single', 'custom'],
      default: 'additive'
    }
  },
  
  // Duration and Recurrence
  discountDuration: {
    type: {
      type: String,
      enum: ['one_time', 'recurring', 'forever', 'trial_period'],
      default: 'one_time'
    },
    recurringMonths: Number,
    trialPeriodDays: Number
  },
  
  // Campaign and Tracking
  campaign: {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionCampaign'
    },
    source: {
      type: String,
      enum: ['manual', 'automatic', 'api', 'import', 'campaign']
    },
    channel: String, // email, social, affiliate, etc.
    attribution: {
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
      utmTerm: String,
      utmContent: String
    }
  },
  
  // Advanced Configuration
  advanced: {
    requiresApproval: {
      type: Boolean,
      default: false
    },
    autoApprove: {
      conditions: [{
        field: String,
        operator: String,
        value: mongoose.Schema.Types.Mixed
      }]
    },
    customValidation: {
      enabled: Boolean,
      script: String, // JavaScript validation code
      endpoint: String // External validation endpoint
    },
    webhooks: [{
      event: {
        type: String,
        enum: ['applied', 'attempted', 'fraud_detected', 'expired']
      },
      url: String,
      secret: String
    }]
  },
  
  // Metadata and Customization
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  tags: [String],
  
  // Admin Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true,
  indexes: [
    { code: 1 },
    { isActive: 1, startDate: 1, endDate: 1 },
    { 'eligibility.applicablePlans': 1 },
    { 'eligibility.customerSegments': 1 },
    { 'usage.totalCount': 1 },
    { 'campaign.campaignId': 1 },
    { tags: 1 },
    { createdAt: -1 }
  ]
});

// Virtuals
discountCodeSchema.virtual('isExpired').get(function() {
  return this.endDate && new Date() > this.endDate;
});

discountCodeSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         (!this.endDate || now <= this.endDate) && 
         now >= this.startDate &&
         (!this.usageLimits.totalUses || this.usage.totalCount < this.usageLimits.totalUses);
});

discountCodeSchema.virtual('remainingUses').get(function() {
  if (!this.usageLimits.totalUses) return Infinity;
  return Math.max(0, this.usageLimits.totalUses - this.usage.totalCount);
});

discountCodeSchema.virtual('usageRate').get(function() {
  if (!this.usageLimits.totalUses) return this.usage.totalCount;
  return (this.usage.totalCount / this.usageLimits.totalUses) * 100;
});

// Instance Methods
discountCodeSchema.methods.calculateDiscount = function(amount, context = {}) {
  let discountAmount = 0;
  
  switch (this.type) {
    case 'percentage':
      discountAmount = amount * (this.value / 100);
      if (this.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
      }
      break;
    case 'fixed_amount':
      discountAmount = Math.min(this.value, amount);
      break;
    case 'free_trial_days':
    case 'free_months':
      discountAmount = 0; // Handled in subscription logic
      break;
    case 'shipping_discount':
      discountAmount = Math.min(this.value, context.shippingCost || 0);
      break;
    case 'buy_x_get_y':
      // Complex BXGY logic would go here
      discountAmount = 0;
      break;
    default:
      discountAmount = 0;
  }
  
  return Math.round(discountAmount * 100) / 100;
};

discountCodeSchema.methods.checkEligibility = async function(user, context = {}) {
  const eligibilityErrors = [];
  
  // Check if code is valid
  if (!this.isValid) {
    eligibilityErrors.push('Discount code is expired or inactive');
  }
  
  // Check customer eligibility
  if (this.eligibility.newCustomersOnly && context.isExistingCustomer) {
    eligibilityErrors.push('This discount is only for new customers');
  }
  
  if (this.eligibility.existingCustomersOnly && !context.isExistingCustomer) {
    eligibilityErrors.push('This discount is only for existing customers');
  }
  
  if (this.eligibility.excludedCustomers.includes(user._id)) {
    eligibilityErrors.push('You are not eligible for this discount');
  }
  
  // Check geographic restrictions
  if (this.eligibility.allowedCountries.length > 0 && 
      !this.eligibility.allowedCountries.includes(context.country)) {
    eligibilityErrors.push('This discount is not available in your country');
  }
  
  if (this.eligibility.excludedCountries.includes(context.country)) {
    eligibilityErrors.push('This discount is not available in your country');
  }
  
  // Check purchase amount
  if (this.eligibility.minimumPurchaseAmount && 
      context.purchaseAmount < this.eligibility.minimumPurchaseAmount) {
    eligibilityErrors.push(`Minimum purchase amount of $${this.eligibility.minimumPurchaseAmount} required`);
  }
  
  if (this.eligibility.maximumPurchaseAmount && 
      context.purchaseAmount > this.eligibility.maximumPurchaseAmount) {
    eligibilityErrors.push(`Maximum purchase amount of $${this.eligibility.maximumPurchaseAmount} exceeded`);
  }
  
  // Check per-customer usage limit
  const userUsageCount = await mongoose.model('DiscountRedemption').countDocuments({
    discountCode: this._id,
    userId: user._id,
    status: 'completed'
  });
  
  if (userUsageCount >= this.usageLimits.perCustomer) {
    eligibilityErrors.push('You have already used this discount code');
  }
  
  return {
    isEligible: eligibilityErrors.length === 0,
    errors: eligibilityErrors
  };
};

discountCodeSchema.methods.checkFraudRisk = function(context = {}) {
  const riskFactors = [];
  let riskScore = 0;
  
  // Velocity checks
  if (context.recentAttempts > this.fraudPrevention.velocityLimits.maxAttemptsPerMinute) {
    riskFactors.push('High velocity - too many attempts');
    riskScore += 25;
  }
  
  // IP reputation
  if (this.fraudPrevention.ipRestrictions.blockedIPs.includes(context.ipAddress)) {
    riskFactors.push('Blocked IP address');
    riskScore += 50;
  }
  
  // Geographic anomaly
  if (context.geoAnomaly) {
    riskFactors.push('Geographic anomaly detected');
    riskScore += 20;
  }
  
  // Device fingerprint
  if (context.suspiciousDevice) {
    riskFactors.push('Suspicious device fingerprint');
    riskScore += 30;
  }
  
  // Bot detection
  if (context.botScore > 0.7) {
    riskFactors.push('High bot probability');
    riskScore += 40;
  }
  
  return {
    riskScore,
    riskFactors,
    requiresReview: riskScore > this.fraudPrevention.anomalyDetection.riskScore.threshold,
    blocked: riskScore > 90
  };
};

// Static Methods
discountCodeSchema.statics.validateAndApply = async function(code, user, context = {}) {
  const discount = await this.findOne({ 
    code: code.toUpperCase(), 
    isActive: true 
  });
  
  if (!discount) {
    throw new Error('Invalid discount code');
  }
  
  // Check eligibility
  const eligibilityCheck = await discount.checkEligibility(user, context);
  if (!eligibilityCheck.isEligible) {
    throw new Error(eligibilityCheck.errors[0]);
  }
  
  // Check fraud risk
  const fraudCheck = discount.checkFraudRisk(context);
  if (fraudCheck.blocked) {
    throw new Error('Discount application blocked due to security concerns');
  }
  
  // Calculate discount
  const discountAmount = discount.calculateDiscount(context.purchaseAmount, context);
  
  return {
    discount,
    discountAmount,
    fraudCheck,
    requiresApproval: discount.advanced.requiresApproval || fraudCheck.requiresReview
  };
};

discountCodeSchema.statics.generateCode = function(length = 8, prefix = '') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix;
  for (let i = 0; i < length - prefix.length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Discount Redemption Schema
const discountRedemptionSchema = new mongoose.Schema({
  // References
  discountCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscountCode',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  orderId: String, // For e-commerce orders
  
  // Redemption Details
  originalAmount: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true
  },
  finalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: ['pending', 'applied', 'completed', 'failed', 'reversed', 'expired'],
    default: 'pending',
    index: true
  },
  redemptionMethod: {
    type: String,
    enum: ['manual', 'automatic', 'api', 'checkout'],
    default: 'manual'
  },
  
  // Technical Details
  sessionId: String,
  deviceFingerprint: {
    userAgent: String,
    screenResolution: String,
    timezone: String,
    language: String,
    platform: String,
    cookiesEnabled: Boolean,
    javaEnabled: Boolean,
    browserPlugins: [String]
  },
  ipAddress: String,
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    accuracy: Number
  },
  
  // Fraud Analysis
  fraudAnalysis: {
    riskScore: {
      type: Number,
      default: 0
    },
    riskFactors: [String],
    velocityFlags: [{
      type: String,
      value: Number,
      threshold: Number
    }],
    ipReputation: {
      score: Number,
      source: String,
      lastUpdated: Date
    },
    deviceTrust: {
      score: Number,
      isNewDevice: Boolean,
      deviceAge: Number
    },
    anomalies: [String]
  },
  
  // Attribution
  attribution: {
    source: String,
    medium: String,
    campaign: String,
    term: String,
    content: String,
    referrer: String,
    landingPage: String
  },
  
  // Reversal Information
  reversal: {
    isReversed: {
      type: Boolean,
      default: false
    },
    reversedAt: Date,
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reversalReason: String,
    refundAmount: Number
  },
  
  // Approval Workflow
  approval: {
    required: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  notes: String
}, {
  timestamps: true,
  indexes: [
    { discountCode: 1, userId: 1 },
    { status: 1, createdAt: -1 },
    { userId: 1, createdAt: -1 },
    { ipAddress: 1, createdAt: -1 },
    { sessionId: 1 },
    { 'approval.status': 1 }
  ]
});

// Promotion Campaign Schema
const promotionCampaignSchema = new mongoose.Schema({
  // Campaign Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  campaignType: {
    type: String,
    enum: ['seasonal', 'product_launch', 'customer_acquisition', 'retention', 'win_back', 'upsell', 'referral'],
    required: true
  },
  
  // Campaign Period
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Campaign Status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  // Target Audience
  targeting: {
    customerSegments: [String],
    demographics: {
      ageRange: {
        min: Number,
        max: Number
      },
      genders: [String],
      locations: {
        countries: [String],
        regions: [String],
        cities: [String]
      }
    },
    behavioral: {
      purchaseHistory: {
        minOrders: Number,
        maxOrders: Number,
        minSpent: Number,
        maxSpent: Number,
        timeframe: String // '30d', '90d', '1y'
      },
      subscriptionStatus: [String],
      lastActivity: {
        operator: String, // 'gt', 'lt', 'between'
        value: Number,
        unit: String // 'days', 'weeks', 'months'
      }
    },
    excludeSegments: [String]
  },
  
  // Associated Discount Codes
  discountCodes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscountCode'
  }],
  
  // Campaign Configuration
  configuration: {
    autoGenerateCodes: {
      enabled: Boolean,
      prefix: String,
      codeLength: Number,
      quantity: Number
    },
    distributionChannels: [{
      type: String,
      enum: ['email', 'sms', 'push', 'social', 'affiliate', 'influencer', 'print'],
      config: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    }],
    personalizedOffers: {
      enabled: Boolean,
      algorithm: String,
      factors: [String]
    }
  },
  
  // Budget and Goals
  budget: {
    maxSpend: Number,
    currentSpend: {
      type: Number,
      default: 0
    },
    costPerAcquisition: Number,
    projectedROI: Number
  },
  goals: {
    targetCustomers: Number,
    targetRevenue: Number,
    targetRedemptions: Number,
    conversionRate: Number
  },
  
  // Performance Metrics
  performance: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    redemptions: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    newCustomers: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    roi: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    customerLifetimeValue: {
      type: Number,
      default: 0
    }
  },
  
  // A/B Testing
  abTesting: {
    enabled: Boolean,
    variants: [{
      name: String,
      percentage: Number,
      discountCodes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiscountCode'
      }],
      performance: {
        impressions: Number,
        clicks: Number,
        redemptions: Number,
        revenue: Number
      }
    }],
    winningVariant: String
  },
  
  // Automation Rules
  automation: {
    autoStart: Boolean,
    autoEnd: Boolean,
    pauseConditions: [{
      metric: String,
      operator: String,
      value: Number
    }],
    stopConditions: [{
      metric: String,
      operator: String,
      value: Number
    }],
    notifications: [{
      event: String,
      recipients: [String],
      template: String
    }]
  },
  
  // Metadata and Admin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  indexes: [
    { status: 1, startDate: 1, endDate: 1 },
    { campaignType: 1 },
    { createdBy: 1 },
    { tags: 1 },
    { 'targeting.customerSegments': 1 }
  ]
});

// Models
const DiscountCode = mongoose.model('DiscountCode', discountCodeSchema);
const DiscountRedemption = mongoose.model('DiscountRedemption', discountRedemptionSchema);
const PromotionCampaign = mongoose.model('PromotionCampaign', promotionCampaignSchema);

module.exports = {
  DiscountCode,
  DiscountRedemption,
  PromotionCampaign
};





