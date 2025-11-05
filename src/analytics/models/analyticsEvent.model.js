const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  // Event Identification
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
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
  
  // Event Details
  name: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: [
      'page_view',
      'user_interaction',
      'conversion',
      'engagement',
      'system',
      'error',
      'custom'
    ],
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: null
  },
  
  // Page Information
  page: {
    url: { type: String, required: true },
    title: { type: String, default: null },
    path: { type: String, required: true },
    referrer: { type: String, default: null },
    queryParams: { type: mongoose.Schema.Types.Mixed, default: {} },
    hash: { type: String, default: null }
  },
  
  // Event Value & Metrics
  value: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Timing Information
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  serverTimestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  processingDelay: {
    type: Number, // milliseconds
    default: 0
  },
  
  // User Interaction Details
  interaction: {
    elementId: { type: String, default: null },
    elementClass: { type: String, default: null },
    elementText: { type: String, default: null },
    elementType: { type: String, default: null },
    coordinates: {
      x: { type: Number, default: null },
      y: { type: Number, default: null }
    },
    scrollDepth: { type: Number, default: null },
    timeOnPage: { type: Number, default: null } // seconds
  },
  
  // Conversion Tracking
  conversion: {
    isConversion: { type: Boolean, default: false },
    conversionType: {
      type: String,
      enum: ['signup', 'trial', 'purchase', 'upgrade', 'contract_signed', 'custom'],
      default: null
    },
    conversionValue: { type: Number, default: 0 },
    funnelStep: { type: String, default: null },
    goalId: { type: String, default: null }
  },
  
  // E-commerce Tracking
  ecommerce: {
    transactionId: { type: String, default: null },
    itemId: { type: String, default: null },
    itemName: { type: String, default: null },
    itemCategory: { type: String, default: null },
    quantity: { type: Number, default: null },
    price: { type: Number, default: null },
    discount: { type: Number, default: null },
    couponCode: { type: String, default: null }
  },
  
  // Technical Details
  technical: {
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    ipAnonymized: { type: Boolean, default: false },
    devicePixelRatio: { type: Number, default: null },
    viewportSize: {
      width: { type: Number, default: null },
      height: { type: Number, default: null }
    },
    connectionType: { type: String, default: null },
    loadTime: { type: Number, default: null }
  },
  
  // Privacy & Consent
  privacy: {
    consentGiven: { type: Boolean, default: false },
    consentTypes: {
      analytics: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
      personalization: { type: Boolean, default: false }
    },
    cookielessMode: { type: Boolean, default: false },
    doNotTrack: { type: Boolean, default: false }
  },
  
  // A/B Testing & Personalization
  experiments: [{
    id: { type: String, required: true },
    variant: { type: String, required: true },
    timestamp: { type: Date, required: true }
  }],
  personalization: {
    segmentIds: [{ type: String }],
    recommendations: [{ type: mongoose.Schema.Types.Mixed }],
    customizations: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  
  // Custom Properties
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Data Quality
  quality: {
    isValid: { type: Boolean, default: true },
    isBot: { type: Boolean, default: false },
    isSuspicious: { type: Boolean, default: false },
    qualityScore: { type: Number, default: 100 }, // 0-100
    validationErrors: [{ type: String }]
  },
  
  // Processing Status
  processing: {
    status: {
      type: String,
      enum: ['pending', 'processed', 'failed', 'skipped'],
      default: 'pending'
    },
    processedAt: { type: Date, default: null },
    retryCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null }
  },
  
  // Attribution
  attribution: {
    firstTouch: {
      source: { type: String, default: null },
      medium: { type: String, default: null },
      campaign: { type: String, default: null },
      timestamp: { type: Date, default: null }
    },
    lastTouch: {
      source: { type: String, default: null },
      medium: { type: String, default: null },
      campaign: { type: String, default: null },
      timestamp: { type: Date, default: null }
    }
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'analytics_events'
});

// Indexes for performance
analyticsEventSchema.index({ eventId: 1 });
analyticsEventSchema.index({ sessionId: 1, timestamp: -1 });
analyticsEventSchema.index({ visitorId: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ name: 1, timestamp: -1 });
analyticsEventSchema.index({ category: 1, timestamp: -1 });
analyticsEventSchema.index({ 'page.path': 1, timestamp: -1 });
analyticsEventSchema.index({ timestamp: -1 });
analyticsEventSchema.index({ 'conversion.isConversion': 1, timestamp: -1 });
analyticsEventSchema.index({ 'privacy.consentGiven': 1 });
analyticsEventSchema.index({ 'processing.status': 1 });

