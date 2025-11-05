const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    // Core Invoice Information
    invoiceNumber: {
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
    
    // Invoice Status
    status: {
      type: String,
      enum: [
        "draft",
        "pending", 
        "paid", 
        "partially_paid",
        "overdue", 
        "canceled",
        "refunded",
        "partially_refunded"
      ],
      default: "pending",
      index: true,
    },
    
    // Amounts
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    
    // Dates
    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
    },
    
    // Invoice Items
    items: [{
      description: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 0,
      },
      unitPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      totalPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MembershipPlan",
      },
      billingPeriod: {
        start: Date,
        end: Date,
      },
      prorated: {
        type: Boolean,
        default: false,
      },
      metadata: {
        type: Map,
        of: String,
      },
    }],
    
    // Tax Information
    taxDetails: [{
      taxName: String,
      taxRate: Number,
      taxAmount: Number,
      taxType: {
        type: String,
        enum: ["vat", "sales_tax", "gst", "other"],
      },
    }],
    
    // Discounts Applied
    discounts: [{
      code: String,
      description: String,
      type: {
        type: String,
        enum: ["percentage", "fixed_amount", "credit"],
      },
      value: Number,
      amount: Number,
    }],
    
    // Payment Information
    paymentMethod: {
      type: String,
      enum: ["card", "bank_transfer", "paypal", "stripe", "manual", "credit"],
    },
    stripeInvoiceId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalInvoiceId: {
      type: String,
      sparse: true,
      index: true,
    },
    
    // Payment Attempts
    paymentAttempts: [{
      attemptedAt: {
        type: Date,
        default: Date.now,
      },
      amount: Number,
      status: {
        type: String,
        enum: ["success", "failed", "pending"],
      },
      failureReason: String,
      paymentMethodId: String,
      transactionId: String,
    }],
    
    // Billing Address
    billingAddress: {
      name: String,
      email: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    
    // Notes and Communication
    notes: String,
    internalNotes: String,
    
    // Email Status
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: Date,
    emailAttempts: [{
      sentAt: {
        type: Date,
        default: Date.now,
      },
      recipient: String,
      status: {
        type: String,
        enum: ["sent", "delivered", "failed", "bounced"],
      },
      emailType: {
        type: String,
        enum: ["invoice", "reminder", "overdue", "paid"],
      },
    }],
    
    // PDF Generation
    pdfGenerated: {
      type: Boolean,
      default: false,
    },
    pdfUrl: String,
    pdfGeneratedAt: Date,
    
    // Refund Information
    refunds: [{
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      reason: String,
      refundedAt: {
        type: Date,
        default: Date.now,
      },
      refundedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      externalRefundId: String,
      status: {
        type: String,
        enum: ["pending", "succeeded", "failed", "canceled"],
        default: "pending",
      },
    }],
    
    // Credits Applied
    creditsApplied: [{
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      description: String,
      appliedAt: {
        type: Date,
        default: Date.now,
      },
      appliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    }],
    
    // Dunning Management
    dunningAttempts: {
      type: Number,
      default: 0,
    },
    lastDunningAttempt: Date,
    nextDunningAttempt: Date,
    
    // Custom Fields
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, status: 1 },
      { subscriptionId: 1 },
      { status: 1 },
      { dueDate: 1 },
      { issueDate: 1 },
      { stripeInvoiceId: 1 },
      { paypalInvoiceId: 1 },
      { invoiceNumber: 1 },
    ],
  }
);

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue') return 0;
  return Math.floor((Date.now() - this.dueDate) / (1000 * 60 * 60 * 24));
});

// Virtual for total refunded amount
invoiceSchema.virtual('totalRefunded').get(function() {
  return this.refunds
    .filter(refund => refund.status === 'succeeded')
    .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for remaining balance after refunds
invoiceSchema.virtual('remainingBalance').get(function() {
  return this.total - this.amountPaid - this.totalRefunded;
});

// Pre-save middleware to calculate totals
invoiceSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((total, item) => total + item.totalPrice, 0);
  
  // Calculate total
  this.total = this.subtotal + this.taxAmount - this.discountAmount;
  
  // Calculate amount due
  this.amountDue = this.total - this.amountPaid;
  
  // Update status based on payment
  if (this.amountPaid >= this.total) {
    this.status = 'paid';
    if (!this.paidAt) this.paidAt = new Date();
  } else if (this.amountPaid > 0) {
    this.status = 'partially_paid';
  } else if (this.dueDate < new Date() && this.status === 'pending') {
    this.status = 'overdue';
  }
  
  next();
});

// Static method to generate invoice number
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  
  // Find the latest invoice for this year
  const latestInvoice = await this.findOne({
    invoiceNumber: { $regex: `^${prefix}` }
  }).sort({ invoiceNumber: -1 });
  
  let number = 1;
  if (latestInvoice) {
    const lastNumber = parseInt(latestInvoice.invoiceNumber.replace(prefix, ''));
    number = lastNumber + 1;
  }
  
  return `${prefix}${number.toString().padStart(6, '0')}`;
};

// Instance method to mark as paid
invoiceSchema.methods.markAsPaid = function(amount, paymentMethod, transactionId) {
  this.amountPaid += amount || this.amountDue;
  this.paymentMethod = paymentMethod;
  
  if (this.amountPaid >= this.total) {
    this.status = 'paid';
    this.paidAt = new Date();
  } else {
    this.status = 'partially_paid';
  }
  
  // Add payment attempt record
  this.paymentAttempts.push({
    amount: amount || this.amountDue,
    status: 'success',
    transactionId: transactionId,
  });
  
  return this.save();
};

// Instance method to add refund
invoiceSchema.methods.addRefund = function(amount, reason, refundedBy, externalRefundId) {
  this.refunds.push({
    amount,
    reason,
    refundedBy,
    externalRefundId,
    status: 'succeeded',
  });
  
  // Update status if fully refunded
  const totalRefunded = this.totalRefunded + amount;
  if (totalRefunded >= this.total) {
    this.status = 'refunded';
  } else if (totalRefunded > 0) {
    this.status = 'partially_refunded';
  }
  
  return this.save();
};

module.exports = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);





