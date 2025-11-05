const mongoose = require('mongoose');

/**
 * Tax Rate Schema for Multi-Currency Tax Management
 * Supports provider-agnostic tax calculation (Stripe Tax, TaxJar, Avalara)
 */
const taxRateSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 500
  },

  // Geographic Scope
  country: {
    type: String,
    required: true,
    uppercase: true,
    length: 2 // ISO 3166-1 alpha-2
  },
  state: {
    type: String,
    uppercase: true,
    maxlength: 10 // State/province code
  },
  city: {
    type: String,
    maxlength: 100
  },
  postalCode: {
    type: String,
    maxlength: 20
  },

  // Tax Configuration
  taxType: {
    type: String,
    required: true,
    enum: ['VAT', 'GST', 'SALES_TAX', 'WITHHOLDING', 'EXCISE', 'OTHER']
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100 // Percentage
  },
  compoundTax: {
    type: Boolean,
    default: false // Whether this tax compounds with others
  },

  // Applicability Rules
  applicableToProducts: [{
    type: String,
    enum: ['DIGITAL_SERVICES', 'PHYSICAL_GOODS', 'SUBSCRIPTIONS', 'LICENSES', 'ALL']
  }],
  customerTypes: [{
    type: String,
    enum: ['INDIVIDUAL', 'BUSINESS', 'NONPROFIT', 'GOVERNMENT', 'ALL']
  }],

  // Thresholds and Exemptions
  thresholds: {
    minimumAmount: {
      type: Number,
      default: 0
    },
    maximumAmount: {
      type: Number
    },
    annualRevenueThreshold: {
      type: Number // Economic nexus threshold
    }
  },

  exemptions: {
    vatExempt: {
      type: Boolean,
      default: false
    },
    reverseCharge: {
      type: Boolean,
      default: false // EU reverse charge mechanism
    },
    exemptEntityTypes: [{
      type: String,
      enum: ['CHARITY', 'EDUCATIONAL', 'GOVERNMENT', 'DIPLOMATIC']
    }]
  },

  // Provider Integration
  providerMappings: {
    stripe: {
      taxRateId: String,
      taxCodeId: String
    },
    taxjar: {
      categoryId: String,
      jurisdictionCode: String
    },
    avalara: {
      taxCodeId: String,
      nexusId: String
    }
  },

  // Validity and Status
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  active: {
    type: Boolean,
    default: true
  },

  // Audit Information
  registrationNumbers: {
    vatNumber: String,
    taxNumber: String,
    gstNumber: String
  },

  // Metadata
  metadata: {
    regulatoryReference: String,
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    source: {
      type: String,
      enum: ['MANUAL', 'PROVIDER_SYNC', 'REGULATORY_UPDATE'],
      default: 'MANUAL'
    },
    tags: [String]
  }
}, {
  timestamps: true,
  collection: 'taxrates'
});

// Indexes for performance
taxRateSchema.index({ country: 1, state: 1, taxType: 1 });
taxRateSchema.index({ active: 1, effectiveFrom: 1, effectiveTo: 1 });
taxRateSchema.index({ 'providerMappings.stripe.taxRateId': 1 });
taxRateSchema.index({ 'providerMappings.taxjar.categoryId': 1 });
taxRateSchema.index({ 'providerMappings.avalara.taxCodeId': 1 });

// Methods
taxRateSchema.methods.isApplicable = function (location, customerType, productType, amount) {
  // Check if tax rate applies to given parameters
  if (!this.active) return false;

  const now = new Date();
  if (this.effectiveFrom > now || (this.effectiveTo && this.effectiveTo < now)) {
    return false;
  }

  // Geographic check
  if (this.country !== location.country) return false;
  if (this.state && this.state !== location.state) return false;

  // Customer type check
  if (this.customerTypes.length > 0 && !this.customerTypes.includes('ALL')) {
    if (!this.customerTypes.includes(customerType)) return false;
  }

  // Product type check
  if (this.applicableToProducts.length > 0 && !this.applicableToProducts.includes('ALL')) {
    if (!this.applicableToProducts.includes(productType)) return false;
  }

  // Amount thresholds
  if (amount < this.thresholds.minimumAmount) return false;
  if (this.thresholds.maximumAmount && amount > this.thresholds.maximumAmount) return false;

  return true;
};

taxRateSchema.methods.calculateTax = function (amount, compoundedAmount = 0) {
  const baseAmount = this.compoundTax ? amount + compoundedAmount : amount;
  return (baseAmount * this.rate) / 100;
};

/**
 * Enhanced Invoice Schema with Multi-Currency and Tax Support
 */
