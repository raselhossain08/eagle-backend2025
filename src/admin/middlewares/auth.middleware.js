const jwt = require('jsonwebtoken');
const AdminUser = require('../models/adminUser.model');
const createError = require('http-errors');

/**
 * Admin Authentication Middleware
 * Validates admin JWT tokens and ensures proper access control
 */
class AdminAuthMiddleware {

  /**
   * Verify Admin JWT Token
   */
  static async verifyToken(req, res, next) {
    try {
      let token;

      // Check for token in Authorization header
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }
      // Check for token in cookies
      else if (req.cookies.adminToken) {
        token = req.cookies.adminToken;
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided.'
        });
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Ensure it's an admin token
        if (decoded.type !== 'admin') {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Admin access required.'
          });
        }

        // Get admin user from database
        const adminUser = await AdminUser.findById(decoded.id)
          .select('-password -twoFactorSecret -passwordResetToken -activationToken');

        if (!adminUser) {
          return res.status(401).json({
            success: false,
            message: 'Admin user not found. Please login again.'
          });
        }

        // Check if admin is active
        if (!adminUser.isActive) {
          return res.status(401).json({
            success: false,
            message: 'Account has been deactivated.'
          });
        }

        // Check if password was changed after token was issued
        if (adminUser.changedPasswordAfter(decoded.iat)) {
          return res.status(401).json({
            success: false,
            message: 'Password was recently changed. Please login again.'
          });
        }

        // Add admin user to request object
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

        next();
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Token has expired. Please login again.',
            expired: true
          });
        } else if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            message: 'Invalid token. Please login again.'
          });
        } else {
          throw jwtError;
        }
      }
    } catch (error) {
      console.error('Admin Auth Middleware Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed'
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

module.exports = AdminAuthMiddleware;