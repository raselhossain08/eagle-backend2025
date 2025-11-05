/**
 * Eagle Support Session Model
 * Handles user impersonation sessions with security controls
 */

const mongoose = require('mongoose');

const supportSessionSchema = new mongoose.Schema({
  supportAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionType: {
    type: String,
    enum: ['READ_ONLY', 'WRITE_ENABLED'],
    default: 'READ_ONLY',
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'ENDED', 'EXPIRED'],
    default: 'ACTIVE'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    }
  },
  writeActionsRequested: [{
    action: {
      type: String,
      required: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    approved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    executedAt: {
      type: Date
    },
    details: mongoose.Schema.Types.Mixed
  }],
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  metadata: {
    clientIp: String,
    userAgent: String,
    location: String,
    deviceInfo: String
  }
}, {
  timestamps: true,
  collection: 'supportSessions'
});

// Indexes for performance
supportSessionSchema.index({ supportAgent: 1, status: 1 });
supportSessionSchema.index({ targetUser: 1, status: 1 });
supportSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
supportSessionSchema.methods.logAction = function(action, details, req) {
  this.auditLog.push({
    action,
    details,
    ipAddress: req?.ip,
    userAgent: req?.get('User-Agent')
  });
  return this.save();
};

supportSessionSchema.methods.requestWriteAction = function(action, details) {
  this.writeActionsRequested.push({
    action,
    details
  });
  return this.save();
};

supportSessionSchema.methods.approveWriteAction = function(actionIndex, approverId) {
  if (this.writeActionsRequested[actionIndex]) {
    this.writeActionsRequested[actionIndex].approved = true;
    this.writeActionsRequested[actionIndex].approvedBy = approverId;
    this.writeActionsRequested[actionIndex].approvedAt = new Date();
  }
  return this.save();
};

supportSessionSchema.methods.endSession = function() {
  this.status = 'ENDED';
  this.endTime = new Date();
  return this.save();
};

// Statics
supportSessionSchema.statics.getActiveSession = function(supportAgentId, targetUserId) {
  return this.findOne({
    supportAgent: supportAgentId,
    targetUser: targetUserId,
    status: 'ACTIVE',
    expiresAt: { $gt: new Date() }
  });
};

module.exports = mongoose.model('SupportSession', supportSessionSchema);