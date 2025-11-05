const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Enhanced Subscriber Model
 * Comprehensive subscriber management with WooCommerce-equivalent features
 */

// Contact Information Schema
const contactInfoSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true }, // Unique index defined at parent schema level
  phone: { type: String, trim: true },
  companyName: { type: String, trim: true },
  jobTitle: { type: String, trim: true },

  // Address Information
  address: {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
    isDefault: { type: Boolean, default: true }
  },

  // Billing Address (if different)
  billingAddress: {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },

  // Communication Preferences
  preferences: {
    emailMarketing: { type: Boolean, default: false },
    smsMarketing: { type: Boolean, default: false },
    productUpdates: { type: Boolean, default: true },
    billingAlerts: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' }
  }
}, { _id: false });

// Subscription Plan Schema
const subscriptionPlanSchema = new mongoose.Schema({
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  planType: {
    type: String,
    enum: ['monthly', 'yearly', 'quarterly', 'lifetime', 'usage-based', 'seat-based'],
    required: true
  },

  // Pricing Information
  pricing: {
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'USD' },
    interval: { type: String, enum: ['day', 'week', 'month', 'year'], required: true },
    intervalCount: { type: Number, default: 1 },
    trialDays: { type: Number, default: 0 }
  },

  // Subscription Status
  status: {
    type: String,
    enum: ['trial', 'active', 'paused', 'cancelled', 'expired', 'past_due', 'incomplete'],
    required: true,
    default: 'trial'
  },

  // Key Dates
  dates: {
    started: { type: Date, required: true, default: Date.now },
    trialStart: { type: Date },
    trialEnd: { type: Date },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelledAt: { type: Date },
    pausedAt: { type: Date },
    resumedAt: { type: Date },
    endedAt: { type: Date }
  },

  // Billing Information
  billing: {
    collectionMethod: { type: String, enum: ['charge_automatically', 'send_invoice'], default: 'charge_automatically' },
    daysUntilDue: { type: Number, default: 30 },
    defaultPaymentMethodId: { type: String },
    taxExempt: { type: Boolean, default: false },
    taxIds: [{ type: String }] // Tax identification numbers
  },

  // Plan Features & Limits
  features: {
    maxUsers: { type: Number },
    maxProjects: { type: Number },
    storageLimit: { type: Number }, // in GB
    apiCallsLimit: { type: Number },
    customFeatures: { type: Map, of: mongoose.Schema.Types.Mixed }
  },

  // Proration and Changes
  pendingChanges: {
    newPlanId: { type: String },
    effectiveDate: { type: Date },
    prorationBehavior: { type: String, enum: ['create_prorations', 'none', 'always_invoice'] },
    changeReason: { type: String }
  },

  // Discount Information
  appliedDiscounts: [{
    discountId: { type: String, required: true },
    discountCode: { type: String },
    discountType: { type: String, enum: ['percentage', 'fixed', 'free_trial'] },
    discountValue: { type: Number },
    appliedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isRecurring: { type: Boolean, default: false }
  }],

  // Metrics
  metrics: {
    totalPaid: { type: Number, default: 0 },
    lastPaymentDate: { type: Date },
    nextBillingDate: { type: Date },
    failedPaymentCount: { type: Number, default: 0 },
    churnRiskScore: { type: Number, min: 0, max: 100, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    monthsActive: { type: Number, default: 0 }
  }
}, { _id: false });

// Payment Method Schema
const paymentMethodSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['card', 'bank_account', 'sepa_debit', 'paypal', 'apple_pay', 'google_pay'],
    required: true
  },
  isDefault: { type: Boolean, default: false },

  // Card Details (masked)
  card: {
    brand: { type: String }, // visa, mastercard, etc.
    last4: { type: String },
    expMonth: { type: Number },
    expYear: { type: Number },
    fingerprint: { type: String }
  },

  // Bank Account Details (masked)
  bankAccount: {
    bankName: { type: String },
    accountHolderType: { type: String, enum: ['individual', 'company'] },
    last4: { type: String },
    routingNumber: { type: String }
  },

  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'requires_action'],
    default: 'active'
  },

  metadata: {
    addedAt: { type: Date, default: Date.now },
    lastUsed: { type: Date },
    processor: { type: String }, // stripe, braintree, etc.
    processorId: { type: String },
    fingerprint: { type: String }
  }
}, { _id: false });

