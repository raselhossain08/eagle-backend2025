const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const UserRole = require('../models/userRole.model');
const AuditLog = require('../models/auditLog.model');

/**
 * RBAC Middleware for checking permissions
 * Super Admin bypasses all permission checks
 */
class RBACMiddleware {
  
  /**
   * Check if user has specific permission
   * @param {String} resource - Resource name (e.g., 'billing', 'users')
   * @param {String} action - Action name (e.g., 'create', 'read', 'update', 'delete')
   */
  static checkPermission(resource, action) {
    return async (req, res, next) => {
      try {
        const userId = req.user.id;
        const user = req.user;

        // Log the permission check attempt
        await AuditLog.create({
          userId,
          action: 'permission_check',
          resource: `${resource}:${action}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: {
            requestedResource: resource,
            requestedAction: action,
            endpoint: req.originalUrl,
            method: req.method
          }
        });

        // Super Admin bypasses all permission checks
        if (await RBACMiddleware.isSuperAdmin(userId)) {
          return next();
        }

        // Check if user has the required permission
        const hasPermission = await RBACMiddleware.userHasPermission(userId, resource, action);
        
        if (!hasPermission) {
          // Log access denied
          await AuditLog.create({
            userId,
            action: 'access_denied',
            resource: `${resource}:${action}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: false,
            errorMessage: 'Insufficient permissions',
            details: {
              requestedResource: resource,
              requestedAction: action,
              endpoint: req.originalUrl,
              method: req.method
            }
          });

          return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient permissions.',
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              resource,
              action,
              required: `${resource}:${action}`
            }
          });
        }

        next();
      } catch (error) {
        console.error('RBAC Permission Check Error:', error);
        
        // Log the error
        await AuditLog.create({
          userId: req.user?.id,
          action: 'permission_check',
          resource: `${resource}:${action}`,
          success: false,
          errorMessage: error.message,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(500).json({
          success: false,
          message: 'Internal server error during permission check',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Permission check failed'
        });
      }
    };
  }

  /**
   * Check if user has any of the specified roles
   * @param {Array} allowedRoles - Array of role names
   */
  static checkRole(allowedRoles = []) {
    return async (req, res, next) => {
      try {
        const userId = req.user.id;

        // Super Admin bypasses role checks
        if (await RBACMiddleware.isSuperAdmin(userId)) {
          return next();
        }

        const userRoles = await RBACMiddleware.getUserRoles(userId);
        const userRoleNames = userRoles.map(role => role.name);

        const hasRole = allowedRoles.some(role => userRoleNames.includes(role));

        if (!hasRole) {
          await AuditLog.create({
            userId,
            action: 'access_denied',
            resource: 'role_check',
            success: false,
            errorMessage: 'Insufficient role privileges',
            details: {
              allowedRoles,
              userRoles: userRoleNames,
              endpoint: req.originalUrl
            }
          });

          return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient role privileges.',
            error: {
              code: 'INSUFFICIENT_ROLE',
              allowedRoles,
              userRoles: userRoleNames
            }
          });
        }

        next();
      } catch (error) {
        console.error('RBAC Role Check Error:', error);
        return res.status(500).json({
          success: false,
          message: 'Internal server error during role check'
        });
      }
    };
  }

  /**
   * Check if user is Super Admin
   * @param {String} userId 
   * @returns {Boolean}
   */
  static async isSuperAdmin(userId) {
    try {
      const userRoles = await UserRole.find({ 
        userId, 
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }).populate('roleId');

      return userRoles.some(userRole => 
        userRole.roleId && userRole.roleId.name === 'super_admin'
      );
    } catch (error) {
      console.error('Error checking super admin status:', error);
      return false;
    }
  }

  /**
   * Get all active roles for a user
   * @param {String} userId 
   * @returns {Array} Array of role objects
   */
  static async getUserRoles(userId) {
    try {
      const userRoles = await UserRole.find({ 
        userId, 
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }).populate('roleId');

      return userRoles
        .filter(userRole => userRole.roleId && userRole.roleId.isActive)
        .map(userRole => userRole.roleId);
    } catch (error) {
      console.error('Error getting user roles:', error);
      return [];
    }
  }

  /**
   * Check if user has specific permission
   * @param {String} userId 
   * @param {String} resource 
   * @param {String} action 
   * @returns {Boolean}
   */
  static async userHasPermission(userId, resource, action) {
    try {
      const userRoles = await RBACMiddleware.getUserRoles(userId);
      
      for (const role of userRoles) {
        const permissions = await Permission.find({
          _id: { $in: role.permissions },
          resource,
          action,
          isActive: true
        });

        if (permissions.length > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user (aggregated from all roles)
   * @param {String} userId 
   * @returns {Array} Array of permission objects
   */
  static async getUserPermissions(userId) {
    try {
      const userRoles = await RBACMiddleware.getUserRoles(userId);
      let allPermissions = [];

      for (const role of userRoles) {
        const permissions = await Permission.find({
          _id: { $in: role.permissions },
          isActive: true
        });
        allPermissions = allPermissions.concat(permissions);
      }

      // Remove duplicates
      const uniquePermissions = allPermissions.filter((permission, index, self) =>
        index === self.findIndex(p => p._id.toString() === permission._id.toString())
      );

      return uniquePermissions;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Middleware to inject user permissions into request object
   */
  static async injectUserPermissions(req, res, next) {
    try {
      if (req.user && req.user.id) {
        req.userRoles = await RBACMiddleware.getUserRoles(req.user.id);
        req.userPermissions = await RBACMiddleware.getUserPermissions(req.user.id);
        req.isSuperAdmin = await RBACMiddleware.isSuperAdmin(req.user.id);
      }
      next();
    } catch (error) {
      console.error('Error injecting user permissions:', error);
      next(); // Continue without permissions if there's an error
    }
  }
}

module.exports = RBACMiddleware;