const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const adminUserSchema = new mongoose.Schema(
  {
    firstName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 50
    },
    lastName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 50
    },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    password: { 
      type: String, 
      required: true,
      minlength: 8,
      validate: {
        validator: function(password) {
          // Password must contain at least one uppercase, one lowercase, one number, and one special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
        },
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }
    },
    phone: { 
      type: String, 
      required: false,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number']
    },
    
    // Admin-specific fields
    adminLevel: {
      type: String,
      enum: ["super_admin", "finance_admin", "growth_marketing", "support", "read_only"],
      default: "read_only",
      required: true
    },
    department: {
      type: String,
      enum: [
        "technology", 
        "finance", 
        "marketing", 
        "support", 
        "operations", 
        "hr", 
        "legal",
        "executive"
      ],
      required: true
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    
    // Security & Access
    isActive: {
      type: Boolean,
      default: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      default: null
    },
    
    // Access Control
    permissions: [{
      module: {
        type: String,
        required: true
      },
      actions: [{
        type: String,
        enum: ["create", "read", "update", "delete", "approve", "execute"]
      }]
    }],
    
    // Session Management
    lastLoginAt: {
      type: Date
    },
    lastLoginIP: {
      type: String
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    },
    
    // Password Management
    passwordChangedAt: {
      type: Date,
      default: Date.now
    },
    passwordResetToken: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    },
    forcePasswordChange: {
      type: Boolean,
      default: false
    },
    
    // Account Activation
    activationToken: {
      type: String,
      default: null
    },
    activationTokenExpiry: {
      type: Date,
      default: null
    },
    
    // Admin Profile
    profilePicture: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      maxlength: 500
    },
    
    // System Information
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: false
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: false
    },
    
    // Audit Fields
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { 
    timestamps: true,
    // Add indexes for better performance
    indexes: [
      { email: 1 },
      { username: 1 },
      { employeeId: 1 },
      { adminLevel: 1 },
      { department: 1 },
      { isActive: 1 },
      { lastLoginAt: -1 }
    ]
  }
);

// Virtual for full name
adminUserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
adminUserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
adminUserSchema.pre("save", async function (next) {
  // Only hash if password is modified
  if (!this.isModified("password")) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    
    // Update password changed timestamp
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Update username to lowercase before saving
adminUserSchema.pre("save", function(next) {
  if (this.isModified("username")) {
    this.username = this.username.toLowerCase();
  }
  next();
});

// Method to compare passwords
adminUserSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Method to check if password was changed after JWT was issued
adminUserSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to increment login attempts
adminUserSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: {
        loginAttempts: 1
      },
      $unset: {
        lockUntil: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
adminUserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

// Method to generate password reset token
adminUserSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Method to generate activation token
adminUserSchema.methods.createActivationToken = function() {
  const crypto = require('crypto');
  const activationToken = crypto.randomBytes(32).toString('hex');
  
  this.activationToken = crypto
    .createHash('sha256')
    .update(activationToken)
    .digest('hex');
    
  this.activationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return activationToken;
};

// Method to check if user has specific permission
adminUserSchema.methods.hasPermission = function(module, action) {
  // Super admin has all permissions
  if (this.adminLevel === 'super_admin') {
    return true;
  }
  
  const permission = this.permissions.find(p => p.module === module);
  return permission && permission.actions.includes(action);
};

// Method to add permission
adminUserSchema.methods.addPermission = function(module, actions) {
  const existingPermission = this.permissions.find(p => p.module === module);
  
  if (existingPermission) {
    // Add new actions to existing permission
    actions.forEach(action => {
      if (!existingPermission.actions.includes(action)) {
        existingPermission.actions.push(action);
      }
    });
  } else {
    // Create new permission
    this.permissions.push({ module, actions });
  }
};

// Method to remove permission
adminUserSchema.methods.removePermission = function(module, actions) {
  const permissionIndex = this.permissions.findIndex(p => p.module === module);
  
  if (permissionIndex !== -1) {
    if (actions) {
      // Remove specific actions
      this.permissions[permissionIndex].actions = 
        this.permissions[permissionIndex].actions.filter(action => !actions.includes(action));
      
      // Remove permission if no actions left
      if (this.permissions[permissionIndex].actions.length === 0) {
        this.permissions.splice(permissionIndex, 1);
      }
    } else {
      // Remove entire permission module
      this.permissions.splice(permissionIndex, 1);
    }
  }
};

// Static method to find by email or username
adminUserSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() }
    ]
  });
};

// Static method to get admin hierarchy
adminUserSchema.statics.getAdminHierarchy = function() {
  return {
    'super_admin': { 
      level: 1, 
      name: 'Super Administrator',
      description: 'Full access incl. security settings and destructive actions'
    },
    'finance_admin': { 
      level: 2, 
      name: 'Finance Administrator',
      description: 'Billing, invoices, refunds, payouts, taxes, financial reports'
    },
    'growth_marketing': { 
      level: 3, 
      name: 'Growth/Marketing',
      description: 'Discounts, campaigns, announcements, analytics read'
    },
    'support': { 
      level: 4, 
      name: 'Support Agent',
      description: 'Subscriber lookup, plan changes (non-financial), resend receipts, initiate cancellations'
    },
    'read_only': { 
      level: 5, 
      name: 'Read-Only Access',
      description: 'All reports and dashboards, no writes'
    }
  };
};

// Ensure virtual fields are serialized
adminUserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.twoFactorSecret;
    delete ret.passwordResetToken;
    delete ret.activationToken;
    return ret;
  }
});

module.exports = mongoose.model("AdminUser", adminUserSchema);

// Backwards-compatible mappings and convenience statics
// Normalize commonly seen legacy values before validation to avoid enum errors
adminUserSchema.pre('validate', function(next) {
  // Map legacy admin values
  if (this.adminLevel && typeof this.adminLevel === 'string') {
    const v = this.adminLevel.toLowerCase().trim();
    if (v === 'admin') this.adminLevel = 'super_admin';
    // allow a few common synonyms
    if (v === 'superadmin' || v === 'super-admin') this.adminLevel = 'super_admin';
    if (v === 'finance') this.adminLevel = 'finance_admin';
    if (v === 'growth' || v === 'marketing') this.adminLevel = 'growth_marketing';
  }

  // Map legacy department values
  if (this.department && typeof this.department === 'string') {
    const d = this.department.toLowerCase().trim();
    if (d === 'engineering' || d === 'eng' || d === 'engineering & development') {
      this.department = 'technology';
    }
    if (d === 'hr' || d === 'human resources') this.department = 'hr';
    if (d === 'ops') this.department = 'operations';
  }

  next();
});

// Expose enum values for other modules/scripts to use
adminUserSchema.statics.ADMIN_LEVELS = ["super_admin", "finance_admin", "growth_marketing", "support", "read_only"];
adminUserSchema.statics.DEPARTMENTS = ["technology","finance","marketing","support","operations","hr","legal","executive"];