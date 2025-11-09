const mongoose = require('mongoose');

const webhookDeliverySchema = new mongoose.Schema({
    webhook: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Webhook',
        required: true,
        index: true
    },
    event: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    statusCode: {
        type: Number,
        required: true
    },
    response: {
        type: String,
        maxlength: 5000
    },
    duration: {
        type: Number, // milliseconds
        required: true
    },
    success: {
        type: Boolean,
        required: true
    },
    attempt: {
        type: Number,
        default: 1
    },
    error: {
        type: String,
        maxlength: 1000
    },
    deliveredAt: {
        type: Date,
        default: Date.now,
        expires: 2592000 // Auto-delete after 30 days
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
webhookDeliverySchema.index({ webhook: 1, deliveredAt: -1 });
webhookDeliverySchema.index({ event: 1, success: 1 });
webhookDeliverySchema.index({ deliveredAt: -1 });

// Static method to get recent deliveries for a webhook
webhookDeliverySchema.statics.getRecentDeliveries = async function (webhookId, limit = 10) {
    return await this.find({ webhook: webhookId })
        .select('event statusCode duration success deliveredAt attempt')
        .sort({ deliveredAt: -1 })
        .limit(limit);
};

// Static method to get delivery stats
webhookDeliverySchema.statics.getStats = async function (webhookId) {
    const stats = await this.aggregate([
        { $match: { webhook: mongoose.Types.ObjectId(webhookId) } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                successful: {
                    $sum: { $cond: ['$success', 1, 0] }
                },
                failed: {
                    $sum: { $cond: ['$success', 0, 1] }
                },
                avgDuration: { $avg: '$duration' }
            }
        }
    ]);

    return stats[0] || {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0
    };
};

const WebhookDelivery = mongoose.model('WebhookDelivery', webhookDeliverySchema);

module.exports = WebhookDelivery;
