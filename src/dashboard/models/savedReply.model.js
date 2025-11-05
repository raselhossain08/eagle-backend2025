const mongoose = require("mongoose");

// Enhanced Saved Reply Schema with Enterprise Features
const savedReplySchema = new mongoose.Schema({
  // Core Information
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },
  shortDescription: {
    type: String,
    maxlength: 300,
    trim: true
  },
  
  // Enhanced Classification
  category: {
    type: String,
    required: true,
    enum: [
      "general", "billing", "technical", "account", "subscription", "refund",
      "cancellation", "feature_request", "bug_report", "welcome", "follow_up",
      "escalation", "closing", "onboarding", "training", "compliance", "security",
      "payment_failure", "upgrade", "downgrade", "integration", "api_support",
      "data_export", "gdpr", "legal", "emergency", "vip_customer"
    ],
    index: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  
  // Content Configuration
  contentType: {
    type: String,
    enum: ['text', 'html', 'markdown'],
    default: 'text'
  },
  language: {
    type: String,
    default: 'en',
    index: true
  },
  
  // Template Variables
  variables: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean', 'email', 'url', 'phone'],
      default: 'text'
    },
    defaultValue: String,
    required: {
      type: Boolean,
      default: false
    },
    validation: {
      pattern: String, // Regex pattern for validation
      minLength: Number,
      maxLength: Number,
      min: Number, // For numbers
      max: Number
    },
    options: [String] // For dropdown/select variables
  }],
  
  // Permissions and Access Control
  visibility: {
    type: String,
    enum: ['private', 'team', 'department', 'company', 'public'],
    default: 'team',
    index: true
  },
  accessLevel: {
    type: String,
    enum: ['basic', 'intermediate', 'advanced', 'expert'],
    default: 'basic'
  },
  departments: [{
    type: String,
    enum: ["support", "billing", "technical", "sales", "management", "legal", "compliance"],
    index: true
  }],
  roles: [String], // Specific role requirements
  minimumExperience: {
    type: Number,
    default: 0 // Months of experience required
  },
  
  // Status and Lifecycle
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'active', 'archived', 'deprecated'],
    default: 'draft',
    index: true
  },
  version: {
    type: String,
    default: '1.0'
  },
  versionHistory: [{
    version: String,
    content: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changeDate: {
      type: Date,
      default: Date.now
    },
    changeReason: String,
    changes: [String] // List of what changed
  }],
  
  // Quality and Effectiveness
  qualityScore: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  effectiveness: {
    useCount: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    customerSatisfaction: {
      averageRating: Number,
      totalRatings: {
        type: Number,
        default: 0
      },
      ratings: [{
        rating: {
          type: Number,
          min: 1,
          max: 5
        },
        feedback: String,
        ratedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        ratedAt: {
          type: Date,
          default: Date.now
        }
      }]
    }
  },
  
  // Usage Tracking
  usage: {
    totalCount: {
      type: Number,
      default: 0,
      index: true
    },
    lastUsedAt: {
      type: Date,
      index: true
    },
    lastUsedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    monthlyUsage: [{
      month: String, // YYYY-MM
      count: Number
    }],
    usageByAgent: [{
      agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      count: Number,
      lastUsed: Date
    }],
    peakUsageTimes: [{
      hour: Number, // 0-23
      count: Number
    }]
  },
  
  // Content Enhancement
  keywords: [String], // For better searchability
  tags: [{
    name: String,
    category: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Related Content
  relatedReplies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SavedReply'
  }],
  knowledgeBaseArticles: [String], // KB article IDs
  parentReply: { // For reply variations
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SavedReply'
  },
  childReplies: [{ // Variations of this reply
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SavedReply'
  }],
  
  // Automation and AI
  aiGenerated: {
    type: Boolean,
    default: false
  },
  aiPrompt: String, // Prompt used to generate content
  autoSuggestions: [{
    scenario: String,
    confidence: Number,
    lastSuggested: Date
  }],
  triggerPhrases: [String], // Phrases that should suggest this reply
  
  // Localization
  translations: [{
    language: String,
    title: String,
    content: String,
    shortDescription: String,
    translatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    translatedAt: {
      type: Date,
      default: Date.now
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  }],
  
  // Approval Workflow
  approval: {
    required: {
      type: Boolean,
      default: false
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    approvalNotes: String,
    reviewers: [{
      reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'changes_requested']
      },
      comments: String,
      reviewedAt: Date
    }]
  },
  
  // Compliance and Legal
  compliance: {
    requiresLegalReview: {
      type: Boolean,
      default: false
    },
    legallyApproved: {
      type: Boolean,
      default: false
    },
    complianceNotes: String,
    gdprCompliant: {
      type: Boolean,
      default: true
    },
    dataRetentionImpact: {
      type: String,
      enum: ['none', 'low', 'medium', 'high']
    }
  },
  
  // Metadata and Customization
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Admin Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  // Scheduling and Expiration
  scheduledFor: Date, // When to make active
  expiresAt: Date, // When to deactivate
  seasonalUse: {
    isSeasonalReply: {
      type: Boolean,
      default: false
    },
    activeMonths: [Number], // 1-12 for months when this reply is relevant
    activeSeasons: [String] // spring, summer, fall, winter
  }
}, {
  timestamps: true,
  indexes: [
    { category: 1, isActive: 1 },
    { status: 1, isActive: 1 },
    { visibility: 1, departments: 1 },
    { language: 1 },
    { tags: 1 },
    { keywords: 1 },
    { createdBy: 1 },
    { 'usage.totalCount': -1 },
    { 'usage.lastUsedAt': -1 },
    { 'effectiveness.successRate': -1 },
    { qualityScore: -1 },
    { title: 'text', content: 'text', keywords: 'text' }, // Full-text search
    { triggerPhrases: 1 }
  ]
});

