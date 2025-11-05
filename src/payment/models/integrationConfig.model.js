const mongoose = require('mongoose');
const crypto = require('crypto');

const integrationConfigSchema = new mongoose.Schema({
    // Basic Information
    provider: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['payment', 'email', 'sms', 'tax', 'analytics'],
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,

    // Configuration Status
    isEnabled: {
        type: Boolean,
        default: false,
        index: true
    },
    isPrimary: {
        type: Boolean,
        default: false,
        index: true
    },
    environment: {
        type: String,
        enum: ['sandbox', 'production'],
        default: 'sandbox'
    },

    // Encrypted Credentials
    credentials: {
        type: Map,
        of: String // Encrypted values
    },
    encryptionKey: String,

    // Configuration Settings
    settings: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    // Health Monitoring
    health: {
        status: {
            type: String,
            enum: ['healthy', 'unhealthy', 'warning', 'unknown'],
            default: 'unknown'
        },
        lastCheck: Date,
        responseTime: Number,
        errorRate: {
            type: Number,
            default: 0
        },
        uptime: {
            type: Number,
            default: 100
        },
        consecutiveFailures: {
            type: Number,
            default: 0
        }
    },

    // Usage Statistics
    usage: {
        totalRequests: {
            type: Number,
            default: 0
        },
        successfulRequests: {
            type: Number,
            default: 0
        },
        failedRequests: {
            type: Number,
            default: 0
        },
        lastUsed: Date,
        monthlyUsage: [{
            month: String, // YYYY-MM format
            requests: Number,
            successRate: Number
        }]
    },

    // Rate Limiting
    rateLimits: {
        requestsPerSecond: Number,
        requestsPerMinute: Number,
        requestsPerHour: Number,
        requestsPerDay: Number
    },

    // Webhooks Configuration
    webhooks: {
        enabled: {
            type: Boolean,
            default: false
        },
        url: String,
        secret: String,
        events: [String]
    },

    // Metadata
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    // Admin Information
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    indexes: [
        { provider: 1, type: 1 },
        { isEnabled: 1, isPrimary: 1 },
        { type: 1, isPrimary: 1 }
    ]
});

// Encryption/Decryption Methods
integrationConfigSchema.methods.encryptCredentials = function (credentials) {
    const algorithm = 'aes-256-gcm';
    const key = this.encryptionKey || crypto.randomBytes(32);
    this.encryptionKey = key.toString('hex');

    const encrypted = new Map();

    for (const [field, value] of Object.entries(credentials)) {
        if (value) {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(algorithm, key);

            let encryptedValue = cipher.update(value, 'utf8', 'hex');
            encryptedValue += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            encrypted.set(field, JSON.stringify({
                encrypted: encryptedValue,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            }));
        }
    }

    this.credentials = encrypted;
};

integrationConfigSchema.methods.getDecryptedCredentials = function () {
    if (!this.credentials || !this.encryptionKey) {
        return {};
    }

    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.encryptionKey, 'hex');
    const decrypted = {};

    try {
        for (const [field, encryptedData] of this.credentials.entries()) {
            if (encryptedData) {
                const data = JSON.parse(encryptedData);
                const decipher = crypto.createDecipher(algorithm, key);
                decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

                let decryptedValue = decipher.update(data.encrypted, 'hex', 'utf8');
                decryptedValue += decipher.final('utf8');

                decrypted[field] = decryptedValue;
            }
        }
    } catch (error) {
        console.error('Error decrypting credentials:', error);
        return {};
    }

    return decrypted;
};

// Health Monitoring Methods
integrationConfigSchema.methods.updateHealth = async function (status, responseTime = null, isError = false) {
    this.health.status = status;
    this.health.lastCheck = new Date();

    if (responseTime !== null) {
        this.health.responseTime = responseTime;
    }

    if (isError) {
        this.health.consecutiveFailures += 1;
        this.usage.failedRequests += 1;
    } else {
        this.health.consecutiveFailures = 0;
        this.usage.successfulRequests += 1;
    }

    this.usage.totalRequests += 1;
    this.usage.lastUsed = new Date();

    // Calculate error rate
    if (this.usage.totalRequests > 0) {
        this.health.errorRate = (this.usage.failedRequests / this.usage.totalRequests) * 100;
    }

    await this.save();
};

integrationConfigSchema.methods.incrementUsage = async function () {
    this.usage.totalRequests += 1;
    this.usage.successfulRequests += 1;
    this.usage.lastUsed = new Date();

    // Update monthly usage
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    let monthlyStats = this.usage.monthlyUsage.find(m => m.month === currentMonth);

    if (!monthlyStats) {
        monthlyStats = {
            month: currentMonth,
            requests: 0,
            successRate: 0
        };
        this.usage.monthlyUsage.push(monthlyStats);
    }

    monthlyStats.requests += 1;
    monthlyStats.successRate = (this.usage.successfulRequests / this.usage.totalRequests) * 100;

    await this.save();
};

// Static Methods
integrationConfigSchema.statics.getProviderByName = function (type, provider) {
    return this.findOne({ type, provider, isEnabled: true });
};

integrationConfigSchema.statics.getPrimaryProvider = function (type) {
    return this.findOne({ type, isPrimary: true, isEnabled: true });
};

integrationConfigSchema.statics.getProvidersByType = function (type) {
    return this.find({ type, isEnabled: true }).sort({ isPrimary: -1 });
};

integrationConfigSchema.statics.getEnabledProviders = function () {
    return this.find({ isEnabled: true }).sort({ type: 1, isPrimary: -1 });
};

module.exports = mongoose.model('IntegrationConfig', integrationConfigSchema);