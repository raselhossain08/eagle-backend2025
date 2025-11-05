const mongoose = require('mongoose');

const promotionalCampaignSchema = new mongoose.Schema({
  // Basic Information
  campaignId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  // Campaign Classification
  type: {
    type: String,
    enum: ['acquisition', 'retention', 'winback', 'upsell', 'seasonal', 'flash_sale', 'loyalty', 'referral'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['discount', 'promotion', 'trial', 'bundle', 'loyalty_reward', 'referral_bonus'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Timeline
  timeline: {
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      index: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    launchDate: Date,
    actualStartDate: Date,
    actualEndDate: Date,
    duration: {
      planned: Number, // days
      actual: Number   // days
    }
  },
  
  // Target Audience
  targeting: {
    customerSegments: [{
      segmentId: String,
      segmentName: String,
      estimatedSize: Number
    }],
    geoTargeting: {
      countries: [{
        code: String,
        name: String
      }],
      regions: [String],
      cities: [String],
      excludedCountries: [{
        code: String,
        name: String
      }]
    },
    demographicTargeting: {
      ageRange: {
        min: Number,
        max: Number
      },
      gender: [String],
      interests: [String],
      behaviors: [String]
    },
    behavioralTargeting: {
      purchaseHistory: {
        hasSubscription: Boolean,
        subscriptionType: [String],
        lastPurchaseDate: {
          before: Date,
          after: Date
        },
        totalSpent: {
          min: Number,
          max: Number,
          currency: String
        }
      },
      engagement: {
        emailEngagement: {
          type: String,
          enum: ['high', 'medium', 'low', 'any']
        },
        siteActivity: {
          type: String,
          enum: ['frequent', 'occasional', 'rare', 'dormant', 'any']
        },
        loginFrequency: {
          type: String,
          enum: ['daily', 'weekly', 'monthly', 'rarely', 'any']
        }
      },
      deviceTargeting: {
        deviceTypes: [String], // desktop, mobile, tablet
        operatingSystems: [String],
        browsers: [String]
      }
    },
    exclusions: {
      customerIds: [mongoose.Schema.Types.ObjectId],
      emailDomains: [String],
      segments: [String],
      previousCampaigns: [String]
    }
  },
  
  // Channel Configuration
  channels: {
    primary: {
      type: String,
      enum: ['email', 'sms', 'push', 'in_app', 'web_banner', 'social', 'paid_ads', 'affiliate', 'direct_mail'],
      required: true
    },
    secondary: [{
      type: String,
      enum: ['email', 'sms', 'push', 'in_app', 'web_banner', 'social', 'paid_ads', 'affiliate', 'direct_mail']
    }],
    channelSettings: {
      email: {
        templateId: String,
        subject: String,
        senderName: String,
        preheader: String,
        personalization: Boolean,
        abTestVariants: [String]
      },
      sms: {
        message: String,
        senderId: String,
        abTestVariants: [String]
      },
      push: {
        title: String,
        message: String,
        iconUrl: String,
        actionUrl: String
      },
      webBanner: {
        position: String,
        design: String,
        ctaText: String,
        ctaUrl: String
      },
      social: {
        platforms: [String],
        posts: [{
          platform: String,
          content: String,
          mediaUrl: String,
          hashtags: [String]
        }]
      },
      paidAds: {
        platforms: [String],
        budgetAllocation: [{
          platform: String,
          budget: Number,
          currency: String
        }],
        targetingCriteria: mongoose.Schema.Types.Mixed
      }
    }
  },
  
  // Discount Codes Associated
  discountCodes: [{
    codeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscountCode',
      required: true
    },
    code: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    allocation: {
      percentage: Number,
      description: String
    }
  }],
  
  // Budget & Resources
  budget: {
    total: {
      amount: Number,
      currency: String
    },
    spent: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    allocation: {
      discounts: {
        amount: Number,
        percentage: Number
      },
      advertising: {
        amount: Number,
        percentage: Number
      },
      creative: {
        amount: Number,
        percentage: Number
      },
      operations: {
        amount: Number,
        percentage: Number
      }
    },
    roi: {
      target: Number,
      actual: Number
    },
    costPerAcquisition: {
      target: Number,
      actual: Number,
      currency: String
    }
  },
  
  // Goals & KPIs
  objectives: {
    primary: {
      metric: {
        type: String,
        enum: ['revenue', 'conversions', 'signups', 'engagement', 'retention', 'churn_reduction'],
        required: true
      },
      target: {
        value: Number,
        unit: String
      },
      actual: {
        value: {
          type: Number,
          default: 0
        },
        unit: String
      }
    },
    secondary: [{
      metric: String,
      target: {
        value: Number,
        unit: String
      },
      actual: {
        value: {
          type: Number,
          default: 0
        },
        unit: String
      }
    }],
    kpis: {
      conversionRate: {
        target: Number,
        actual: {
          type: Number,
          default: 0
        }
      },
      clickThroughRate: {
        target: Number,
        actual: {
          type: Number,
          default: 0
        }
      },
      openRate: {
        target: Number,
        actual: {
          type: Number,
          default: 0
        }
      },
      unsubscribeRate: {
        target: Number,
        actual: {
          type: Number,
          default: 0
        }
      },
      costPerClick: {
        target: {
          amount: Number,
          currency: String
        },
        actual: {
          amount: {
            type: Number,
            default: 0
          },
          currency: String
        }
      }
    }
  },
  
  // Affiliate & Referral Program
  affiliateProgram: {
    enabled: {
      type: Boolean,
      default: false
    },
    affiliates: [{
      affiliateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      affiliateName: String,
      commissionRate: Number,
      commissionType: {
        type: String,
        enum: ['percentage', 'fixed_amount']
      },
      trackingCode: String,
      uniqueLink: String,
      payoutTerms: String
    }],
    trackingSettings: {
      cookieDuration: {
        type: Number,
        default: 30 // days
      },
      attributionModel: {
        type: String,
        enum: ['first_click', 'last_click', 'linear', 'time_decay'],
        default: 'last_click'
      },
      crossDeviceTracking: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Creative Assets
  creativeAssets: {
    emails: [{
      variant: String,
      templateId: String,
      subject: String,
      previewText: String,
      htmlContent: String,
      textContent: String,
      images: [{
        url: String,
        alt: String,
        type: String
      }]
    }],
    banners: [{
      variant: String,
      size: String,
      imageUrl: String,
      ctaText: String,
      ctaUrl: String,
      clickTrackingUrl: String
    }],
    landingPages: [{
      variant: String,
      url: String,
      title: String,
      description: String,
      conversionGoal: String
    }],
    socialMedia: [{
      platform: String,
      variant: String,
      content: String,
      imageUrl: String,
      videoUrl: String,
      hashtags: [String]
    }]
  },
  
  // A/B Testing
  abTesting: {
    enabled: {
      type: Boolean,
      default: false
    },
    variants: [{
      variantId: String,
      name: String,
      description: String,
      trafficPercentage: Number,
      changes: mongoose.Schema.Types.Mixed,
      performance: {
        impressions: Number,
        clicks: Number,
        conversions: Number,
        revenue: Number,
        conversionRate: Number
      }
    }],
    winningVariant: {
      variantId: String,
      confidence: Number,
      liftPercentage: Number
    },
    testDuration: {
      planned: Number, // days
      actual: Number   // days
    }
  },
  
  // Performance Analytics
  analytics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    revenue: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    discountAmount: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    incrementalRevenue: {
      amount: {
        type: Number,
        default: 0
      },
      currency: String
    },
    metrics: {
      ctr: {
        type: Number,
        default: 0
      }, // Click-through rate
      cpm: {
        type: Number,
        default: 0
      }, // Cost per mille
      cpc: {
        type: Number,
        default: 0
      }, // Cost per click
      cpa: {
        type: Number,
        default: 0
      }, // Cost per acquisition
      roas: {
        type: Number,
        default: 0
      }, // Return on ad spend
      roi: {
        type: Number,
        default: 0
      }, // Return on investment
      conversionRate: {
        type: Number,
        default: 0
      },
      bounceRate: {
        type: Number,
        default: 0
      },
      avgSessionDuration: {
        type: Number,
        default: 0
      }
    },
    cohortAnalysis: {
      week1Retention: Number,
      week4Retention: Number,
      week12Retention: Number,
      avgLifetimeValue: Number,
      timeToFirstPurchase: Number,
      timeToSecondPurchase: Number
    }
  },
  
  // Attribution Tracking
  attribution: {
    utmCampaign: String,
    utmSource: String,
    utmMedium: String,
    utmTerm: String,
    utmContent: String,
    trackingPixels: [{
      provider: String,
      pixelId: String,
      events: [String]
    }],
    conversionTracking: {
      googleAnalytics: {
        enabled: Boolean,
        gaId: String,
        goals: [String]
      },
      facebookPixel: {
        enabled: Boolean,
        pixelId: String,
        events: [String]
      },
      customTracking: [{
        provider: String,
        trackingId: String,
        events: [String]
      }]
    }
  },
  
  // Workflow & Approvals
  workflow: {
    currentStage: {
      type: String,
      enum: ['planning', 'creative_review', 'legal_review', 'approval_pending', 'approved', 'launched', 'monitoring', 'analysis'],
      default: 'planning'
    },
    approvals: [{
      approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approverName: String,
      role: String,
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'changes_requested']
      },
      comments: String,
      approvedAt: Date
    }],
    checklist: [{
      item: String,
      completed: {
        type: Boolean,
        default: false
      },
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      completedAt: Date,
      notes: String
    }]
  },
  
  // Compliance & Legal
  compliance: {
    gdprCompliant: {
      type: Boolean,
      default: true
    },
    ccpaCompliant: {
      type: Boolean,
      default: true
    },
    canSpamCompliant: {
      type: Boolean,
      default: true
    },
    legalReview: {
      required: {
        type: Boolean,
        default: false
      },
      completed: {
        type: Boolean,
        default: false
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reviewedAt: Date,
      notes: String
    },
    disclaimers: [String],
    termsAndConditions: String
  },
  
  // Team & Ownership
  team: {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    members: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      name: String,
      role: String,
      permissions: [String]
    }],
    stakeholders: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      name: String,
      department: String,
      role: String
    }]
  },
  
  // Integration & Automation
  integrations: {
    emailPlatform: {
      provider: String,
      campaignId: String,
      status: String,
      lastSync: Date
    },
    crmSystem: {
      provider: String,
      campaignId: String,
      listId: String,
      status: String,
      lastSync: Date
    },
    analyticsTools: [{
      provider: String,
      trackingId: String,
      status: String,
      lastSync: Date
    }],
    webhooks: [{
      url: String,
      events: [String],
      secret: String,
      status: String,
      lastTriggered: Date
    }]
  },
  
  // Notes & Documentation
  documentation: {
    brief: String,
    strategy: String,
    executionPlan: String,
    riskAssessment: String,
    successCriteria: String,
    postMortemNotes: String,
    lessonsLearned: [String],
    bestPractices: [String]
  },
  
  // Related Campaigns
  relationships: {
    parentCampaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotionalCampaign'
    },
    childCampaigns: [{
      campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PromotionalCampaign'
      },
      relationship: String
    }],
    relatedCampaigns: [{
      campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PromotionalCampaign'
      },
      relationship: String
    }]
  },
  
  // Audit Fields
  audit: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: Date,
    changeLog: [{
      action: String,
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      reason: String
    }]
  }
}, {
  timestamps: true,
  collection: 'promotional_campaigns'
});

