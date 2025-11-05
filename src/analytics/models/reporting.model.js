const mongoose = require('mongoose');

/**
 * Revenue Analytics Schema for MRR/ARR Tracking
 */
const revenueAnalyticsSchema = new mongoose.Schema({
  // Time Period
  period: {
    date: {
      type: Date,
      required: true,
      index: true
    },
    year: {
      type: Number,
      required: true,
      index: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true
    },
    day: {
      type: Number,
      min: 1,
      max: 31
    },
    periodType: {
      type: String,
      enum: ['DAILY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
      required: true,
      index: true
    }
  },

  // Revenue Metrics
  revenue: {
    // Monthly Recurring Revenue
    mrr: {
      type: Number,
      default: 0,
      min: 0
    },
    // Annual Recurring Revenue (MRR * 12)
    arr: {
      type: Number,
      default: 0,
      min: 0
    },
    // New revenue from new customers
    newRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    // Revenue from upgrades/expansions
    expansionRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    // Revenue lost from downgrades
    contractionRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    // Revenue lost from churned customers
    churnedRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    // Net revenue change (new + expansion - contraction - churn)
    netRevenueChange: {
      type: Number,
      default: 0
    },
    // One-time revenue (setup fees, etc.)
    oneTimeRevenue: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Customer Metrics
  customers: {
    // Total active subscribers
    totalActive: {
      type: Number,
      default: 0,
      min: 0
    },
    // New customers acquired
    newCustomers: {
      type: Number,
      default: 0,
      min: 0
    },
    // Customers who churned
    churnedCustomers: {
      type: Number,
      default: 0,
      min: 0
    },
    // Net customer change
    netCustomerChange: {
      type: Number,
      default: 0
    },
    // Customers who upgraded
    upgradedCustomers: {
      type: Number,
      default: 0,
      min: 0
    },
    // Customers who downgraded
    downgradedCustomers: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Key Performance Indicators
  kpis: {
    // Average Revenue Per User
    arpu: {
      type: Number,
      default: 0,
      min: 0
    },
    // Average Revenue Per Account
    arpa: {
      type: Number,
      default: 0,
      min: 0
    },
    // Customer churn rate (%)
    churnRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    // Revenue churn rate (%)
    revenueChurnRate: {
      type: Number,
      default: 0,
      min: 0
    },
    // Net Revenue Retention (%)
    netRevenueRetention: {
      type: Number,
      default: 0,
      min: 0
    },
    // Gross Revenue Retention (%)
    grossRevenueRetention: {
      type: Number,
      default: 0,
      min: 0
    },
    // Customer Acquisition Cost
    cac: {
      type: Number,
      default: 0,
      min: 0
    },
    // Customer Lifetime Value
    ltv: {
      type: Number,
      default: 0,
      min: 0
    },
    // LTV to CAC ratio
    ltvToCacRatio: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Currency and Segmentation
  currency: {
    type: String,
    required: true,
    uppercase: true,
    length: 3
  },
  
  // Plan breakdown
  planBreakdown: [{
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    },
    planName: String,
    revenue: {
      type: Number,
      default: 0
    },
    customers: {
      type: Number,
      default: 0
    },
    arpu: {
      type: Number,
      default: 0
    }
  }],

  // Geographic breakdown
  geographicBreakdown: [{
    country: String,
    revenue: Number,
    customers: Number,
    percentage: Number
  }],

  // Metadata
  calculatedAt: {
    type: Date,
    default: Date.now
  },
  calculationVersion: {
    type: String,
    default: '1.0'
  }
}, {
  timestamps: true,
  collection: 'revenueanalytics'
});

// Compound indexes for efficient querying
revenueAnalyticsSchema.index({ 'period.date': 1, currency: 1, periodType: 1 });
revenueAnalyticsSchema.index({ 'period.year': 1, 'period.month': 1, currency: 1 });
revenueAnalyticsSchema.index({ periodType: 1, 'period.date': -1 });

/**
 * Cohort Analysis Schema for Retention Tracking
 */
const cohortAnalysisSchema = new mongoose.Schema({
  // Cohort Definition
  cohort: {
    // Month when customers first subscribed
    cohortMonth: {
      type: Date,
      required: true,
      index: true
    },
    // Cohort size (initial customers)
    cohortSize: {
      type: Number,
      required: true,
      min: 0
    },
    // Cohort label for display
    cohortLabel: {
      type: String,
      required: true
    }
  },

  // Retention Data by Period
  retentionData: [{
    // Period number (0 = first month, 1 = second month, etc.)
    period: {
      type: Number,
      required: true,
      min: 0
    },
    // Date of this retention period
    periodDate: {
      type: Date,
      required: true
    },
    // Number of customers still active
    customersActive: {
      type: Number,
      required: true,
      min: 0
    },
    // Retention rate as percentage
    retentionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    // Revenue from retained customers
    retainedRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    // Average revenue per retained customer
    revenuePerCustomer: {
      type: Number,
      default: 0,
      min: 0
    }
  }],

  // Revenue Cohort Analysis
  revenueRetention: [{
    period: Number,
    periodDate: Date,
    totalRevenue: Number,
    revenueRetentionRate: Number,
    expansionRevenue: Number,
    contractionRevenue: Number,
    netRevenueRetention: Number
  }],

  // Cohort Characteristics
  characteristics: {
    // Primary acquisition channel for this cohort
    acquisitionChannel: String,
    // Average initial plan value
    averageInitialValue: {
      type: Number,
      default: 0
    },
    // Geographic distribution
    primaryCountries: [String],
    // Plan distribution
    planDistribution: [{
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MembershipPlan'
      },
      planName: String,
      percentage: Number
    }]
  },

  // Analysis Metadata
  currency: {
    type: String,
    required: true,
    uppercase: true
  },
  
  analysisDate: {
    type: Date,
    default: Date.now
  },
  
  // Calculated insights
  insights: {
    // Predicted LTV based on cohort behavior
    predictedLtv: Number,
    // Risk score (0-100)
    riskScore: Number,
    // Quality score (0-100)
    qualityScore: Number,
    // Recommended actions
    recommendations: [String]
  }
}, {
  timestamps: true,
  collection: 'cohortanalysis'
});

// Indexes for efficient cohort queries
cohortAnalysisSchema.index({ 'cohort.cohortMonth': 1, currency: 1 });
cohortAnalysisSchema.index({ 'cohort.cohortMonth': -1 });

/**
 * Real-time Alerts Schema
 */
const alertSchema = new mongoose.Schema({
  // Alert Identification
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Alert Type and Category
  type: {
    type: String,
    required: true,
    enum: [
      'FAILED_PAYMENT_SPIKE',
      'CHURN_THRESHOLD_EXCEEDED',
      'FRAUD_DETECTION',
      'REVENUE_DROP',
      'UNUSUAL_ACTIVITY',
      'SYSTEM_HEALTH',
      'COMPLIANCE_ISSUE'
    ],
    index: true
  },
  
  category: {
    type: String,
    required: true,
    enum: ['FINANCIAL', 'SECURITY', 'OPERATIONAL', 'COMPLIANCE'],
    index: true
  },

  // Alert Details
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  severity: {
    type: String,
    required: true,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    index: true
  },

  // Alert Data
  data: {
    // Current value that triggered the alert
    currentValue: mongoose.Schema.Types.Mixed,
    // Threshold that was exceeded
    threshold: mongoose.Schema.Types.Mixed,
    // Historical context
    previousValue: mongoose.Schema.Types.Mixed,
    // Percentage change
    changePercentage: Number,
    // Time period for comparison
    timePeriod: String,
    // Affected entities (customer IDs, plan IDs, etc.)
    affectedEntities: [String],
    // Geographic scope
    affectedRegions: [String]
  },

  // Alert Status
  status: {
    type: String,
    required: true,
    enum: ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'],
    default: 'OPEN',
    index: true
  },

  // Timing
  triggeredAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  acknowledgedAt: Date,
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },
  
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  },

  // Alert Configuration
  alertRule: {
    ruleId: String,
    ruleName: String,
    condition: String,
    threshold: mongoose.Schema.Types.Mixed,
    lookbackPeriod: String
  },

  // Actions and Response
  actions: [{
    actionType: {
      type: String,
      enum: ['EMAIL', 'SMS', 'WEBHOOK', 'TICKET', 'AUTO_REMEDIATION']
    },
    actionTarget: String,
    executedAt: Date,
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED', 'COMPLETED']
    },
    response: mongoose.Schema.Types.Mixed
  }],

  // Investigation Notes
  notes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Related Alerts
  relatedAlerts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert'
  }],

  // Impact Assessment
  impact: {
    // Financial impact in base currency
    revenueImpact: Number,
    // Number of customers affected
    customersAffected: Number,
    // Business criticality
    businessImpact: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    }
  }
}, {
  timestamps: true,
  collection: 'alerts'
});

