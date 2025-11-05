const mongoose = require('mongoose');

/**
 * Visitor Analytics Models
 * Privacy-aware analytics with consent management, UTM tracking, and conversion funnels
 */

// Analytics Event Schema
const analyticsEventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  userId: { type: String }, // If authenticated user
  visitorId: { type: String, required: true }, // Anonymous or authenticated
  
  // Event Details
  event: {
    name: { type: String, required: true }, // page_view, button_click, form_submit, etc.
    category: { type: String, required: true }, // navigation, engagement, conversion, etc.
    action: { type: String }, // click, submit, view, etc.
    label: { type: String }, // Additional context
    value: { type: Number }, // Numeric value (price, duration, etc.)
    
    // Custom properties
    properties: { type: Map, of: mongoose.Schema.Types.Mixed }
  },
  
  // Page Information
  page: {
    url: { type: String, required: true },
    path: { type: String, required: true },
    title: { type: String },
    hostname: { type: String },
    referrer: { type: String },
    
    // Performance metrics
    loadTime: { type: Number }, // in milliseconds
    domContentLoaded: { type: Number },
    firstContentfulPaint: { type: Number },
    largestContentfulPaint: { type: Number },
    cumulativeLayoutShift: { type: Number },
    firstInputDelay: { type: Number }
  },
  
  // UTM & Campaign Tracking
  utm: {
    source: { type: String },
    medium: { type: String },
    campaign: { type: String },
    term: { type: String },
    content: { type: String }
  },
  
  // Technical Information
  technical: {
    // Device
    device: {
      type: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'] },
      brand: { type: String },
      model: { type: String },
      screenResolution: { type: String },
      viewportSize: { type: String },
      pixelRatio: { type: Number },
      touchSupport: { type: Boolean }
    },
    
    // Browser
    browser: {
      name: { type: String },
      version: { type: String },
      engine: { type: String },
      language: { type: String },
      languages: [{ type: String }],
      cookieEnabled: { type: Boolean },
      doNotTrack: { type: Boolean }
    },
    
    // Operating System
    os: {
      name: { type: String },
      version: { type: String },
      architecture: { type: String }
    },
    
    // Network
    network: {
      effectiveType: { type: String }, // 2g, 3g, 4g, etc.
      downlink: { type: Number },
      rtt: { type: Number },
      saveData: { type: Boolean }
    }
  },
  
  // Geolocation (with privacy controls)
  location: {
    // IP-based location
    ipAddress: { type: String, required: true },
    country: { type: String },
    countryCode: { type: String },
    region: { type: String },
    city: { type: String },
    timezone: { type: String },
    
    // GPS location (if consent given)
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number }
    },
    
    // Privacy settings
    isAnonymized: { type: Boolean, default: true },
    consentGiven: { type: Boolean, default: false },
    retentionPeriod: { type: Number, default: 90 } // days
  },
  
  // Privacy & Consent
  privacy: {
    consentMode: { type: String, enum: ['granted', 'denied', 'unknown'], default: 'unknown' },
    analyticsConsent: { type: Boolean, default: false },
    advertisingConsent: { type: Boolean, default: false },
    functionalConsent: { type: Boolean, default: true },
    
    // Data collection settings
    collectPersonalData: { type: Boolean, default: false },
    collectBehavioralData: { type: Boolean, default: true },
    cookielessMode: { type: Boolean, default: false },
    
    // GDPR compliance
    gdprApplies: { type: Boolean, default: false },
    consentString: { type: String }, // IAB consent string
    consentTimestamp: { type: Date }
  },
  
  // Conversion Tracking
  conversion: {
    isConversion: { type: Boolean, default: false },
    conversionType: { type: String }, // signup, purchase, trial, etc.
    conversionValue: { type: Number },
    conversionGoal: { type: String },
    funnelStep: { type: String },
    funnelPosition: { type: Number }
  },
  
  // Engagement Metrics
  engagement: {
    timeOnPage: { type: Number }, // in seconds
    scrollDepth: { type: Number }, // percentage
    clickDepth: { type: Number }, // number of clicks
    formInteractions: { type: Number },
    videoPlays: { type: Number },
    fileDownloads: [{ type: String }],
    externalLinkClicks: [{ type: String }]
  },
  
  // A/B Testing
  experiments: [{
    experimentId: { type: String },
    variantId: { type: String },
    variantName: { type: String }
  }],
  
  // Timestamps
  timestamp: { type: Date, required: true, default: Date.now },
  serverTimestamp: { type: Date, default: Date.now },
  
  // Processing flags
  processed: { type: Boolean, default: false },
  processedAt: { type: Date }
}, {
  timestamps: true,
  collection: 'analytics_events'
});