const invoiceSchema = new mongoose.Schema({
  // Invoice Identification
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  invoiceSequence: {
    type: Number,
    required: true
  },

  // Customer Information
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnhancedUser',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    index: true
  },

  // Billing Information
  billingAddress: {
    name: String,
    company: String,
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    state: String,
    postalCode: { type: String, required: true },
    country: { type: String, required: true, uppercase: true },
    vatNumber: String,
    taxNumber: String
  },

  // Financial Details
  currency: {
    type: String,
    required: true,
    uppercase: true,
    length: 3 // ISO 4217
  },
  exchangeRate: {
    type: Number,
    default: 1.0
  },
  baseCurrency: {
    type: String,
    default: 'USD',
    uppercase: true
  },

  // Line Items
  lineItems: [{
    id: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    productType: {
      type: String,
      enum: ['DIGITAL_SERVICES', 'PHYSICAL_GOODS', 'SUBSCRIPTIONS', 'LICENSES'],
      default: 'SUBSCRIPTIONS'
    },
    periodStart: Date,
    periodEnd: Date,
    metadata: {
      planId: String,
      addonId: String,
      prorationReason: String
    }
  }],

  // Tax Calculations
  taxCalculation: {
    provider: {
      type: String,
      enum: ['STRIPE_TAX', 'TAXJAR', 'AVALARA', 'MANUAL'],
      default: 'MANUAL'
    },
    calculatedAt: Date,
    taxLines: [{
      taxRateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaxRate'
      },
      jurisdiction: String,
      taxType: String,
      rate: Number,
      taxableAmount: Number,
      taxAmount: Number,
      exemptAmount: Number
    }],
    exemptions: [{
      reason: String,
      amount: Number,
      certificateNumber: String
    }],
    reverseCharge: {
      applicable: Boolean,
      reason: String,
      customerVatNumber: String
    }
  },

  // Amount Summary
  amounts: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    taxTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    amountDue: {
      type: Number,
      required: true,
      min: 0
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    amountRemaining: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Invoice Status and Lifecycle
  status: {
    type: String,
    required: true,
    enum: ['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE'],
    default: 'DRAFT',
    index: true
  },

  // Important Dates
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidAt: Date,
  voidedAt: Date,

  // Payment Information
  paymentIntentId: String,
  paymentMethodId: String,

  // Document Generation
  pdfGeneration: {
    generated: {
      type: Boolean,
      default: false
    },
    generatedAt: Date,
    fileUrl: String,
    fileSize: Number,
    templateId: String,
    version: {
      type: Number,
      default: 1
    }
  },

  // Email Delivery
  emailDelivery: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    sentTo: [String],
    deliveryAttempts: [{
      attemptedAt: Date,
      successful: Boolean,
      errorMessage: String,
      emailProvider: String
    }],
    resendCount: {
      type: Number,
      default: 0
    }
  },

  // Compliance and Audit
  compliance: {
    digitalSignature: String,
    fiscalYear: String,
    auditTrail: [{
      action: String,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser'
      },
      performedAt: Date,
      details: mongoose.Schema.Types.Mixed
    }]
  },

  // Notes and References
  notes: String,
  internalNotes: String,
  customFields: mongoose.Schema.Types.Mixed,

  // Integration Data
  externalReferences: {
    stripeInvoiceId: String,
    quickbooksId: String,
    xeroId: String,
    sapId: String
  }
}, {
  timestamps: true,
  collection: 'invoices'
});

// Indexes for performance and queries
invoiceSchema.index({ customerId: 1, invoiceDate: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ invoiceDate: 1, currency: 1 });
invoiceSchema.index({ 'amounts.total': 1, status: 1 });
invoiceSchema.index({ subscriptionId: 1, invoiceDate: -1 });

// Pre-save middleware to calculate amounts
invoiceSchema.pre('save', function (next) {
  if (this.isModified('lineItems') || this.isModified('taxCalculation')) {
    this.calculateAmounts();
  }
  next();
});

// Methods
invoiceSchema.methods.calculateAmounts = function () {
  // Calculate subtotal
  this.amounts.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);

  // Calculate discount total
  this.amounts.discountTotal = this.lineItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);

  // Calculate tax total
  this.amounts.taxTotal = this.taxCalculation.taxLines.reduce((sum, tax) => sum + tax.taxAmount, 0);

  // Calculate total
  this.amounts.total = this.amounts.subtotal - this.amounts.discountTotal + this.amounts.taxTotal;

  // Calculate amount due
  this.amounts.amountDue = this.amounts.total - this.amounts.amountPaid;

  // Calculate amount remaining
  this.amounts.amountRemaining = Math.max(0, this.amounts.amountDue);
};

