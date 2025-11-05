const mongoose = require('mongoose');

const emailResendLogSchema = new mongoose.Schema({
  // Resend Request Details
  resendId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Email Information
  emailDetails: {
    originalEmailId: {
      type: String,
      required: true
    },
    emailType: {
      type: String,
      required: true,
      enum: [
        'receipt',
        'verification',
        'contract_link',
        'payment_confirmation',
        'invoice',
        'password_reset',
        'account_activation',
        'subscription_confirmation',
        'renewal_notice',
        'cancellation_confirmation',
        'refund_confirmation',
        'dispute_notification',
        'security_alert'
      ]
    },
    templateId: String,
    templateVersion: String,
    subject: String,
    originalSentAt: Date,
    resendReason: {
      type: String,
      required: true,
      enum: [
        'delivery_failed',
        'customer_request',
        'spam_folder',
        'email_not_received',
        'incorrect_email',
        'technical_issue',
        'customer_support',
        'compliance_requirement'
      ]
    }
  },
  
  // Recipient Information
  recipient: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    email: {
      type: String,
      required: true
    },
    name: String,
    language: {
      type: String,
      default: 'en'
    },
    timezone: String
  },
  
  // Request Information
  requestDetails: {
    requestedBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser',
        required: true
      },
      adminName: String,
      adminEmail: String,
      department: {
        type: String,
        enum: ['support', 'finance', 'technical', 'billing']
      }
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    ticketReference: String,
    customerRequest: {
      type: Boolean,
      default: false
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    notes: String
  },
  
  // Rate Limiting
  rateLimiting: {
    dailyCount: {
      type: Number,
      default: 0
    },
    weeklyCount: {
      type: Number,
      default: 0
    },
    monthlyCount: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    },
    rateLimitExceeded: {
      type: Boolean,
      default: false
    },
    nextAllowedTime: Date
  },
  
  // Delivery Information
  delivery: {
    status: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'complained'],
      default: 'pending'
    },
    provider: String,
    providerId: String,
    sentAt: Date,
    deliveredAt: Date,
    openedAt: Date,
    clickedAt: Date,
    failureReason: String,
    bounceType: {
      type: String,
      enum: ['hard', 'soft', 'complaint']
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    }
  },
  
  // Email Content
  emailContent: {
    personalizedData: mongoose.Schema.Types.Mixed,
    dynamicContent: mongoose.Schema.Types.Mixed,
    attachments: [{
      filename: String,
      contentType: String,
      size: Number,
      url: String,
      expiresAt: Date
    }],
    trackingPixelEnabled: {
      type: Boolean,
      default: true
    },
    linkTracking: {
      type: Boolean,
      default: true
    }
  },
  
  // Security & Validation
  security: {
    ipAddress: String,
    userAgent: String,
    requestValidated: {
      type: Boolean,
      default: false
    },
    permissionChecked: {
      type: Boolean,
      default: false
    },
    fraudScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    approved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    approvedAt: Date
  },
  
  // Analytics & Tracking
  analytics: {
    deliveryTime: Number, // milliseconds
    openRate: {
      type: Number,
      default: 0
    },
    clickRate: {
      type: Number,
      default: 0
    },
    unsubscribeClicked: {
      type: Boolean,
      default: false
    },
    complaintFiled: {
      type: Boolean,
      default: false
    },
    links: [{
      url: String,
      clickCount: {
        type: Number,
        default: 0
      },
      firstClickAt: Date,
      lastClickAt: Date
    }]
  },
  
  // Compliance
  compliance: {
    gdprCompliant: {
      type: Boolean,
      default: true
    },
    canSpamCompliant: {
      type: Boolean,
      default: true
    },
    consentVerified: {
      type: Boolean,
      default: false
    },
    consentSource: String,
    retentionPeriod: {
      type: Number,
      default: 2555 // 7 years in days
    },
    dataProcessingBasis: {
      type: String,
      enum: ['consent', 'contract', 'legal_obligation', 'legitimate_interest']
    }
  }
}, {
  timestamps: true,
  collection: 'email_resend_logs'
});

// Indexes
emailResendLogSchema.index({ 'recipient.userId': 1, 'emailDetails.emailType': 1 });
emailResendLogSchema.index({ 'requestDetails.requestedBy.adminId': 1, 'requestDetails.requestedAt': -1 });
emailResendLogSchema.index({ 'delivery.status': 1, 'requestDetails.requestedAt': -1 });
emailResendLogSchema.index({ 'emailDetails.originalEmailId': 1 });
emailResendLogSchema.index({ 'requestDetails.ticketReference': 1 });

