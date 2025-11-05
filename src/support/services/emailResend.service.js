/**
 * Eagle Email Resend Service
 * Handles resending various types of emails with rate limiting
 */

const EmailResendLog = require('../models/emailResendLog.model');
const User = require('../../models/user.model');
const emailService = require('../../services/emailService');
const createError = require('http-errors');

class EmailResendService {
  /**
   * Resend verification email
   */
  static async resendVerification(userId, requestedBy, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw createError(404, 'User not found');
      }

      if (user.isEmailVerified) {
        throw createError(400, 'Email is already verified');
      }

      // Check rate limit
      const rateLimit = await EmailResendLog.checkRateLimit(userId, 'VERIFICATION');
      if (!rateLimit.allowed) {
        throw createError(429, `Rate limit exceeded. Daily: ${rateLimit.dailyCount}/${rateLimit.dailyLimit}, Hourly: ${rateLimit.hourlyCount}/${rateLimit.hourlyLimit}`);
      }

      // Create resend log
      const resendLog = new EmailResendLog({
        recipientUserId: userId,
        recipientEmail: user.email,
        emailType: 'VERIFICATION',
        reason,
        requestedBy,
        emailData: {
          subject: 'Verify Your Eagle Account',
          template: 'verification'
        }
      });

      await resendLog.save();

      // Send email
      await emailService.sendVerificationEmail(user);
      await resendLog.markAsSent();

