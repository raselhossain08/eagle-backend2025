/**
 * Audit Logger Middleware
 * Automatically logs subscription actions to audit log
 */

const AuditLog = require('../models/auditLog.model');

/**
 * Create audit logger middleware
 */
function createAuditLogger(action, options = {}) {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.send;
        const startTime = Date.now();

        // Override send function to capture response
        res.send = function (data) {
            // Restore original send
            res.send = originalSend;

            // Calculate duration
            const duration = Date.now() - startTime;

            // Try to parse response data
            let responseData;
            try {
                responseData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (error) {
                responseData = { raw: data };
            }

            // Check if operation was successful
            const success = res.statusCode >= 200 && res.statusCode < 300 && responseData.success !== false;

            // Log to audit if successful and user is authenticated
            if (req.user) {
                setImmediate(() => {
                    logAuditAction({
                        action,
                        req,
                        res,
                        success,
                        duration,
                        responseData,
                        options
                    }).catch(error => {
                        console.error('Failed to log audit action:', error);
                    });
                });
            }

            // Send response
            return originalSend.call(this, data);
        };

        next();
    };
}

/**
 * Log audit action
 */
async function logAuditAction({ action, req, res, success, duration, responseData, options }) {
    try {
        const {
            resourceIdParam = 'id',
            descriptionBuilder,
            changesBuilder,
            customMetadata = {}
        } = options;

        // Get resource ID from params, body, or response
        const resourceId = req.params[resourceIdParam] ||
            req.body.userId ||
            req.body._id ||
            responseData?.data?._id;

        if (!resourceId) {
            console.warn('No resource ID found for audit log');
            return;
        }

        // Build description
        let description;
        if (descriptionBuilder && typeof descriptionBuilder === 'function') {
            description = descriptionBuilder(req, responseData);
        } else {
            description = buildDefaultDescription(action, req, responseData);
        }

        // Build changes object
        let changes = {};
        let oldValues = {};
        let newValues = {};

        if (changesBuilder && typeof changesBuilder === 'function') {
            const changesData = changesBuilder(req, responseData);
            changes = changesData.changes || {};
            oldValues = changesData.oldValues || {};
            newValues = changesData.newValues || {};
        } else {
            changes = extractChanges(req, responseData);
        }

        // Create audit log entry
        await AuditLog.logAction({
            action,
            resource: 'subscription',
            resourceId,
            resourceType: 'User',
            actor: req.user._id,
            actorEmail: req.user.email,
            actorName: req.user.name || req.user.email,
            actorRole: req.user.role,
            description,
            changes,
            oldValues,
            newValues,
            metadata: {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent'),
                requestId: req.id,
                endpoint: req.originalUrl,
                method: req.method,
                duration,
                success,
                errorMessage: success ? null : (responseData.error || responseData.message),
                errorCode: success ? null : responseData.code,
                ...customMetadata
            },
            timestamp: new Date()
        });

        console.log(`✅ Audit logged: ${action} by ${req.user.email}`);
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
}

/**
 * Build default description
 */
function buildDefaultDescription(action, req, responseData) {
    const actionDescriptions = {
        'CREATE': 'Created subscription',
        'UPDATE': 'Updated subscription',
        'DELETE': 'Deleted subscription',
        'CANCEL': 'Cancelled subscription',
        'REACTIVATE': 'Reactivated subscription',
        'SUSPEND': 'Suspended subscription',
        'RESUME': 'Resumed subscription',
        'PAUSE': 'Paused subscription',
        'RENEW': 'Renewed subscription',
        'PLAN_CHANGE': 'Changed subscription plan',
        'SCHEDULED_CHANGE': 'Scheduled plan change',
        'CANCEL_SCHEDULED_CHANGE': 'Cancelled scheduled plan change',
        'VIEW': 'Viewed subscription',
        'EXPORT': 'Exported subscriptions'
    };

    const baseDescription = actionDescriptions[action] || `Performed ${action}`;

    // Add user name if available from response
    if (responseData?.data?.name) {
        return `${baseDescription} for ${responseData.data.name}`;
    }

    if (responseData?.data?.email) {
        return `${baseDescription} for ${responseData.data.email}`;
    }

    return baseDescription;
}

/**
 * Extract changes from request/response
 */
function extractChanges(req, responseData) {
    const changes = {};

    // Check body for updates
    if (req.body && Object.keys(req.body).length > 0) {
        const trackFields = [
            'status',
            'subscriptionStatus',
            'price',
            'billingCycle',
            'planId',
            'newPlanId',
            'reason',
            'pauseDuration',
            'adminNotes'
        ];

        for (const field of trackFields) {
            if (req.body[field] !== undefined) {
                changes[field] = req.body[field];
            }
        }
    }

    // Check response data for changes
    if (responseData?.data) {
        const data = responseData.data;

        if (data.subscriptionStatus) {
            changes.status = data.subscriptionStatus;
        }

        if (data.currentPlan) {
            changes.plan = data.currentPlan;
        }

        if (data.billingCycle) {
            changes.billingCycle = data.billingCycle;
        }
    }

    return changes;
}

/**
 * Manual audit log function (for use outside middleware)
 */
async function logManualAction(action, {
    resourceId,
    actor,
    description,
    changes = {},
    oldValues = {},
    newValues = {},
    metadata = {}
}) {
    try {
        await AuditLog.logAction({
            action,
            resource: 'subscription',
            resourceId,
            resourceType: 'User',
            actor: actor._id,
            actorEmail: actor.email,
            actorName: actor.name || actor.email,
            actorRole: actor.role,
            description,
            changes,
            oldValues,
            newValues,
            metadata,
            timestamp: new Date()
        });

        console.log(`✅ Manual audit logged: ${action}`);
    } catch (error) {
        console.error('Failed to create manual audit log:', error);
    }
}

module.exports = {
    createAuditLogger,
    logAuditAction,
    logManualAction,
    AuditLog
};