// Virtual for delivery success rate
emailResendLogSchema.virtual('deliverySuccessRate').get(function() {
  if (this.delivery.attempts === 0) return 0;
  return this.delivery.status === 'delivered' ? 100 : 0;
});

// Virtual for processing time
emailResendLogSchema.virtual('processingTime').get(function() {
  if (!this.delivery.sentAt) return null;
  return this.delivery.sentAt - this.requestDetails.requestedAt;
});

// Methods
emailResendLogSchema.methods.updateDeliveryStatus = function(status, details = {}) {
  this.delivery.status = status;
  
  if (status === 'sent') {
    this.delivery.sentAt = new Date();
  } else if (status === 'delivered') {
    this.delivery.deliveredAt = new Date();
    this.analytics.deliveryTime = this.processingTime;
  } else if (status === 'failed' || status === 'bounced') {
    this.delivery.failureReason = details.reason;
    this.delivery.bounceType = details.bounceType;
  }
  
  this.delivery.attempts += 1;
  
  return this.save();
};

emailResendLogSchema.methods.trackOpen = function() {
  if (!this.delivery.openedAt) {
    this.delivery.openedAt = new Date();
    this.analytics.openRate = 1;
  }
  return this.save();
};

emailResendLogSchema.methods.trackClick = function(url) {
  this.delivery.clickedAt = new Date();
  
  // Track specific link
  const linkIndex = this.analytics.links.findIndex(link => link.url === url);
  if (linkIndex >= 0) {
    this.analytics.links[linkIndex].clickCount += 1;
    this.analytics.links[linkIndex].lastClickAt = new Date();
    if (!this.analytics.links[linkIndex].firstClickAt) {
      this.analytics.links[linkIndex].firstClickAt = new Date();
    }
  } else {
    this.analytics.links.push({
      url,
      clickCount: 1,
      firstClickAt: new Date(),
      lastClickAt: new Date()
    });
  }
  
  // Update overall click rate
  this.analytics.clickRate = this.analytics.links.reduce((total, link) => total + link.clickCount, 0);
  
  return this.save();
};

emailResendLogSchema.methods.canResend = function() {
  // Check rate limits
  if (this.rateLimiting.rateLimitExceeded) return false;
  
  // Check max attempts
  if (this.delivery.attempts >= this.delivery.maxAttempts) return false;
  
  // Check time restrictions
  if (this.rateLimiting.nextAllowedTime && new Date() < this.rateLimiting.nextAllowedTime) return false;
  
  return true;
};

// Static methods
emailResendLogSchema.statics.createResendLog = async function(resendData) {
  const resendId = require('crypto').randomBytes(16).toString('hex');
  
  const log = new this({
    resendId,
    ...resendData,
    requestDetails: {
      ...resendData.requestDetails,
      requestedAt: new Date()
    }
  });
  
  return log.save();
};

emailResendLogSchema.statics.getUserResendHistory = function(userId, emailType = null, limit = 50) {
  const query = { 'recipient.userId': userId };
  if (emailType) query['emailDetails.emailType'] = emailType;
  
  return this.find(query)
    .sort({ 'requestDetails.requestedAt': -1 })
    .limit(limit)
    .populate('requestDetails.requestedBy.adminId', 'name email');
};

emailResendLogSchema.statics.getAdminResendHistory = function(adminId, limit = 100) {
  return this.find({ 'requestDetails.requestedBy.adminId': adminId })
    .sort({ 'requestDetails.requestedAt': -1 })
    .limit(limit)
    .populate('recipient.userId', 'name email');
};

emailResendLogSchema.statics.getDeliveryStats = function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        'requestDetails.requestedAt': { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$delivery.status',
        count: { $sum: 1 },
        averageDeliveryTime: { $avg: '$analytics.deliveryTime' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

emailResendLogSchema.statics.checkRateLimit = async function(userId, emailType, period = 'daily') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  const count = await this.countDocuments({
    'recipient.userId': userId,
    'emailDetails.emailType': emailType,
    'requestDetails.requestedAt': { $gte: startDate }
  });
  
  return count;
};

// Pre-save middleware
emailResendLogSchema.pre('save', function(next) {
  // Update rate limiting counters
  if (this.isNew) {
    this.rateLimiting.dailyCount = this.rateLimiting.dailyCount || 0;
    this.rateLimiting.weeklyCount = this.rateLimiting.weeklyCount || 0;
    this.rateLimiting.monthlyCount = this.rateLimiting.monthlyCount || 0;
  }
  
  next();
});

module.exports = mongoose.model('EmailResendLog', emailResendLogSchema);





