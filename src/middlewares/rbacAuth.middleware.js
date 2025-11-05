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
    
    // Get user data (implement based on your user system)
    const User = require('../models/user.model');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid - user not found'
      });
    }

    // Set user info in request
    req.user = user;
    req.user.roles = user.roles || ['user']; // Default role if not specified
    
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