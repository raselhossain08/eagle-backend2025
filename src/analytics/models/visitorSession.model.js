const mongoose = require('mongoose');

const visitorSessionSchema = new mongoose.Schema({
  // Session Identification
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  // Session Timing
  startTime: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  endTime: {
    type: Date,
    default: null
  },
  lastActivity: {
    type: Date,
    required: true,
    default: Date.now
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  
  // Traffic Source & Campaign Data
  utm: {
    source: { type: String, default: null },
    medium: { type: String, default: null },
    campaign: { type: String, default: null },
    term: { type: String, default: null },
    content: { type: String, default: null }
  },
  referrer: {
    url: { type: String, default: null },
    domain: { type: String, default: null },
    type: { 
      type: String, 
      enum: ['direct', 'organic', 'social', 'referral', 'paid', 'email', 'unknown'],
      default: 'unknown'
    }
  },
  
  // Device & Browser Information
  device: {
    type: { 
      type: String, 
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    browser: { type: String, default: null },
    browserVersion: { type: String, default: null },
    os: { type: String, default: null },
    osVersion: { type: String, default: null },
    screenResolution: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  
  // Geographic Information
  geo: {
    country: { type: String, default: null },
    countryCode: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    timezone: { type: String, default: null },
    isp: { type: String, default: null }
  },
  
  // Privacy & Consent
  privacy: {
    ipAddress: { type: String, default: null }, // Can be anonymized
    ipAnonymized: { type: Boolean, default: false },
    consentGiven: { type: Boolean, default: false },
    consentTimestamp: { type: Date, default: null },
    consentVersion: { type: String, default: null },
    cookiesEnabled: { type: Boolean, default: true },
    doNotTrack: { type: Boolean, default: false }
  },
  
  // Session Metrics
  metrics: {
    pageViews: { type: Number, default: 0 },
    uniquePageViews: { type: Number, default: 0 },
    events: { type: Number, default: 0 },
    bounced: { type: Boolean, default: true }, // true if only 1 page view
    converted: { type: Boolean, default: false },
    revenue: { type: Number, default: 0 }
  },
  
  // Conversion Tracking
  conversions: [{
    type: {
      type: String,
      enum: ['signup', 'trial', 'purchase', 'upgrade', 'contract_signed', 'custom']
    },
    timestamp: { type: Date, required: true },
    value: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  }],
  
  // Landing & Exit Pages
  landingPage: {
    url: { type: String, required: true },
    title: { type: String, default: null },
    timestamp: { type: Date, required: true }
  },
  exitPage: {
    url: { type: String, default: null },
    title: { type: String, default: null },
    timestamp: { type: Date, default: null }
  },
  
  // A/B Testing & Experiments
  experiments: [{
    id: { type: String, required: true },
    variant: { type: String, required: true },
    timestamp: { type: Date, required: true }
  }],
  
  // Session Quality Indicators
  quality: {
    engagementScore: { type: Number, default: 0 }, // 0-100
    isBot: { type: Boolean, default: false },
    isSuspicious: { type: Boolean, default: false },
    qualityScore: { type: Number, default: 100 } // 0-100
  },
  
  // Real-time Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'visitor_sessions'
});

// Indexes for performance
visitorSessionSchema.index({ sessionId: 1 });
visitorSessionSchema.index({ visitorId: 1 });
visitorSessionSchema.index({ userId: 1 });
visitorSessionSchema.index({ startTime: -1 });
visitorSessionSchema.index({ 'utm.source': 1, 'utm.medium': 1, 'utm.campaign': 1 });
visitorSessionSchema.index({ 'referrer.type': 1 });
visitorSessionSchema.index({ 'device.type': 1 });
visitorSessionSchema.index({ 'geo.country': 1 });
visitorSessionSchema.index({ 'privacy.consentGiven': 1 });
visitorSessionSchema.index({ isActive: 1, lastActivity: -1 });
visitorSessionSchema.index({ 'metrics.converted': 1 });

// Compound indexes for analytics queries
visitorSessionSchema.index({ startTime: -1, 'referrer.type': 1 });
visitorSessionSchema.index({ startTime: -1, 'utm.source': 1 });
visitorSessionSchema.index({ startTime: -1, 'device.type': 1 });
visitorSessionSchema.index({ startTime: -1, 'geo.country': 1 });

// Virtual for session duration
visitorSessionSchema.virtual('sessionDuration').get(function() {
  if (this.endTime) {
    return Math.round((this.endTime - this.startTime) / 1000);
  }
  return Math.round((this.lastActivity - this.startTime) / 1000);
});

// Methods
visitorSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  this.isActive = true;
  return this.save();
};

visitorSessionSchema.methods.endSession = function() {
  this.endTime = new Date();
  this.isActive = false;
  this.duration = Math.round((this.endTime - this.startTime) / 1000);
  return this.save();
};

visitorSessionSchema.methods.addConversion = function(type, value = 0, currency = 'USD', metadata = {}) {
  this.conversions.push({
    type,
    value,
    currency,
    metadata,
    timestamp: new Date()
  });
  this.metrics.converted = true;
  this.metrics.revenue += value;
  return this.save();
};

visitorSessionSchema.methods.anonymizeIP = function() {
  if (this.privacy.ipAddress && !this.privacy.ipAnonymized) {
    // IPv4: mask last octet, IPv6: mask last 80 bits
    const ip = this.privacy.ipAddress;
    if (ip.includes('.')) {
      // IPv4
      const parts = ip.split('.');
      parts[3] = '0';
      this.privacy.ipAddress = parts.join('.');
    } else if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      for (let i = 5; i < parts.length; i++) {
        parts[i] = '0000';
      }
      this.privacy.ipAddress = parts.join(':');
    }
    this.privacy.ipAnonymized = true;
  }
  return this;
};

// Static methods
visitorSessionSchema.statics.findActiveSessions = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.find({
    isActive: true,
    lastActivity: { $gte: fiveMinutesAgo }
  });
};

visitorSessionSchema.statics.getSessionsInDateRange = function(startDate, endDate, filters = {}) {
  const query = {
    startTime: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    ...filters
  };
  return this.find(query).sort({ startTime: -1 });
};

visitorSessionSchema.statics.getConversionFunnel = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        startTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        signups: {
          $sum: {
            $cond: [
              { $in: ['signup', '$conversions.type'] },
              1,
              0
            ]
          }
        },
        trials: {
          $sum: {
            $cond: [
              { $in: ['trial', '$conversions.type'] },
              1,
              0
            ]
          }
        },
        purchases: {
          $sum: {
            $cond: [
              { $in: ['purchase', '$conversions.type'] },
              1,
              0
            ]
          }
        },
        contracts: {
          $sum: {
            $cond: [
              { $in: ['contract_signed', '$conversions.type'] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('VisitorSession', visitorSessionSchema);





