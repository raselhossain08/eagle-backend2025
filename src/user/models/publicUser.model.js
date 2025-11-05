const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const publicUserSchema = new mongoose.Schema(
  {
    // Basic Information
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
      unique: true,
      sparse: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    phone: { 
      type: String, 
      required: false,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number']
    },
    
    // Authentication
    password: { 
      type: String, 
      required: function() {
        return !this.isPendingUser && !this.isWordPressUser; 
      }, 
      minlength: 6
    },
    
    // User Status & Roles
    role: {
      type: String,
      enum: ["user", "premium_user", "vip_user", "admin", "superadmin"],
      default: "user",
    },
    userType: {
      type: String,
      enum: ["individual", "business", "enterprise", "developer"],
      default: "individual"
    },
    
    // Subscription Information
    subscription: {
      type: String,
      enum: ["None", "Basic", "Diamond", "Infinity", "Script", "Custom"],
      default: "None",
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "cancelled", "suspended", "pending", "expired"],
      default: "inactive"
    },
    subscriptionStartDate: {
      type: Date
    },
    subscriptionEndDate: {
      type: Date
    },
    subscriptionRenewalDate: {
      type: Date
    },
    
    // Contact Information
    address: {
      country: { type: String, required: false },
      streetAddress: { type: String, required: false },
      flatSuiteUnit: { type: String, required: false },
      townCity: { type: String, required: false },
      stateCounty: { type: String, required: false },
      postcodeZip: { type: String, required: false },
    },
    
    // Social & External Integrations
    discordUsername: { 
      type: String, 
      required: false 
    },
    telegramUsername: {
      type: String,
      required: false
    },
    socialLinks: {
      twitter: String,
      linkedin: String,
      github: String,
      website: String
    },
    
    // WordPress Integration
    wordpressId: { 
      type: Number, 
      unique: true, 
      sparse: true,
      index: true 
    },
    isWordPressUser: { 
      type: Boolean, 
      default: false 
    },
    lastSyncedAt: { 
      type: Date, 
      default: Date.now 
    },
    
    // Account Security & Verification
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    phoneVerifiedAt: {
      type: Date
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      default: null
    },
    
    // Account Status & Management
    isActive: {
      type: Boolean,
      default: true
    },
    isPendingUser: {
      type: Boolean,
      default: false
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockedReason: {
      type: String
    },
    blockedAt: {
      type: Date
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    
    // Login & Session Management
    lastLoginAt: {
      type: Date
    },
    lastLoginIP: {
      type: String
    },
    loginCount: {
      type: Number,
      default: 0
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    },
    
    // Password Management
    passwordChangedAt: {
      type: Date
    },
    resetToken: {
      type: String,
      default: null
    },
    resetTokenExpiry: {
      type: Date,
      default: null
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
    
    // Profile Information
    profilePicture: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      maxlength: 500
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"]
    },
    timezone: {
      type: String,
      default: "UTC"
    },
    language: {
      type: String,
      default: "en"
    },
    
    // Business Information (for business users)
    company: {
      name: String,
      website: String,
      industry: String,
      size: {
        type: String,
        enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]
      },
      taxId: String,
      vatNumber: String
    },
    
    // Preferences & Settings
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      smsNotifications: {
        type: Boolean,
        default: false
      },
      marketingEmails: {
        type: Boolean,
        default: false
      },
      newsletter: {
        type: Boolean,
        default: false
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "light"
      }
    },
    
    // Analytics & Tracking
    referralSource: {
      type: String
    },
    referralCode: {
      type: String
    },
    utmSource: {
      type: String
    },
    utmMedium: {
      type: String
    },
    utmCampaign: {
      type: String
    },
    
    // API & Integration
    apiKey: {
      type: String,
      unique: true,
      sparse: true
    },
    apiKeyCreatedAt: {
      type: Date
    },
    apiUsageCount: {
      type: Number,
      default: 0
    },
    apiRateLimit: {
      type: Number,
      default: 1000 // requests per hour
    },
    
    // Custom Fields & Metadata
    tags: [{
      type: String,
      trim: true
    }],
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    notes: {
      type: String,
      maxlength: 1000
    },
    
    // System Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    source: {
      type: String,
      enum: ["website", "api", "admin", "import", "wordpress", "mobile_app"],
      default: "website"
    }
  },
  { 
    timestamps: true,
    indexes: [
      { email: 1 },
      { username: 1 },
      { wordpressId: 1 },
      { subscription: 1 },
      { subscriptionStatus: 1 },
      { isWordPressUser: 1 },
      { isActive: 1 },
      { isBlocked: 1 },
      { role: 1 },
      { userType: 1 },
      { createdAt: -1 },
      { lastLoginAt: -1 },
      { apiKey: 1 }
    ]
  }
);

// Virtual fields
publicUserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

publicUserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

publicUserSchema.virtual('subscriptionActive').get(function() {
  return this.subscriptionStatus === 'active' && 
         this.subscriptionEndDate && 
         this.subscriptionEndDate > new Date();
});

publicUserSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Pre-save middleware
publicUserSchema.pre("save", async function (next) {
  // Hash password if modified
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordChangedAt = new Date();
  }
  
  // Generate API key for new users
  if (this.isNew && !this.apiKey) {
    const crypto = require('crypto');
    this.apiKey = `ek_${crypto.randomBytes(32).toString('hex')}`;
    this.apiKeyCreatedAt = new Date();
  }
  
  // Update full name if firstName or lastName changed
  if (this.isModified("firstName") || this.isModified("lastName")) {
    this.name = this.fullName;
  }
  
  next();
});

// Instance Methods
publicUserSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

publicUserSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

publicUserSchema.methods.createActivationToken = function() {
  const crypto = require('crypto');
  const activationToken = crypto.randomBytes(32).toString('hex');
  
  this.activationToken = crypto
    .createHash('sha256')
    .update(activationToken)
    .digest('hex');
    
  this.activationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return activationToken;
};

publicUserSchema.methods.incrementLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { failedLoginAttempts: 1 } };
  
  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

publicUserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { failedLoginAttempts: 1, lockUntil: 1 }
  });
};

publicUserSchema.methods.updateLoginInfo = function(ipAddress) {
  this.lastLoginAt = new Date();
  this.lastLoginIP = ipAddress;
  this.loginCount += 1;
  return this.save();
};

publicUserSchema.methods.generateNewApiKey = function() {
  const crypto = require('crypto');
  this.apiKey = `ek_${crypto.randomBytes(32).toString('hex')}`;
  this.apiKeyCreatedAt = new Date();
  this.apiUsageCount = 0;
  return this.apiKey;
};

publicUserSchema.methods.canAccessAPI = function() {
  return this.isActive && 
         !this.isBlocked && 
         this.apiKey && 
         ['premium_user', 'vip_user', 'admin', 'superadmin'].includes(this.role);
};

// Static Methods
publicUserSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() }
    ]
  });
};

publicUserSchema.statics.getSubscriptionStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$subscription',
        count: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'active'] }, 1, 0] } }
      }
    }
  ]);
};

publicUserSchema.statics.getUserTypeStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$userType',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
publicUserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.twoFactorSecret;
    delete ret.resetToken;
    delete ret.activationToken;
    delete ret.apiKey; // Only include API key when specifically requested
    return ret;
  }
});

module.exports = mongoose.model("PublicUser", publicUserSchema);