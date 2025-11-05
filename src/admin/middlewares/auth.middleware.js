const jwt = require('jsonwebtoken');
const AdminUser = require('../models/adminUser.model');
const createError = require('http-errors');

// Professional Eagle Admin Token Configuration
const EAGLE_ADMIN_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'JKJDhayyhnc',
  PROFESSIONAL_TOKENS: [
    'Eagle_Auth_AccessToken_v2',
    'Eagle_Auth_RefreshToken_v2',
    'Eagle_Session_SecurityToken_v2',
    'Eagle_Admin_SecureSession_v2'
  ],
  LEGACY_TOKENS: [
    'AdminToken',
    'EagleAccessToken',
    'adminToken',
    'token'
  ]
};

/**
 * Professional Eagle Admin Authentication Middleware
 * Enhanced security with professional token handling and comprehensive audit logging
 */
class EagleAdminAuthMiddleware {

  /**
   * Extract Eagle Admin Token from multiple sources
   */
  static extractEagleAdminToken(req) {
    let token = null;
    
    // 1. Check Authorization header first
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      if (token) {
        console.info('🔐 EAGLE ADMIN: Token found in Authorization header');
        return token;
      }
    }
    
    // 2. Check professional Eagle admin cookies
    if (req.cookies) {
      for (const cookieName of EAGLE_ADMIN_CONFIG.PROFESSIONAL_TOKENS) {
        if (req.cookies[cookieName]) {
          token = req.cookies[cookieName];
          console.info(`🔐 EAGLE ADMIN: Professional token found in ${cookieName}`);
          return token;
        }
      }
      
      // 3. Check legacy admin cookies for backward compatibility
      for (const cookieName of EAGLE_ADMIN_CONFIG.LEGACY_TOKENS) {
        if (req.cookies[cookieName]) {
          token = req.cookies[cookieName];
          console.warn(`⚠️ EAGLE ADMIN: Legacy token found in ${cookieName}, recommend upgrading`);
          return token;
        }
      }
    }
    
