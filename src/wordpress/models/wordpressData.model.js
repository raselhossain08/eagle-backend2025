const mongoose = require('mongoose');

const wordpressDataSchema = new mongoose.Schema({
    endpoint: {
        type: String,
        required: true,
        enum: ['customers', 'orders', 'subscriptions', 'analytics', 'payment-methods', 'coupons'],
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    metadata: {
        source: {
            type: String,
            default: 'wordpress'
        },
        wpUrl: String,
        lastSynced: {
            type: Date,
            default: Date.now
        },
        itemCount: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['active', 'archived', 'error'],
        default: 'active'
    }
}, {
    timestamps: true,
    collection: 'wordpress_data'
});

// Index for faster queries
wordpressDataSchema.index({ endpoint: 1, 'metadata.lastSynced': -1 });
wordpressDataSchema.index({ createdAt: 1 });

// Static method to get latest data for an endpoint
wordpressDataSchema.statics.getLatestByEndpoint = async function (endpoint) {
    return this.findOne({ endpoint, status: 'active' })
        .sort({ 'metadata.lastSynced': -1 })
        .lean();
};

// Static method to save/update endpoint data
wordpressDataSchema.statics.saveEndpointData = async function (endpoint, data, wpUrl = '') {
    const itemCount = Array.isArray(data) ? data.length : Object.keys(data).length;

    return this.create({
        endpoint,
        data,
        metadata: {
            source: 'wordpress',
            wpUrl,
            lastSynced: new Date(),
            itemCount
        },
        status: 'active'
    });
};

module.exports = mongoose.model('WordPressData', wordpressDataSchema);
