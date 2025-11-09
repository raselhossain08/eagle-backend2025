const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const User = require('../../user/models/publicUser.model');
const AuditLog = require('../../admin/models/auditLog.model');

class TwoFactorService {
  /**
   * Generate 2FA secret for user
   */
  static async generateSecret(userId, userEmail) {
    try {
      const secret = speakeasy.generateSecret({
        name: `Eagle Platform (${userEmail})`,
        issuer: 'Eagle Platform',
        length: 32
      });

      // Store the temporary secret in user record
      await User.findByIdAndUpdate(userId, {
        $set: {
          twoFactorSecret: secret.base32,
          isTwoFactorEnabled: false // Not enabled until verified
        }
      });

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      // Log the action
      await AuditLog.logAction({
        userId,
        action: 'two_factor_setup_initiated',
        resource: 'user_security',
        description: '2FA setup initiated',
        metadata: {
          userEmail,
          timestamp: new Date()
        }
      });

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes: this.generateBackupCodes()
      };
    } catch (error) {
      throw new Error(`Failed to generate 2FA secret: ${error.message}`);
    }
  }

  /**
   * Verify 2FA token and enable 2FA
   */
  static async enableTwoFactor(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.twoFactorSecret) {
        throw new Error('2FA setup not initiated for this user');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2 // Allow for clock drift
      });

      if (!verified) {
        await AuditLog.logAction({
          userId,
          action: 'two_factor_verify_failed',
          resource: 'user_security',
          description: 'Failed 2FA verification attempt',
          success: false
        });
        throw new Error('Invalid verification code');
      }

      // Enable 2FA
      await User.findByIdAndUpdate(userId, {
        $set: {
          isTwoFactorEnabled: true
        }
      });

      // Log successful enablement
      await AuditLog.logAction({
        userId,
        action: 'two_factor_enabled',
        resource: 'user_security',
        description: '2FA successfully enabled',
        success: true
      });

      return { success: true, message: '2FA enabled successfully' };
    } catch (error) {
      throw new Error(`Failed to enable 2FA: ${error.message}`);
    }
  }

  /**
   * Disable 2FA for user
   */
  static async disableTwoFactor(userId, password, token) {
    try {
      const user = await User.findById(userId).select('+password +twoFactorSecret');
      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      // Verify 2FA token if enabled
      if (user.isTwoFactorEnabled && user.twoFactorSecret) {
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token,
          window: 2
        });

        if (!verified) {
          await AuditLog.logAction({
            userId,
            action: 'two_factor_disable_failed',
            resource: 'user_security',
            description: 'Failed 2FA disable attempt - invalid token',
            success: false
          });
          throw new Error('Invalid 2FA token');
        }
      }

      // Disable 2FA
      await User.findByIdAndUpdate(userId, {
        $set: {
          isTwoFactorEnabled: false,
          twoFactorSecret: null
        }
      });

      // Log the action
      await AuditLog.logAction({
        userId,
        action: 'two_factor_disabled',
        resource: 'user_security',
        description: '2FA successfully disabled',
        success: true
      });

      return { success: true, message: '2FA disabled successfully' };
    } catch (error) {
      throw new Error(`Failed to disable 2FA: ${error.message}`);
    }
  }

  /**
   * Verify 2FA token
   */
  static async verifyToken(userId, token) {
    try {
      const user = await User.findById(userId).select('twoFactorSecret isTwoFactorEnabled');
      
      if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
        return { valid: false, message: '2FA not enabled for this user' };
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (verified) {
        await AuditLog.logAction({
          userId,
          action: 'two_factor_verified',
          resource: 'user_security',
          description: '2FA token verified successfully',
          success: true
        });
        return { valid: true, message: 'Token verified successfully' };
      } else {
        await AuditLog.logAction({
          userId,
          action: 'two_factor_verify_failed',
          resource: 'user_security',
          description: 'Invalid 2FA token provided',
          success: false
        });
        return { valid: false, message: 'Invalid token' };
      }
    } catch (error) {
      throw new Error(`Failed to verify 2FA token: ${error.message}`);
    }
  }

  /**
   * Generate backup codes
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Get 2FA status for user
   */
  static async getTwoFactorStatus(userId) {
    try {
      const user = await User.findById(userId).select('isTwoFactorEnabled');
      return {
        enabled: user?.isTwoFactorEnabled || false,
        setupInProgress: !!(user?.twoFactorSecret && !user?.isTwoFactorEnabled)
      };
    } catch (error) {
      throw new Error(`Failed to get 2FA status: ${error.message}`);
    }
  }

  /**
   * Require 2FA verification for sensitive operations
   */
  static async requireTwoFactorForOperation(userId, operation) {
    try {
      const sensitiveOperations = [
        'audit_log_export',
        'security_settings_change',
        'user_role_modification',
        'system_configuration_change'
      ];

      const user = await User.findById(userId).select('isTwoFactorEnabled');
      
      if (sensitiveOperations.includes(operation) && user?.isTwoFactorEnabled) {
        return { requiresTwoFactor: true, message: 'This operation requires 2FA verification' };
      }

      return { requiresTwoFactor: false };
    } catch (error) {
      throw new Error(`Failed to check 2FA requirement: ${error.message}`);
    }
  }

  /**
   * Generate emergency access codes
   */
  static async generateEmergencyAccess(userId, adminUserId) {
    try {
      const emergencyCode = crypto.randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store emergency access code
      await User.findByIdAndUpdate(userId, {
        $set: {
          emergencyAccess: {
            code: emergencyCode,
            generatedBy: adminUserId,
            expiresAt,
            used: false
          }
        }
      });

      // Log the action
      await AuditLog.logAction({
        userId: adminUserId,
        action: 'emergency_access_generated',
        resource: 'user_security',
        description: `Emergency access code generated for user ${userId}`,
        metadata: {
          targetUserId: userId,
          expiresAt
        }
      });

      return {
        emergencyCode,
        expiresAt,
        instructions: 'This code allows one-time bypass of 2FA and expires in 24 hours'
      };
    } catch (error) {
      throw new Error(`Failed to generate emergency access: ${error.message}`);
    }
  }
}

module.exports = TwoFactorService;