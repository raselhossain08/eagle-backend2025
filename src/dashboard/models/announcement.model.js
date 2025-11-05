const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'promotional', 'maintenance'],
    default: 'info'
  },
  
  // Targeting & Display
  targetPages: [{
    type: String,
    trim: true
  }], // ['*'] for all pages, ['/dashboard', '/billing'] for specific pages
  targetSegments: [{
    type: String,
    enum: ['all', 'free_users', 'paid_users', 'trial_users', 'admin_users', 'beta_users'],
    default: 'all'
  }],
  targetUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // Specific user targeting
  
  // Display Properties
  position: {
    type: String,
    enum: ['top', 'bottom', 'modal', 'sidebar', 'inline'],
    default: 'top'
  },
  style: {
    backgroundColor: {
      type: String,
      default: '#007bff'
    },
    textColor: {
      type: String,
      default: '#ffffff'
    },
    borderColor: {
      type: String,
      default: 'transparent'
    },
    icon: {
      type: String,
      trim: true
    }
  },
  
  // Scheduling
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Behavior
  isDismissible: {
    type: Boolean,
    default: true
  },
  isSticky: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }, // Higher numbers = higher priority
  maxDisplayCount: {
    type: Number,
    default: null // null = unlimited
  },
  
  // Status & Tracking
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'expired', 'paused'],
    default: 'draft'
  },
  
  // Analytics
  impressions: {
    total: {
      type: Number,
      default: 0
    },
    unique: {
      type: Number,
      default: 0
    }
  },
  clicks: {
    total: {
      type: Number,
      default: 0
    },
    unique: {
      type: Number,
      default: 0
    }
  },
  dismissals: {
    total: {
      type: Number,
      default: 0
    },
    unique: {
      type: Number,
      default: 0
    }
  },
  
  // Call to Action
  cta: {
    text: {
      type: String,
      trim: true,
      maxlength: 50
    },
    url: {
      type: String,
      trim: true
    },
    action: {
      type: String,
      enum: ['link', 'modal', 'function', 'dismiss'],
      default: 'link'
    },
    target: {
      type: String,
      enum: ['_self', '_blank'],
      default: '_self'
    }
  },
  
  // Localization
  locales: [{
    language: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    cta: {
      text: String,
      url: String
    }
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
announcementSchema.index({ status: 1, startDate: 1, endDate: 1 });
announcementSchema.index({ targetPages: 1, targetSegments: 1 });
announcementSchema.index({ isActive: 1, priority: -1 });
announcementSchema.index({ createdBy: 1 });
announcementSchema.index({ startDate: 1, endDate: 1 });

// Virtuals
announcementSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && 
         this.status === 'active' && 
         this.startDate <= now && 
         this.endDate > now;
});

announcementSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  if (this.endDate <= now) return 0;
  return Math.max(0, this.endDate - now);
});

// Instance Methods
announcementSchema.methods.incrementImpression = async function(isUnique = false) {
  this.impressions.total += 1;
  if (isUnique) {
    this.impressions.unique += 1;
  }
  return await this.save();
};

announcementSchema.methods.incrementClick = async function(isUnique = false) {
  this.clicks.total += 1;
  if (isUnique) {
    this.clicks.unique += 1;
  }
  return await this.save();
};

announcementSchema.methods.incrementDismissal = async function(isUnique = false) {
  this.dismissals.total += 1;
  if (isUnique) {
    this.dismissals.unique += 1;
  }
  return await this.save();
};

announcementSchema.methods.getLocalizedContent = function(language = 'en') {
  const locale = this.locales.find(l => l.language === language);
  if (locale) {
    return {
      title: locale.title,
      content: locale.content,
      cta: locale.cta
    };
  }
  
  // Fallback to default content
  return {
    title: this.title,
    content: this.content,
    cta: this.cta
  };
};

announcementSchema.methods.isTargetedToUser = function(user, page = null) {
  // Check if announcement is currently active
  if (!this.isCurrentlyActive) return false;
  
  // Check page targeting
  if (this.targetPages.length > 0 && !this.targetPages.includes('*')) {
    if (!page || !this.targetPages.includes(page)) {
      return false;
    }
  }
  
  // Check specific user targeting
  if (this.targetUserIds.length > 0) {
    return this.targetUserIds.some(id => id.equals(user._id));
  }
  
  // Check segment targeting
  if (this.targetSegments.includes('all')) return true;
  
  // Determine user segment
  const userSegments = this.getUserSegments(user);
  return this.targetSegments.some(segment => userSegments.includes(segment));
};

announcementSchema.methods.getUserSegments = function(user) {
  const segments = [];
  
  // Basic segments
  if (user.subscription?.status === 'active') {
    segments.push('paid_users');
  } else if (user.subscription?.status === 'trial') {
    segments.push('trial_users');
  } else {
    segments.push('free_users');
  }
  
  // Role-based segments
  if (user.role === 'admin' || user.isAdmin) {
    segments.push('admin_users');
  }
  
  // Beta users
  if (user.isBetaUser || user.features?.includes('beta_access')) {
    segments.push('beta_users');
  }
  
  return segments;
};

// Static Methods
announcementSchema.statics.getActiveAnnouncements = async function(user, page = null, limit = 10) {
  const now = new Date();
  
  const announcements = await this.find({
    isActive: true,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gt: now }
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit)
  .populate('createdBy', 'firstName lastName email')
  .lean();
  
  // Filter by targeting rules
  return announcements.filter(announcement => {
    const doc = new this(announcement);
    return doc.isTargetedToUser(user, page);
  });
};

announcementSchema.statics.updateExpiredAnnouncements = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: 'active',
      endDate: { $lte: now }
    },
    {
      status: 'expired'
    }
  );
  
  return result;
};

announcementSchema.statics.getAnnouncementStats = async function(announcementId = null) {
  const match = announcementId ? { _id: mongoose.Types.ObjectId(announcementId) } : {};
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: announcementId ? '$_id' : null,
        totalAnnouncements: { $sum: 1 },
        totalImpressions: { $sum: '$impressions.total' },
        totalClicks: { $sum: '$clicks.total' },
        totalDismissals: { $sum: '$dismissals.total' },
        uniqueImpressions: { $sum: '$impressions.unique' },
        uniqueClicks: { $sum: '$clicks.unique' },
        uniqueDismissals: { $sum: '$dismissals.unique' }
      }
    },
    {
      $addFields: {
        clickThroughRate: {
          $cond: {
            if: { $gt: ['$totalImpressions', 0] },
            then: { $divide: ['$totalClicks', '$totalImpressions'] },
            else: 0
          }
        },
        dismissalRate: {
          $cond: {
            if: { $gt: ['$totalImpressions', 0] },
            then: { $divide: ['$totalDismissals', '$totalImpressions'] },
            else: 0
          }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalAnnouncements: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalDismissals: 0,
    uniqueImpressions: 0,
    uniqueClicks: 0,
    uniqueDismissals: 0,
    clickThroughRate: 0,
    dismissalRate: 0
  };
};

// Pre-save middleware
announcementSchema.pre('save', function(next) {
  // Auto-update status based on dates
  const now = new Date();
  
  if (this.startDate > now && this.status !== 'draft') {
    this.status = 'scheduled';
  } else if (this.startDate <= now && this.endDate > now && this.isActive) {
    this.status = 'active';
  } else if (this.endDate <= now) {
    this.status = 'expired';
  }
  
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);