// Support Notes Schema
const supportNoteSchema = new mongoose.Schema({
  id: { type: String, required: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String },

  content: { type: String, required: true },
  category: {
    type: String,
    enum: ['general', 'billing', 'technical', 'cancellation', 'upgrade', 'complaint', 'compliment'],
    default: 'general'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  isInternal: { type: Boolean, default: true },
  isPinned: { type: Boolean, default: false },

  tags: [{ type: String }],

  attachments: [{
    filename: { type: String },
    url: { type: String },
    type: { type: String },
    size: { type: Number }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

// Login Activity Schema
const loginActivitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },

  // Geolocation
  location: {
    country: { type: String },
    region: { type: String },
    city: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    timezone: { type: String }
  },

  // Device Information
  device: {
    type: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'] },
    os: { type: String },
    browser: { type: String },
    fingerprint: { type: String }
  },

  // Session Information
  sessionId: { type: String },
  status: {
    type: String,
    enum: ['success', 'failed', 'blocked', 'suspicious'],
    required: true
  },

  // Security Flags
  security: {
    isSuspicious: { type: Boolean, default: false },
    isNewDevice: { type: Boolean, default: false },
    isNewLocation: { type: Boolean, default: false },
    requiresTwoFactor: { type: Boolean, default: false },
    twoFactorVerified: { type: Boolean, default: false }
  },

  // Failure Information
  failureReason: { type: String },
  blockReason: { type: String }
}, { _id: false });

// Events Timeline Schema
const eventSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'account_created', 'email_verified', 'subscription_started', 'subscription_upgraded',
      'subscription_downgraded', 'subscription_paused', 'subscription_resumed',
      'subscription_cancelled', 'payment_succeeded', 'payment_failed', 'refund_issued',
      'discount_applied', 'contract_signed', 'support_ticket_created', 'login_failed',
      'password_changed', 'two_factor_enabled', 'payment_method_added', 'plan_changed'
    ],
    required: true
  },

  title: { type: String, required: true },
  description: { type: String },

  // Event Data
  data: { type: Map, of: mongoose.Schema.Types.Mixed },

  // Metadata
  metadata: {
    triggeredBy: { type: String }, // user, system, admin
    triggeredByUserId: { type: String },
    source: { type: String }, // web, api, webhook, etc.
    ipAddress: { type: String },
    userAgent: { type: String }
  },

  // Categorization
  category: {
    type: String,
    enum: ['account', 'subscription', 'billing', 'security', 'support', 'compliance'],
    required: true
  },

  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },

  timestamp: { type: Date, required: true, default: Date.now },

  // Visibility
  isVisible: { type: Boolean, default: true },
  isInternal: { type: Boolean, default: false }
}, { _id: false });

// Account Flags Schema
const accountFlagSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['vip', 'at_risk', 'high_value', 'fraud_risk', 'payment_issues', 'support_priority', 'beta_user'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  reason: { type: String, required: true },
  addedBy: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed }
}, { _id: false });

