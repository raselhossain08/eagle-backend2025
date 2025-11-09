const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    attempts: {
        type: Number,
        default: 0
    },
    lastAttemptAt: {
        type: Date,
        default: null
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

// Index for automatic deletion of expired tokens
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if token is expired
emailVerificationSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

// Check if token is verified
emailVerificationSchema.methods.isVerified = function () {
    return this.verifiedAt !== null;
};

// Increment attempt count
emailVerificationSchema.methods.incrementAttempts = function () {
    this.attempts += 1;
    this.lastAttemptAt = new Date();
    return this.save();
};

// Static method to generate verification token
emailVerificationSchema.statics.generateToken = function () {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
};

// Static method to create verification token for user
emailVerificationSchema.statics.createVerificationToken = async function (userId, email, expiryHours = 24) {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Delete any existing unverified tokens for this user
    await this.deleteMany({
        userId,
        verifiedAt: null
    });

    const verification = await this.create({
        userId,
        email,
        token,
        expiresAt
    });

    return verification;
};

// Static method to verify token
emailVerificationSchema.statics.verifyToken = async function (token) {
    const verification = await this.findOne({ token });

    if (!verification) {
        throw new Error('Invalid verification token');
    }

    if (verification.isVerified()) {
        throw new Error('Token already used');
    }

    if (verification.isExpired()) {
        throw new Error('Verification token has expired');
    }

    verification.verifiedAt = new Date();
    await verification.save();

    return verification;
};

const EmailVerification = mongoose.model('EmailVerification', emailVerificationSchema);

module.exports = EmailVerification;
