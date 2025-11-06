const mongoose = require('mongoose');

// Feature Flag Schema
const featureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  key: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  rolloutPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  targetAudience: [{
    type: String,
    trim: true
  }],
  conditions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Legal Text Schema
const legalTextSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['terms_of_service', 'privacy_policy', 'cookie_policy', 'gdpr_notice', 'acceptable_use']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  language: {
    type: String,
    required: true,
    default: 'en',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Policy URL Schema
const policyUrlSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['privacy_policy', 'terms_of_service', 'cookie_policy', 'support', 'contact', 'about']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Main System Settings Schema
const systemSettingsSchema = new mongoose.Schema({
  organizationName: {
    type: String,
    required: true,
    trim: true,
    default: 'Your Organization'
  },
  organizationLogo: {
    type: String,
    trim: true
  },
  supportEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  supportPhone: {
    type: String,
    trim: true
  },
  defaultCurrency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
    trim: true
  },
  defaultTimezone: {
    type: String,
    required: true,
    default: 'UTC',
    trim: true
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String,
    trim: true
  },
  featureFlags: [featureFlagSchema],
  legalTexts: [legalTextSchema],
  policyUrls: [policyUrlSchema],
  configuration: {
    authentication: {
      requireEmailVerification: {
        type: Boolean,
        default: true
      },
      requirePhoneVerification: {
        type: Boolean,
        default: false
      },
      passwordMinLength: {
        type: Number,
        default: 8,
        min: 6,
        max: 128
      },
      passwordRequireUppercase: {
        type: Boolean,
        default: true
      },
      passwordRequireLowercase: {
        type: Boolean,
        default: true
      },
      passwordRequireNumbers: {
        type: Boolean,
        default: true
      },
      passwordRequireSymbols: {
        type: Boolean,
        default: false
      },
      sessionTimeout: {
        type: Number,
        default: 3600000, // 1 hour in ms
        min: 300000 // 5 minutes
      },
      maxLoginAttempts: {
        type: Number,
        default: 5,
        min: 3,
        max: 10
      },
      lockoutDuration: {
        type: Number,
        default: 900000, // 15 minutes in ms
        min: 300000 // 5 minutes
      }
    },
    notifications: {
      emailEnabled: {
        type: Boolean,
        default: true
      },
      smsEnabled: {
        type: Boolean,
        default: false
      },
      pushEnabled: {
        type: Boolean,
        default: false
      },
      defaultEmailProvider: {
        type: String,
        default: 'sendgrid',
        enum: ['sendgrid', 'mailgun', 'ses', 'smtp']
      },
      defaultSmsProvider: {
        type: String,
        default: 'twilio',
        enum: ['twilio', 'aws-sns', 'nexmo']
      }
    },
    billing: {
      taxCalculationEnabled: {
        type: Boolean,
        default: false
      },
      defaultTaxRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
      },
      invoiceAutoGeneration: {
        type: Boolean,
        default: true
      },
      paymentRetryAttempts: {
        type: Number,
        default: 3,
        min: 0,
        max: 10
      },
      dunningEnabled: {
        type: Boolean,
        default: true
      }
    },
    paymentGateways: {
      stripe: {
        enabled: {
          type: Boolean,
          default: false
        },
        mode: {
          type: String,
          enum: ['test', 'live'],
          default: 'test'
        },
        publishableKey: {
          type: String,
          trim: true,
          select: false // Don't return by default
        },
        secretKey: {
          type: String,
          trim: true,
          select: false // Don't return by default
        },
        webhookSecret: {
          type: String,
          trim: true,
          select: false
        }
      },
      paypal: {
        enabled: {
          type: Boolean,
          default: false
        },
        mode: {
          type: String,
          enum: ['sandbox', 'live'],
          default: 'sandbox'
        },
        clientId: {
          type: String,
          trim: true,
          select: false
        },
        clientSecret: {
          type: String,
          trim: true,
          select: false
        },
        webhookId: {
          type: String,
          trim: true,
          select: false
        }
      }
    },
    security: {
      encryptionEnabled: {
        type: Boolean,
        default: true
      },
      auditLoggingEnabled: {
        type: Boolean,
        default: true
      },
      ipWhitelistEnabled: {
        type: Boolean,
        default: false
      },
      allowedIpRanges: [{
        type: String,
        trim: true
      }],
      rateLimitEnabled: {
        type: Boolean,
        default: true
      },
      maxRequestsPerMinute: {
        type: Number,
        default: 100,
        min: 10,
        max: 1000
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
systemSettingsSchema.index({ 'featureFlags.key': 1 });
systemSettingsSchema.index({ 'legalTexts.type': 1, 'legalTexts.language': 1 });
systemSettingsSchema.index({ 'policyUrls.type': 1 });

// Static method to get singleton settings
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Instance method to add feature flag
systemSettingsSchema.methods.addFeatureFlag = function (flagData) {
  this.featureFlags.push(flagData);
  return this.save();
};

// Instance method to update feature flag
systemSettingsSchema.methods.updateFeatureFlag = function (flagId, updates) {
  const flag = this.featureFlags.id(flagId);
  if (!flag) {
    throw new Error('Feature flag not found');
  }
  Object.assign(flag, updates);
  return this.save();
};

// Instance method to remove feature flag
systemSettingsSchema.methods.removeFeatureFlag = function (flagId) {
  this.featureFlags.pull(flagId);
  return this.save();
};

// Instance method to add legal text
systemSettingsSchema.methods.addLegalText = function (textData) {
  // Deactivate other texts of the same type and language
  this.legalTexts.forEach(text => {
    if (text.type === textData.type && text.language === textData.language) {
      text.isActive = false;
    }
  });

  this.legalTexts.push(textData);
  return this.save();
};

// Instance method to add policy URL
systemSettingsSchema.methods.addPolicyUrl = function (urlData) {
  this.policyUrls.push(urlData);
  return this.save();
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);