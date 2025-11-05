/**
 * Eagle Email Resend Controller
 * Handles resending various types of emails
 */

const EmailResendService = require('../services/emailResend.service');
const User = require('../../models/user.model');
const createError = require('http-errors');

/**
 * Resend verification email
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(createError(400, 'Reason for resending is required'));
    }

    const result = await EmailResendService.resendVerification(userId, req.user._id, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        resendId: result.resendId,
        rateLimit: result.rateLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend payment receipt
 */
exports.resendReceipt = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { transactionId, reason } = req.body;

    if (!transactionId || !reason) {
      return next(createError(400, 'Transaction ID and reason are required'));
    }

    const result = await EmailResendService.resendReceipt(userId, transactionId, req.user._id, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        resendId: result.resendId,
        rateLimit: result.rateLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend contract link
 */
exports.resendContractLink = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { contractId, reason } = req.body;

    if (!contractId || !reason) {
      return next(createError(400, 'Contract ID and reason are required'));
    }

    const result = await EmailResendService.resendContractLink(userId, contractId, req.user._id, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        resendId: result.resendId,
        rateLimit: result.rateLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend password reset email
 */
exports.resendPasswordReset = async (req, res, next) => {
  try {
    const { email, reason } = req.body;

    if (!email || !reason) {
      return next(createError(400, 'Email and reason are required'));
    }

    const result = await EmailResendService.resendPasswordReset(email, req.user._id, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        resendId: result.resendId,
        rateLimit: result.rateLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend welcome email
 */
exports.resendWelcome = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return next(createError(400, 'Reason for resending is required'));
    }

    const result = await EmailResendService.resendWelcome(userId, req.user._id, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        resendId: result.resendId,
        rateLimit: result.rateLimit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get resend history for a user
 */
exports.getResendHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const result = await EmailResendService.getResendHistory(userId, parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Resend history retrieved successfully',
      data: result.data,
      total: result.total
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available email types
 */
exports.getEmailTypes = (req, res) => {
  const emailTypes = EmailResendService.getAvailableEmailTypes();
  
  res.status(200).json({
    success: true,
    message: 'Email types retrieved successfully',
    data: emailTypes
  });
};

/**
 * Check rate limits for all email types
 */
exports.checkRateLimits = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await EmailResendService.checkAllRateLimits(userId);

    res.status(200).json({
      success: true,
      message: 'Rate limits retrieved successfully',
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk resend emails (for multiple users)
 */
exports.bulkResend = async (req, res, next) => {
  try {
    const { userIds, emailType, reason } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return next(createError(400, 'User IDs array is required'));
    }

    if (!emailType || !reason) {
      return next(createError(400, 'Email type and reason are required'));
    }

    if (userIds.length > 50) {
      return next(createError(400, 'Maximum 50 users allowed per bulk operation'));
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        let result;
        switch (emailType) {
          case 'VERIFICATION':
            result = await EmailResendService.resendVerification(userId, req.user._id, reason);
            break;
          case 'WELCOME':
            result = await EmailResendService.resendWelcome(userId, req.user._id, reason);
            break;
          default:
            throw new Error(`Bulk resend not supported for email type: ${emailType}`);
        }
        
        results.push({ userId, success: true, resendId: result.resendId });
      } catch (error) {
        errors.push({ userId, success: false, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk resend completed. ${results.length} successful, ${errors.length} failed`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: userIds.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get resend statistics
 */
exports.getResendStats = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const EmailResendLog = require('../models/emailResendLog.model');

    const stats = await EmailResendLog.aggregate([
      {
        $match: {
          recipientUserId: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$emailType',
          count: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
          },
          lastResent: { $max: '$createdAt' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      message: 'Resend statistics retrieved successfully',
      data: {
        period: `${days} days`,
        stats,
        summary: {
          totalResends: stats.reduce((sum, stat) => sum + stat.count, 0),
          totalSuccessful: stats.reduce((sum, stat) => sum + stat.successful, 0),
          totalFailed: stats.reduce((sum, stat) => sum + stat.failed, 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};