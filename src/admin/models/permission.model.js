const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'user_management',
      'billing_finance',
      'marketing_growth',
      'support_operations',
      'analytics_reports',
      'security_settings',
      'system_admin',
      'subscription_management',
      'content_management'
    ]
  },
  resource: {
    type: String,
    required: true // e.g., 'users', 'billing', 'reports', etc.
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'execute', 'approve', 'cancel']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for resource and action
permissionSchema.index({ resource: 1, action: 1 });
permissionSchema.index({ category: 1 });
permissionSchema.index({ isActive: 1 });

module.exports = mongoose.model('Permission', permissionSchema);