const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema({
  // Event identification
  type: {
    type: String,
    required: true,
    index: true,
    enum: [
      'page_view',
      'user_action', 
      'signup_started',
      'signup_completed',
      'login',
      'logout',
      'subscription_viewed',
      'payment_started',
      'payment_completed',
      'feature_usage',
      'error_occurred',
      'download',
      'video_play',
      'video_pause',
      'form_submit',
      'search',
      'share',
      'custom'
    ]
  },

  // User and session tracking
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  sessionId: {
    type: String,
    default: null,
    index: true
  },

  // Event timing
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Event data
  properties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Technical metadata
  metadata: {
    userAgent: {
      type: String,
      default: 'Unknown'
    },
    ip: {
      type: String,
      default: 'Unknown'
    },
    referer: {
      type: String,
      default: null
    },
    country: {
      type: String,
      default: null
    },
    city: {
      type: String,
      default: null
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    browser: {
      type: String,
      default: 'unknown'
    },
    os: {
      type: String,
      default: 'unknown'
    }
  }
}, {
  timestamps: true,
  // Add indexes for better performance
  collection: 'analytics_events'
});

// Compound indexes for common queries
analyticsEventSchema.index({ type: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ sessionId: 1, timestamp: -1 });
analyticsEventSchema.index({ timestamp: -1, type: 1 });

// TTL index to automatically delete old events (90 days)
analyticsEventSchema.index({ 
  createdAt: 1 
}, { 
  expireAfterSeconds: 90 * 24 * 60 * 60 // 90 days in seconds
});

// Static methods for common queries
analyticsEventSchema.statics.getEventsByDateRange = function(startDate, endDate, eventType = null) {
  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (eventType) {
    query.type = eventType;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

analyticsEventSchema.statics.getUserEvents = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'email firstName lastName');
};

analyticsEventSchema.statics.getTopEvents = function(timeRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  return this.aggregate([
    { 
      $match: { 
        timestamp: { $gte: startDate } 
      } 
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        lastOccurred: { $max: '$timestamp' }
      }
    },
    { 
      $sort: { count: -1 } 
    },
    {
      $project: {
        eventType: '$_id',
        count: 1,
        lastOccurred: 1,
        _id: 0
      }
    }
  ]);
};

analyticsEventSchema.statics.getDailyStats = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { 
      $match: { 
        timestamp: { $gte: startDate } 
      } 
    },
    {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        },
        totalEvents: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        eventTypes: { $addToSet: '$type' }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        totalEvents: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        eventTypes: { $size: '$eventTypes' },
        _id: 0
      }
    },
    { 
      $sort: { date: 1 } 
    }
  ]);
};

// Instance methods
analyticsEventSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  
  // Remove sensitive data if needed
  if (obj.metadata && obj.metadata.ip) {
    obj.metadata.ip = obj.metadata.ip.replace(/\.\d+$/, '.***');
  }
  
  return obj;
};

// Pre-save middleware to parse user agent and extract device info
analyticsEventSchema.pre('save', function(next) {
  if (this.metadata && this.metadata.userAgent) {
    const userAgent = this.metadata.userAgent.toLowerCase();
    
    // Simple device detection
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      this.metadata.device = 'mobile';
    } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
      this.metadata.device = 'tablet';
    } else {
      this.metadata.device = 'desktop';
    }
    
    // Simple browser detection
    if (userAgent.includes('chrome')) {
      this.metadata.browser = 'chrome';
    } else if (userAgent.includes('firefox')) {
      this.metadata.browser = 'firefox';
    } else if (userAgent.includes('safari')) {
      this.metadata.browser = 'safari';
    } else if (userAgent.includes('edge')) {
      this.metadata.browser = 'edge';
    }
    
    // Simple OS detection
    if (userAgent.includes('windows')) {
      this.metadata.os = 'windows';
    } else if (userAgent.includes('mac')) {
      this.metadata.os = 'macos';
    } else if (userAgent.includes('linux')) {
      this.metadata.os = 'linux';
    } else if (userAgent.includes('android')) {
      this.metadata.os = 'android';
    } else if (userAgent.includes('ios')) {
      this.metadata.os = 'ios';
    }
  }
  
  next();
});

// Virtual for formatted timestamp
analyticsEventSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Virtual for event age
analyticsEventSchema.virtual('ageInHours').get(function() {
  const now = new Date();
  const diffMs = now - this.timestamp;
  return Math.floor(diffMs / (1000 * 60 * 60));
});

const AnalyticsEvent = mongoose.model("AnalyticsEvent", analyticsEventSchema);

module.exports = AnalyticsEvent;