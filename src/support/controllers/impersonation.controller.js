/**
 * Eagle User Impersonation Controller
 * Handles support user impersonation with security controls
 */

const SupportSession = require('../models/supportSession.model');
const User = require('../../models/user.model');
const createError = require('http-errors');

/**
 * Start impersonation session
 */
exports.startImpersonation = async (req, res, next) => {
  try {
    const { targetUserId, reason, sessionType = 'READ_ONLY' } = req.body;

    // Validate inputs
    if (!targetUserId || !reason) {
      return next(createError(400, 'Target user ID and reason are required'));
    }

    if (!['READ_ONLY', 'WRITE_ENABLED'].includes(sessionType)) {
      return next(createError(400, 'Invalid session type'));
    }

    // Check target user exists
    const targetUser = await User.findById(targetUserId).select('name email role');
    if (!targetUser) {
      return next(createError(404, 'Target user not found'));
    }

    // Prevent impersonating other admins (unless super admin)
    if (targetUser.role === 'admin' && req.user.role !== 'superadmin') {
      return next(createError(403, 'Cannot impersonate other admin users'));
    }

    // Check for existing active session
    const existingSession = await SupportSession.getActiveSession(req.user._id, targetUserId);
    if (existingSession) {
      return res.status(200).json({
        success: true,
        message: 'Active session already exists',
        data: {
          sessionId: existingSession._id,
          targetUser,
          sessionType: existingSession.sessionType,
          startTime: existingSession.startTime,
          expiresAt: existingSession.expiresAt
        }
      });
    }

    // Create new session (handled by middleware)
    const session = req.supportSession;

    res.status(201).json({
      success: true,
      message: 'Impersonation session started successfully',
      data: {
        sessionId: session._id,
        targetUser,
        sessionType: session.sessionType,
        startTime: session.startTime,
        expiresAt: session.expiresAt,
        banner: {
          message: `🔧 SUPPORT MODE: Now viewing as ${targetUser.name} (${targetUser.email})`,
          type: sessionType === 'READ_ONLY' ? 'info' : 'warning',
          dismissible: false
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active impersonation sessions
 */
exports.getActiveSessions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sessions = await SupportSession.find({
      supportAgent: req.user._id,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() }
    })
      .populate('targetUser', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SupportSession.countDocuments({
      supportAgent: req.user._id,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() }
    });

    res.status(200).json({
      success: true,
      message: 'Active sessions retrieved successfully',
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session details
 */
exports.getSessionDetails = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await SupportSession.findById(sessionId)
      .populate('supportAgent', 'name email')
      .populate('targetUser', 'name email role')
      .populate('writeActionsRequested.approvedBy', 'name email');

    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Only allow viewing own sessions (unless super admin)
    if (session.supportAgent._id.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return next(createError(403, 'Access denied to this session'));
    }

    res.status(200).json({
      success: true,
      message: 'Session details retrieved successfully',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End impersonation session
 */
exports.endImpersonation = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await SupportSession.findById(sessionId);
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Only allow ending own sessions
    if (session.supportAgent.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Cannot end another agent\'s session'));
    }

    if (session.status !== 'ACTIVE') {
      return next(createError(400, 'Session is not active'));
    }

    await session.endSession();
    await session.logAction('SESSION_ENDED', { endedBy: 'MANUAL' }, req);

    res.status(200).json({
      success: true,
      message: 'Impersonation session ended successfully',
      data: {
        sessionId: session._id,
        endTime: session.endTime
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Extend session duration
 */
exports.extendSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { hours = 2 } = req.body;

    if (hours < 1 || hours > 8) {
      return next(createError(400, 'Extension hours must be between 1 and 8'));
    }

    const session = await SupportSession.findById(sessionId);
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Only allow extending own sessions
    if (session.supportAgent.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Cannot extend another agent\'s session'));
    }

    if (session.status !== 'ACTIVE') {
      return next(createError(400, 'Cannot extend inactive session'));
    }

    const extensionMs = hours * 60 * 60 * 1000;
    session.expiresAt = new Date(session.expiresAt.getTime() + extensionMs);
    await session.save();

    await session.logAction('SESSION_EXTENDED', { 
      extensionHours: hours,
      newExpiresAt: session.expiresAt 
    }, req);

    res.status(200).json({
      success: true,
      message: 'Session extended successfully',
      data: {
        sessionId: session._id,
        expiresAt: session.expiresAt,
        extensionHours: hours
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve write action
 */
exports.approveWriteAction = async (req, res, next) => {
  try {
    const { sessionId, actionId } = req.params;

    const session = await SupportSession.findById(sessionId);
    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    const actionIndex = session.writeActionsRequested.findIndex(
      a => a._id.toString() === actionId
    );

    if (actionIndex === -1) {
      return next(createError(404, 'Write action not found'));
    }

    const action = session.writeActionsRequested[actionIndex];
    if (action.approved) {
      return next(createError(400, 'Action already approved'));
    }

    await session.approveWriteAction(actionIndex, req.user._id);
    await session.logAction('WRITE_ACTION_APPROVED', {
      actionId,
      action: action.action,
      approvedBy: req.user._id
    }, req);

    res.status(200).json({
      success: true,
      message: 'Write action approved successfully',
      data: {
        sessionId,
        actionId,
        approvedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get impersonation audit log
 */
exports.getAuditLog = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const session = await SupportSession.findById(sessionId)
      .populate('supportAgent', 'name email')
      .populate('targetUser', 'name email');

    if (!session) {
      return next(createError(404, 'Session not found'));
    }

    // Only allow viewing own sessions (unless super admin)
    if (session.supportAgent._id.toString() !== req.user._id.toString() && req.user.role !== 'superadmin') {
      return next(createError(403, 'Access denied to this session'));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const auditLog = session.auditLog
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Audit log retrieved successfully',
      data: {
        sessionInfo: {
          sessionId: session._id,
          supportAgent: session.supportAgent,
          targetUser: session.targetUser,
          sessionType: session.sessionType,
          status: session.status
        },
        auditLog,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: session.auditLog.length,
          pages: Math.ceil(session.auditLog.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all sessions for admin overview
 */
exports.getAllSessions = async (req, res, next) => {
  try {
    // Only super admins can view all sessions
    if (req.user.role !== 'superadmin') {
      return next(createError(403, 'Super admin access required'));
    }

    const { page = 1, limit = 20, status, supportAgent } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status) query.status = status;
    if (supportAgent) query.supportAgent = supportAgent;

    const sessions = await SupportSession.find(query)
      .populate('supportAgent', 'name email')
      .populate('targetUser', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SupportSession.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'All sessions retrieved successfully',
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};