// Indexes
promotionalCampaignSchema.index({ campaignId: 1 });
promotionalCampaignSchema.index({ status: 1, 'timeline.startDate': 1 });
promotionalCampaignSchema.index({ type: 1, category: 1 });
promotionalCampaignSchema.index({ 'team.owner': 1 });
promotionalCampaignSchema.index({ 'channels.primary': 1 });
promotionalCampaignSchema.index({ 'timeline.startDate': 1, 'timeline.endDate': 1 });
promotionalCampaignSchema.index({ 'analytics.revenue.amount': -1 });
promotionalCampaignSchema.index({ 'analytics.metrics.roi': -1 });
promotionalCampaignSchema.index({ 'workflow.currentStage': 1 });
promotionalCampaignSchema.index({ createdAt: -1 });

// Virtuals
promotionalCampaignSchema.virtual('daysRemaining').get(function() {
  if (!this.timeline.endDate) return null;
  const now = new Date();
  const diffTime = this.timeline.endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

promotionalCampaignSchema.virtual('budgetUtilization').get(function() {
  if (!this.budget.total.amount) return 0;
  return Math.round((this.budget.spent.amount / this.budget.total.amount) * 100);
});

promotionalCampaignSchema.virtual('performanceScore').get(function() {
  const metrics = this.analytics.metrics;
  const weights = {
    roi: 0.3,
    conversionRate: 0.25,
    ctr: 0.2,
    roas: 0.25
  };
  
  const score = (
    (metrics.roi || 0) * weights.roi +
    (metrics.conversionRate || 0) * weights.conversionRate * 100 +
    (metrics.ctr || 0) * weights.ctr * 100 +
    (metrics.roas || 0) * weights.roas
  );
  
  return Math.min(Math.round(score), 100);
});

// Methods
promotionalCampaignSchema.methods.calculateROI = function() {
  const revenue = this.analytics.revenue.amount || 0;
  const spent = this.budget.spent.amount || 0;
  
  if (spent === 0) return 0;
  return Math.round(((revenue - spent) / spent) * 100);
};

promotionalCampaignSchema.methods.updateAnalytics = function(data) {
  // Update analytics with new data
  this.analytics.impressions += data.impressions || 0;
  this.analytics.clicks += data.clicks || 0;
  this.analytics.conversions += data.conversions || 0;
  
  if (data.revenue) {
    this.analytics.revenue.amount += data.revenue;
  }
  
  // Recalculate metrics
  this.analytics.metrics.ctr = this.analytics.impressions > 0 ? 
    (this.analytics.clicks / this.analytics.impressions) * 100 : 0;
  
  this.analytics.metrics.conversionRate = this.analytics.clicks > 0 ? 
    (this.analytics.conversions / this.analytics.clicks) * 100 : 0;
  
  this.analytics.metrics.roi = this.calculateROI();
  
  return this.save();
};

promotionalCampaignSchema.methods.addToChangeLog = function(action, field, oldValue, newValue, changedBy, reason) {
  this.audit.changeLog.push({
    action,
    field,
    oldValue,
    newValue,
    changedBy,
    reason
  });
  
  return this.save();
};

// Statics
promotionalCampaignSchema.statics.generateCampaignId = function(prefix = 'CAMP') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
};

promotionalCampaignSchema.statics.getActiveCampaigns = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    'timeline.startDate': { $lte: now },
    $or: [
      { 'timeline.endDate': { $exists: false } },
      { 'timeline.endDate': { $gte: now } }
    ]
  });
};

// Pre-save middleware
promotionalCampaignSchema.pre('save', function(next) {
  // Generate campaign ID if not present
  if (!this.campaignId) {
    this.campaignId = this.constructor.generateCampaignId();
  }
  
  // Update workflow stage based on status and approvals
  if (this.status === 'active' && this.workflow.currentStage !== 'launched') {
    this.workflow.currentStage = 'launched';
  }
  
  // Calculate actual duration
  if (this.timeline.actualStartDate && this.timeline.actualEndDate) {
    const diffTime = this.timeline.actualEndDate - this.timeline.actualStartDate;
    this.timeline.duration.actual = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  // Auto-update performance score
  this.analytics.performanceScore = this.performanceScore;
  
  next();
});

module.exports = mongoose.model('PromotionalCampaign', promotionalCampaignSchema);





