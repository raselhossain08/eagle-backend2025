const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // Core Payment Information
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      index: true,
    },
    
    // Payment Status
    status: {
      type: String,
      enum: [
        "pending",
        "processing", 
        "succeeded", 
        "failed",
        "canceled",
        "refunded",
        "partially_refunded",
        "requires_action",
        "requires_confirmation"
      ],
      default: "pending",
      index: true,
    },
    
    // Amount Information
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    feeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Payment Method
    paymentMethod: {
      type: {
        type: String,
        enum: ["card", "bank_account", "paypal", "apple_pay", "google_pay", "ach", "wire", "manual"],
        required: true,
      },
      details: {
        // Card details (last 4 digits, brand, etc.)
        last4: String,
        brand: String,
        expMonth: Number,
        expYear: Number,
        country: String,
        
        // Bank details
        bankName: String,
        accountType: String,
        routingNumber: String,
        
        // PayPal details
        paypalEmail: String,
        paypalId: String,
        
        // Generic details
        fingerprint: String,
      },
    },
    
    // External Integration IDs
    stripePaymentIntentId: {
      type: String,
      sparse: true,
      index: true,
    },
    stripeChargeId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalPaymentId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalCaptureId: {
      type: String,
      sparse: true,
      index: true,
    },
    
    // Payment Dates
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    
    // Failure Information
    failureCode: String,
    failureMessage: String,
    declineCode: String,
    
    // Billing Information
    billingDetails: {
      name: String,
      email: String,
      phone: String,
      address: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
    },
    
    // Risk Assessment
    riskAssessment: {
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      level: {
        type: String,
        enum: ["low", "medium", "high"],
      },
      factors: [String],
      fraudulent: {
        type: Boolean,
        default: false,
      },
    },
    
    // Refund Information
    refunds: [{
      refundId: String,
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      reason: String,
      status: {
        type: String,
        enum: ["pending", "succeeded", "failed", "canceled"],
      },
      refundedAt: Date,
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      externalRefundId: String,
    }],
    
    // Dispute Information
    disputes: [{
      disputeId: String,
      amount: Number,
      reason: String,
      status: {
        type: String,
        enum: ["warning_needs_response", "warning_under_review", "warning_closed", "needs_response", "under_review", "charge_refunded", "won", "lost"],
      },
      evidence: {
        submittedAt: Date,
        evidenceDetails: Map,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    
    // Retry Information
    retryAttempts: {
      type: Number,
      default: 0,
    },
    maxRetryAttempts: {
      type: Number,
      default: 3,
    },
    nextRetryAt: Date,
    
    // Description and Notes
    description: String,
    internalNotes: String,
    
    // Customer Information
    customerIpAddress: String,
    customerUserAgent: String,
    
    // Custom Fields
    metadata: {
      type: Map,
      of: String,
    },
    
    // Webhooks and Notifications
    webhookEvents: [{
      eventType: String,
      eventId: String,
      processedAt: {
        type: Date,
        default: Date.now,
      },
      data: Map,
    }],
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, status: 1 },
      { subscriptionId: 1 },
      { invoiceId: 1 },
      { status: 1 },
      { attemptedAt: 1 },
      { stripePaymentIntentId: 1 },
      { stripeChargeId: 1 },
      { paypalPaymentId: 1 },
      { paymentId: 1 },
      { 'paymentMethod.type': 1 },
    ],
  }
);

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds
    .filter(refund => refund.status === 'succeeded')
    .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for remaining amount after refunds
paymentSchema.virtual('remainingAmount').get(function() {
  return this.amount - this.totalRefunded;
});

// Virtual for payment age in days
paymentSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.attemptedAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Calculate net amount
  this.netAmount = this.amount - this.feeAmount;
  
  // Update processed date on status change
  if (this.isModified('status')) {
    if (this.status === 'succeeded' && !this.processedAt) {
      this.processedAt = new Date();
    } else if (this.status === 'failed' && !this.failedAt) {
      this.failedAt = new Date();
    }
  }
  
  next();
});

// Static method to generate payment ID
paymentSchema.statics.generatePaymentId = function() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `PAY_${timestamp}_${randomStr}`.toUpperCase();
};

// Instance method to mark as succeeded
paymentSchema.methods.markAsSucceeded = function(externalId, processingFee = 0) {
  this.status = 'succeeded';
  this.processedAt = new Date();
  this.feeAmount = processingFee;
  
  if (externalId) {
    if (this.paymentMethod.type === 'card' || this.paymentMethod.type === 'bank_account') {
      this.stripeChargeId = externalId;
    } else if (this.paymentMethod.type === 'paypal') {
      this.paypalCaptureId = externalId;
    }
  }
  
  return this.save();
};

// Instance method to mark as failed
paymentSchema.methods.markAsFailed = function(failureCode, failureMessage, declineCode) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureCode = failureCode;
  this.failureMessage = failureMessage;
  this.declineCode = declineCode;
  this.retryAttempts += 1;
  
  // Schedule next retry if not exceeded max attempts
  if (this.retryAttempts < this.maxRetryAttempts) {
    const retryDelay = Math.pow(2, this.retryAttempts) * 24 * 60 * 60 * 1000; // Exponential backoff in days
    this.nextRetryAt = new Date(Date.now() + retryDelay);
  }
  
  return this.save();
};

// Instance method to add refund
paymentSchema.methods.addRefund = function(amount, reason, refundedBy, externalRefundId) {
  const refund = {
    refundId: `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`.toUpperCase(),
    amount,
    reason,
    refundedBy,
    externalRefundId,
    status: 'succeeded',
    refundedAt: new Date(),
  };
  
  this.refunds.push(refund);
  
  // Update payment status
  const totalRefunded = this.totalRefunded + amount;
  if (totalRefunded >= this.amount) {
    this.status = 'refunded';
  } else {
    this.status = 'partially_refunded';
  }
  
  return this.save();
};

// Instance method to add dispute
paymentSchema.methods.addDispute = function(disputeData) {
  this.disputes.push({
    disputeId: disputeData.id || `DIS_${Date.now()}`,
    amount: disputeData.amount,
    reason: disputeData.reason,
    status: disputeData.status,
    createdAt: new Date(),
  });
  
  return this.save();
};

// Static method for risk assessment
paymentSchema.statics.assessRisk = function(paymentData, userHistory) {
  let score = 0;
  const factors = [];
  
  // IP-based risk
  if (paymentData.customerIpAddress && paymentData.customerIpAddress.includes('proxy')) {
    score += 20;
    factors.push('proxy_ip');
  }
  
  // Payment method risk
  if (paymentData.paymentMethod.type === 'card' && !paymentData.paymentMethod.details.last4) {
    score += 15;
    factors.push('incomplete_card_data');
  }
  
  // User history risk
  if (userHistory && userHistory.chargebacks > 0) {
    score += 30;
    factors.push('previous_chargebacks');
  }
  
  if (userHistory && userHistory.failedPayments > 5) {
    score += 25;
    factors.push('high_failure_rate');
  }
  
  // Amount-based risk
  if (paymentData.amount > 1000) {
    score += 10;
    factors.push('high_amount');
  }
  
  // Determine risk level
  let level = 'low';
  if (score >= 60) level = 'high';
  else if (score >= 30) level = 'medium';
  
  return {
    score: Math.min(score, 100),
    level,
    factors,
    fraudulent: score >= 80,
  };
};

module.exports = mongoose.model("Payment", paymentSchema);





