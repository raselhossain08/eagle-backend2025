/**
 * Audit Log Model
 * Tracks all subscription-related actions for compliance and monitoring
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const auditLogSchema = new Schema({
    // Action type
    action: {
        type: String,
        required: true,
        enum: [
            'CREATE',
            'UPDATE',
            'DELETE',
            'CANCEL',
            'REACTIVATE',
            'SUSPEND',
            'RESUME',
            'PAUSE',
            'RENEW',
            'PLAN_CHANGE',
            'SCHEDULED_CHANGE',
            'CANCEL_SCHEDULED_CHANGE',
            'VIEW',
            'EXPORT',
            'BULK_OPERATION'
        ],
        index: true
    },

    // Resource information
    resource: {
        type: String,
        required: true,
        default: 'subscription',
        enum: ['subscription', 'plan', 'user', 'payment', 'system']
    },

    resourceId: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true
    },

    resourceType: {
        type: String,
        default: 'User'
    },

    // Actor (who performed the action)
    actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    actorEmail: {
        type: String,
        required: true
    },

    actorName: {
        type: String,
        required: true
    },

    actorRole: {
        type: String,
        required: true
    },

    // Action details
    description: {
        type: String,
        required: true
    },

    // Changes made (before/after values)
    changes: {
        type: Schema.Types.Mixed,
        default: {}
    },

    // Old values (before change)
    oldValues: {
        type: Schema.Types.Mixed,
        default: {}
    },

    // New values (after change)
    newValues: {
        type: Schema.Types.Mixed,
        default: {}
    },

    // Additional metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        requestId: String,
        endpoint: String,
        method: String,
        duration: Number, // in milliseconds
        success: {
            type: Boolean,
            default: true
        },
        errorMessage: String,
        errorCode: String
    },

    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false, // Using custom timestamp field
    collection: 'subscription_audit_logs' // Use separate collection for subscription audits
});

// Compound indexes for common queries
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, action: 1, timestamp: -1 });

// TTL index - automatically delete logs older than 2 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

// Static methods

/**
 * Log an action
 */
auditLogSchema.statics.logAction = async function (data) {
    try {
        const log = new this(data);
        await log.save();
        return log;
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - audit logging should not break the main flow
        return null;
    }
};

/**
 * Get recent activity
 */
auditLogSchema.statics.getRecentActivity = async function (limit = 10, filters = {}) {
    try {
        const query = { ...filters };

        return await this.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('actor', 'name email')
            .lean();
    } catch (error) {
        console.error('Failed to get recent activity:', error);
        return [];
    }
};

/**
 * Get activity for specific resource
 */
auditLogSchema.statics.getResourceActivity = async function (resourceId, limit = 20) {
    try {
        return await this.find({ resourceId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('actor', 'name email')
            .lean();
    } catch (error) {
        console.error('Failed to get resource activity:', error);
        return [];
    }
};

/**
 * Get activity by actor
 */
auditLogSchema.statics.getActorActivity = async function (actorId, limit = 20) {
    try {
        return await this.find({ actor: actorId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    } catch (error) {
        console.error('Failed to get actor activity:', error);
        return [];
    }
};

/**
 * Get activity statistics
 */
auditLogSchema.statics.getStatistics = async function (startDate, endDate) {
    try {
        const query = {
            timestamp: {
                $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                $lte: endDate || new Date()
            }
        };

        const [totalActions, actionBreakdown, actorBreakdown] = await Promise.all([
            this.countDocuments(query),
            this.aggregate([
                { $match: query },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            this.aggregate([
                { $match: query },
                { $group: { _id: '$actor', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        return {
            totalActions,
            actionBreakdown,
            actorBreakdown
        };
    } catch (error) {
        console.error('Failed to get statistics:', error);
        return {
            totalActions: 0,
            actionBreakdown: [],
            actorBreakdown: []
        };
    }
};

// Instance methods

/**
 * Format log for display
 */
auditLogSchema.methods.toDisplayFormat = function () {
    return {
        id: this._id.toString(),
        action: this.action,
        description: this.description,
        actor: this.actorName,
        actorEmail: this.actorEmail,
        resource: this.resource,
        resourceId: this.resourceId.toString(),
        timestamp: this.timestamp,
        changes: this.formatChanges()
    };
};

/**
 * Format changes for display
 */
auditLogSchema.methods.formatChanges = function () {
    if (!this.changes || Object.keys(this.changes).length === 0) {
        return 'No changes recorded';
    }

    const changesList = [];
    for (const [key, value] of Object.entries(this.changes)) {
        if (typeof value === 'object' && value.from !== undefined && value.to !== undefined) {
            changesList.push(`${key}: ${value.from} → ${value.to}`);
        } else {
            changesList.push(`${key}: ${value}`);
        }
    }

    return changesList.join(', ');
};

// Create and export model with unique name to avoid conflicts with admin AuditLog
// Delete existing model if it exists to ensure fresh compilation with all statics
if (mongoose.models.SubscriptionAuditLog) {
    delete mongoose.models.SubscriptionAuditLog;
}

const SubscriptionAuditLog = mongoose.model('SubscriptionAuditLog', auditLogSchema);

module.exports = SubscriptionAuditLog;
