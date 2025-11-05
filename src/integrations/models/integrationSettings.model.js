/**
 * Eagle Integration Settings Model
 * Manages provider configurations and settings
 */

const mongoose = require('mongoose');

const integrationSettingsSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['PAYMENT', 'EMAIL', 'SMS', 'TAX', 'ANALYTICS', 'WEBHOOK'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // Encrypted sensitive data
  encryptedSecrets: {
    type: String // JSON string of encrypted secrets
  },
  webhookConfig: {
    endpoint: String,
    secret: String,
    events: [String]
  },
  rateLimits: {
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    requestsPerDay: {
      type: Number,
      default: 10000
    }
  },
  healthCheck: {
    lastChecked: Date,
    status: {
      type: String,
      enum: ['HEALTHY', 'WARNING', 'ERROR', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    responseTime: Number, // in milliseconds
    errorMessage: String
  },
  metadata: {
    version: String,
    supportedFeatures: [String],
    region: String,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'production'
    }
  },
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    successfulRequests: {
      type: Number,
      default: 0
    },
    failedRequests: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    monthlyUsage: [{
      month: String, // YYYY-MM
      requests: Number,
      successRate: Number
    }]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'integrationSettings'
});

// Indexes
integrationSettingsSchema.index({ category: 1, isActive: 1 });
integrationSettingsSchema.index({ provider: 1, category: 1 });
integrationSettingsSchema.index({ isPrimary: 1, category: 1 });

// Methods
integrationSettingsSchema.methods.updateUsage = function(success = true) {
  this.usage.totalRequests += 1;
  if (success) {
    this.usage.successfulRequests += 1;
  } else {
    this.usage.failedRequests += 1;
  }
  this.usage.lastUsed = new Date();
  
  // Update monthly usage
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyEntry = this.usage.monthlyUsage.find(m => m.month === currentMonth);
  
  if (monthlyEntry) {
    monthlyEntry.requests += 1;
    monthlyEntry.successRate = this.usage.successfulRequests / this.usage.totalRequests;
  } else {
    this.usage.monthlyUsage.push({
      month: currentMonth,
      requests: 1,
      successRate: success ? 1 : 0
    });
  }
  
  // Keep only last 12 months
  if (this.usage.monthlyUsage.length > 12) {
    this.usage.monthlyUsage = this.usage.monthlyUsage.slice(-12);
  }
  
  return this.save();
};

integrationSettingsSchema.methods.updateHealthStatus = function(status, responseTime, errorMessage = null) {
  this.healthCheck.lastChecked = new Date();
  this.healthCheck.status = status;
  this.healthCheck.responseTime = responseTime;
  this.healthCheck.errorMessage = errorMessage;
  return this.save();
};

// Statics
integrationSettingsSchema.statics.getPrimaryProvider = function(category) {
  return this.findOne({ category, isPrimary: true, isActive: true });
};

integrationSettingsSchema.statics.getActiveProviders = function(category) {
  return this.find({ category, isActive: true }).sort({ isPrimary: -1, createdAt: -1 });
};

integrationSettingsSchema.statics.setPrimary = async function(providerId, category) {
  // Remove primary flag from all providers in category
  await this.updateMany(
    { category, isPrimary: true },
    { isPrimary: false }
  );
  
  // Set new primary
  return this.findByIdAndUpdate(
    providerId,
    { isPrimary: true, isActive: true },
    { new: true }
  );
};

module.exports = mongoose.model('IntegrationSettings', integrationSettingsSchema);