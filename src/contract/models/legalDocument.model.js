const mongoose = require('mongoose');

const legalDocumentSchema = new mongoose.Schema({
  // Document Identity
  documentType: {
    type: String,
    enum: ['terms_of_service', 'privacy_policy', 'cookie_policy', 'data_processing_agreement', 'user_agreement', 'refund_policy', 'acceptable_use_policy'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  // Version Management
  version: {
    type: String,
    required: true,
    trim: true
  },
  majorVersion: {
    type: Number,
    required: true,
    default: 1
  },
  minorVersion: {
    type: Number,
    required: true,
    default: 0
  },
  patchVersion: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Content
  content: {
    type: String,
    required: true
  },
  htmlContent: {
    type: String
  },
  markdownContent: {
    type: String
  },
  summary: {
    type: String,
    maxlength: 500
  },
  
  // Localization
  locale: {
    type: String,
    required: true,
    default: 'en'
  },
  localizedVersions: [{
    locale: {
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
    htmlContent: String,
    markdownContent: String,
    summary: String,
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    translator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isApproved: {
      type: Boolean,
      default: false
    }
  }],
  
  // Lifecycle & Status
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'published', 'archived', 'superseded'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Effective Dates
  effectiveDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  
  // Approval Workflow
  approvalWorkflow: {
    requiredApprovals: {
      type: Number,
      default: 1
    },
    approvals: [{
      approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      approvedAt: {
        type: Date,
        default: Date.now
      },
      comments: String,
      decision: {
        type: String,
        enum: ['approved', 'rejected', 'request_changes'],
        required: true
      }
    }],
    isFullyApproved: {
      type: Boolean,
      default: false
    }
  },
  
  // Change Tracking
  changeLog: [{
    version: String,
    changes: [{
      section: String,
      type: {
        type: String,
        enum: ['added', 'modified', 'removed', 'restructured']
      },
      description: String,
      details: String
    }],
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String,
    impact: {
      type: String,
      enum: ['major', 'minor', 'patch', 'editorial'],
      default: 'minor'
    }
  }],
  
  // User Agreement Tracking
  userAgreements: {
    totalAgreements: {
      type: Number,
      default: 0
    },
    agreementsByDate: [{
      date: Date,
      count: Number
    }],
    lastAgreementDate: Date
  },
  
  // Compliance & Legal
  legalReview: {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'requires_changes']
    },
    comments: String,
    complianceChecks: [{
      regulation: {
        type: String,
        enum: ['GDPR', 'CCPA', 'COPPA', 'PIPEDA', 'SOX', 'HIPAA', 'PCI_DSS']
      },
      compliant: Boolean,
      notes: String
    }]
  },
  
  // Display Configuration
  displaySettings: {
    showVersionNumber: {
      type: Boolean,
      default: true
    },
    showLastUpdated: {
      type: Boolean,
      default: true
    },
    showEffectiveDate: {
      type: Boolean,
      default: true
    },
    allowPrint: {
      type: Boolean,
      default: true
    },
    allowDownload: {
      type: Boolean,
      default: true
    },
    requireScrollToBottom: {
      type: Boolean,
      default: false
    }
  },
  
  // Related Documents
  relatedDocuments: [{
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LegalDocument'
    },
    relationship: {
      type: String,
      enum: ['supersedes', 'superseded_by', 'referenced_in', 'references', 'companion']
    }
  }],
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    enum: ['legal', 'policy', 'agreement', 'notice', 'disclosure']
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  
  // Author & Ownership
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  legalTeam: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['author', 'reviewer', 'approver', 'editor']
    }
  }],
  
  // Analytics
  analytics: {
    views: {
      total: {
        type: Number,
        default: 0
      },
      unique: {
        type: Number,
        default: 0
      },
      byLocale: {
        type: Map,
        of: Number,
        default: new Map()
      }
    },
    downloads: {
      total: {
        type: Number,
        default: 0
      },
      byFormat: {
        pdf: { type: Number, default: 0 },
        html: { type: Number, default: 0 },
        txt: { type: Number, default: 0 }
      }
    },
    lastViewed: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound Indexes
legalDocumentSchema.index({ documentType: 1, version: 1 }, { unique: true });
legalDocumentSchema.index({ documentType: 1, isActive: 1, effectiveDate: -1 });
legalDocumentSchema.index({ documentType: 1, locale: 1, isActive: 1 });
legalDocumentSchema.index({ status: 1, effectiveDate: 1 });
legalDocumentSchema.index({ author: 1 });
legalDocumentSchema.index({ 'approvalWorkflow.isFullyApproved': 1 });

// Virtuals
legalDocumentSchema.virtual('fullVersion').get(function() {
  return `${this.majorVersion}.${this.minorVersion}.${this.patchVersion}`;
});

legalDocumentSchema.virtual('isCurrentVersion').get(function() {
  const now = new Date();
  return this.isActive && 
         this.status === 'published' && 
         this.effectiveDate <= now && 
         (!this.expiryDate || this.expiryDate > now);
});

legalDocumentSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const now = new Date();
  const diff = this.expiryDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

legalDocumentSchema.virtual('wordCount').get(function() {
  if (!this.content) return 0;
  return this.content.split(/\s+/).length;
});

// Instance Methods
legalDocumentSchema.methods.getLocalizedContent = function(locale = 'en') {
  if (this.locale === locale) {
    return {
      title: this.title,
      content: this.content,
      htmlContent: this.htmlContent,
      markdownContent: this.markdownContent,
      summary: this.summary
    };
  }
  
  const localized = this.localizedVersions.find(v => v.locale === locale);
  if (localized && localized.isApproved) {
    return {
      title: localized.title,
      content: localized.content,
      htmlContent: localized.htmlContent,
      markdownContent: localized.markdownContent,
      summary: localized.summary
    };
  }
  
  // Fallback to default locale
  return {
    title: this.title,
    content: this.content,
    htmlContent: this.htmlContent,
    markdownContent: this.markdownContent,
    summary: this.summary
  };
};

legalDocumentSchema.methods.addApproval = function(approverId, decision, comments = '') {
  this.approvalWorkflow.approvals.push({
    approver: approverId,
    decision,
    comments
  });
  
  // Check if fully approved
  const approvalCount = this.approvalWorkflow.approvals.filter(a => a.decision === 'approved').length;
  this.approvalWorkflow.isFullyApproved = approvalCount >= this.approvalWorkflow.requiredApprovals;
  
  // Auto-update status
  if (this.approvalWorkflow.isFullyApproved && this.status === 'review') {
    this.status = 'approved';
  }
  
  return this.save();
};

legalDocumentSchema.methods.logChange = function(changes, changedBy, reason, impact = 'minor') {
  this.changeLog.push({
    version: this.version,
    changes,
    changedBy,
    reason,
    impact
  });
  
  this.lastModified = new Date();
};

legalDocumentSchema.methods.incrementView = function(locale = 'en', isUnique = false) {
  this.analytics.views.total += 1;
  if (isUnique) {
    this.analytics.views.unique += 1;
  }
  
  // Track by locale
  const currentCount = this.analytics.views.byLocale.get(locale) || 0;
  this.analytics.views.byLocale.set(locale, currentCount + 1);
  
  this.analytics.lastViewed = new Date();
  return this.save();
};

legalDocumentSchema.methods.incrementDownload = function(format = 'pdf') {
  this.analytics.downloads.total += 1;
  if (this.analytics.downloads.byFormat[format] !== undefined) {
    this.analytics.downloads.byFormat[format] += 1;
  }
  return this.save();
};

legalDocumentSchema.methods.recordUserAgreement = function() {
  this.userAgreements.totalAgreements += 1;
  this.userAgreements.lastAgreementDate = new Date();
  
  // Track daily agreements
  const today = new Date().toDateString();
  const todayRecord = this.userAgreements.agreementsByDate.find(
    record => record.date.toDateString() === today
  );
  
  if (todayRecord) {
    todayRecord.count += 1;
  } else {
    this.userAgreements.agreementsByDate.push({
      date: new Date(),
      count: 1
    });
  }
  
  return this.save();
};

legalDocumentSchema.methods.publish = function() {
  if (this.status !== 'approved') {
    throw new Error('Document must be approved before publishing');
  }
  
  this.status = 'published';
  this.isActive = true;
  return this.save();
};

legalDocumentSchema.methods.archive = function() {
  this.status = 'archived';
  this.isActive = false;
  return this.save();
};

// Static Methods
legalDocumentSchema.statics.getCurrentVersion = async function(documentType, locale = 'en') {
  const document = await this.findOne({
    documentType,
    isActive: true,
    status: 'published',
    effectiveDate: { $lte: new Date() },
    $or: [
      { expiryDate: { $gt: new Date() } },
      { expiryDate: null }
    ]
  })
  .sort({ effectiveDate: -1 })
  .populate('author', 'firstName lastName email');
  
  return document;
};

legalDocumentSchema.statics.getVersionHistory = async function(documentType, limit = 10) {
  return await this.find({
    documentType
  })
  .sort({ effectiveDate: -1 })
  .limit(limit)
  .populate('author', 'firstName lastName email')
  .select('version effectiveDate status changeLog analytics');
};

legalDocumentSchema.statics.getDocumentsRequiringApproval = async function() {
  return await this.find({
    status: 'review',
    'approvalWorkflow.isFullyApproved': false
  })
  .populate('author', 'firstName lastName email')
  .populate('approvalWorkflow.approvals.approver', 'firstName lastName email');
};

legalDocumentSchema.statics.getExpiringDocuments = async function(daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return await this.find({
    isActive: true,
    status: 'published',
    expiryDate: {
      $lte: futureDate,
      $gt: new Date()
    }
  })
  .sort({ expiryDate: 1 })
  .populate('author', 'firstName lastName email');
};

legalDocumentSchema.statics.getAnalytics = async function(documentType = null, timeframe = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);
  
  const match = documentType ? { documentType } : {};
  
  const analytics = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: documentType ? '$documentType' : null,
        totalDocuments: { $sum: 1 },
        totalViews: { $sum: '$analytics.views.total' },
        totalUniqueViews: { $sum: '$analytics.views.unique' },
        totalDownloads: { $sum: '$analytics.downloads.total' },
        totalAgreements: { $sum: '$userAgreements.totalAgreements' },
        activeDocuments: {
          $sum: {
            $cond: [{ $eq: ['$isActive', true] }, 1, 0]
          }
        },
        avgWordCount: { $avg: { $size: { $split: ['$content', ' '] } } }
      }
    }
  ]);
  
  return analytics[0] || {
    totalDocuments: 0,
    totalViews: 0,
    totalUniqueViews: 0,
    totalDownloads: 0,
    totalAgreements: 0,
    activeDocuments: 0,
    avgWordCount: 0
  };
};

