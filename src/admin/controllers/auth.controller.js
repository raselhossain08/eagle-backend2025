const AdminUser = require('../models/adminUser.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

/**
 * Admin Authentication Controller
 * Handles admin-specific login, 2FA, password management, and security features
 */
class AdminAuthController {

  /**
   * Admin Login
   * Enhanced security with account lockouts, login attempts tracking, and 2FA support
   */
  static async login(req, res, next) {
    try {
      const { email, username, password, twoFactorCode } = req.body;
      const identifier = email || username;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide email/username and password'
        });
      }

      // Find admin user by email or username
      const adminUser = await AdminUser.findByEmailOrUsername(identifier);

      if (!adminUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is active
      if (!adminUser.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated. Please contact system administrator.'
        });
      }

      // Check if account is locked
      if (adminUser.isLocked) {
        return res.status(423).json({
          success: false,
          message: `Account is locked due to too many failed login attempts. Please try again later.`,
          lockUntil: adminUser.lockUntil
        });
      }

      // Verify password
      const isPasswordValid = await adminUser.comparePassword(password);

      if (!isPasswordValid) {
        // Increment failed login attempts
        await adminUser.incLoginAttempts();

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          attemptsRemaining: Math.max(0, 5 - (adminUser.loginAttempts + 1))
        });
      }

      // Check if 2FA is enabled
      if (adminUser.isTwoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(200).json({
            success: false,
            requiresTwoFactor: true,
            email: adminUser.email,
            message: 'Two-factor authentication code required'
          });
        }

        // Verify 2FA code
        const isValidToken = speakeasy.totp.verify({
          secret: adminUser.twoFactorSecret,
          encoding: 'ascii',
          token: twoFactorCode,
          window: 2 // Allow 2 time steps tolerance
        });

        if (!isValidToken) {
          return res.status(401).json({
            success: false,
            message: 'Invalid two-factor authentication code'
          });
        }
      }

      // Reset login attempts on successful login
      if (adminUser.loginAttempts > 0) {
        await adminUser.resetLoginAttempts();
      }

      // Update last login info
      adminUser.lastLoginAt = new Date();
      adminUser.lastLoginIP = req.ip || req.connection.remoteAddress;
      await adminUser.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          id: adminUser._id,
          email: adminUser.email,
          username: adminUser.username,
          adminLevel: adminUser.adminLevel,
          department: adminUser.department,
          type: 'admin'
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '8h', // Admin sessions expire in 8 hours
          issuer: 'eagle-admin-dashboard',
          audience: 'eagle-admin-users'
        }
      );

      // Set secure HTTP-only cookie (backend authentication)
      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });

      // IMPORTANT: Also set a JavaScript-accessible cookie for the frontend
      // This is safe because the token is also sent in the response body
      res.cookie('admin_token', token, {
        httpOnly: false,  // Allow JavaScript access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });

      // Prepare response data (exclude sensitive information)
      const responseData = {
        id: adminUser._id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        fullName: adminUser.fullName,
        email: adminUser.email,
        username: adminUser.username,
        adminLevel: adminUser.adminLevel,
        department: adminUser.department,
        permissions: adminUser.permissions,
        profilePicture: adminUser.profilePicture,
        forcePasswordChange: adminUser.forcePasswordChange,
        isTwoFactorEnabled: adminUser.isTwoFactorEnabled,
        lastLoginAt: adminUser.lastLoginAt
      };

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: responseData,
        expiresIn: 8 * 60 * 60 // 8 hours in seconds
      });

    } catch (error) {
      console.error('Admin Login Error:', error);
      next(createError(500, 'Login failed. Please try again.'));
    }
  }

  /**
   * Admin Login with 2FA
   * Separate endpoint for 2FA verification
   */
  static async loginWith2FA(req, res, next) {
    try {
      const { email, token: twoFactorCode } = req.body;

      if (!email || !twoFactorCode) {
        return res.status(400).json({
          success: false,
          message: 'Email and two-factor code are required'
        });
      }

      const adminUser = await AdminUser.findOne({ email: email.toLowerCase() });

      if (!adminUser || !adminUser.isTwoFactorEnabled) {
        return res.status(401).json({
          success: false,
          message: 'Invalid request'
        });
      }

      // Check for backup code first
      let isValidToken = false;
      let usedBackupCode = false;

      // Check if it's a backup code (8 characters)
      if (twoFactorCode.length === 8) {
        // This would require implementing backup codes in the model
        // For now, we'll just check the TOTP
        isValidToken = speakeasy.totp.verify({
          secret: adminUser.twoFactorSecret,
          encoding: 'ascii',
          token: twoFactorCode,
          window: 2
        });
      } else {
        // Regular TOTP verification
        isValidToken = speakeasy.totp.verify({
          secret: adminUser.twoFactorSecret,
          encoding: 'ascii',
          token: twoFactorCode,
          window: 2
        });
      }

      if (!isValidToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication code'
        });
      }

      // Update last login info
      adminUser.lastLoginAt = new Date();
      adminUser.lastLoginIP = req.ip || req.connection.remoteAddress;
      await adminUser.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          id: adminUser._id,
          email: adminUser.email,
          username: adminUser.username,
          adminLevel: adminUser.adminLevel,
          department: adminUser.department,
          type: 'admin'
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '8h',
          issuer: 'eagle-admin-dashboard',
          audience: 'eagle-admin-users'
        }
      );

      // Set secure HTTP-only cookie (backend authentication)
      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });

      // IMPORTANT: Also set a JavaScript-accessible cookie for the frontend
      res.cookie('admin_token', token, {
        httpOnly: false,  // Allow JavaScript access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });      // Prepare response data
      const responseData = {
        id: adminUser._id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        fullName: adminUser.fullName,
        email: adminUser.email,
        username: adminUser.username,
        adminLevel: adminUser.adminLevel,
        department: adminUser.department,
        permissions: adminUser.permissions,
        profilePicture: adminUser.profilePicture,
        forcePasswordChange: adminUser.forcePasswordChange,
        isTwoFactorEnabled: adminUser.isTwoFactorEnabled,
        lastLoginAt: adminUser.lastLoginAt
      };

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication successful',
        token,
        user: responseData,
        usedBackupCode,
        expiresIn: 8 * 60 * 60
      });

    } catch (error) {
      console.error('Admin 2FA Login Error:', error);
      next(createError(500, '2FA verification failed. Please try again.'));
    }
  }

  /**
   * Get Admin Profile
   */
  static async getProfile(req, res, next) {
    try {
      const adminUser = await AdminUser.findById(req.user.id)
        .select('-password -twoFactorSecret -passwordResetToken -activationToken')
        .populate('createdBy', 'firstName lastName email username')
        .populate('updatedBy', 'firstName lastName email username');

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      res.status(200).json({
        success: true,
        user: adminUser
      });

    } catch (error) {
      console.error('Get Admin Profile Error:', error);
      next(createError(500, 'Failed to fetch profile'));
    }
  }

  /**
   * Setup Two-Factor Authentication
   */
  static async setup2FA(req, res, next) {
    try {
      const adminUser = await AdminUser.findById(req.user.id);

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      if (adminUser.isTwoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Two-factor authentication is already enabled'
        });
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Eagle Admin Dashboard (${adminUser.email})`,
        issuer: 'Eagle Dashboard',
        length: 20
      });

      // Store temporary secret (not yet confirmed)
      adminUser.metadata.tempTwoFactorSecret = secret.ascii;
      await adminUser.save();

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.status(200).json({
        success: true,
        data: {
          secret: secret.ascii,
          qrCodeUrl,
          backupCodes: [], // TODO: Generate backup codes
          manualEntryKey: secret.ascii
        }
      });

    } catch (error) {
      console.error('Setup 2FA Error:', error);
      next(createError(500, 'Failed to setup 2FA'));
    }
  }

  /**
   * Confirm Two-Factor Authentication Setup
   */
  static async confirm2FA(req, res, next) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const adminUser = await AdminUser.findById(req.user.id);

      if (!adminUser || !adminUser.metadata.tempTwoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: 'No pending 2FA setup found'
        });
      }

      // Verify the token
      const isValidToken = speakeasy.totp.verify({
        secret: adminUser.metadata.tempTwoFactorSecret,
        encoding: 'ascii',
        token,
        window: 2
      });

      if (!isValidToken) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification token'
        });
      }

      // Enable 2FA
      adminUser.twoFactorSecret = adminUser.metadata.tempTwoFactorSecret;
      adminUser.isTwoFactorEnabled = true;
      delete adminUser.metadata.tempTwoFactorSecret;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication enabled successfully'
      });

    } catch (error) {
      console.error('Confirm 2FA Error:', error);
      next(createError(500, 'Failed to confirm 2FA'));
    }
  }

  /**
   * Disable Two-Factor Authentication
   */
  static async disable2FA(req, res, next) {
    try {
      const { password, token } = req.body;

      if (!password || !token) {
        return res.status(400).json({
          success: false,
          message: 'Password and current 2FA token are required'
        });
      }

      const adminUser = await AdminUser.findById(req.user.id);

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Verify password
      const isPasswordValid = await adminUser.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }

      // Verify 2FA token
      const isValidToken = speakeasy.totp.verify({
        secret: adminUser.twoFactorSecret,
        encoding: 'ascii',
        token,
        window: 2
      });

      if (!isValidToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid 2FA token'
        });
      }

      // Disable 2FA
      adminUser.twoFactorSecret = null;
      adminUser.isTwoFactorEnabled = false;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication disabled successfully'
      });

    } catch (error) {
      console.error('Disable 2FA Error:', error);
      next(createError(500, 'Failed to disable 2FA'));
    }
  }

  /**
   * Admin Logout
   */
  static async logout(req, res) {
    try {
      // Clear both admin token cookies
      res.clearCookie('adminToken');
      res.clearCookie('admin_token');

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Admin Logout Error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }  /**
   * Force Password Change
   */
  static async forcePasswordChange(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      const adminUser = await AdminUser.findById(req.user.id);

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Verify current password
      const isPasswordValid = await adminUser.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      adminUser.password = newPassword;
      adminUser.forcePasswordChange = false;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Force Password Change Error:', error);
      next(createError(500, 'Failed to change password'));
    }
  }

  /**
   * Forgot Password - Generate reset token
   */
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const adminUser = await AdminUser.findOne({ email: email.toLowerCase() });

      if (!adminUser) {
        // Don't reveal if email exists or not
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = adminUser.createPasswordResetToken();
      await adminUser.save();

      // TODO: Send email with reset token
      // For now, return the token (remove in production)
      res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email',
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });

    } catch (error) {
      console.error('Forgot Password Error:', error);
      next(createError(500, 'Failed to process password reset request'));
    }
  }

  /**
   * Reset Password - Using reset token
   */
  static async resetPassword(req, res, next) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }

      // Hash the token to compare with stored version
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      const adminUser = await AdminUser.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!adminUser) {
        return res.status(400).json({
          success: false,
          message: 'Token is invalid or has expired'
        });
      }

      // Update password and clear reset token
      adminUser.password = password;
      adminUser.passwordResetToken = null;
      adminUser.passwordResetExpires = null;
      adminUser.forcePasswordChange = false;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      console.error('Reset Password Error:', error);
      next(createError(500, 'Failed to reset password'));
    }
  }

  /**
   * Validate Token
   */
  static async validateToken(req, res) {
    try {
      // If we reach here, the token is valid (middleware validated it)
      res.status(200).json({
        valid: true,
        user: req.user
      });
    } catch (error) {
      console.error('Validate Token Error:', error);
      res.status(401).json({
        valid: false,
        message: 'Invalid token'
      });
    }
  }
}

module.exports = AdminAuthController;