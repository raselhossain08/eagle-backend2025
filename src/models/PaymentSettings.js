const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
    // PayPal Settings
    paypal: {
        enabled: {
            type: Boolean,
            default: false
        },
        mode: {
            type: String,
            enum: ['sandbox', 'live'],
            default: 'sandbox'
        },
        clientId: {
            type: String,
            default: ''
        },
        clientSecret: {
            type: String,
            default: ''
        },
        apiUrl: {
            type: String,
            default: ''
        }
    },

    // Stripe Settings
    stripe: {
        enabled: {
            type: Boolean,
            default: false
        },
        mode: {
            type: String,
            enum: ['test', 'live'],
            default: 'test'
        },
        publishableKey: {
            type: String,
            default: ''
        },
        secretKey: {
            type: String,
            default: ''
        },
        webhookSecret: {
            type: String,
            default: ''
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
paymentSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

paymentSettingsSchema.statics.updateSettings = async function (updates, userId) {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this(updates);
    } else {
        Object.assign(settings, updates);
    }
    settings.updatedBy = userId;
    settings.lastUpdated = new Date();
    await settings.save();
    return settings;
};

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
