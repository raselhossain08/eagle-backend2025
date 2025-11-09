const mongoose = require('mongoose');

const verificationSettingsSchema = new mongoose.Schema({
    // Email Verification Settings
    emailVerification: {
        enabled: {
            type: Boolean,
            default: true
        },
        required: {
            type: Boolean,
            default: true,
            description: 'Require email verification for new accounts'
        },
        tokenExpiry: {
            type: Number,
            default: 24,
            min: 1,
            max: 168, // 7 days max
            description: 'Token expiry in hours'
        },
        resendCooldown: {
            type: Number,
            default: 5,
            min: 1,
            max: 60,
            description: 'Cooldown period between resend requests in minutes'
        },
        maxAttempts: {
            type: Number,
            default: 5,
            description: 'Maximum verification attempts before locking'
        },
        autoSendOnRegister: {
            type: Boolean,
            default: true,
            description: 'Automatically send verification email on registration'
        }
    },

    // Email Template Settings
    emailTemplate: {
        subject: {
            type: String,
            default: 'Verify Your Email Address'
        },
        fromName: {
            type: String,
            default: 'Eagle Platform'
        },
        fromEmail: {
            type: String,
            default: process.env.EMAIL_FROM || 'noreply@eagle.com'
        },
        logoUrl: {
            type: String,
            default: ''
        },
        buttonText: {
            type: String,
            default: 'Verify Email'
        },
        buttonColor: {
            type: String,
            default: '#3B82F6'
        },
        footerText: {
            type: String,
            default: 'If you did not create an account, please ignore this email.'
        }
    },

    // Phone Verification Settings (Future)
    phoneVerification: {
        enabled: {
            type: Boolean,
            default: false
        },
        required: {
            type: Boolean,
            default: false
        },
        provider: {
            type: String,
            enum: ['twilio', 'nexmo', 'aws-sns'],
            default: 'twilio'
        }
    },

    // Security Settings
    security: {
        blockDisposableEmails: {
            type: Boolean,
            default: true,
            description: 'Block temporary/disposable email addresses'
        },
        captchaOnResend: {
            type: Boolean,
            default: false,
            description: 'Require CAPTCHA when resending verification email'
        },
        ipRateLimit: {
            enabled: {
                type: Boolean,
                default: true
            },
            maxRequests: {
                type: Number,
                default: 10,
                description: 'Max verification requests per IP per hour'
            }
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

// Singleton pattern - only one settings document
verificationSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();

    if (!settings) {
        settings = await this.create({});
    }

    return settings;
};

// Update settings
verificationSettingsSchema.statics.updateSettings = async function (updates, userId) {
    let settings = await this.getSettings();

    Object.keys(updates).forEach(key => {
        if (settings[key] !== undefined) {
            if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
                settings[key] = { ...settings[key], ...updates[key] };
            } else {
                settings[key] = updates[key];
            }
        }
    });

    settings.updatedBy = userId;
    settings.lastUpdated = new Date();

    await settings.save();
    return settings;
};

const VerificationSettings = mongoose.model('VerificationSettings', verificationSettingsSchema);

module.exports = VerificationSettings;
