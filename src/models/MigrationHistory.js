const mongoose = require('mongoose');

/**
 * Migration History Model
 * Tracks all WordPress user migration activities
 */
const migrationHistorySchema = new mongoose.Schema(
    {
        wpUserId: {
            type: Number,
            required: true,
            index: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
            // index: true // Removed: covered by schema.index({ userId: 1 }) below
        },
        username: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true
        },
        status: {
            type: String,
            enum: ['success', 'failed', 'already_exists'],
            required: true
        },
        migrationType: {
            type: String,
            enum: ['single', 'bulk', 'auto'],
            default: 'single'
        },
        migrationSource: {
            type: String,
            default: 'dashboard' // dashboard, api, script, etc.
        },
        migratedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AdminUser', // Admin who performed migration
            default: null
        },
        errorMessage: {
            type: String,
            default: null
        },
        wordPressData: {
            displayName: String,
            firstName: String,
            lastName: String,
            role: String,
            registeredDate: Date,
            meta: mongoose.Schema.Types.Mixed
        },
        migrationAttempts: {
            type: Number,
            default: 1
        },
        lastAttemptAt: {
            type: Date,
            default: Date.now
        },
        completedAt: {
            type: Date
        },
        ipAddress: String,
        userAgent: String
    },
    {
        timestamps: true // createdAt, updatedAt
    }
);

// Indexes for better query performance
migrationHistorySchema.index({ wpUserId: 1, status: 1 });
migrationHistorySchema.index({ email: 1, status: 1 });
migrationHistorySchema.index({ userId: 1 });
migrationHistorySchema.index({ createdAt: -1 });
migrationHistorySchema.index({ migratedBy: 1, createdAt: -1 });

// Static method to check if user is already migrated
migrationHistorySchema.statics.isUserMigrated = async function (wpUserId) {
    const migration = await this.findOne({
        wpUserId,
        status: { $in: ['success', 'already_exists'] }
    }).sort({ createdAt: -1 });

    return {
        isMigrated: !!migration,
        migration: migration
    };
};

// Static method to get migration stats
migrationHistorySchema.statics.getMigrationStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const result = {
        total: 0,
        success: 0,
        failed: 0,
        already_exists: 0
    };

    stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
    });

    return result;
};

// Static method to get recent migrations
migrationHistorySchema.statics.getRecentMigrations = async function (limit = 50) {
    return this.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email subscription')
        .populate('migratedBy', 'name email')
        .lean();
};

// Instance method to mark migration as completed
migrationHistorySchema.methods.markCompleted = function () {
    this.status = 'success';
    this.completedAt = new Date();
    return this.save();
};

// Instance method to mark migration as failed
migrationHistorySchema.methods.markFailed = function (errorMessage) {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    this.lastAttemptAt = new Date();
    this.migrationAttempts += 1;
    return this.save();
};

module.exports = mongoose.model('MigrationHistory', migrationHistorySchema);
