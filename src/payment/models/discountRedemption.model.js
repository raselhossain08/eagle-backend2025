const mongoose = require('mongoose');

const discountRedemptionSchema = new mongoose.Schema({
  // Basic Information
  redemptionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Discount Code Reference
  discountCode: {
    codeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscountCode',
      required: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    discountType: String,
    discountValue: Number
  },
  
  // User Information
  user: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    email: {
      type: String,
      lowercase: true,
      index: true
    },
    isNewCustomer: {
      type: Boolean,
      default: false
    },
    customerSegment: String,
    loyaltyTier: String
  },
  
  // Transaction Details
  transaction: {
    transactionId: String,
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    orderId: String,
    originalAmount: {
      amount: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        required: true,
        uppercase: true
      }
    },
    discountAmount: {
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        required: true,
        uppercase: true
      }
    },
    finalAmount: {
      amount: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        required: true,
        uppercase: true
      }
    },
    taxAmount: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    }
  },
  
  // Product/Plan Information
  items: [{
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    },
    planName: String,
    planType: String,
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: {
      amount: Number,
      currency: String
    },
    discountApplied: {
      amount: Number,
      currency: String
    }
  }],
  
  // Campaign Attribution
  attribution: {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign'
    },
    campaignName: String,
    channel: String,
    source: String,
    medium: String,
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    affiliateName: String,
    referralCode: String,
    utmParameters: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    },
    trackingUrl: String,
    clickId: String
  },
  
  // Geographic & Technical Context
  context: {
    ipAddress: {
      type: String,
      select: false // Hidden by default for privacy
    },
    country: String,
    region: String,
    city: String,
    timezone: String,
    userAgent: String,
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown']
    },
    browser: String,
    operatingSystem: String,
    referrer: String,
    landingPage: String
  },
  
  // Redemption Status
  status: {
    type: String,
    enum: ['pending', 'applied', 'failed', 'refunded', 'cancelled', 'fraud_flagged'],
    default: 'pending',
    index: true
  },
  
  // Validation Results
  validation: {
    isValid: {
      type: Boolean,
      required: true
    },
    eligibilityPassed: {
      type: Boolean,
      required: true
    },
    fraudChecksPassed: {
      type: Boolean,
      required: true
    },
    validationErrors: [String],
    warnings: [String],
    validatedAt: {
      type: Date,
      default: Date.now
    },
    validatedBy: String
  },
  
  // Fraud Detection
  fraudAnalysis: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    detectedPatterns: [{
      pattern: String,
      confidence: Number,
      description: String
    }],
    velocityFlags: [{
      type: String,
      threshold: Number,
      actual: Number,
      timeWindow: String
    }],
    geoFlags: [{
      type: String,
      reason: String,
      data: mongoose.Schema.Types.Mixed
    }],
    deviceFlags: [{
      type: String,
      reason: String,
      fingerprint: String
    }],
    reviewRequired: {
      type: Boolean,
      default: false
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reviewNotes: String
  },
  
  // Stacking Information
  stacking: {
    isStacked: {
      type: Boolean,
      default: false
    },
    stackedWith: [{
      codeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiscountCode'
      },
      code: String,
      discountAmount: {
        amount: Number,
        currency: String
      },
      priority: Number
    }],
    totalStackedDiscount: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    }
  },
  
  // Subscription Impact (for recurring discounts)
  subscriptionImpact: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    cyclesRemaining: Number,
    nextApplicationDate: Date,
    totalCyclesPlanned: Number,
    estimatedLifetimeValue: {
      amount: Number,
      currency: String
    },
    recurringDiscountAmount: {
      amount: Number,
      currency: String
    }
  },
  
  // Revenue Analytics
  revenueAnalytics: {
    incrementalRevenue: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    customerLifetimeValue: {
      before: {
        amount: Number,
        currency: String
      },
      after: {
        amount: Number,
        currency: String
      },
      impact: {
        amount: Number,
        currency: String,
        percentage: Number
      }
    },
    marginImpact: {
      grossMargin: {
        before: Number,
        after: Number,
        impact: Number
      },
      netMargin: {
        before: Number,
        after: Number,
        impact: Number
      }
    },
    cannibalization: {
      isCannibalizing: {
        type: Boolean,
        default: false
      },
      baselineRevenue: {
        amount: Number,
        currency: String
      },
      confidence: Number
    }
  },
  
  // Payment Processing
  payment: {
    paymentMethodId: String,
    paymentProcessorId: String,
    processorTransactionId: String,
    processorFee: {
      amount: Number,
      currency: String
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'disputed']
    },
    paymentDate: Date,
    refundDate: Date,
    refundAmount: {
      amount: Number,
      currency: String
    },
    refundReason: String
  },
  
  // Customer Journey
  customerJourney: {
    touchpoints: [{
      timestamp: Date,
      touchpoint: String,
      channel: String,
      content: String,
      engagement: Number
    }],
    timeToConversion: Number, // seconds
    sessionDuration: Number, // seconds
    pageViews: Number,
    previousRedemptions: Number,
    daysSinceLastPurchase: Number,
    acquisitionChannel: String,
    conversionPath: [String]
  },
  
  // Cohort Tracking
  cohort: {
    acquisitionCohort: String, // YYYY-MM format
    campaignCohort: String,
    discountCohort: String,
    planCohort: String,
    geoLocation: String,
    deviceCohort: String
  },
  
  // Performance Metrics
  metrics: {
    redemptionLatency: Number, // milliseconds
    validationLatency: Number, // milliseconds
    fraudCheckLatency: Number, // milliseconds
    applicationLatency: Number, // milliseconds,
    apiResponseTime: Number,
    cacheHitRate: Number,
    errorRate: Number
  },
  
  // External Integration
  integration: {
    webhooksSent: [{
      provider: String,
      status: String,
      sentAt: Date,
      response: mongoose.Schema.Types.Mixed
    }],
    thirdPartyIds: [{
      provider: String,
      externalId: String,
      syncStatus: String,
      lastSyncAt: Date
    }],
    analyticsTracked: [{
      provider: String,
      eventId: String,
      trackedAt: Date
    }]
  },
  
  // Audit Information
  audit: {
    createdBy: {
      type: String,
      default: 'system'
    },
    modifiedBy: String,
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    requestId: String,
    correlationId: String
  },
  
  // Notes and Comments
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    authorName: String,
    content: String,
    type: {
      type: String,
      enum: ['general', 'fraud_review', 'customer_service', 'billing_issue'],
      default: 'general'
    },
    isInternal: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Data Retention
  retention: {
    retentionPeriod: {
      type: Number,
      default: 2555 // 7 years in days
    },
    anonymizeAfter: {
      type: Number,
      default: 1095 // 3 years in days
    },
    deleteAfter: {
      type: Number,
      default: 2555 // 7 years in days
    },
    isAnonymized: {
      type: Boolean,
      default: false
    },
    anonymizedAt: Date
  }
}, {
  timestamps: true,
  collection: 'discount_redemptions'
});