// Analytics Session Schema
const analyticsSessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  visitorId: { type: String, required: true },
  userId: { type: String }, // If user logs in during session
  
  // Session Details
  session: {
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    duration: { type: Number }, // in seconds
    isActive: { type: Boolean, default: true },
    
    // Entry/Exit
    entryPage: { type: String, required: true },
    exitPage: { type: String },
    landingPage: { type: String },
    
    // Engagement
    pageViews: { type: Number, default: 0 },
    uniquePageViews: { type: Number, default: 0 },
    events: { type: Number, default: 0 },
    interactions: { type: Number, default: 0 },
    
    // Bounce tracking
    isBounce: { type: Boolean },
    bounceTime: { type: Number }, // seconds before bounce
    
    // Conversion
    hasConversion: { type: Boolean, default: false },
    conversions: [{ type: String }], // conversion types achieved
    conversionValue: { type: Number, default: 0 }
  },
  
  // Attribution
  attribution: {
    // First-touch attribution
    firstTouch: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      referrer: { type: String },
      timestamp: { type: Date }
    },
    
    // Last-touch attribution  
    lastTouch: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      referrer: { type: String },
      timestamp: { type: Date }
    },
    
    // Channel classification
    channel: { type: String }, // organic, paid, direct, social, email, etc.
    channelGroup: { type: String }, // acquisition, retention, etc.
    
    // Multi-touch attribution
    touchpoints: [{
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      timestamp: { type: Date },
      weight: { type: Number, default: 1 }
    }]
  },
  
  // Device & Technology (aggregated from events)
  technology: {
    device: { type: String },
    browser: { type: String },
    os: { type: String },
    screenResolution: { type: String },
    language: { type: String }
  },
  
  // Geographic data
  geography: {
    country: { type: String },
    region: { type: String },
    city: { type: String },
    timezone: { type: String }
  },
  
  // Privacy settings for this session
  privacy: {
    consentMode: { type: String, enum: ['granted', 'denied', 'unknown'], default: 'unknown' },
    trackingEnabled: { type: Boolean, default: true },
    isAnonymous: { type: Boolean, default: true }
  }
}, {
  timestamps: true,
  collection: 'analytics_sessions'
});

