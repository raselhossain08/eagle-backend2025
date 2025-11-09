const mongoose = require('mongoose');

const analyticsSettingsSchema = new mongoose.Schema({
    // Google Analytics 4 Settings
    googleAnalytics: {
        enabled: {
            type: Boolean,
            default: false
        },
        measurementId: {
            type: String,
            default: ''
        },
        trackingId: {
            type: String,
            default: ''
        },
        apiSecret: {
            type: String,
            default: ''
        },
        events: {
            pageViews: { type: Boolean, default: true },
            subscriptions: { type: Boolean, default: true },
            contracts: { type: Boolean, default: true },
            payments: { type: Boolean, default: true },
            customEvents: { type: Boolean, default: true }
        },
        tracking: {
            enhancedEcommerce: { type: Boolean, default: true },
            userIdTracking: { type: Boolean, default: true },
            crossDomainTracking: { type: Boolean, default: false },
            sampleRate: { type: Number, default: 100, min: 1, max: 100 }
        },
        privacy: {
            cookieConsent: { type: Boolean, default: true },
            ipAnonymization: { type: Boolean, default: true },
            respectDNT: { type: Boolean, default: false },
            dataRetention: { type: Number, default: 14 } // months
        },
        customEventsList: {
            type: String,
            default: ''
        }
    },

    // PostHog Settings
    posthog: {
        enabled: {
            type: Boolean,
            default: false
        },
        projectApiKey: {
            type: String,
            default: ''
        },
        personalApiKey: {
            type: String,
            default: ''
        },
        host: {
            type: String,
            default: 'https://app.posthog.com'
        },
        events: {
            userActions: { type: Boolean, default: true },
            featureFlags: { type: Boolean, default: true },
            sessionRecordings: { type: Boolean, default: false },
            heatmaps: { type: Boolean, default: false }
        },
        tracking: {
            enhancedEcommerce: { type: Boolean, default: true },
            userIdTracking: { type: Boolean, default: true },
            crossDomainTracking: { type: Boolean, default: false },
            sampleRate: { type: Number, default: 100, min: 1, max: 100 }
        },
        privacy: {
            cookieConsent: { type: Boolean, default: true },
            ipAnonymization: { type: Boolean, default: true },
            respectDNT: { type: Boolean, default: false },
            dataRetention: { type: Number, default: 14 }
        }
    },

    // Plausible Analytics Settings
    plausible: {
        enabled: {
            type: Boolean,
            default: false
        },
        domain: {
            type: String,
            default: ''
        },
        apiKey: {
            type: String,
            default: ''
        },
        scriptSrc: {
            type: String,
            default: 'https://plausible.io/js/script.js'
        },
        events: {
            pageViews: { type: Boolean, default: true },
            goals: { type: Boolean, default: true },
            customEvents: { type: Boolean, default: false }
        },
        tracking: {
            enhancedEcommerce: { type: Boolean, default: true },
            userIdTracking: { type: Boolean, default: true },
            crossDomainTracking: { type: Boolean, default: false },
            sampleRate: { type: Number, default: 100, min: 1, max: 100 }
        },
        privacy: {
            cookieConsent: { type: Boolean, default: true },
            ipAnonymization: { type: Boolean, default: true },
            respectDNT: { type: Boolean, default: false },
            dataRetention: { type: Number, default: 14 }
        }
    },

    // Metadata
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Only allow one settings document
analyticsSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

analyticsSettingsSchema.statics.updateSettings = async function (updates, userId) {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this(updates);
    } else {
        // Deep merge for nested objects
        Object.keys(updates).forEach(provider => {
            if (typeof updates[provider] === 'object' && settings[provider]) {
                Object.assign(settings[provider], updates[provider]);
            } else {
                settings[provider] = updates[provider];
            }
        });
    }
    settings.updatedBy = userId;
    settings.lastUpdated = new Date();
    await settings.save();
    return settings;
};

// Helper method to check if provider is configured
analyticsSettingsSchema.methods.isProviderConfigured = function (provider) {
    const providerSettings = this[provider];
    if (!providerSettings) return false;

    switch (provider) {
        case 'googleAnalytics':
            return !!(providerSettings.measurementId && providerSettings.measurementId.length > 5);
        case 'posthog':
            return !!(providerSettings.projectApiKey && providerSettings.projectApiKey.length > 10);
        case 'plausible':
            return !!(providerSettings.domain && providerSettings.domain.length > 3);
        default:
            return false;
    }
};

module.exports = mongoose.model('AnalyticsSettings', analyticsSettingsSchema);