      return {
        success: true,
        message: 'Verification email sent successfully',
        resendId: resendLog._id,
        rateLimit
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resend receipt email
   */
  static async resendReceipt(userId, transactionId, requestedBy, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw createError(404, 'User not found');
      }

      // Check rate limit
      const rateLimit = await EmailResendLog.checkRateLimit(userId, 'RECEIPT');
      if (!rateLimit.allowed) {
        throw createError(429, `Rate limit exceeded. Daily: ${rateLimit.dailyCount}/${rateLimit.dailyLimit}, Hourly: ${rateLimit.hourlyCount}/${rateLimit.hourlyLimit}`);
      }

      // Create resend log
      const resendLog = new EmailResendLog({
        recipientUserId: userId,
        recipientEmail: user.email,
        emailType: 'RECEIPT',
        reason,
        requestedBy,
        emailData: {
          subject: 'Payment Receipt - Eagle Investors',
          template: 'receipt',
          variables: { transactionId }
        }
      });

      await resendLog.save();

      // Send receipt email (you'll need to implement this in emailService)
      await emailService.sendPaymentReceipt(user, transactionId);
      await resendLog.markAsSent();

      return {
        success: true,
        message: 'Receipt email sent successfully',
        resendId: resendLog._id,
        rateLimit
      };
    } catch (error) {
      if (resendLog) {
        await resendLog.markAsFailed(error.message);
      }
      throw error;
    }
  }

  /**
   * Resend contract link
   */
  static async resendContractLink(userId, contractId, requestedBy, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw createError(404, 'User not found');
      }

      // Check rate limit
      const rateLimit = await EmailResendLog.checkRateLimit(userId, 'CONTRACT_LINK');
      if (!rateLimit.allowed) {
        throw createError(429, `Rate limit exceeded. Daily: ${rateLimit.dailyCount}/${rateLimit.dailyLimit}, Hourly: ${rateLimit.hourlyCount}/${rateLimit.hourlyLimit}`);
      }

      // Create resend log
      const resendLog = new EmailResendLog({
        recipientUserId: userId,
        recipientEmail: user.email,
        emailType: 'CONTRACT_LINK',
        reason,
        requestedBy,
        emailData: {
          subject: 'Your Contract Link - Eagle Investors',
          template: 'contract_link',
          variables: { contractId }
        }
      });

      await resendLog.save();

      // Send contract link email
      await emailService.sendContractLink(user, contractId);
      await resendLog.markAsSent();

      return {
        success: true,
        message: 'Contract link email sent successfully',
        resendId: resendLog._id,
        rateLimit
      };
    } catch (error) {
      if (resendLog) {
        await resendLog.markAsFailed(error.message);
      }
      throw error;
    }
  }

  /**
   * Resend password reset email
   */
  static async resendPasswordReset(email, requestedBy, reason) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw createError(404, 'User not found');
      }

      // Check rate limit
      const rateLimit = await EmailResendLog.checkRateLimit(user._id, 'PASSWORD_RESET');
      if (!rateLimit.allowed) {
        throw createError(429, `Rate limit exceeded. Daily: ${rateLimit.dailyCount}/${rateLimit.dailyLimit}, Hourly: ${rateLimit.hourlyCount}/${rateLimit.hourlyLimit}`);
      }

      // Create resend log
      const resendLog = new EmailResendLog({
        recipientUserId: user._id,
        recipientEmail: user.email,
        emailType: 'PASSWORD_RESET',
        reason,
        requestedBy,
        emailData: {
          subject: 'Password Reset - Eagle Investors',
          template: 'password_reset'
        }
      });

      await resendLog.save();

      // Send password reset email
      await emailService.sendPasswordResetEmail(user);
      await resendLog.markAsSent();

      return {
        success: true,
        message: 'Password reset email sent successfully',
        resendId: resendLog._id,
        rateLimit
      };
    } catch (error) {
      if (resendLog) {
        await resendLog.markAsFailed(error.message);
      }
      throw error;
    }
  }

  /**
   * Resend welcome email
   */
  static async resendWelcome(userId, requestedBy, reason) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw createError(404, 'User not found');
      }

      // Check rate limit
      const rateLimit = await EmailResendLog.checkRateLimit(userId, 'WELCOME');
      if (!rateLimit.allowed) {
        throw createError(429, `Rate limit exceeded. Daily: ${rateLimit.dailyCount}/${rateLimit.dailyLimit}, Hourly: ${rateLimit.hourlyCount}/${rateLimit.hourlyLimit}`);
      }

      // Create resend log
      const resendLog = new EmailResendLog({
        recipientUserId: userId,
        recipientEmail: user.email,
        emailType: 'WELCOME',
        reason,
        requestedBy,
        emailData: {
          subject: 'Welcome to Eagle Investors!',
          template: 'welcome'
        }
      });

      await resendLog.save();

      // Send welcome email
      await emailService.sendWelcomeEmail(user);
      await resendLog.markAsSent();

      return {
        success: true,
        message: 'Welcome email sent successfully',
        resendId: resendLog._id,
        rateLimit
      };
    } catch (error) {
      if (resendLog) {
        await resendLog.markAsFailed(error.message);
      }
      throw error;
    }
  }

  /**
   * Get resend history for a user
   */
  static async getResendHistory(userId, limit = 50) {
    try {
      const history = await EmailResendLog.getResendHistory(userId, limit);
      return {
        success: true,
        data: history,
        total: history.length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get available email types for resending
   */
  static getAvailableEmailTypes() {
    return [
      {
        type: 'VERIFICATION',
        name: 'Email Verification',
        description: 'Resend email verification link',
        rateLimit: { daily: 3, hourly: 1 }
      },
      {
        type: 'RECEIPT',
        name: 'Payment Receipt',
        description: 'Resend payment receipt',
        rateLimit: { daily: 5, hourly: 2 }
      },
      {
        type: 'CONTRACT_LINK',
        name: 'Contract Link',
        description: 'Resend contract signing link',
        rateLimit: { daily: 10, hourly: 3 }
      },
      {
        type: 'PASSWORD_RESET',
        name: 'Password Reset',
        description: 'Resend password reset link',
        rateLimit: { daily: 5, hourly: 2 }
      },
      {
        type: 'WELCOME',
        name: 'Welcome Email',
        description: 'Resend welcome email',
        rateLimit: { daily: 2, hourly: 1 }
      }
    ];
  }

  /**
   * Check rate limits for all email types for a user
   */
  static async checkAllRateLimits(userId) {
    try {
      const emailTypes = ['VERIFICATION', 'RECEIPT', 'CONTRACT_LINK', 'PASSWORD_RESET', 'WELCOME'];
      const rateLimits = {};

      for (const type of emailTypes) {
        rateLimits[type] = await EmailResendLog.checkRateLimit(userId, type);
      }

      return {
        success: true,
        data: rateLimits
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = EmailResendService;