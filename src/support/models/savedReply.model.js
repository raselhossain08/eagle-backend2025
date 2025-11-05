/**
 * Eagle Saved Replies Model
 * Template library for support and finance responses
 */

const mongoose = require('mongoose');

const savedReplySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  category: {
    type: String,
    enum: ['SUPPORT', 'FINANCE', 'TECHNICAL', 'BILLING', 'COMPLIANCE', 'GENERAL'],
    required: true
  },
  subcategory: {
    type: String,
    maxlength: 50
  },
  subject: {
    type: String,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  variables: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    defaultValue: String,
    isRequired: {
      type: Boolean,
      default: false
    }
  }],
  tags: [{
    type: String,
    maxlength: 30
  }],
  language: {
    type: String,
    default: 'en',
    maxlength: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true // If false, only creator can use
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: Date,
  approvalRequired: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    content: String,
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    changeReason: String
  }],
  metadata: {
    estimatedReadTime: Number, // in seconds
    complexity: {
      type: String,
      enum: ['SIMPLE', 'MEDIUM', 'COMPLEX'],
      default: 'SIMPLE'
    },
    requiredPermissions: [String]
  }
}, {
  timestamps: true,
  collection: 'savedReplies'
});

// Indexes for performance
savedReplySchema.index({ category: 1, isActive: 1 });
savedReplySchema.index({ tags: 1 });
savedReplySchema.index({ createdBy: 1 });
savedReplySchema.index({ usageCount: -1 });
savedReplySchema.index({ title: 'text', content: 'text' });

// Methods
savedReplySchema.methods.use = function(userId) {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

savedReplySchema.methods.updateContent = function(newContent, userId, changeReason) {
  // Save current version to history
  this.previousVersions.push({
    content: this.content,
    modifiedBy: this.lastModifiedBy || this.createdBy,
    changeReason
  });
  
  // Update content
  this.content = newContent;
  this.lastModifiedBy = userId;
  this.version += 1;
  
  return this.save();
};

savedReplySchema.methods.renderContent = function(variables = {}) {
  let content = this.content;
  let subject = this.subject;
  
  // Replace variables in format {{variableName}}
  this.variables.forEach(variable => {
    const placeholder = new RegExp(`{{${variable.name}}}`, 'g');
    const value = variables[variable.name] || variable.defaultValue || `[${variable.name}]`;
    content = content.replace(placeholder, value);
    if (subject) {
      subject = subject.replace(placeholder, value);
    }
  });
  
  return {
    subject,
    content,
    missingVariables: this.variables
      .filter(v => v.isRequired && !variables[v.name] && !v.defaultValue)
      .map(v => v.name)
  };
};

// Statics
savedReplySchema.statics.findByCategory = function(category, userId = null) {
  const query = {
    category,
    isActive: true,
    $or: [
      { isPublic: true },
      { createdBy: userId }
    ]
  };
  
  return this.find(query)
    .populate('createdBy', 'name email')
    .sort({ usageCount: -1, createdAt: -1 });
};

savedReplySchema.statics.searchReplies = function(searchTerm, category = null, userId = null) {
  const query = {
    $text: { $search: searchTerm },
    isActive: true,
    $or: [
      { isPublic: true },
      { createdBy: userId }
    ]
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, usageCount: -1 })
    .populate('createdBy', 'name email');
};

savedReplySchema.statics.getPopular = function(category = null, limit = 10) {
  const query = {
    isActive: true,
    isPublic: true
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query)
    .sort({ usageCount: -1, lastUsedAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name email');
};

module.exports = mongoose.model('SavedReply', savedReplySchema);