// Virtuals
savedReplySchema.virtual('formattedContent').get(function() {
  return this.content;
});

savedReplySchema.virtual('averageRating').get(function() {
  if (this.effectiveness.customerSatisfaction.totalRatings === 0) return 0;
  return this.effectiveness.customerSatisfaction.averageRating || 0;
});

savedReplySchema.virtual('isPopular').get(function() {
  return this.usage.totalCount > 50 && this.effectiveness.successRate > 80;
});

savedReplySchema.virtual('needsReview').get(function() {
  const lastUsed = this.usage.lastUsedAt;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return this.effectiveness.successRate < 60 || 
         (lastUsed && lastUsed < sixMonthsAgo) ||
         this.qualityScore < 5;
});

// Instance Methods
savedReplySchema.methods.incrementUsage = async function(usedBy) {
  this.usage.totalCount += 1;
  this.usage.lastUsedAt = new Date();
  this.usage.lastUsedBy = usedBy;
  
  // Update monthly usage
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthlyUsage = this.usage.monthlyUsage.find(m => m.month === currentMonth);
  if (monthlyUsage) {
    monthlyUsage.count += 1;
  } else {
    this.usage.monthlyUsage.push({ month: currentMonth, count: 1 });
  }
  
  // Update usage by agent
  const agentUsage = this.usage.usageByAgent.find(a => a.agent.toString() === usedBy.toString());
  if (agentUsage) {
    agentUsage.count += 1;
    agentUsage.lastUsed = new Date();
  } else {
    this.usage.usageByAgent.push({ agent: usedBy, count: 1, lastUsed: new Date() });
  }
  
  // Update peak usage times
  const currentHour = new Date().getHours();
  const peakUsage = this.usage.peakUsageTimes.find(p => p.hour === currentHour);
  if (peakUsage) {
    peakUsage.count += 1;
  } else {
    this.usage.peakUsageTimes.push({ hour: currentHour, count: 1 });
  }
  
  return this.save();
};

savedReplySchema.methods.replaceVariables = function(variableValues = {}) {
  let content = this.content;
  
  this.variables.forEach(variable => {
    const value = variableValues[variable.name] || variable.defaultValue || `{${variable.name}}`;
    const regex = new RegExp(`{${variable.name}}`, 'g');
    content = content.replace(regex, value);
  });
  
  return content;
};

