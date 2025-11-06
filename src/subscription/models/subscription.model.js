const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    // Core Subscription Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      required: true,
    },

    // Subscription Status
    status: {
      type: String,
      enum: [
        "trial",
        "active",
        "past_due",
        "canceled",
        "paused",
        "suspended",
        "incomplete",
        "incomplete_expired"
      ],
      default: "trial",
      index: true,
    },

    // Billing Information
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "semiannual", "annual"],
      required: true,
    },
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },

    // Subscription Dates
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    trialStartDate: {
      type: Date,
    },
    trialEndDate: {
      type: Date,
    },
    nextBillingDate: {
      type: Date,
    },
    lastBillingDate: {
      type: Date,
    },
    canceledAt: {
      type: Date,
    },
    pausedAt: {
      type: Date,
    },
    resumedAt: {
      type: Date,
    },

    // Payment and External Integration
    stripeSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalSubscriptionId: {
      type: String,
      sparse: true,
      index: true,
    },

    // WordPress/WooCommerce Integration
    wordpressSubscriptionId: {
      type: Number,
      sparse: true,
      index: true,
    },
    wooCommerceOrderId: {
      type: Number,
      sparse: true,
      index: true,
    },
    isMigratedFromWordPress: {
      type: Boolean,
      default: false,
      index: true,
    },
    originalWordPressStatus: {
      type: String,
    },
    wordPressLastSync: {
      type: Date,
    },

    // Subscription Configuration
    autoRenew: {
      type: Boolean,
      default: true,
    },

    // Change Management
    scheduledChanges: [{
      changeType: {
        type: String,
        enum: ["plan_change", "cancellation", "pause", "resume"],
        required: true,
      },
      newPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MembershipPlan",
      },
      scheduledDate: {
        type: Date,
        required: true,
      },
      effectiveDate: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["scheduled", "processed", "cancelled"],
        default: "scheduled",
      },
      reason: String,
      processedAt: Date,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    }],

    // Proration and Credits
    proratedCredits: {
      type: Number,
      default: 0,
    },

    // Cancellation Information
    cancellationReason: {
      type: String,
      enum: [
        "voluntary",
        "payment_failed",
        "chargeback",
        "fraud",
        "admin_action",
        "downgrade",
        "upgrade",
        "other"
      ],
    },
    cancellationNote: String,

    // Pause Information
    pauseReason: String,
    pausedUntil: Date,

    // Metrics
    totalPaid: {
      type: Number,
      default: 0,
    },
    billingAttempts: {
      type: Number,
      default: 0,
    },

    // Custom Fields
    metadata: {
      type: Map,
      of: String,
    },

    // Seat Management (for team plans)
    seats: {
      allocated: {
        type: Number,
        default: 1,
        min: 1,
      },
      used: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Churn Risk Analysis
    churnRisk: {
      score: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      level: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low",
      },
      factors: [String],
      lastCalculated: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, status: 1 },
      { planId: 1 },
      { status: 1 },
      { nextBillingDate: 1 },
      { stripeSubscriptionId: 1 },
      { paypalSubscriptionId: 1 },
      { 'churnRisk.level': 1 },
      { createdAt: 1 },
      { endDate: 1 },
    ],
  }
);

// Virtual for subscription age in days
subscriptionSchema.virtual('ageInDays').get(function () {
  return Math.floor((Date.now() - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for days until next billing
subscriptionSchema.virtual('daysUntilNextBilling').get(function () {
  if (!this.nextBillingDate) return null;
  return Math.floor((this.nextBillingDate - Date.now()) / (1000 * 60 * 60 * 24));
});

// Virtual for MRR calculation
subscriptionSchema.virtual('mrr').get(function () {
  if (this.status === 'canceled' || this.status === 'paused') return 0;

  switch (this.billingCycle) {
    case 'monthly':
      return this.currentPrice;
    case 'quarterly':
      return this.currentPrice / 3;
    case 'semiannual':
      return this.currentPrice / 6;
    case 'annual':
      return this.currentPrice / 12;
    default:
      return 0;
  }
});

// Instance method to check if subscription is active
subscriptionSchema.methods.isActive = function () {
  return ['trial', 'active'].includes(this.status);
};

// Instance method to check if subscription is in trial
subscriptionSchema.methods.isInTrial = function () {
  return this.status === 'trial' &&
    this.trialEndDate &&
    new Date() < this.trialEndDate;
};

// Instance method to calculate remaining trial days
subscriptionSchema.methods.trialDaysRemaining = function () {
  if (!this.isInTrial()) return 0;
  return Math.floor((this.trialEndDate - Date.now()) / (1000 * 60 * 60 * 24));
};

// Static method to calculate churn risk
subscriptionSchema.statics.calculateChurnRisk = function (subscription, userActivity) {
  let score = 0;
  const factors = [];

  // Payment history factor
  if (subscription.billingAttempts > 2) {
    score += 30;
    factors.push('payment_issues');
  }

  // Usage factor (requires userActivity data)
  if (userActivity && userActivity.lastLoginDays > 30) {
    score += 25;
    factors.push('low_usage');
  }

  // Support tickets factor
  if (userActivity && userActivity.supportTickets > 3) {
    score += 20;
    factors.push('support_issues');
  }

  // Subscription age factor
  const ageInDays = Math.floor((Date.now() - subscription.startDate) / (1000 * 60 * 60 * 24));
  if (ageInDays < 30) {
    score += 15;
    factors.push('new_subscriber');
  }

  // Determine risk level
  let level = 'low';
  if (score >= 60) level = 'high';
  else if (score >= 30) level = 'medium';

  return { score, level, factors };
};

module.exports = mongoose.model("Subscription", subscriptionSchema);