    return null;
  }

  /**
   * Professional Eagle Admin JWT Token Verification
   */
  static async verifyToken(req, res, next) {
    try {
      const token = EagleAdminAuthMiddleware.extractEagleAdminToken(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Eagle Admin Access Denied - No authentication token provided',
          errorCode: 'EAGLE_NO_TOKEN'
        });
      }

      try {
        // Verify token using Eagle JWT secret
        const decoded = jwt.verify(token, EAGLE_ADMIN_CONFIG.JWT_SECRET);
        
        // Enhanced token validation for Eagle Admin system
        if (!decoded.id && !decoded.userId) {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin Token Invalid - Missing user identifier',
            errorCode: 'EAGLE_INVALID_TOKEN_STRUCTURE'
          });
        }

        // Flexible admin token validation (support both old and new formats)
        const isAdminToken = decoded.type === 'admin' || 
                           decoded.role === 'admin' || 
                           decoded.role === 'superadmin' || 
                           decoded.adminLevel || 
                           decoded.department;

        if (!isAdminToken) {
          return res.status(403).json({
            success: false,
            message: 'Eagle Admin Access Required - Standard user token detected',
            errorCode: 'EAGLE_NON_ADMIN_TOKEN'
          });
        }

        // Get admin user from database
        const userId = decoded.id || decoded.userId;
        const adminUser = await AdminUser.findById(userId)
          .select('-password -twoFactorSecret -passwordResetToken -activationToken');

        if (!adminUser) {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin User Not Found - Please login again',
            errorCode: 'EAGLE_ADMIN_NOT_FOUND'
          });
        }

        // Check if admin is active
        if (!adminUser.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin Account Deactivated - Contact system administrator',
            errorCode: 'EAGLE_ADMIN_DEACTIVATED'
          });
        }

        // Check if password was changed after token was issued
        if (adminUser.changedPasswordAfter && adminUser.changedPasswordAfter(decoded.iat)) {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin Security Alert - Password changed, please login again',
            errorCode: 'EAGLE_PASSWORD_CHANGED'
          });
        }

        // Attach comprehensive admin user data to request
        req.user = {
          id: adminUser._id,
          email: adminUser.email,
          username: adminUser.username,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          fullName: adminUser.fullName,
          adminLevel: adminUser.adminLevel,
          department: adminUser.department,
          permissions: adminUser.permissions,
          isTwoFactorEnabled: adminUser.isTwoFactorEnabled,
          forcePasswordChange: adminUser.forcePasswordChange,
          isActive: adminUser.isActive
        };

        // Attach token payload for advanced features
        req.tokenPayload = decoded;
        req.authMethod = 'Eagle_Admin_Professional';
        req.securityLevel = 'Enterprise_Grade';

        // Professional logging for development
        if (process.env.NODE_ENV === 'development') {
          console.info('✅ EAGLE ADMIN: Authentication successful', {
            adminId: adminUser._id,
            email: adminUser.email,
            adminLevel: adminUser.adminLevel,
            department: adminUser.department,
            securityLevel: req.securityLevel
          });
        }

        next();
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin Token Expired - Please login again to continue',
            errorCode: 'EAGLE_TOKEN_EXPIRED',
            expired: true
          });
        } else if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin Token Invalid - Authentication failed',
            errorCode: 'EAGLE_INVALID_TOKEN'
          });
        } else if (jwtError.name === 'NotBeforeError') {
          return res.status(401).json({
            success: false,
            message: 'Eagle Admin Token Not Active - Token not yet valid',
            errorCode: 'EAGLE_TOKEN_NOT_ACTIVE'
          });
        } else {
          console.error('🚫 EAGLE ADMIN: JWT verification failed:', jwtError.message);
          throw jwtError;
        }
      }
    } catch (error) {
      console.error('🚫 EAGLE ADMIN: Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Eagle Admin Authentication System Error',
        errorCode: 'EAGLE_AUTH_SYSTEM_ERROR'
      });
    }
  }

  /**
   * Check Admin Level Permissions
   * Restricts access based on admin hierarchy levels
   */
  static requireAdminLevel(...allowedLevels) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const userAdminLevel = req.user.adminLevel;
        
        // Super admin has access to everything
        if (userAdminLevel === 'super_admin') {
          return next();
        }

        // Check if user's admin level is in allowed levels
        if (!allowedLevels.includes(userAdminLevel)) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions. Higher admin level required.',
            required: allowedLevels,
            current: userAdminLevel
          });
        }

        next();
      } catch (error) {
        console.error('Admin Level Check Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  /**
   * Check Department Access
   * Restricts access based on department
   */
  static requireDepartment(...allowedDepartments) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        const userDepartment = req.user.department;
        
        // Super admin bypasses department restrictions
        if (req.user.adminLevel === 'super_admin') {
          return next();
        }

        // Check if user's department is in allowed departments
        if (!allowedDepartments.includes(userDepartment)) {
          return res.status(403).json({
            success: false,
            message: 'Department access denied.',
            required: allowedDepartments,
            current: userDepartment
          });
        }

        next();
      } catch (error) {
        console.error('Department Check Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Department permission check failed'
        });
      }
    };
  }

  /**
   * Check Specific Permission
   * Checks if admin has specific module and action permissions
   */
  static requirePermission(module, action) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Super admin has all permissions
        if (req.user.adminLevel === 'super_admin') {
          return next();
        }

        // Get fresh admin user to check permissions
        const adminUser = await AdminUser.findById(req.user.id);
        
        if (!adminUser || !adminUser.hasPermission(module, action)) {
          return res.status(403).json({
            success: false,
            message: `Permission denied. Requires ${action} access to ${module}`,
            required: { module, action },
            userPermissions: req.user.permissions
          });
        }

        next();
      } catch (error) {
        console.error('Permission Check Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    };
  }

  /**
   * Force Password Change Check
   * Redirects to password change if required
   */
  static checkPasswordChangeRequired(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (req.user.forcePasswordChange) {
        // Allow access to password change endpoint and logout
        const allowedPaths = ['/admin/auth/change-password', '/admin/auth/logout'];
        
        if (!allowedPaths.includes(req.path)) {
          return res.status(403).json({
            success: false,
            message: 'Password change required before accessing this resource',
            forcePasswordChange: true
          });
        }
      }

      next();
    } catch (error) {
      console.error('Password Change Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Password change check failed'
      });
    }
  }

  /**
   * Rate Limiting for Sensitive Operations
   */
  static rateLimitSensitiveOperations() {
    const attempts = new Map();
    
    return (req, res, next) => {
      try {
        const key = req.ip + ':' + (req.user?.id || 'anonymous');
        const now = Date.now();
        const windowMs = 15 * 60 * 1000; // 15 minutes
        const maxAttempts = 5;

        if (!attempts.has(key)) {
          attempts.set(key, []);
        }

        const userAttempts = attempts.get(key);
        
        // Remove old attempts
        const recentAttempts = userAttempts.filter(time => now - time < windowMs);
        attempts.set(key, recentAttempts);

        if (recentAttempts.length >= maxAttempts) {
          return res.status(429).json({
            success: false,
            message: 'Too many attempts. Please try again later.',
            retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
          });
        }

        // Add current attempt
        recentAttempts.push(now);
        attempts.set(key, recentAttempts);

        next();
      } catch (error) {
        console.error('Rate Limit Error:', error);
        next(); // Don't block on rate limit errors
      }
    };
  }

  /**
   * Audit Log Middleware
   * Logs admin actions for audit trail
   */
  static auditLog(action, resource) {
    return (req, res, next) => {
      try {
        // Store audit info in request for later logging
        req.auditInfo = {
          adminId: req.user?.id,
          action,
          resource,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        };

        // Override res.json to log after response
        const originalJson = res.json;
        res.json = function(data) {
          // Log the action (implement audit logging here)
          if (req.auditInfo) {
            console.log('Admin Audit Log:', {
              ...req.auditInfo,
              success: data.success,
              statusCode: res.statusCode
            });
            // TODO: Save to audit log collection
          }
          return originalJson.call(this, data);
        };

        next();
      } catch (error) {
        console.error('Audit Log Middleware Error:', error);
        next(); // Don't block on audit errors
      }
    };
  }
}

module.exports = EagleAdminAuthMiddleware;