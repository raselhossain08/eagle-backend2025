const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'role_assigned',
      'role_removed',
      'permission_granted',
      'permission_revoked',
      'login_attempt',
      'permission_check',
      'access_denied',
      'security_violation',
      'data_access',
      'data_modification',
      'system_action'
    ]
  },
  resource: {
    type: String,
    required: true // What resource was accessed/modified
  },
  resourceId: {
    type: String, // ID of the specific resource if applicable
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Additional details about the action
    default: {}
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });
auditLogSchema.index({ success: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 }); // For general time-based queries

// TTL index to automatically delete old audit logs after 2 years
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

module.exports = mongoose.model('AuditLog', auditLogSchema);