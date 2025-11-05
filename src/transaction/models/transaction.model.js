const mongoose = require('mongoose');

/**
 * Transaction Model - Comprehensive payment transaction tracking
 * Stores all transaction details including PSP references, amounts, fees, and payout status
 */
const transactionSchema = new mongoose.Schema({
    // Unique Transaction Identifier
    transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // References
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        index: true,
    },
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        index: true,
    },
    orderId: {
        type: String,
        index: true,
    },

    // Transaction Type
    type: {
        type: String,
        enum: ['charge', 'refund', 'payout', 'fee', 'adjustment', 'chargeback', 'transfer'],
        required: true,
        index: true,
    },

    // Transaction Status
    status: {
        type: String,
        enum: [
            'pending',
            'processing',
            'succeeded',
            'failed',
            'canceled',
            'refunded',
            'partially_refunded',
            'disputed',
            'chargeback',
            'requires_action',
        ],
        default: 'pending',
        required: true,
        index: true,
    },

    // Amount Details (in smallest currency unit, e.g., cents)
    amount: {
        gross: {
            type: Number,
            required: true,
            min: 0,
        },
        fee: {
            type: Number,
            default: 0,
            min: 0,
        },
        net: {
            type: Number,
            required: true,
        },
        tax: {
            type: Number,
            default: 0,
            min: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },

    // Currency
    currency: {
        type: String,
        required: true,
        uppercase: true,
        default: 'USD',
    },

    // Payment Service Provider (PSP) Details
    psp: {
        provider: {
            type: String,
            enum: ['stripe', 'paypal', 'braintree', 'square', 'manual', 'other'],
            required: true,
            index: true,
        },

        // PSP Reference IDs
        reference: {
            paymentIntentId: String,
            chargeId: String,
            transactionId: String,
            balanceTransactionId: String,
            payoutId: String,
            customerId: String,
            orderId: String,
        },

        // PSP Response Data
        response: {
            raw: mongoose.Schema.Types.Mixed,
            statusCode: Number,
            message: String,
        },
    },

    // Payment Method Details
    paymentMethod: {
        type: {
            type: String,
            enum: ['card', 'bank_account', 'paypal', 'apple_pay', 'google_pay', 'ach', 'wire', 'cash', 'check', 'other'],
            required: true,
        },
        card: {
            last4: String,
            brand: String,
            expMonth: Number,
            expYear: Number,
            fingerprint: String,
            funding: String,
            country: String,
        },
        bankAccount: {
            last4: String,
            bankName: String,
            accountType: String,
            routingNumber: String,
        },
        digital: {
            email: String,
            accountId: String,
        },
    },

    // Payout Information
    payout: {
        status: {
            type: String,
            enum: ['not_applicable', 'pending', 'in_transit', 'paid', 'failed', 'canceled'],
            default: 'not_applicable',
            index: true,
        },
        expectedDate: Date,
        actualDate: Date,
        payoutId: String,
        amount: Number,
        currency: String,
        method: String,
        destination: String,
        failureReason: String,
    },

    // Failure Details
    failure: {
        code: String,
        message: String,
        declineCode: String,
        reason: String,
        details: mongoose.Schema.Types.Mixed,
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
            enum: ['pending', 'succeeded', 'failed', 'canceled'],
            default: 'pending',
        },
        refundedAt: Date,
        refundedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        pspRefundId: String,
        metadata: Map,
    }],

    // Chargeback/Dispute Information
    disputes: [{
        disputeId: String,
        amount: Number,
        reason: String,
        status: {
            type: String,
            enum: ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost', 'closed'],
        },
        evidence: {
            submittedAt: Date,
            files: [String],
            details: Map,
        },
        respondBy: Date,
        createdAt: {
            type: Date,
            default: Date.now,
        },
        resolvedAt: Date,
    }],

    // Billing Details
    billing: {
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

    // Transaction Timeline
    timeline: {
        initiatedAt: {
            type: Date,
            default: Date.now,
            required: true,
            index: true,
        },
        authorizedAt: Date,
        capturedAt: Date,
        settledAt: Date,
        failedAt: Date,
        refundedAt: Date,
        disputedAt: Date,
    },

    // Risk Assessment
    risk: {
        score: {
            type: Number,
            min: 0,
            max: 100,
        },
        level: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
        },
        factors: [String],
        fraudulent: {
            type: Boolean,
            default: false,
        },
        requiresReview: {
            type: Boolean,
            default: false,
        },
    },

    // Customer Context
    customer: {
        ipAddress: String,
        userAgent: String,
        deviceFingerprint: String,
        location: {
            country: String,
            region: String,
            city: String,
            coordinates: {
                latitude: Number,
                longitude: Number,
            },
        },
    },

    // Related Transactions
    related: {
        parentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
        },
        childTransactions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
        }],
        originalTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
        },
    },

    // Reconciliation
    reconciliation: {
        status: {
            type: String,
            enum: ['pending', 'matched', 'unmatched', 'discrepancy', 'resolved'],
            default: 'pending',
        },
        reconciledAt: Date,
        reconciledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        bankStatementId: String,
        notes: String,
    },

    // Description and Notes
    description: String,
    notes: String,
    internalNotes: String,

    // Tags for categorization
    tags: [String],

    // Metadata - flexible field for additional data
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
    },

    // Webhook Events
    webhookEvents: [{
        eventId: String,
        eventType: String,
        provider: String,
        receivedAt: {
            type: Date,
            default: Date.now,
        },
        processed: {
            type: Boolean,
            default: false,
        },
        data: mongoose.Schema.Types.Mixed,
    }],

    // Audit Trail
    audit: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        changes: [{
            field: String,
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            changedAt: {
                type: Date,
                default: Date.now,
            },
            changedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        }],
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes for performance
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ 'timeline.initiatedAt': -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ 'psp.provider': 1, 'psp.reference.chargeId': 1 });
transactionSchema.index({ 'payout.status': 1 });
transactionSchema.index({ subscriptionId: 1 });
transactionSchema.index({ invoiceId: 1 });