// Main Enhanced Subscriber Schema
const enhancedSubscriberSchema = new mongoose.Schema({
  // Core Identification
  id: { type: String, required: true }, // Unique index defined in schema.index() below
  customerId: { type: String }, // External processor customer ID - index defined in schema.index() below

  // Contact Information
  contact: { type: contactInfoSchema, required: true },

  // Authentication
  auth: {
    passwordHash: { type: String },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // Two-Factor Authentication
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String },
      backupCodes: [{ type: String }],
      lastUsed: { type: Date }
    },

    // Password Reset
    passwordReset: {
      token: { type: String },
      expires: { type: Date },
      attempts: { type: Number, default: 0 }
    },

    // Account Security
    security: {
      loginAttempts: { type: Number, default: 0 },
      lockoutUntil: { type: Date },
      lastLogin: { type: Date },
      lastPasswordChange: { type: Date },
      sessionCount: { type: Number, default: 0 },
      maxSessions: { type: Number, default: 5 }
    }
  },

  // Account Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'cancelled', 'pending_verification'],
    default: 'pending_verification'
  },

  // Subscription Plans
  subscriptions: [subscriptionPlanSchema],

  // Payment Methods
  paymentMethods: [paymentMethodSchema],

  // Support Information
  support: {
    notes: [supportNoteSchema],
    ticketCount: { type: Number, default: 0 },
    lastContactDate: { type: Date },
    preferredContactMethod: { type: String, enum: ['email', 'phone', 'chat'], default: 'email' },
    assignedAgent: { type: String },
    satisfactionScore: { type: Number, min: 1, max: 5 }
  },

  // Activity Tracking
  activity: {
    loginHistory: [loginActivitySchema],
    lastActivityDate: { type: Date },
    sessionCount: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    featureUsage: { type: Map, of: Number },
    deviceFingerprints: [{ type: String }]
  },

  // Events Timeline
  events: [eventSchema],

  // Account Flags
  flags: [accountFlagSchema],

  // Financial Summary
  financial: {
    totalRevenue: { type: Number, default: 0 },
    currentMRR: { type: Number, default: 0 },
    currentARR: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },

    // Payment History Summary
    paymentsSummary: {
      total: { type: Number, default: 0 },
      successful: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      refunded: { type: Number, default: 0 },
      lastPaymentDate: { type: Date },
      nextPaymentDate: { type: Date }
    },

    // Risk Assessment
    riskAssessment: {
      churnProbability: { type: Number, min: 0, max: 1, default: 0 },
      fraudScore: { type: Number, min: 0, max: 100, default: 0 },
      creditScore: { type: Number },
      paymentBehavior: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' }
    }
  },

  // Compliance & Legal
  compliance: {
    gdprConsent: { type: Boolean, default: false },
    gdprConsentDate: { type: Date },
    marketingConsent: { type: Boolean, default: false },
    dataRetentionUntil: { type: Date },
    rightToBeForgettenRequested: { type: Boolean, default: false },

    // KYC Information
    kyc: {
      status: { type: String, enum: ['not_required', 'pending', 'verified', 'failed'], default: 'not_required' },
      verificationDate: { type: Date },
      documents: [{
        type: { type: String },
        url: { type: String },
        status: { type: String, enum: ['pending', 'approved', 'rejected'] }
      }]
    }
  },

  // Segmentation & Analytics
  segmentation: {
    customerSegment: { type: String, enum: ['free', 'trial', 'starter', 'professional', 'enterprise', 'churned'] },
    acquisitionChannel: { type: String },
    campaignSource: { type: String },
    cohort: { type: String }, // e.g., "2024-Q1"
    tags: [{ type: String }],
    customAttributes: { type: Map, of: mongoose.Schema.Types.Mixed }
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  collection: 'enhanced_subscribers'
});

// Indexes for performance
enhancedSubscriberSchema.index({ id: 1 }, { unique: true });
enhancedSubscriberSchema.index({ 'contact.email': 1 }, { unique: true });
enhancedSubscriberSchema.index({ customerId: 1 });
enhancedSubscriberSchema.index({ status: 1 });
enhancedSubscriberSchema.index({ 'subscriptions.status': 1 });
enhancedSubscriberSchema.index({ 'financial.currentMRR': -1 });
enhancedSubscriberSchema.index({ 'financial.lifetimeValue': -1 });
enhancedSubscriberSchema.index({ 'segmentation.customerSegment': 1 });
enhancedSubscriberSchema.index({ 'segmentation.acquisitionChannel': 1 });
enhancedSubscriberSchema.index({ createdAt: -1 });
enhancedSubscriberSchema.index({ updatedAt: -1 });

