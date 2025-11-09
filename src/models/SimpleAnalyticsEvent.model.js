const mongoose = require('mongoose');

/**
 * Simple Analytics Event Model
 * Centralized model definition to avoid duplicate index warnings
 */

// Check if model already exists and return it immediately
if (mongoose.models.SimpleAnalyticsEvent) {
    module.exports = mongoose.models.SimpleAnalyticsEvent;
} else {
    // Create schema only if model doesn't exist
    const simpleAnalyticsSchema = new mongoose.Schema({
        type: {
            type: String,
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        sessionId: {
            type: String,
            default: null
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        properties: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    }, {
        timestamps: true,
        collection: 'simple_analytics_events'
    });

    // Define indexes once
    simpleAnalyticsSchema.index({ type: 1 });
    simpleAnalyticsSchema.index({ userId: 1 });
    simpleAnalyticsSchema.index({ sessionId: 1 });
    simpleAnalyticsSchema.index({ timestamp: 1 });

    module.exports = mongoose.model('SimpleAnalyticsEvent', simpleAnalyticsSchema);
}