savedReplySchema.methods.validateVariables = function(variableValues = {}) {
  const errors = [];
  
  this.variables.forEach(variable => {
    const value = variableValues[variable.name];
    
    // Check required variables
    if (variable.required && (!value || value.trim() === '')) {
      errors.push(`Variable '${variable.name}' is required`);
      return;
    }
    
    if (value) {
      // Type validation
      if (variable.type === 'number' && isNaN(Number(value))) {
        errors.push(`Variable '${variable.name}' must be a number`);
      }
      
      if (variable.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`Variable '${variable.name}' must be a valid email`);
      }
      
      if (variable.type === 'url' && !/^https?:\/\/.+/.test(value)) {
        errors.push(`Variable '${variable.name}' must be a valid URL`);
      }
      
      // Length validation
      if (variable.validation) {
        if (variable.validation.minLength && value.length < variable.validation.minLength) {
          errors.push(`Variable '${variable.name}' must be at least ${variable.validation.minLength} characters`);
        }
        
        if (variable.validation.maxLength && value.length > variable.validation.maxLength) {
          errors.push(`Variable '${variable.name}' must be no more than ${variable.validation.maxLength} characters`);
        }
        
        // Pattern validation
        if (variable.validation.pattern) {
          const regex = new RegExp(variable.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`Variable '${variable.name}' format is invalid`);
          }
        }
        
        // Range validation for numbers
        if (variable.type === 'number') {
          const numValue = Number(value);
          if (variable.validation.min !== undefined && numValue < variable.validation.min) {
            errors.push(`Variable '${variable.name}' must be at least ${variable.validation.min}`);
          }
          if (variable.validation.max !== undefined && numValue > variable.validation.max) {
            errors.push(`Variable '${variable.name}' must be no more than ${variable.validation.max}`);
          }
        }
      }
      
      // Options validation
      if (variable.options && variable.options.length > 0 && !variable.options.includes(value)) {
        errors.push(`Variable '${variable.name}' must be one of: ${variable.options.join(', ')}`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

savedReplySchema.methods.addRating = async function(rating, feedback, ratedBy) {
  this.effectiveness.customerSatisfaction.ratings.push({
    rating,
    feedback,
    ratedBy,
    ratedAt: new Date()
  });
  
  // Recalculate average
  const totalRatings = this.effectiveness.customerSatisfaction.ratings.length;
  const sum = this.effectiveness.customerSatisfaction.ratings.reduce((acc, r) => acc + r.rating, 0);
  
  this.effectiveness.customerSatisfaction.totalRatings = totalRatings;
  this.effectiveness.customerSatisfaction.averageRating = sum / totalRatings;
  
  return this.save();
};

savedReplySchema.methods.createVersion = async function(changes, changedBy, changeReason) {
  // Save current version to history
  this.versionHistory.push({
    version: this.version,
    content: this.content,
    changedBy,
    changeDate: new Date(),
    changeReason,
    changes
  });
  
  // Increment version
  const versionParts = this.version.split('.');
  const majorVersion = parseInt(versionParts[0]);
  const minorVersion = parseInt(versionParts[1]) + 1;
  this.version = `${majorVersion}.${minorVersion}`;
  
  this.lastModifiedBy = changedBy;
  
  return this.save();
};

savedReplySchema.methods.addTranslation = async function(language, translation, translatedBy) {
  // Remove existing translation for this language
  this.translations = this.translations.filter(t => t.language !== language);
  
  // Add new translation
  this.translations.push({
    language,
    title: translation.title,
    content: translation.content,
    shortDescription: translation.shortDescription,
    translatedBy,
    translatedAt: new Date(),
    isVerified: false
  });
  
  return this.save();
};

// Static Methods
savedReplySchema.statics.getPopularReplies = function(limit = 10, department = null) {
  const filter = { isActive: true, status: 'active' };
  
  if (department) {
    filter.departments = department;
  }
  
  return this.find(filter)
    .sort({ 'usage.totalCount': -1, 'effectiveness.successRate': -1 })
    .limit(limit)
    .populate('createdBy', 'firstName lastName email')
    .lean();
};

savedReplySchema.statics.searchReplies = function(query, filters = {}) {
  const searchFilter = {
    isActive: true,
    status: 'active',
    $text: { $search: query }
  };
  
  // Apply additional filters
  if (filters.category && filters.category !== 'all') {
    searchFilter.category = filters.category;
  }
  
  if (filters.department) {
    searchFilter.departments = filters.department;
  }
  
  if (filters.language) {
    searchFilter.language = filters.language;
  }
  
  if (filters.visibility) {
    searchFilter.visibility = { $in: filters.visibility };
  }
  
  if (filters.tags && filters.tags.length > 0) {
    searchFilter['tags.name'] = { $in: filters.tags };
  }
  
  return this.find(searchFilter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, 'usage.totalCount': -1 })
    .limit(filters.limit || 20)
    .populate('createdBy', 'firstName lastName email')
    .lean();
};

savedReplySchema.statics.findSuggestions = function(triggerPhrase, context = {}) {
  const filter = {
    isActive: true,
    status: 'active',
    triggerPhrases: { $elemMatch: { $regex: new RegExp(triggerPhrase, 'i') } }
  };
  
  if (context.department) {
    filter.departments = context.department;
  }
  
  if (context.language) {
    filter.language = context.language;
  }
  
  return this.find(filter)
    .sort({ 'effectiveness.successRate': -1, 'usage.totalCount': -1 })
    .limit(5)
    .select('title shortDescription category effectiveness usage')
    .lean();
};

savedReplySchema.statics.getAnalytics = async function(startDate, endDate, filters = {}) {
  const matchFilter = {
    createdAt: { $gte: startDate, $lte: endDate }
  };
  
  if (filters.department) {
    matchFilter.departments = filters.department;
  }
  
  if (filters.category) {
    matchFilter.category = filters.category;
  }
  
  const analytics = await this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalReplies: { $sum: 1 },
        activeReplies: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
        avgUsageCount: { $avg: '$usage.totalCount' },
        avgSuccessRate: { $avg: '$effectiveness.successRate' },
        avgQualityScore: { $avg: '$qualityScore' },
        totalUsage: { $sum: '$usage.totalCount' },
        categoryCounts: { $push: '$category' }
      }
    }
  ]);
  
  // Get category breakdown
  const categoryAnalytics = await this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgUsage: { $avg: '$usage.totalCount' },
        avgSuccessRate: { $avg: '$effectiveness.successRate' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get top performers
  const topPerformers = await this.find(matchFilter)
    .sort({ 'effectiveness.successRate': -1, 'usage.totalCount': -1 })
    .limit(10)
    .select('title category effectiveness.successRate usage.totalCount')
    .lean();
  
  return {
    overview: analytics[0] || {},
    categoryBreakdown: categoryAnalytics,
    topPerformers
  };
};

module.exports = mongoose.model("SavedReply", savedReplySchema);