// Indexes
discountRedemptionSchema.index({ redemptionId: 1 });
discountRedemptionSchema.index({ 'discountCode.codeId': 1, createdAt: -1 });
discountRedemptionSchema.index({ 'discountCode.code': 1, status: 1 });
discountRedemptionSchema.index({ 'user.userId': 1, createdAt: -1 });
discountRedemptionSchema.index({ 'user.email': 1 });
discountRedemptionSchema.index({ status: 1, createdAt: -1 });
discountRedemptionSchema.index({ 'attribution.campaignId': 1 });
discountRedemptionSchema.index({ 'attribution.affiliateId': 1 });
discountRedemptionSchema.index({ 'context.country': 1 });
discountRedemptionSchema.index({ 'fraudAnalysis.riskLevel': 1, 'fraudAnalysis.reviewRequired': 1 });
discountRedemptionSchema.index({ 'cohort.acquisitionCohort': 1 });
discountRedemptionSchema.index({ 'transaction.finalAmount.amount': -1 });
discountRedemptionSchema.index({ createdAt: -1 });

// Compound indexes for analytics
discountRedemptionSchema.index({ 
  'discountCode.codeId': 1, 
  'attribution.campaignId': 1, 
  createdAt: -1 
});
discountRedemptionSchema.index({ 
  'cohort.acquisitionCohort': 1, 
  'attribution.channel': 1 
});
discountRedemptionSchema.index({ 
  'user.isNewCustomer': 1, 
  'transaction.finalAmount.amount': -1 
});

// Virtuals
discountRedemptionSchema.virtual('discountPercentage').get(function() {
  const original = this.transaction.originalAmount.amount;
  const discount = this.transaction.discountAmount.amount;
  
  if (original === 0) return 0;
  return Math.round((discount / original) * 100);
});

discountRedemptionSchema.virtual('savingsAmount').get(function() {
  return this.transaction.discountAmount.amount;
});

discountRedemptionSchema.virtual('effectivePrice').get(function() {
  return this.transaction.finalAmount.amount;
});

discountRedemptionSchema.virtual('timeToRedemption').get(function() {
  if (!this.customerJourney.timeToConversion) return null;
  
  const hours = Math.floor(this.customerJourney.timeToConversion / 3600);
  const minutes = Math.floor((this.customerJourney.timeToConversion % 3600) / 60);
  
  return { hours, minutes, total: this.customerJourney.timeToConversion };
});

