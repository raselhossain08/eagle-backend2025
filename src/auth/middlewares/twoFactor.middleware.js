const TwoFactorService = require('../services/twoFactor.service');
const User = require('../../user/models/publicUser.model');
const AuditLog = require('../../admin/models/auditLog.model');

/**
 * Middleware to require 2FA verification for sensitive operations
 */
const requireTwoFactorVerification = (operation = 'general') => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Check if user has 2FA enabled
      const user = await User.findById(userId).select('isTwoFactorEnabled');
      
      if (!user?.isTwoFactorEnabled) {
        // User doesn't have 2FA enabled, proceed normally
        return next();
      }

      // Check if operation requires 2FA
      const requirement = await TwoFactorService.requireTwoFactorForOperation(userId, operation);
      
      if (!requirement.requiresTwoFactor) {
        return next();
      }

      // Check for 2FA verification in session or headers
      const twoFactorToken = req.headers['x-2fa-token'] || req.body.twoFactorToken;
      
      if (!twoFactorToken) {
        return res.status(403).json({
          success: false,
          message: 'Two-factor authentication required for this operation',
          requiresTwoFactor: true,
          operation
        });
      }

      // Verify the 2FA token
      const verification = await TwoFactorService.verifyToken(userId, twoFactorToken);
      
      if (!verification.valid) {
        await AuditLog.logAction({
          userId,
          action: 'two_factor_auth_failed',
          resource: 'security',
          description: `Failed 2FA verification for operation: ${operation}`,
          success: false,
          metadata: { operation }
        });

        return res.status(403).json({
          success: false,
          message: 'Invalid two-factor authentication token',
          requiresTwoFactor: true,
          operation
        });
      }

      // Log successful 2FA verification
      await AuditLog.logAction({
        userId,
        action: 'two_factor_auth_success',
        resource: 'security',
        description: `Successful 2FA verification for operation: ${operation}`,
        success: true,
        metadata: { operation }
      });

      // Add verification info to request
      req.twoFactorVerified = true;
      req.verifiedOperation = operation;
      
      next();
    } catch (error) {
      console.error('2FA Middleware Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying two-factor authentication',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to check if user has 2FA enabled
 */
const checkTwoFactorEnabled = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('isTwoFactorEnabled');
    
    req.user.hasTwoFactor = user?.isTwoFactorEnabled || false;
    next();
  } catch (error) {
    console.error('Check 2FA Error:', error);
    req.user.hasTwoFactor = false;
    next();
  }
};

/**
 * Middleware to enforce 2FA for admin users
 */
const enforceAdminTwoFactor = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user is admin
    const isAdmin = req.user.roles?.includes('admin') || req.user.isAdmin;
    
    if (!isAdmin) {
      return next(); // Not admin, proceed normally
    }

    // Check if admin has 2FA enabled
    const user = await User.findById(userId).select('isTwoFactorEnabled');
    
    if (!user?.isTwoFactorEnabled) {
      await AuditLog.logAction({
        userId,
        action: 'admin_2fa_required',
        resource: 'security',
        description: 'Admin attempted to access system without 2FA enabled',
        success: false
      });

      return res.status(403).json({
        success: false,
        message: 'Two-factor authentication is required for admin accounts',
        requiresSetup: true,
        adminEnforcement: true
      });
    }

    next();
  } catch (error) {
    console.error('Admin 2FA Enforcement Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enforcing admin 2FA requirements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Middleware for audit log export with 2FA
 */
const auditLogExportProtection = requireTwoFactorVerification('audit_log_export');

/**
 * Middleware for security settings changes
 */
const securitySettingsProtection = requireTwoFactorVerification('security_settings_change');

/**
 * Middleware for user role modifications
 */
const userRoleProtection = requireTwoFactorVerification('user_role_modification');

/**
 * Middleware for system configuration changes
 */
const systemConfigProtection = requireTwoFactorVerification('system_configuration_change');

module.exports = {
  requireTwoFactorVerification,
  checkTwoFactorEnabled,
  enforceAdminTwoFactor,
  auditLogExportProtection,
  securitySettingsProtection,
  userRoleProtection,
  systemConfigProtection
};