// Indexes for alert management
alertSchema.index({ status: 1, severity: 1, triggeredAt: -1 });
alertSchema.index({ type: 1, triggeredAt: -1 });
alertSchema.index({ triggeredAt: -1 });

/**
 * Advanced Subscription Features Schema
 */
const familyPlanSchema = new mongoose.Schema({
  // Plan Configuration
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan',
    required: true
  },
  
  // Primary Account Holder
  primaryAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnhancedUser',
    required: true,
    index: true
  },

  // Family Plan Settings
  settings: {
    // Maximum number of family members
    maxMembers: {
      type: Number,
      required: true,
      min: 1,
      max: 20
    },
    // Current number of active members
    currentMembers: {
      type: Number,
      default: 1,
      min: 1
    },
    // Age restrictions
    ageRestrictions: {
      minAge: {
        type: Number,
        default: 13
      },
      maxAge: Number,
      requireParentalConsent: {
        type: Boolean,
        default: true
      }
    },
    // Content restrictions
    contentFiltering: {
      enabled: {
        type: Boolean,
        default: false
      },
      level: {
        type: String,
        enum: ['STRICT', 'MODERATE', 'PERMISSIVE'],
        default: 'MODERATE'
      }
    }
  },

  // Family Members
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnhancedUser',
      required: true
    },
    // Member role within family
    role: {
      type: String,
      enum: ['PRIMARY', 'ADULT', 'TEEN', 'CHILD'],
      required: true
    },
    // Member permissions
    permissions: {
      canInviteMembers: {
        type: Boolean,
        default: false
      },
      canManageBilling: {
        type: Boolean,
        default: false
      },
      canViewUsage: {
        type: Boolean,
        default: false
      },
      canModifySettings: {
        type: Boolean,
        default: false
      }
    },
    // Join information
    joinedAt: {
      type: Date,
      default: Date.now
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnhancedUser'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING', 'SUSPENDED', 'REMOVED'],
      default: 'PENDING'
    },
    // Usage tracking
    usage: {
      lastActiveAt: Date,
      totalSessions: {
        type: Number,
        default: 0
      },
      totalUsageHours: {
        type: Number,
        default: 0
      }
    }
  }],

  // Invitations
  pendingInvitations: [{
    email: {
      type: String,
      required: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnhancedUser',
      required: true
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    role: {
      type: String,
      enum: ['ADULT', 'TEEN', 'CHILD'],
      required: true
    },
    invitationToken: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      default: 'PENDING'
    }
  }],

  // Sharing Detection
  sharingDetection: {
    enabled: {
      type: Boolean,
      default: true
    },
    // Suspicious activity indicators
    suspiciousActivity: [{
      type: {
        type: String,
        enum: ['CONCURRENT_LOCATIONS', 'UNUSUAL_USAGE_PATTERN', 'DEVICE_SHARING', 'IP_ANOMALY']
      },
      detectedAt: Date,
      details: mongoose.Schema.Types.Mixed,
      severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH']
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }],
    // Usage limits
    limits: {
      maxConcurrentSessions: {
        type: Number,
        default: 4
      },
      maxDevicesPerUser: {
        type: Number,
        default: 5
      },
      maxLocationChangesPerDay: {
        type: Number,
        default: 3
      }
    }
  },

  // Billing and Pricing
  billing: {
    basePrice: {
      type: Number,
      required: true
    },
    perMemberPrice: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      required: true
    },
    billingCycle: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY', 'YEARLY'],
      default: 'MONTHLY'
    }
  },

  // Status and Lifecycle
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  cancelledAt: Date,
  cancellationReason: String
}, {
  timestamps: true,
  collection: 'familyplans'
});