legalDocumentSchema.statics.createNewVersion = async function(baseDocumentId, updates, authorId) {
  const baseDocument = await this.findById(baseDocumentId);
  if (!baseDocument) {
    throw new Error('Base document not found');
  }
  
  // Determine new version numbers
  let { majorVersion, minorVersion, patchVersion } = baseDocument;
  
  if (updates.impact === 'major') {
    majorVersion += 1;
    minorVersion = 0;
    patchVersion = 0;
  } else if (updates.impact === 'minor') {
    minorVersion += 1;
    patchVersion = 0;
  } else {
    patchVersion += 1;
  }
  
  const newVersion = `${majorVersion}.${minorVersion}.${patchVersion}`;
  
  // Create new document version
  const newDocument = new this({
    ...baseDocument.toObject(),
    _id: undefined,
    version: newVersion,
    majorVersion,
    minorVersion,
    patchVersion,
    ...updates,
    author: authorId,
    status: 'draft',
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    'approvalWorkflow.approvals': [],
    'approvalWorkflow.isFullyApproved': false
  });
  
  // Mark previous version as superseded when new version is published
  baseDocument.relatedDocuments.push({
    documentId: newDocument._id,
    relationship: 'superseded_by'
  });
  
  await baseDocument.save();
  return await newDocument.save();
};

// Pre-save middleware
legalDocumentSchema.pre('save', function(next) {
  // Update lastModified when content changes
  if (this.isModified('content') || this.isModified('title')) {
    this.lastModified = new Date();
  }
  
  // Auto-update version string
  if (this.isModified('majorVersion') || this.isModified('minorVersion') || this.isModified('patchVersion')) {
    this.version = `${this.majorVersion}.${this.minorVersion}.${this.patchVersion}`;
  }
  
  next();
});

module.exports = mongoose.model('LegalDocument', legalDocumentSchema);