// Analytics Visitor Schema
const analyticsVisitorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String }, // If visitor becomes authenticated
  
  // Visitor Identification
  identity: {
    isAuthenticated: { type: Boolean, default: false },
    email: { type: String },
    customUserId: { type: String },
    fingerprint: { type: String }, // Device fingerprinting for anonymized tracking
    
    // Cross-device tracking
    crossDeviceId: { type: String },
    deviceIds: [{ type: String }]
  },
  
  // First-time visitor data
  firstVisit: {
    timestamp: { type: Date, required: true, default: Date.now },
    page: { type: String, required: true },
    referrer: { type: String },
    utm: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      term: { type: String },
      content: { type: String }
    },
    
    // Geographic data from first visit
    location: {
      country: { type: String },
      region: { type: String },
      city: { type: String },
      timezone: { type: String }
    }
  },
  
  // Latest visit data
  lastVisit: {
    timestamp: { type: Date },
    page: { type: String },
    sessionId: { type: String }
  },
  
  // Aggregate metrics
  metrics: {
    totalSessions: { type: Number, default: 0 },
    totalPageViews: { type: Number, default: 0 },
    totalEvents: { type: Number, default: 0 },
    totalTimeOnSite: { type: Number, default: 0 }, // in seconds
    
    averageSessionDuration: { type: Number, default: 0 },
    averagePageViews: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    
    // Conversion metrics
    conversions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    totalConversionValue: { type: Number, default: 0 },
    
    // Engagement score (0-100)
    engagementScore: { type: Number, default: 0 }
  },
  
  // Behavioral segments
  segments: [{ type: String }], // high_value, at_risk, new_visitor, etc.
  
  // Technology preferences
  technology: {
    preferredDevice: { type: String },
    preferredBrowser: { type: String },
    preferredOs: { type: String },
    devices: [{ type: String }] // List of devices used
  },
  
  // Privacy & Consent
  privacy: {
    consentGiven: { type: Boolean, default: false },
    consentTimestamp: { type: Date },
    optedOut: { type: Boolean, default: false },
    optOutTimestamp: { type: Date },
    
    dataRetentionPeriod: { type: Number, default: 90 }, // days
    dataExpirationDate: { type: Date },
    rightToBeForgotten: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: 'analytics_visitors'
});

// Analytics Funnel Schema
const analyticsFunnelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  
  // Funnel Configuration
  config: {
    steps: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String },
      
      // Step criteria
      criteria: {
        event: { type: String }, // event name
        url: { type: String }, // page URL pattern
        conditions: [{ 
          property: { type: String },
          operator: { type: String, enum: ['equals', 'contains', 'starts_with', 'exists'] },
          value: { type: String }
        }]
      },
      
      // Step settings
      order: { type: Number, required: true },
      isRequired: { type: Boolean, default: true },
      timeoutMinutes: { type: Number, default: 60 } // Max time to complete step
    }],
    
    // Funnel settings
    settings: {
      conversionWindow: { type: Number, default: 7 }, // days
      allowRepeatedSteps: { type: Boolean, default: false },
      requireSequentialOrder: { type: Boolean, default: true }
    }
  },
  
  // Performance metrics (updated periodically)
  metrics: {
    lastCalculated: { type: Date },
    period: { type: String, enum: ['hour', 'day', 'week', 'month'] },
    
    totalEntries: { type: Number, default: 0 },
    totalCompletions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    
    stepMetrics: [{
      stepId: { type: String },
      entries: { type: Number, default: 0 },
      completions: { type: Number, default: 0 },
      dropoffs: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      averageTimeToComplete: { type: Number, default: 0 } // in minutes
    }]
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  lastModifiedBy: { type: String }
}, {
  timestamps: true,
  collection: 'analytics_funnels'
});

