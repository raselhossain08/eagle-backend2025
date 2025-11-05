/**
 * Eagle Support Impersonation Middleware
 * Security controls for user impersonation with audit logging
 */

const SupportSession = require('../models/supportSession.model');
const createError = require('http-errors');

/**
 * Initialize impersonation session
 */
exports.initializeImpersonation = async (req, res, next) => {
  try {
    const { targetUserId, reason, sessionType = 'READ_ONLY' } = req.body;

    if (!targetUserId || !reason) {
      return next(createError(400, 'Target user ID and reason are required'));
    }

    // Check if support agent has permission
    if (!req.user || req.user.role !== 'admin') {
      return next(createError(403, 'Support impersonation requires admin privileges'));
    }

    // Check for existing active session
    const existingSession = await SupportSession.getActiveSession(req.user._id, targetUserId);
    if (existingSession) {
      return next(createError(409, 'Active impersonation session already exists for this user'));
    }

    // Create new session
    const session = new SupportSession({
      supportAgent: req.user._id,
      targetUser: targetUserId,
      sessionType,
      reason,
      metadata: {
        clientIp: req.ip,
        userAgent: req.get('User-Agent'),
        location: req.get('CF-IPCountry') || 'Unknown'
      }
    });

    await session.save();
    await session.logAction('SESSION_STARTED', { reason, sessionType }, req);

    req.supportSession = session;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate active impersonation session
 */
exports.validateImpersonation = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-support-session-id'];
    
    if (!sessionId) {
      return next(createError(400, 'Support session ID required'));
    }

    const session = await SupportSession.findById(sessionId)
      .populate('supportAgent', 'name email')
      .populate('targetUser', 'name email');

    if (!session) {
      return next(createError(404, 'Support session not found'));
    }

    if (session.status !== 'ACTIVE') {
      return next(createError(403, 'Support session is not active'));
    }

    if (session.expiresAt < new Date()) {
      session.status = 'EXPIRED';
      await session.save();
      return next(createError(403, 'Support session has expired'));
    }

    if (session.supportAgent._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Session does not belong to current user'));
    }

    // Log access
    await session.logAction('API_ACCESS', {
      endpoint: req.path,
      method: req.method,
      params: req.params,
      query: req.query
    }, req);

    req.supportSession = session;
    req.impersonatedUser = session.targetUser;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require write confirmation for write operations
 */
exports.requireWriteConfirmation = async (req, res, next) => {
  try {
    if (!req.supportSession) {
      return next(createError(400, 'No active support session'));
    }

    if (req.supportSession.sessionType === 'READ_ONLY') {
      return next(createError(403, 'Write operations not allowed in read-only session'));
    }

    const writeActionId = req.headers['x-write-action-id'];
    
    if (!writeActionId) {
      // Request write permission
      const action = `${req.method} ${req.path}`;
      await req.supportSession.requestWriteAction(action, {
        body: req.body,
        params: req.params,
        query: req.query
      });

      return res.status(202).json({
        success: false,
        message: 'Write action requires confirmation',
        requiresConfirmation: true,
        sessionId: req.supportSession._id,
        pendingActions: req.supportSession.writeActionsRequested.filter(a => !a.approved)
      });
    }

    // Validate write action approval
    const actionIndex = req.supportSession.writeActionsRequested.findIndex(
      a => a._id.toString() === writeActionId && a.approved && !a.executedAt
    );

    if (actionIndex === -1) {
      return next(createError(403, 'Write action not approved or already executed'));
    }

    // Mark as executed
    req.supportSession.writeActionsRequested[actionIndex].executedAt = new Date();
    await req.supportSession.save();

    await req.supportSession.logAction('WRITE_ACTION_EXECUTED', {
      actionId: writeActionId,
      action: req.supportSession.writeActionsRequested[actionIndex].action
    }, req);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Add impersonation banner data to responses
 */
exports.addImpersonationBanner = (req, res, next) => {
  if (req.supportSession && req.impersonatedUser) {
    // Override res.json to add banner info
    const originalJson = res.json;
    res.json = function(data) {
      const responseWithBanner = {
        ...data,
        __impersonation: {
          active: true,
          supportAgent: {
            id: req.supportSession.supportAgent._id,
            name: req.supportSession.supportAgent.name
          },
          targetUser: {
            id: req.impersonatedUser._id,
            name: req.impersonatedUser.name,
            email: req.impersonatedUser.email
          },
          sessionType: req.supportSession.sessionType,
          startTime: req.supportSession.startTime,
          expiresAt: req.supportSession.expiresAt,
          banner: {
            message: `🔧 SUPPORT MODE: Viewing as ${req.impersonatedUser.name}`,
            type: req.supportSession.sessionType === 'READ_ONLY' ? 'info' : 'warning',
            dismissible: false
          }
        }
      };
      return originalJson.call(this, responseWithBanner);
    };
  }
  next();
};

/**
 * Log support actions for audit
 */
exports.auditSupportAction = (action) => {
  return async (req, res, next) => {
    try {
      if (req.supportSession) {
        await req.supportSession.logAction(action, {
          endpoint: req.path,
          method: req.method,
          success: res.statusCode < 400,
          statusCode: res.statusCode
        }, req);
      }
      next();
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the request for audit errors
      next();
    }
  };
};

/**
 * Clean up expired sessions (can be called by cron job)
 */
exports.cleanupExpiredSessions = async () => {
  try {
    const result = await SupportSession.updateMany(
      {
        status: 'ACTIVE',
        expiresAt: { $lt: new Date() }
      },
      {
        status: 'EXPIRED',
        endTime: new Date()
      }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} expired support sessions`);
    return result;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
};