invoiceSchema.methods.markAsPaid = function (paymentAmount, paymentDate = new Date()) {
  this.amounts.amountPaid += paymentAmount;
  this.amounts.amountRemaining = Math.max(0, this.amounts.total - this.amounts.amountPaid);

  if (this.amounts.amountRemaining === 0) {
    this.status = 'PAID';
    this.paidAt = paymentDate;
  }

  this.compliance.auditTrail.push({
    action: 'PAYMENT_RECORDED',
    performedAt: paymentDate,
    details: { amount: paymentAmount }
  });
};

invoiceSchema.methods.void = function (reason, userId) {
  this.status = 'VOID';
  this.voidedAt = new Date();

  this.compliance.auditTrail.push({
    action: 'INVOICE_VOIDED',
    performedBy: userId,
    performedAt: new Date(),
    details: { reason }
  });
};

/**
 * Receipt Schema for Payment Confirmations
 */
const receiptSchema = new mongoose.Schema({
  // Receipt Identification
  receiptNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Related Documents
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
    // Index defined in schema.index() below
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
    // Index defined in schema.index() below
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EnhancedUser',
    required: true
    // Index defined in schema.index() below
  },

  // Payment Details
  paymentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentCurrency: {
    type: String,
    required: true,
    uppercase: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['CARD', 'BANK_TRANSFER', 'PAYPAL', 'CRYPTO', 'CHECK', 'CASH', 'OTHER']
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  // Transaction Information
  transactionId: String,
  gatewayReference: String,

  // Receipt Generation
  pdfGeneration: {
    generated: {
      type: Boolean,
      default: false
    },
    generatedAt: Date,
    fileUrl: String,
    templateId: String
  },

  // Email Delivery
  emailDelivery: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    sentTo: String,
    resendCount: {
      type: Number,
      default: 0
    }
  },

  // Metadata
  metadata: {
    paymentProcessor: String,
    feeAmount: Number,
    netAmount: Number
  }
}, {
  timestamps: true,
  collection: 'receipts'
});

// Indexes
receiptSchema.index({ customerId: 1, paymentDate: -1 });
receiptSchema.index({ invoiceId: 1 });
receiptSchema.index({ paymentDate: 1, paymentCurrency: 1 });

/**
 * Tax Report Schema for Compliance and Analytics
 */
const taxReportSchema = new mongoose.Schema({
  // Report Identification
  reportId: {
    type: String,
    required: true,
    unique: true
  },

  // Reporting Period
  periodType: {
    type: String,
    required: true,
    enum: ['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },

  // Geographic Scope
  jurisdiction: {
    country: {
      type: String,
      required: true,
      uppercase: true
    },
    state: String,
    taxAuthority: String
  },

  // Tax Summary
  summary: {
    totalTaxableAmount: {
      type: Number,
      required: true,
      default: 0
    },
    totalTaxAmount: {
      type: Number,
      required: true,
      default: 0
    },
    exemptAmount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      required: true,
      uppercase: true
    }
  },

  // Tax Breakdown by Type
  taxBreakdown: [{
    taxType: String,
    taxRate: Number,
    taxableAmount: Number,
    taxAmount: Number,
    transactionCount: Number
  }],

  // Filing Information
  filing: {
    status: {
      type: String,
      enum: ['DRAFT', 'READY', 'FILED', 'AMENDED'],
      default: 'DRAFT'
    },
    filedAt: Date,
    filedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    confirmationNumber: String,
    amendments: [{
      amendedAt: Date,
      reason: String,
      previousAmount: Number,
      newAmount: Number
    }]
  },

  // Export and Delivery
  exports: [{
    format: {
      type: String,
      enum: ['CSV', 'JSON', 'XML', 'PDF']
    },
    exportedAt: Date,
    exportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser'
    },
    fileUrl: String,
    recordCount: Number
  }]
}, {
  timestamps: true,
  collection: 'taxreports'
});

// Indexes
taxReportSchema.index({ 'jurisdiction.country': 1, periodStart: 1, periodEnd: 1 });
taxReportSchema.index({ periodType: 1, 'filing.status': 1 });

// Export models
const TaxRate = mongoose.models.TaxRate || mongoose.model('TaxRate', taxRateSchema);
const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
const Receipt = mongoose.model('Receipt', receiptSchema);
const TaxReport = mongoose.models.TaxReport || mongoose.model('TaxReport', taxReportSchema);

module.exports = {
  TaxRate,
  Invoice,
  Receipt,
  TaxReport
};





