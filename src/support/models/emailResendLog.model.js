/**
 * Eagle Email Resend Log Model
 * Track email resend operations for audit and rate limiting
 */

const mongoose = require('mongoose');

const emailResendLogSchema = new mongoose.Schema({
  recipientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientEmail: {
    type: String,
    required: true
  },
  emailType: {
    type: String,
    enum: [
      'RECEIPT', 
      'VERIFICATION', 
      'CONTRACT_LINK', 
      'PAYMENT_CONFIRMATION',
      'PASSWORD_RESET',
      'WELCOME',
      'SUBSCRIPTION_RENEWAL',
      'SUBSCRIPTION_CANCELLATION',
      'SUPPORT_RESPONSE'
    ],
    required: true
  },
  originalEmailId: String, // Reference to original email if available
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'FAILED', 'BLOCKED'],
    default: 'PENDING'
  },
  sentAt: Date,
  failureReason: String,
  emailData: {
    subject: String,
    template: String,
    variables: mongoose.Schema.Types.Mixed,
    attachments: [String]
  },
  metadata: {
    originalSentDate: Date,
    resendCount: {
      type: Number,
      default: 1
    },
    ipAddress: String,
    userAgent: String,
    sessionId: String
  },
  rateLimitInfo: {
    dailyCount: Number,
    hourlyCount: Number,
    lastResetDate: Date
  }
}, {
  timestamps: true,
  collection: 'emailResendLogs'
});

// Indexes for performance and rate limiting
emailResendLogSchema.index({ recipientUserId: 1, emailType: 1 });
emailResendLogSchema.index({ requestedBy: 1, createdAt: -1 });
emailResendLogSchema.index({ recipientEmail: 1, createdAt: -1 });
emailResendLogSchema.index({ status: 1 });
emailResendLogSchema.index({ createdAt: -1 });

// Methods
emailResendLogSchema.methods.markAsSent = function() {
  this.status = 'SENT';
  this.sentAt = new Date();
  return this.save();
};

emailResendLogSchema.methods.markAsFailed = function(reason) {
  this.status = 'FAILED';
  this.failureReason = reason;
  return this.save();
};

// Statics for rate limiting
emailResendLogSchema.statics.checkRateLimit = async function(userId, emailType) {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Count recent resends
  const [dailyCount, hourlyCount] = await Promise.all([
    this.countDocuments({
      recipientUserId: userId,
      emailType,
      createdAt: { $gte: oneDayAgo },
      status: { $ne: 'FAILED' }
    }),
    this.countDocuments({
      recipientUserId: userId,
      emailType,
      createdAt: { $gte: oneHourAgo },
      status: { $ne: 'FAILED' }
    })
  ]);

  // Rate limits by email type
  const limits = {
    RECEIPT: { daily: 5, hourly: 2 },
    VERIFICATION: { daily: 3, hourly: 1 },
    CONTRACT_LINK: { daily: 10, hourly: 3 },
    PAYMENT_CONFIRMATION: { daily: 5, hourly: 2 },
    PASSWORD_RESET: { daily: 5, hourly: 2 },
    WELCOME: { daily: 2, hourly: 1 },
    SUBSCRIPTION_RENEWAL: { daily: 3, hourly: 1 },
    SUBSCRIPTION_CANCELLATION: { daily: 3, hourly: 1 },
    SUPPORT_RESPONSE: { daily: 20, hourly: 5 }
  };

  const limit = limits[emailType] || { daily: 5, hourly: 2 };

  return {
    allowed: dailyCount < limit.daily && hourlyCount < limit.hourly,
    dailyCount,
    hourlyCount,
    dailyLimit: limit.daily,
    hourlyLimit: limit.hourly,
    resetTime: {
      nextHour: new Date(Math.ceil(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000)),
      nextDay: new Date(Math.ceil(now.getTime() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000))
    }
  };
};

emailResendLogSchema.statics.getResendHistory = function(userId, limit = 50) {
  return this.find({ recipientUserId: userId })
    .populate('requestedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('EmailResendLog', emailResendLogSchema);