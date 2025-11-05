const mongoose = require("mongoose");

const membershipPlanSchema = new mongoose.Schema(
  {
    // Basic Plan Information
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      maxlength: 200,
    },
    
    // Pricing Structure (similar to WooCommerce)
    pricing: {
      basePrice: {
        type: Number,
        required: true,
        min: 0,
      },
      // Billing cycle configurations
      billingCycles: {
        monthly: {
          enabled: { type: Boolean, default: true },
          price: { type: Number, required: true },
          multiplier: { type: Number, default: 1.5 }, // 1.5x for monthly
          stripeProductId: { type: String },
          stripePriceId: { type: String },
        },
        quarterly: {
          enabled: { type: Boolean, default: false },
          price: { type: Number },
          multiplier: { type: Number, default: 1.2 },
          stripeProductId: { type: String },
          stripePriceId: { type: String },
        },
        semiAnnual: {
          enabled: { type: Boolean, default: false },
          price: { type: Number },
          multiplier: { type: Number, default: 1.1 },
          stripeProductId: { type: String },
          stripePriceId: { type: String },
        },
        annual: {
          enabled: { type: Boolean, default: true },
          price: { type: Number, required: true },
          multiplier: { type: Number, default: 1.0 }, // Base price
          stripeProductId: { type: String },
          stripePriceId: { type: String },
        },
      },
      // Setup fees and trial periods
      setupFee: { type: Number, default: 0 },
      trialPeriod: {
        enabled: { type: Boolean, default: false },
        duration: { type: Number, default: 0 }, // in days
        price: { type: Number, default: 0 }, // usually 0 for free trials
      },
    },
    
    // Plan Features and Access Control
    features: [{
      name: { type: String, required: true },
      description: { type: String },
      enabled: { type: Boolean, default: true },
      limitations: {
        type: mongoose.Schema.Types.Mixed, // Flexible for different limit types
      },
    }],
    
    // Access Controls
    accessLevels: {
      dashboard: { type: Boolean, default: true },
      tradingSignals: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
      privateChannel: { type: Boolean, default: false },
      oneOnOneSupport: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      mobileApp: { type: Boolean, default: false },
    },
    
    // Content Restrictions
    contentAccess: {
      basicContent: { type: Boolean, default: true },
      premiumContent: { type: Boolean, default: false },
      exclusiveContent: { type: Boolean, default: false },
      videoLibrary: { type: Boolean, default: false },
      webinars: { type: Boolean, default: false },
      downloads: { type: Boolean, default: false },
    },
    
    // Plan Status and Settings
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
    },
    visibility: {
      type: String,
      enum: ["public", "private", "hidden"],
      default: "public",
    },
    
    // Subscription Rules
    subscriptionRules: {
      autoRenewal: { type: Boolean, default: true },
      gracePeriod: { type: Number, default: 7 }, // days after expiration
      cancellationPolicy: {
        type: String,
        enum: ["immediate", "end_of_period", "no_cancellation"],
        default: "end_of_period",
      },
      refundPolicy: {
        type: String,
        enum: ["no_refund", "prorated", "full_within_period"],
        default: "no_refund",
      },
      upgradePolicy: {
        type: String,
        enum: ["immediate", "next_billing", "prorated"],
        default: "immediate",
      },
      downgradePolicy: {
        type: String,
        enum: ["immediate", "end_of_period"],
        default: "end_of_period",
      },
    },
    
    // Plan Ordering and Display
    sortOrder: {
      type: Number,
      default: 0,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    badge: {
      text: { type: String },
      color: { type: String },
    },
    
    // Plan Limits
    limits: {
      maxUsers: { type: Number }, // For team plans
      maxProjects: { type: Number },
      storageLimit: { type: Number }, // in MB
      apiCallsPerMonth: { type: Number },
      customLimits: [{
        name: { type: String },
        value: { type: Number },
        unit: { type: String },
      }],
    },
    
    // Marketing and Display
    marketingInfo: {
      tagline: { type: String },
      highlights: [{ type: String }],
      buttonText: { type: String, default: "Choose Plan" },
      customCSS: { type: String },
      icon: { type: String },
      color: { type: String },
    },
    
    // Integration Settings
    integrations: {
      discord: {
        enabled: { type: Boolean, default: false },
        roleId: { type: String },
        serverId: { type: String },
      },
      slack: {
        enabled: { type: Boolean, default: false },
        workspaceId: { type: String },
        channelId: { type: String },
      },
      zapier: {
        enabled: { type: Boolean, default: false },
        webhookUrl: { type: String },
      },
    },
    
    // Compatibility with existing system
    legacyMapping: {
      oldPlanId: { type: String },
      woocommerceProductId: { type: String },
      wpMembershipId: { type: String },
    },
  },
  {
    timestamps: true,
    indexes: [
      { slug: 1 },
      { status: 1 },
      { visibility: 1 },
      { sortOrder: 1 },
      { 'pricing.billingCycles.monthly.enabled': 1 },
      { 'pricing.billingCycles.annual.enabled': 1 },
    ],
  }
);

// Virtual for calculating effective prices
membershipPlanSchema.virtual('effectivePricing').get(function() {
  const cycles = {};
  const basePrice = this.pricing.basePrice;
  
  Object.keys(this.pricing.billingCycles).forEach(cycle => {
    const cycleData = this.pricing.billingCycles[cycle];
    if (cycleData.enabled) {
      cycles[cycle] = {
        ...cycleData,
        calculatedPrice: cycleData.price || (basePrice * cycleData.multiplier),
      };
    }
  });
  
  return cycles;
});

// Static method to calculate price for a given cycle
membershipPlanSchema.statics.calculatePrice = function(basePrice, cycle, multiplier) {
  return Math.round((basePrice * multiplier) * 100) / 100; // Round to 2 decimals
};

// Instance method to get price for specific billing cycle
membershipPlanSchema.methods.getPriceForCycle = function(cycle) {
  const cycleData = this.pricing.billingCycles[cycle];
  if (!cycleData || !cycleData.enabled) {
    throw new Error(`Billing cycle ${cycle} is not available for this plan`);
  }
  
  return cycleData.price || (this.pricing.basePrice * cycleData.multiplier);
};

// Pre-save middleware to update calculated prices
membershipPlanSchema.pre('save', function(next) {
  // Auto-generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }
  
  // Calculate prices based on base price and multipliers
  Object.keys(this.pricing.billingCycles).forEach(cycle => {
    const cycleData = this.pricing.billingCycles[cycle];
    if (cycleData.enabled && !cycleData.price) {
      cycleData.price = this.constructor.calculatePrice(
        this.pricing.basePrice, 
        cycle, 
        cycleData.multiplier
      );
    }
  });
  
  next();
});

module.exports = mongoose.model("MembershipPlan", membershipPlanSchema);