/**
 * Gift Subscription Schema
 */
const giftSubscriptionSchema = new mongoose.Schema({
  // Gift Information
  giftId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Giver Information
  giver: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnhancedUser'
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    message: {
      type: String,
      maxlength: 500
    }
  },

  // Recipient Information
  recipient: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnhancedUser'
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },

  // Subscription Details
  subscription: {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: true
    },
    duration: {
      type: Number,
      required: true,
      min: 1 // Duration in months
    },
    startDate: Date,
    endDate: Date,
    autoRenew: {
      type: Boolean,
      default: false
    }
  },

  // Payment Information
  payment: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true
    },
    paymentIntentId: String,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number
  },

  // Gift Delivery
  delivery: {
    deliveryMethod: {
      type: String,
      enum: ['IMMEDIATE', 'SCHEDULED', 'ON_DEMAND'],
      default: 'IMMEDIATE'
    },
    scheduledDate: Date,
    deliveredAt: Date,
    deliveryAttempts: [{
      attemptedAt: Date,
      successful: Boolean,
      errorMessage: String
    }]
  },

  // Redemption
  redemption: {
    redemptionCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    redeemedAt: Date,
    redeemedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EnhancedUser'
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    }
  },

  // Status
  status: {
    type: String,
    enum: ['PENDING_PAYMENT', 'PAID', 'DELIVERED', 'REDEEMED', 'EXPIRED', 'REFUNDED'],
    default: 'PENDING_PAYMENT',
    index: true
  },

  // Expiration
  expiresAt: {
    type: Date,
    required: true
  },

  // Customization
  customization: {
    theme: {
      type: String,
      enum: ['DEFAULT', 'BIRTHDAY', 'HOLIDAY', 'ANNIVERSARY', 'CUSTOM'],
      default: 'DEFAULT'
    },
    customMessage: String,
    giftCardImage: String
  }
}, {
  timestamps: true,
  collection: 'giftsubscriptions'
});

// Indexes for gift subscriptions
giftSubscriptionSchema.index({ status: 1, createdAt: -1 });
giftSubscriptionSchema.index({ 'redemption.redemptionCode': 1 });
giftSubscriptionSchema.index({ expiresAt: 1 });

// Export models
const RevenueAnalytics = mongoose.model('RevenueAnalytics', revenueAnalyticsSchema);
const CohortAnalysis = mongoose.model('CohortAnalysis', cohortAnalysisSchema);
const Alert = mongoose.model('Alert', alertSchema);
const FamilyPlan = mongoose.model('FamilyPlan', familyPlanSchema);
const GiftSubscription = mongoose.model('GiftSubscription', giftSubscriptionSchema);

module.exports = {
  RevenueAnalytics,
  CohortAnalysis,
  Alert,
  FamilyPlan,
  GiftSubscription
};





