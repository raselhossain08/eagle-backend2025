const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Webhook name is required'],
        trim: true,
        maxlength: [100, 'Webhook name cannot exceed 100 characters']
    },
    url: {
        type: String,
        required: [true, 'Webhook URL is required'],
        trim: true,
        validate: {
            validator: function (v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Please provide a valid HTTP/HTTPS URL'
        }
    },
    events: [{
        type: String,
        required: true,
        enum: [
            // Subscription events
            'subscription.created',
            'subscription.updated',
            'subscription.cancelled',
            'subscription.renewed',
            // Payment events
            'invoice.paid',
            'invoice.failed',
            'invoice.created',
            'payment.refunded',
            // Contract events
            'contract.signed',
            'contract.expired',
            'contract.renewed',
            'contract.updated',
            // User events
            'user.created',
            'user.updated',
            'user.deleted'
        ]
    }],
    enabled: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['active', 'disabled', 'error'],
        default: 'active'
    },
    retryPolicy: {
        type: String,
        enum: ['linear', 'exponential', 'none'],
        default: 'exponential'
    },
    maxRetries: {
        type: Number,
        default: 3,
        min: 0,
        max: 10
    },
    timeout: {
        type: Number,
        default: 30,
        min: 1,
        max: 60
    },
    secret: {
        type: String,
        required: true
    },
    verifySsl: {
        type: Boolean,
        default: true
    },
    authHeaders: [{
        name: {
            type: String,
            required: true
        },
        value: {
            type: String,
            required: true
        }
    }],
    lastDelivery: {
        type: Date,
        default: null
    },
    deliveryStats: {
        total: {
            type: Number,
            default: 0
        },
        successful: {
            type: Number,
            default: 0
        },
        failed: {
            type: Number,
            default: 0
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for faster queries
webhookSchema.index({ enabled: 1, status: 1 });
webhookSchema.index({ createdBy: 1 });

// Static method to get all webhooks
webhookSchema.statics.getAllWebhooks = async function (userId) {
    return await this.find({ createdBy: userId })
        .select('-secret -authHeaders.value')
        .sort({ createdAt: -1 });
};

// Static method to get webhooks by event
webhookSchema.statics.getWebhooksByEvent = async function (eventName) {
    return await this.find({
        events: eventName,
        enabled: true,
        status: 'active'
    });
};

// Method to sanitize webhook for response
webhookSchema.methods.sanitize = function () {
    const webhook = this.toObject();

    // Mask the secret (show only last 4 characters)
    if (webhook.secret) {
        webhook.secret = `whsec_${'*'.repeat(20)}${webhook.secret.slice(-4)}`;
    }

    // Mask auth header values
    if (webhook.authHeaders) {
        webhook.authHeaders = webhook.authHeaders.map(header => ({
            name: header.name,
            value: `${'*'.repeat(8)}${header.value.slice(-4)}`
        }));
    }

    return webhook;
};

// Generate a secure random secret
webhookSchema.statics.generateSecret = function () {
    const crypto = require('crypto');
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
};

const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = Webhook;
