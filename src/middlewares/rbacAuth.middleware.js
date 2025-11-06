const jwt = require('jsonwebtoken');

/**
 * RBAC Authentication Middleware
 * Provides role-based access control for contract management
 */

/**
 * Extract user info and roles from JWT token
 */
exports.authRBAC = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '') ||
      req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to get admin user first, then fall back to regular user
    const AdminUser = require('../admin/models/adminUser.model');
    const User = require('../user/models/user.model');

    let user = await AdminUser.findById(decoded.id);
    let isAdmin = true;

    if (!user) {
      // Try regular user model
      user = await User.findById(decoded.id);
      isAdmin = false;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid - user not found'
      });
    }

    // Set user info in request
    req.user = user;

    // Set roles based on user type
    if (isAdmin) {
      // Admin users: use adminLevel as role
      req.user.roles = [user.adminLevel];
    } else {
      // Regular users: use role field
      req.user.roles = [user.role || 'user'];
    }

    next();
  } catch (error) {
    console.error('RBAC Auth Error:', error);
    res.status(401).json({
      success: false,
      message: 'Token is not valid',
      error: error.message
    });
  }
};

/**
 * Require specific roles
 * Note: super_admin role automatically has access to all routes
 */
exports.requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user has required roles
      if (!req.user || !req.user.roles) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - no roles found'
        });
      }

      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];

      // super_admin has access to everything
      if (userRoles.includes('super_admin')) {
        return next();
      }

      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          message: `Access denied - requires one of: ${allowedRoles.join(', ')}`,
          userRoles: userRoles,
          requiredRoles: allowedRoles
        });
      }

      next();
    } catch (error) {
      console.error('Role Check Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking user roles',
        error: error.message
      });
    }
  };
};

/**
 * Admin only access
 */
exports.adminOnly = (req, res, next) => {
  return exports.requireRole(['admin'])(req, res, next);
};

/**
 * Manager or Admin access
 */
exports.managerOrAdmin = (req, res, next) => {
  return exports.requireRole(['admin', 'manager'])(req, res, next);
};

/**
 * Support, Manager, or Admin access
 */
exports.supportOrHigher = (req, res, next) => {
  return exports.requireRole(['admin', 'manager', 'support'])(req, res, next);
};