// Text search index
enhancedSubscriberSchema.index({
  'contact.firstName': 'text',
  'contact.lastName': 'text',
  'contact.email': 'text',
  'contact.companyName': 'text',
  id: 'text'
});

// Virtual for full name
enhancedSubscriberSchema.virtual('contact.fullName').get(function () {
  return `${this.contact.firstName} ${this.contact.lastName}`.trim();
});

// Methods
enhancedSubscriberSchema.methods = {
  /**
   * Add event to timeline
   */
  addEvent(eventData) {
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...eventData
    };

    this.events.unshift(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(0, 1000);
    }

    return event;
  },

  /**
   * Add support note
   */
  addSupportNote(noteData) {
    const note = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...noteData
    };

    this.support.notes.unshift(note);
    this.support.lastContactDate = new Date();

    return note;
  },

  /**
   * Add login activity
   */
  addLoginActivity(activityData) {
    const activity = {
      id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...activityData
    };

    this.activity.loginHistory.unshift(activity);

    // Keep only last 100 login records
    if (this.activity.loginHistory.length > 100) {
      this.activity.loginHistory = this.activity.loginHistory.slice(0, 100);
    }

    if (activity.status === 'success') {
      this.auth.security.lastLogin = new Date();
      this.activity.lastActivityDate = new Date();
    }

    return activity;
  },

  /**
   * Calculate current MRR
   */
  calculateMRR() {
    let totalMRR = 0;

    this.subscriptions.forEach(sub => {
      if (sub.status === 'active' || sub.status === 'trial') {
        const { amount, interval, intervalCount } = sub.pricing;

        // Convert to monthly recurring revenue
        switch (interval) {
          case 'month':
            totalMRR += amount / intervalCount;
            break;
          case 'year':
            totalMRR += amount / (12 * intervalCount);
            break;
          case 'quarter':
            totalMRR += amount / (3 * intervalCount);
            break;
          case 'week':
            totalMRR += amount * 4.33 / intervalCount; // ~4.33 weeks per month
            break;
        }
      }
    });

    this.financial.currentMRR = Math.round(totalMRR * 100) / 100;
    this.financial.currentARR = Math.round(totalMRR * 12 * 100) / 100;

    return this.financial.currentMRR;
  },

  /**
   * Update churn risk score
   */
  updateChurnRisk() {
    let riskScore = 0;

    // Failed payment attempts
    const failedPayments = this.financial.paymentsSummary.failed;
    if (failedPayments > 0) riskScore += Math.min(failedPayments * 10, 30);

    // Days since last login
    if (this.auth.security.lastLogin) {
      const daysSinceLogin = (Date.now() - this.auth.security.lastLogin.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLogin > 30) riskScore += Math.min((daysSinceLogin - 30) * 2, 25);
    }

    // Subscription status
    const hasActiveSubscription = this.subscriptions.some(sub => sub.status === 'active');
    if (!hasActiveSubscription) riskScore += 20;

    // Support tickets
    if (this.support.ticketCount > 5) riskScore += 10;

    // Payment method issues
    const hasValidPaymentMethod = this.paymentMethods.some(pm => pm.status === 'active');
    if (!hasValidPaymentMethod) riskScore += 15;

    this.financial.riskAssessment.churnProbability = Math.min(riskScore, 100) / 100;

    return this.financial.riskAssessment.churnProbability;
  },

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions() {
    return this.subscriptions.filter(sub =>
      ['active', 'trial', 'past_due'].includes(sub.status)
    );
  },

  /**
   * Check if subscriber is VIP
   */
  isVIP() {
    return this.flags.some(flag =>
      flag.type === 'vip' && flag.isActive && (!flag.expiresAt || flag.expiresAt > new Date())
    );
  },

  /**
   * Get total lifetime value
   */
  calculateLTV() {
    const totalRevenue = this.financial.totalRevenue;
    const monthsActive = this.financial.paymentsSummary.total > 0 ?
      Math.max(1, (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;

    this.financial.lifetimeValue = totalRevenue;

    // Calculate predicted LTV based on current MRR and churn probability
    if (this.financial.currentMRR > 0) {
      const churnRate = Math.max(0.01, this.financial.riskAssessment.churnProbability);
      const predictedLifetimeMonths = 1 / churnRate;
      const predictedLTV = this.financial.currentMRR * predictedLifetimeMonths;

      // Use the higher of actual and predicted LTV
      this.financial.lifetimeValue = Math.max(totalRevenue, predictedLTV);
    }

    return this.financial.lifetimeValue;
  }
};

// Static methods
enhancedSubscriberSchema.statics = {
  /**
   * Search subscribers with advanced filters
   */
  async searchSubscribers(filters = {}, options = {}) {
    const {
      search, // text search
      email,
      status,
      planType,
      minMRR,
      maxMRR,
      churnRisk,
      country,
      dateRange,
      customerSegment,
      acquisitionChannel,
      hasFlags
    } = filters;

    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = {};

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Email filter
    if (email) {
      query['contact.email'] = new RegExp(email, 'i');
    }

    // Status filter
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }

    // Plan type filter
    if (planType) {
      query['subscriptions.planType'] = planType;
    }

    // MRR range
    if (minMRR !== undefined || maxMRR !== undefined) {
      query['financial.currentMRR'] = {};
      if (minMRR !== undefined) query['financial.currentMRR'].$gte = minMRR;
      if (maxMRR !== undefined) query['financial.currentMRR'].$lte = maxMRR;
    }

    // Churn risk
    if (churnRisk) {
      const riskThresholds = {
        low: { $lt: 0.3 },
        medium: { $gte: 0.3, $lt: 0.7 },
        high: { $gte: 0.7 }
      };
      query['financial.riskAssessment.churnProbability'] = riskThresholds[churnRisk];
    }

    // Country filter
    if (country) {
      query['contact.address.country'] = country;
    }

    // Date range
    if (dateRange && dateRange.start && dateRange.end) {
      query.createdAt = {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end)
      };
    }

    // Customer segment
    if (customerSegment) {
      query['segmentation.customerSegment'] = customerSegment;
    }

    // Acquisition channel
    if (acquisitionChannel) {
      query['segmentation.acquisitionChannel'] = acquisitionChannel;
    }

    // Flags filter
    if (hasFlags && hasFlags.length > 0) {
      query['flags.type'] = { $in: hasFlags };
      query['flags.isActive'] = true;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [subscribers, total] = await Promise.all([
      this.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.countDocuments(query)
    ]);

    return {
      subscribers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(dateRange = {}) {
    const { start, end } = dateRange;
    const matchStage = {};

    if (start && end) {
      matchStage.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }

    const [summary] = await this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSubscribers: { $sum: 1 },
          activeSubscribers: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalMRR: { $sum: '$financial.currentMRR' },
          totalARR: { $sum: '$financial.currentARR' },
          averageLTV: { $avg: '$financial.lifetimeValue' },
          totalRevenue: { $sum: '$financial.totalRevenue' },
          averageChurnRisk: { $avg: '$financial.riskAssessment.churnProbability' }
        }
      }
    ]);

    return summary || {
      totalSubscribers: 0,
      activeSubscribers: 0,
      totalMRR: 0,
      totalARR: 0,
      averageLTV: 0,
      totalRevenue: 0,
      averageChurnRisk: 0
    };
  }
};

// Pre-save middleware
enhancedSubscriberSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Update calculated fields
  this.calculateMRR();
  this.updateChurnRisk();
  this.calculateLTV();

  next();
});

// Ensure virtual fields are serialized
enhancedSubscriberSchema.set('toJSON', { virtuals: true });
enhancedSubscriberSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('EnhancedSubscriber', enhancedSubscriberSchema);





