const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
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
      trim: true
    },

    // Authentication & Password
    password: {
      type: String,
      required: function () {
        return !this.isPendingUser && !this.isWordPressUser;
      },
      minlength: 6
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date
    },

    // User Roles & Types - Different from Admin roles
    role: {
      type: String,
      enum: [
        "subscriber",
        "user",
        "customer",
        "author",
        "contributor",
        "editor",
        "administrator",
        "shop_manager",
        "group_leader",
        "student",
        "web_designer",
        "seo_manager",
        "seo_editor"
      ],
      default: "subscriber",
    },
    userType: {
      type: String,
      enum: ["individual", "business", "enterprise", "developer"],
      default: "individual"
    },

    // Subscription Management
    subscription: {
      type: String,
      enum: ["None", "Basic", "Diamond", "Infinity", "Script", "Custom"],
      default: "None",
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "cancelled", "suspended", "pending", "expired", "none", "trial", "past_due", "paused"],
      default: "none"
    },
    subscriptionStartDate: {
      type: Date
    },
    subscriptionEndDate: {
      type: Date
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", "lifetime"],
      default: "monthly"
    },

    // Additional Subscription Fields
    subscriberId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    nextBillingDate: {
      type: Date
    },
    lastBillingDate: {
      type: Date
    },
    subscriptionPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan'
    },
    paymentMethodId: {
      type: String
    },
    stripeCustomerId: {
      type: String,
      sparse: true
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    lifetimeValue: {
      type: Number,
      default: 0
    },

    // Contact & Address Information
    address: {
      country: { type: String, required: false },
      streetAddress: { type: String, required: false },
      flatSuiteUnit: { type: String, required: false },
      townCity: { type: String, required: false },
      stateCounty: { type: String, required: false },
      postcodeZip: { type: String, required: false },
    },

    // Social Integration
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

    // Account Verification & Security
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

    // Account Status
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

    // Session & Login Management
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
    resetToken: {
      type: String,
      default: null
    },
    resetTokenExpiry: {
      type: Date,
      default: null
    },
    passwordChangedAt: {
      type: Date
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
      }
    },

    // User Preferences
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      marketingEmails: {
        type: Boolean,
        default: false
      },
      newsletter: {
        type: Boolean,
        default: true
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "light"
      }
    },

    // Marketing & Analytics
    referralSource: {
      type: String
    },
    referralCode: {
      type: String
    },
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,

    // API Access (for developers)
    apiKey: {
      type: String,
      unique: true,
      sparse: true
    },
    apiUsageCount: {
      type: Number,
      default: 0
    },
    apiRateLimit: {
      type: Number,
      default: 100 // requests per hour for basic users
    },

    // Custom Fields & Tags
    tags: [{
      type: String,
      trim: true
    }],
    notes: {
      type: String,
      maxlength: 1000
    },

    // Additional Subscription Management Fields
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String
    },
    suspendedAt: {
      type: Date
    },
    suspensionReason: {
      type: String
    },
    pausedAt: {
      type: Date
    },
    pausedUntil: {
      type: Date
    },
    pauseReason: {
      type: String
    },
    lastPaymentAmount: {
      type: Number,
      default: 0
    },
    trialEndDate: {
      type: Date
    },
    scheduledPlanChange: {
      newPlanId: mongoose.Schema.Types.ObjectId,
      newPlanName: String,
      newBillingCycle: String,
      effectiveDate: Date,
      scheduledAt: Date
    },
    planChangeHistory: [{
      fromPlan: String,
      toPlan: String,
      fromBillingCycle: String,
      toBillingCycle: String,
      changeDate: Date,
      priceChange: Number
    }],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },

    // WordPress Migration Fields
    wpSubscriptionId: {
      type: String,
      index: true
    },
    wpParentOrderId: {
      type: String
    },
    wpPaymentMethod: {
      type: String
    },
    currency: {
      type: String,
      default: 'USD'
    },

    // System Fields
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
      { subscription: 1, subscriptionStatus: 1 },
      { role: 1 },
      { userType: 1 },
      { isActive: 1 },
      { isBlocked: 1 },
      { createdAt: -1 },
      { lastLoginAt: -1 }
    ]
  }
);

// Virtual fields
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('subscriptionActive').get(function () {
  return this.subscriptionStatus === 'active' &&
    this.subscriptionEndDate &&
    this.subscriptionEndDate > new Date();
});