// Methods
discountRedemptionSchema.methods.calculateIncrementalRevenue = function() {
  // Simplified incremental revenue calculation
  // In practice, this would use complex algorithms and historical data
  const baselineConversionRate = 0.02; // 2% baseline
  const withDiscountRate = 0.05; // 5% with discount
  
  const incrementalConversions = withDiscountRate - baselineConversionRate;
  const incrementalRevenue = this.transaction.finalAmount.amount * incrementalConversions;
  
  return {
    incremental: incrementalRevenue,
    baseline: this.transaction.finalAmount.amount * baselineConversionRate,
    actual: this.transaction.finalAmount.amount
  };
};

discountRedemptionSchema.methods.assessCannibalization = function() {
  // This would typically require ML models and historical data analysis
  // Simplified assessment based on customer behavior
  
  const factors = {
    isExistingCustomer: !this.user.isNewCustomer,
    highValueCustomer: this.transaction.originalAmount.amount > 100,
    shortTimeSinceLastPurchase: this.customerJourney.daysSinceLastPurchase < 30,
    organicTrafficSource: this.attribution.channel === 'organic'
  };
  
  const cannibalizationScore = Object.values(factors).filter(Boolean).length;
  
  return {
    isCannibalizing: cannibalizationScore >= 2,
    confidence: cannibalizationScore * 25,
    factors: factors
  };
};

discountRedemptionSchema.methods.generateInsights = function() {
  const insights = {
    performance: {
      effectiveDiscount: this.discountPercentage,
      customerValue: this.transaction.finalAmount.amount,
      incrementalRevenue: this.calculateIncrementalRevenue(),
      cannibalization: this.assessCannibalization()
    },
    customer: {
      isNewCustomer: this.user.isNewCustomer,
      timeToConversion: this.timeToRedemption,
      conversionChannel: this.attribution.channel,
      deviceType: this.context.deviceType
    },
    risk: {
      fraudRisk: this.fraudAnalysis.riskLevel,
      geoRisk: this.fraudAnalysis.geoFlags.length > 0,
      velocityRisk: this.fraudAnalysis.velocityFlags.length > 0
    }
  };
  
  return insights;
};

// Statics
discountRedemptionSchema.statics.generateRedemptionId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `RDM_${timestamp}_${random}`.toUpperCase();
};

discountRedemptionSchema.statics.getCohortAnalysis = function(options = {}) {
  const {
    startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endDate = new Date(),
    cohortType = 'acquisitionCohort',
    groupBy = 'month'
  } = options;
  
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'applied'
      }
    },
    {
      $group: {
        _id: {
          cohort: `$cohort.${cohortType}`,
          period: {
            $dateToString: {
              format: groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d',
              date: '$createdAt'
            }
          }
        },
        totalRedemptions: { $sum: 1 },
        totalRevenue: { $sum: '$transaction.finalAmount.amount' },
        totalDiscount: { $sum: '$transaction.discountAmount.amount' },
        uniqueUsers: { $addToSet: '$user.userId' },
        averageOrderValue: { $avg: '$transaction.finalAmount.amount' }
      }
    },
    {
      $project: {
        cohort: '$_id.cohort',
        period: '$_id.period',
        totalRedemptions: 1,
        totalRevenue: 1,
        totalDiscount: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        averageOrderValue: 1,
        discountRate: {
          $multiply: [
            { $divide: ['$totalDiscount', '$totalRevenue'] },
            100
          ]
        }
      }
    },
    { $sort: { cohort: 1, period: 1 } }
  ];
  
  return this.aggregate(pipeline);
};

// Pre-save middleware
discountRedemptionSchema.pre('save', function(next) {
  // Generate redemption ID if not present
  if (!this.redemptionId) {
    this.redemptionId = this.constructor.generateRedemptionId();
  }
  
  // Update cohort information
  if (!this.cohort.acquisitionCohort) {
    this.cohort.acquisitionCohort = new Date().toISOString().substr(0, 7); // YYYY-MM
  }
  
  // Auto-calculate incremental revenue
  if (!this.revenueAnalytics.incrementalRevenue.amount) {
    const incremental = this.calculateIncrementalRevenue();
    this.revenueAnalytics.incrementalRevenue.amount = incremental.incremental;
    this.revenueAnalytics.incrementalRevenue.currency = this.transaction.finalAmount.currency;
  }
  
  // Auto-assess cannibalization
  const cannibalization = this.assessCannibalization();
  this.revenueAnalytics.cannibalization.isCannibalizing = cannibalization.isCannibalizing;
  this.revenueAnalytics.cannibalization.confidence = cannibalization.confidence;
  
  next();
});

module.exports = mongoose.model('DiscountRedemption', discountRedemptionSchema);





