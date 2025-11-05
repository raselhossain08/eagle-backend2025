/**
 * Eagle User Notes Model
 * Internal notes and flags for user accounts with PII minimization
 */

const mongoose = require('mongoose');

const userNoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  noteType: {
    type: String,
    enum: ['GENERAL', 'BILLING', 'SUPPORT', 'COMPLIANCE', 'SECURITY', 'TECHNICAL'],
    default: 'GENERAL'
  },
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    default: 'NORMAL'
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  isPrivate: {
    type: Boolean,
    default: false // If true, only author can see
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  flags: [{
    type: {
      type: String,
      enum: ['VIP', 'HIGH_VALUE', 'PROBLEMATIC', 'PAYMENT_ISSUES', 'REQUIRES_FOLLOW_UP', 'ESCALATED', 'RESOLVED'],
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  relatedTickets: [{
    ticketId: String,
    ticketType: String,
    reference: String
  }],
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  visibility: {
    type: String,
    enum: ['SUPPORT', 'FINANCE', 'ADMIN', 'ALL_STAFF'],
    default: 'ALL_STAFF'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'userNotes'
});

// Indexes for performance
userNoteSchema.index({ userId: 1, isDeleted: 1 });
userNoteSchema.index({ authorId: 1, createdAt: -1 });
userNoteSchema.index({ noteType: 1, priority: 1 });
userNoteSchema.index({ tags: 1 });
userNoteSchema.index({ 'flags.type': 1, 'flags.isActive': 1 });

// Methods
userNoteSchema.methods.addFlag = function(flagType, addedBy, expiresAt = null) {
  // Remove existing flag of same type
  this.flags = this.flags.filter(flag => flag.type !== flagType || !flag.isActive);
  
  this.flags.push({
    type: flagType,
    addedBy,
    expiresAt
  });
  
  return this.save();
};

userNoteSchema.methods.removeFlag = function(flagType) {
  this.flags = this.flags.map(flag => {
    if (flag.type === flagType && flag.isActive) {
      flag.isActive = false;
    }
    return flag;
  });
  
  return this.save();
};

userNoteSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Statics
userNoteSchema.statics.getActiveNotes = function(userId, visibility = null) {
  const query = {
    userId,
    isDeleted: false
  };
  
  if (visibility) {
    query.visibility = { $in: [visibility, 'ALL_STAFF'] };
  }
  
  return this.find(query)
    .populate('authorId', 'name email')
    .populate('lastModifiedBy', 'name email')
    .sort({ isPinned: -1, createdAt: -1 });
};

userNoteSchema.statics.getActiveFlags = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), isDeleted: false } },
    { $unwind: '$flags' },
    { $match: { 'flags.isActive': true, $or: [{ 'flags.expiresAt': null }, { 'flags.expiresAt': { $gt: new Date() } }] } },
    { $group: { _id: '$flags.type', count: { $sum: 1 }, latest: { $max: '$flags.addedAt' } } }
  ]);
};

module.exports = mongoose.model('UserNote', userNoteSchema);