// Compound indexes for analytics queries
analyticsEventSchema.index({ category: 1, name: 1, timestamp: -1 });
analyticsEventSchema.index({ 'page.path': 1, category: 1, timestamp: -1 });
analyticsEventSchema.index({ sessionId: 1, category: 1, timestamp: -1 });
analyticsEventSchema.index({ timestamp: -1, 'conversion.isConversion': 1 });

// Text index for searching
analyticsEventSchema.index({
  name: 'text',
  action: 'text',
  label: 'text',
  'page.title': 'text',
  'interaction.elementText': 'text'
});

// Methods
analyticsEventSchema.methods.markAsProcessed = function() {
  this.processing.status = 'processed';
  this.processing.processedAt = new Date();
  return this.save();
};

analyticsEventSchema.methods.markAsFailed = function(errorMessage) {
  this.processing.status = 'failed';
  this.processing.errorMessage = errorMessage;
  this.processing.retryCount += 1;
  return this.save();
};

analyticsEventSchema.methods.anonymizeData = function() {
  if (this.technical.ipAddress && !this.technical.ipAnonymized) {
    // Anonymize IP address
    const ip = this.technical.ipAddress;
    if (ip.includes('.')) {
      // IPv4
      const parts = ip.split('.');
      parts[3] = '0';
      this.technical.ipAddress = parts.join('.');
    } else if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      for (let i = 5; i < parts.length; i++) {
        parts[i] = '0000';
      }
      this.technical.ipAddress = parts.join(':');
    }
    this.technical.ipAnonymized = true;
  }
  
  // Remove sensitive interaction details if needed
  if (this.privacy.doNotTrack) {
    this.interaction.elementText = null;
    this.properties = {};
  }
  
  return this;
};

// Static methods
analyticsEventSchema.statics.getPageViews = function(startDate, endDate, filters = {}) {
  const query = {
    category: 'page_view',
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    ...filters
  };
  return this.find(query).sort({ timestamp: -1 });
};

analyticsEventSchema.statics.getConversionEvents = function(startDate, endDate) {
  return this.find({
    'conversion.isConversion': true,
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ timestamp: -1 });
};

analyticsEventSchema.statics.getTopPages = function(startDate, endDate, limit = 10) {
  return this.aggregate([
    {
      $match: {
        category: 'page_view',
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$page.path',
        pageTitle: { $first: '$page.title' },
        views: { $sum: 1 },
        uniqueVisitors: { $addToSet: '$visitorId' },
        avgTimeOnPage: { $avg: '$interaction.timeOnPage' },
        avgScrollDepth: { $avg: '$interaction.scrollDepth' }
      }
    },
    {
      $addFields: {
        uniqueVisitors: { $size: '$uniqueVisitors' }
      }
    },
    {
      $sort: { views: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

analyticsEventSchema.statics.getFunnelAnalysis = function(startDate, endDate, funnelSteps) {
  return this.aggregate([
    {
      $match: {
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        'conversion.funnelStep': { $in: funnelSteps }
      }
    },
    {
      $group: {
        _id: {
          visitorId: '$visitorId',
          funnelStep: '$conversion.funnelStep'
        },
        timestamp: { $min: '$timestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.funnelStep',
        uniqueVisitors: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

analyticsEventSchema.statics.getRealTimeStats = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: fiveMinutesAgo }
      }
    },
    {
      $facet: {
        activeUsers: [
          {
            $group: {
              _id: '$visitorId'
            }
          },
          {
            $count: 'count'
          }
        ],
        topPages: [
          {
            $match: { category: 'page_view' }
          },
          {
            $group: {
              _id: '$page.path',
              views: { $sum: 1 }
            }
          },
          {
            $sort: { views: -1 }
          },
          {
            $limit: 5
          }
        ],
        recentEvents: [
          {
            $sort: { timestamp: -1 }
          },
          {
            $limit: 20
          },
          {
            $project: {
              name: 1,
              action: 1,
              'page.path': 1,
              timestamp: 1,
              visitorId: 1
            }
          }
        ]
      }
    }
  ]);
};

module.exports = mongoose.models.AnalyticsEvent || mongoose.model('AnalyticsEvent', analyticsEventSchema);