// Real-time Analytics Schema
const analyticsRealtimeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true, default: Date.now },
  
  // Current metrics (last 30 minutes)
  current: {
    activeUsers: { type: Number, default: 0 },
    activeSessions: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    events: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 }
  },
  
  // Top content (last hour)
  topContent: [{
    page: { type: String },
    views: { type: Number },
    uniqueViews: { type: Number },
    activeUsers: { type: Number }
  }],
  
  // Traffic sources (last hour)
  trafficSources: [{
    source: { type: String },
    users: { type: Number },
    sessions: { type: Number },
    bounceRate: { type: Number }
  }],
  
  // Geographic distribution
  geography: [{
    country: { type: String },
    users: { type: Number },
    sessions: { type: Number }
  }],
  
  // Device breakdown
  devices: [{
    type: { type: String },
    users: { type: Number },
    sessions: { type: Number }
  }],
  
  // Alerts triggered
  alerts: [{
    type: { type: String },
    message: { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  collection: 'analytics_realtime',
  // TTL index - remove records older than 7 days
  expires: 604800 // 7 days in seconds
});

// Indexes for performance
analyticsEventSchema.index({ sessionId: 1 });
analyticsEventSchema.index({ visitorId: 1 });
analyticsEventSchema.index({ userId: 1 });
analyticsEventSchema.index({ timestamp: -1 });
analyticsEventSchema.index({ 'event.name': 1 });
analyticsEventSchema.index({ 'event.category': 1 });
analyticsEventSchema.index({ 'page.path': 1 });
analyticsEventSchema.index({ 'utm.campaign': 1 });
analyticsEventSchema.index({ 'utm.source': 1 });
analyticsEventSchema.index({ 'conversion.isConversion': 1 });
analyticsEventSchema.index({ 'location.country': 1 });

analyticsSessionSchema.index({ visitorId: 1 });
analyticsSessionSchema.index({ userId: 1 });
analyticsSessionSchema.index({ 'session.startTime': -1 });
analyticsSessionSchema.index({ 'session.isActive': 1 });
analyticsSessionSchema.index({ 'attribution.channel': 1 });
analyticsSessionSchema.index({ 'geography.country': 1 });

analyticsVisitorSchema.index({ userId: 1 });
analyticsVisitorSchema.index({ 'identity.email': 1 });
analyticsVisitorSchema.index({ 'firstVisit.timestamp': -1 });
analyticsVisitorSchema.index({ segments: 1 });

analyticsFunnelSchema.index({ isActive: 1 });
analyticsFunnelSchema.index({ createdBy: 1 });

analyticsRealtimeSchema.index({ timestamp: -1 });

// Methods for Analytics Event
analyticsEventSchema.methods = {
  /**
   * Check if event qualifies as conversion
   */
  isConversionEvent() {
    const conversionEvents = [
      'signup_completed',
      'trial_started', 
      'subscription_created',
      'purchase_completed',
      'contract_signed'
    ];
    
    return conversionEvents.includes(this.event.name);
  },

  /**
   * Get funnel step for this event
   */
  getFunnelStep() {
    // Logic to determine which funnel step this event represents
    const stepMapping = {
      'page_view': this.page.path.includes('/pricing') ? 'view_pricing' : 'page_view',
      'button_click': this.event.properties?.get('button_type') === 'cta' ? 'click_cta' : 'interaction',
      'form_submit': 'form_submission',
      'signup_completed': 'signup',
      'trial_started': 'trial',
      'subscription_created': 'conversion'
    };
    
    return stepMapping[this.event.name] || 'other';
  }
};

// Methods for Analytics Session
analyticsSessionSchema.methods = {
  /**
   * Update session with new event
   */
  updateWithEvent(event) {
    this.session.events++;
    this.session.endTime = new Date();
    this.session.duration = (this.session.endTime - this.session.startTime) / 1000;
    this.session.exitPage = event.page.path;
    
    // Update interactions based on event type
    if (['button_click', 'form_submit', 'link_click'].includes(event.event.name)) {
      this.session.interactions++;
    }
    
    // Update bounce status
    if (this.session.pageViews === 1 && this.session.duration < 10) {
      this.session.isBounce = true;
      this.session.bounceTime = this.session.duration;
    } else {
      this.session.isBounce = false;
    }
    
    // Check for conversions
    if (event.conversion.isConversion) {
      this.session.hasConversion = true;
      this.session.conversions.push(event.conversion.conversionType);
      this.session.conversionValue += event.conversion.conversionValue || 0;
    }
  },

  /**
   * Calculate engagement score
   */
  calculateEngagementScore() {
    let score = 0;
    
    // Duration points (max 30 points)
    const durationMinutes = this.session.duration / 60;
    score += Math.min(durationMinutes * 2, 30);
    
    // Page views points (max 25 points)
    score += Math.min(this.session.pageViews * 5, 25);
    
    // Interactions points (max 25 points)
    score += Math.min(this.session.interactions * 3, 25);
    
    // Conversion bonus (20 points)
    if (this.session.hasConversion) {
      score += 20;
    }
    
    // Bounce penalty
    if (this.session.isBounce) {
      score = score * 0.1; // Reduce to 10% if bounce
    }
    
    return Math.min(Math.round(score), 100);
  }
};

// Static methods for Analytics Event
analyticsEventSchema.statics = {
  /**
   * Get conversion funnel data
   */
  async getConversionFunnel(funnelId, dateRange = {}) {
    const { start, end } = dateRange;
    const matchStage = {};
    
    if (start && end) {
      matchStage.timestamp = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }
    
    // Get funnel configuration
    const AnalyticsFunnel = mongoose.model('AnalyticsFunnel');
    const funnel = await AnalyticsFunnel.findOne({ id: funnelId });
    
    if (!funnel) {
      throw new Error('Funnel not found');
    }
    
    const pipeline = funnel.config.steps.map((step, index) => {
      return {
        $group: {
          _id: `step_${index}`,
          users: { $addToSet: '$visitorId' },
          events: { $sum: 1 }
        }
      };
    });
    
    const results = await this.aggregate([
      { $match: matchStage },
      ...pipeline
    ]);
    
    return results;
  },

  /**
   * Get real-time analytics
   */
  async getRealtimeAnalytics() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const [activeUsers, topPages, trafficSources] = await Promise.all([
      // Active users in last 30 minutes
      this.distinct('visitorId', { 
        timestamp: { $gte: thirtyMinutesAgo } 
      }),
      
      // Top pages
      this.aggregate([
        { $match: { 
          timestamp: { $gte: thirtyMinutesAgo },
          'event.name': 'page_view'
        }},
        { $group: {
          _id: '$page.path',
          views: { $sum: 1 },
          uniqueViews: { $addToSet: '$visitorId' }
        }},
        { $project: {
          page: '$_id',
          views: 1,
          uniqueViews: { $size: '$uniqueViews' }
        }},
        { $sort: { views: -1 } },
        { $limit: 10 }
      ]),
      
      // Traffic sources
      this.aggregate([
        { $match: { 
          timestamp: { $gte: thirtyMinutesAgo },
          'event.name': 'page_view'
        }},
        { $group: {
          _id: '$utm.source',
          users: { $addToSet: '$visitorId' },
          sessions: { $addToSet: '$sessionId' }
        }},
        { $project: {
          source: '$_id',
          users: { $size: '$users' },
          sessions: { $size: '$sessions' }
        }},
        { $sort: { users: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    return {
      activeUsers: activeUsers.length,
      topPages,
      trafficSources
    };
  }
};

// Create TTL indexes for data retention
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 1 year
analyticsSessionSchema.index({ 'session.startTime': 1 }, { expireAfterSeconds: 31536000 }); // 1 year

const AnalyticsEvent = mongoose.models.AnalyticsEvent || mongoose.model('AnalyticsEvent', analyticsEventSchema);
const AnalyticsSession = mongoose.model('AnalyticsSession', analyticsSessionSchema);
const AnalyticsVisitor = mongoose.model('AnalyticsVisitor', analyticsVisitorSchema);
const AnalyticsFunnel = mongoose.model('AnalyticsFunnel', analyticsFunnelSchema);
const AnalyticsRealtime = mongoose.model('AnalyticsRealtime', analyticsRealtimeSchema);

// Legacy models for backward compatibility
const PageView = AnalyticsEvent;
const UserSession = AnalyticsSession;
const Event = AnalyticsEvent;
const Conversion = AnalyticsEvent;
const AnalyticsSummary = AnalyticsRealtime;

module.exports = {
  // New comprehensive models
  AnalyticsEvent,
  AnalyticsSession,
  AnalyticsVisitor,
  AnalyticsFunnel,
  AnalyticsRealtime,
  
  // Legacy compatibility
  PageView,
  UserSession,
  Event,
  Conversion,
  AnalyticsSummary
};





