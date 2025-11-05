const mongoose = require('mongoose');

const userRoleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate role assignments
userRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });
userRoleSchema.index({ userId: 1 });
userRoleSchema.index({ roleId: 1 });
userRoleSchema.index({ isActive: 1 });
userRoleSchema.index({ expiresAt: 1 });

// Virtual to check if role is expired
userRoleSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to check if role is currently valid
userRoleSchema.methods.isValid = function() {
  return this.isActive && !this.isExpired;
};

module.exports = mongoose.model('UserRole', userRoleSchema);