userSchema.virtual('roleLevel').get(function () {
  const levels = {
    'subscriber': 1, // Newsletter/blog subscribers
    'user': 2,       // Registered users with basic access
    'premium_user': 3, // Paid subscription users
    'vip_user': 4    // Premium/VIP users with full access
  };
  return levels[this.role] || 1;
});

// Pre-save middleware
userSchema.pre("save", async function (next) {
  // Hash password if modified
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordChangedAt = new Date();
  }

  // Auto-upgrade role based on subscription
  if (this.isModified("subscription") || this.isModified("subscriptionStatus")) {
    if (this.subscriptionStatus === 'active') {
      switch (this.subscription) {
        case 'Basic':
          this.role = 'user';
          break;
        case 'Diamond':
        case 'Infinity':
          this.role = 'premium_user';
          break;
        case 'Script':
        case 'Custom':
          this.role = 'vip_user';
          break;
        default:
          this.role = 'subscriber';
      }
    } else if (this.subscriptionStatus !== 'active' && this.role !== 'subscriber') {
      this.role = 'subscriber'; // Downgrade to subscriber if subscription not active
    }
  }

  next();
});

// Instance Methods
userSchema.methods.comparePassword = function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.resetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

userSchema.methods.createActivationToken = function () {
  const crypto = require('crypto');
  const activationToken = crypto.randomBytes(32).toString('hex');

  this.activationToken = crypto
    .createHash('sha256')
    .update(activationToken)
    .digest('hex');

  this.activationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return activationToken;
};

userSchema.methods.updateLoginInfo = function (ipAddress) {
  this.lastLoginAt = new Date();
  this.lastLoginIP = ipAddress;
  this.loginCount += 1;
  return this.save();
};

userSchema.methods.incrementFailedLogin = function () {
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

userSchema.methods.resetFailedLogin = function () {
  return this.updateOne({
    $unset: { failedLoginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.hasAccess = function (feature) {
  const roleAccess = {
    'subscriber': ['newsletter', 'basic_content'],
    'user': ['newsletter', 'basic_content', 'user_dashboard', 'basic_features'],
    'premium_user': ['newsletter', 'basic_content', 'user_dashboard', 'basic_features', 'premium_features', 'api_access'],
    'vip_user': ['newsletter', 'basic_content', 'user_dashboard', 'basic_features', 'premium_features', 'api_access', 'vip_features', 'priority_support']
  };

  return roleAccess[this.role]?.includes(feature) || false;
};

// =====================================================
// Database Indexes for Performance Optimization
// =====================================================

// 1. Subscription Status Index - For filtering subscriptions by status
userSchema.index({ subscriptionStatus: 1 });

// 2. Subscription End Date Index - For finding expiring subscriptions
userSchema.index({ subscriptionEndDate: 1 });

// 3. Next Billing Date Index - For processing upcoming renewals
userSchema.index({ nextBillingDate: 1 });

// 4. Subscription Plan Index - For queries by specific plan
userSchema.index({ subscriptionPlanId: 1 });

// 5. Email Index - Already unique, but ensuring explicit index
userSchema.index({ email: 1 });

// 6. Compound Index: Status + End Date - Most common query pattern
userSchema.index({ subscriptionStatus: 1, subscriptionEndDate: 1 });

// 7. Compound Index: Status + Next Billing - For renewal processing
userSchema.index({ subscriptionStatus: 1, nextBillingDate: 1 });

// 8. Compound Index: Plan + Status - For plan-specific analytics
userSchema.index({ subscriptionPlanId: 1, subscriptionStatus: 1 });

// 9. Compound Index: Status + Created Date - For recent subscriptions
userSchema.index({ subscriptionStatus: 1, createdAt: -1 });

// 10. Sparse Index: Trial End Date - Only for users in trial
userSchema.index({ trialEndDate: 1 }, { sparse: true });

// Static Methods
userSchema.statics.findByEmailOrUsername = function (identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier.toLowerCase() }
    ]
  });
};

userSchema.statics.getSubscriberStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    }
  ]);
};

userSchema.statics.getSubscriptionStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          subscription: '$subscription',
          status: '$subscriptionStatus'
        },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.resetToken;
    delete ret.activationToken;
    return ret;
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema, "users");