// Virtuals
transactionSchema.virtual('totalRefunded').get(function () {
    return this.refunds
        .filter(refund => refund.status === 'succeeded')
        .reduce((total, refund) => total + refund.amount, 0);
});

transactionSchema.virtual('isRefunded').get(function () {
    return this.status === 'refunded' || this.status === 'partially_refunded';
});

transactionSchema.virtual('isDisputed').get(function () {
    return this.disputes && this.disputes.length > 0;
});

transactionSchema.virtual('ageInDays').get(function () {
    return Math.floor((Date.now() - this.timeline.initiatedAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
transactionSchema.pre('save', function (next) {
    // Calculate net amount if not set
    if (!this.amount.net || this.isModified('amount.gross') || this.isModified('amount.fee')) {
        this.amount.net = this.amount.gross - this.amount.fee - this.amount.tax + this.amount.discount;
    }

    // Update timeline based on status
    if (this.isModified('status')) {
        const now = new Date();
        switch (this.status) {
            case 'succeeded':
                if (!this.timeline.capturedAt) this.timeline.capturedAt = now;
                break;
            case 'failed':
                if (!this.timeline.failedAt) this.timeline.failedAt = now;
                break;
            case 'refunded':
            case 'partially_refunded':
                if (!this.timeline.refundedAt) this.timeline.refundedAt = now;
                break;
            case 'disputed':
                if (!this.timeline.disputedAt) this.timeline.disputedAt = now;
                break;
        }
    }

    next();
});

// Static Methods
transactionSchema.statics.generateTransactionId = function () {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN_${timestamp}_${randomStr}`;
};

transactionSchema.statics.createCharge = async function (data) {
    const transaction = new this({
        transactionId: this.generateTransactionId(),
        type: 'charge',
        status: 'pending',
        ...data,
    });
    return await transaction.save();
};

transactionSchema.statics.createRefund = async function (originalTransactionId, refundData) {
    const originalTxn = await this.findById(originalTransactionId);
    if (!originalTxn) {
        throw new Error('Original transaction not found');
    }

    const refundTransaction = new this({
        transactionId: this.generateTransactionId(),
        type: 'refund',
        status: 'pending',
        userId: originalTxn.userId,
        amount: {
            gross: refundData.amount,
            fee: 0,
            net: refundData.amount,
            tax: 0,
            discount: 0,
        },
        currency: originalTxn.currency,
        psp: originalTxn.psp,
        related: {
            originalTransactionId: originalTxn._id,
        },
        ...refundData,
    });

    return await refundTransaction.save();
};

// Instance Methods
transactionSchema.methods.markAsSucceeded = async function (pspData = {}) {
    this.status = 'succeeded';
    this.timeline.capturedAt = new Date();

    if (pspData.chargeId) {
        this.psp.reference.chargeId = pspData.chargeId;
    }
    if (pspData.balanceTransactionId) {
        this.psp.reference.balanceTransactionId = pspData.balanceTransactionId;
    }
    if (pspData.fee !== undefined) {
        this.amount.fee = pspData.fee;
    }

    return await this.save();
};

transactionSchema.methods.markAsFailed = async function (failureData) {
    this.status = 'failed';
    this.timeline.failedAt = new Date();
    this.failure = {
        code: failureData.code,
        message: failureData.message,
        declineCode: failureData.declineCode,
        reason: failureData.reason,
        details: failureData.details,
    };

    return await this.save();
};

transactionSchema.methods.addRefund = async function (refundData) {
    const refund = {
        refundId: `REF_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        amount: refundData.amount,
        reason: refundData.reason,
        status: 'succeeded',
        refundedAt: new Date(),
        refundedBy: refundData.refundedBy,
        pspRefundId: refundData.pspRefundId,
        metadata: refundData.metadata,
    };

    this.refunds.push(refund);

    // Update transaction status
    const totalRefunded = this.totalRefunded + refund.amount;
    if (totalRefunded >= this.amount.gross) {
        this.status = 'refunded';
        this.timeline.refundedAt = new Date();
    } else {
        this.status = 'partially_refunded';
    }

    return await this.save();
};

transactionSchema.methods.addDispute = async function (disputeData) {
    const dispute = {
        disputeId: disputeData.id || `DIS_${Date.now()}`,
        amount: disputeData.amount,
        reason: disputeData.reason,
        status: disputeData.status,
        respondBy: disputeData.respondBy,
        createdAt: new Date(),
    };

    this.disputes.push(dispute);
    this.status = 'disputed';
    this.timeline.disputedAt = new Date();

    return await this.save();
};

transactionSchema.methods.updatePayoutStatus = async function (payoutData) {
    this.payout = {
        ...this.payout,
        ...payoutData,
    };

    if (payoutData.status === 'paid') {
        this.payout.actualDate = new Date();
    }

    return await this.save();
};

transactionSchema.methods.addWebhookEvent = async function (eventData) {
    this.webhookEvents.push({
        eventId: eventData.id,
        eventType: eventData.type,
        provider: eventData.provider,
        receivedAt: new Date(),
        processed: false,
        data: eventData.data,
    });

    return await this.save();
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
