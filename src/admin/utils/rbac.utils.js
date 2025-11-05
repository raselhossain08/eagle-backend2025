const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const UserRole = require('../models/userRole.model');
const RBACMiddleware = require('../middlewares/rbac.middleware');

/**
 * RBAC Utility Functions
 * Helper functions for common RBAC operations
 */
class RBACUtils {

  /**
   * Validate MongoDB ObjectId
   * @param {String} id - The ID to validate
   * @param {String} fieldName - Name of the field for error messages
   * @returns {Object} Validation result
   */
  static validateObjectId(id, fieldName = 'ID') {
    if (!id) {
      return {
        valid: false,
        error: `${fieldName} is required`
      };
    }

    if (id === 'undefined' || id === 'null') {
      return {
        valid: false,
        error: `Valid ${fieldName.toLowerCase()} is required`
      };
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return {
        valid: false,
        error: `Invalid ${fieldName.toLowerCase()} format`
      };
    }

    return { valid: true };
  }

  /**
   * Validate multiple ObjectIds
   * @param {Object} ids - Object with id values and their field names
   * @returns {Object} Validation result
   */
  static validateMultipleObjectIds(ids) {
    const errors = [];
    
    for (const [fieldName, id] of Object.entries(ids)) {
      const validation = this.validateObjectId(id, fieldName);
      if (!validation.valid) {
        errors.push(validation.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get user's effective permissions (combining all roles)
   * @param {String} userId 
   * @returns {Object} Organized permissions by category
   */
  static async getUserEffectivePermissions(userId) {
    try {
      // Check if user is super admin first
      const isSuperAdmin = await RBACMiddleware.isSuperAdmin(userId);
      if (isSuperAdmin) {
        // Super admin has all permissions
        const allPermissions = await Permission.find({ isActive: true });
        return {
          isSuperAdmin: true,
          hasAllPermissions: true,
          permissions: allPermissions,
          categories: this.organizePermissionsByCategory(allPermissions)
        };
      }

      const permissions = await RBACMiddleware.getUserPermissions(userId);
      
      return {
        isSuperAdmin: false,
        hasAllPermissions: false,
        permissions,
        categories: this.organizePermissionsByCategory(permissions)
      };
    } catch (error) {
      console.error('Error getting user effective permissions:', error);
      return {
        isSuperAdmin: false,
        hasAllPermissions: false,
        permissions: [],
        categories: {}
      };
    }
  }

  /**
   * Organize permissions by category
   * @param {Array} permissions 
   * @returns {Object}
   */
  static organizePermissionsByCategory(permissions) {
    return permissions.reduce((categories, permission) => {
      if (!categories[permission.category]) {
        categories[permission.category] = {
          name: permission.category,
          permissions: []
        };
      }
      categories[permission.category].permissions.push(permission);
      return categories;
    }, {});
  }

  /**
   * Check multiple permissions at once
   * @param {String} userId 
   * @param {Array} requiredPermissions - Array of {resource, action} objects
   * @returns {Object} Results for each permission check
   */
  static async checkMultiplePermissions(userId, requiredPermissions) {
    try {
      // Super admin bypasses all checks
      if (await RBACMiddleware.isSuperAdmin(userId)) {
        const results = {};
        requiredPermissions.forEach(({ resource, action }) => {
          results[`${resource}:${action}`] = true;
        });
        return { isSuperAdmin: true, results, hasAll: true };
      }

      const results = {};
      let hasAll = true;

      for (const { resource, action } of requiredPermissions) {
        const hasPermission = await RBACMiddleware.userHasPermission(userId, resource, action);
        results[`${resource}:${action}`] = hasPermission;
        if (!hasPermission) hasAll = false;
      }

      return { isSuperAdmin: false, results, hasAll };
    } catch (error) {
      console.error('Error checking multiple permissions:', error);
      return { isSuperAdmin: false, results: {}, hasAll: false, error: error.message };
    }
  }

  /**
   * Get role hierarchy and user counts
   * @returns {Array} Roles with user counts and hierarchy
   */
  static async getRoleHierarchy() {
    try {
      const roles = await Role.find({ isActive: true })
        .populate('permissions')
        .sort({ name: 1 });

      const roleHierarchy = [];
      
      for (const role of roles) {
        const userCount = await UserRole.countDocuments({
          roleId: role._id,
          isActive: true,
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        });

        roleHierarchy.push({
          ...role.toObject(),
          userCount,
          permissionCount: role.permissions.length,
          level: this.getRoleLevel(role.name)
        });
      }

      return roleHierarchy.sort((a, b) => a.level - b.level);
    } catch (error) {
      console.error('Error getting role hierarchy:', error);
      return [];
    }
  }

  /**
   * Get role level for hierarchy (lower number = higher privilege)
   * @param {String} roleName 
   * @returns {Number}
   */
  static getRoleLevel(roleName) {
    const hierarchy = {
      'super_admin': 1,
      'finance_admin': 2,
      'growth_marketing': 3,
      'support': 4,
      'read_only': 5
    };
    return hierarchy[roleName] || 99;
  }

  /**
   * Get permission conflicts (users with conflicting roles)
   * @returns {Array} Users with potentially conflicting permissions
   */
  static async getPermissionConflicts() {
    try {
      const conflicts = await UserRole.aggregate([
        {
          $match: { 
            isActive: true,
            $or: [
              { expiresAt: null },
              { expiresAt: { $gt: new Date() } }
            ]
          }
        },
        {
          $group: {
            _id: '$userId',
            roles: { $push: '$roleId' },
            roleCount: { $sum: 1 }
          }
        },
        {
          $match: { roleCount: { $gt: 1 } } // Users with multiple roles
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'roles',
            localField: 'roles',
            foreignField: '_id',
            as: 'roleDetails'
          }
        },
        {
          $project: {
            userId: '$_id',
            user: { $arrayElemAt: ['$user', 0] },
            roles: '$roleDetails',
            roleCount: 1,
            hasConflict: {
              $or: [
                // Check for finance + marketing conflict
                {
                  $and: [
                    { $in: ['finance_admin', '$roleDetails.name'] },
                    { $in: ['growth_marketing', '$roleDetails.name'] }
                  ]
                },
                // Add other conflict rules as needed
              ]
            }
          }
        }
      ]);

      return conflicts.filter(conflict => conflict.hasConflict || conflict.roleCount > 2);
    } catch (error) {
      console.error('Error getting permission conflicts:', error);
      return [];
    }
  }

  /**
   * Generate permission matrix for all roles
   * @returns {Object} Matrix showing which roles have which permissions
   */
  static async generatePermissionMatrix() {
    try {
      const roles = await Role.find({ isActive: true }).populate('permissions');
      const allPermissions = await Permission.find({ isActive: true }).sort({ category: 1, name: 1 });
      
      const matrix = {
        permissions: allPermissions,
        roles: roles.map(role => ({
          id: role._id,
          name: role.name,
          displayName: role.displayName,
          permissions: role.permissions.map(p => p._id.toString())
        })),
        grid: {}
      };

      // Create grid
      allPermissions.forEach(permission => {
        matrix.grid[permission._id.toString()] = {};
        roles.forEach(role => {
          const hasPermission = role.permissions.some(p => 
            p._id.toString() === permission._id.toString()
          );
          matrix.grid[permission._id.toString()][role._id.toString()] = hasPermission;
        });
      });

      return matrix;
    } catch (error) {
      console.error('Error generating permission matrix:', error);
      return { permissions: [], roles: [], grid: {} };
    }
  }

  /**
   * Audit user permissions (for compliance)
   * @param {String} userId 
   * @returns {Object} Detailed audit report
   */
  static async auditUserPermissions(userId) {
    try {
      const user = await require('../../models/user.model').findById(userId);
      if (!user) {
        return { error: 'User not found' };
      }

      const userRoles = await UserRole.find({
        userId,
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }).populate('roleId').populate('assignedBy', 'firstName lastName email');

      const permissions = await RBACMiddleware.getUserPermissions(userId);
      const isSuperAdmin = await RBACMiddleware.isSuperAdmin(userId);

      return {
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        },
        isSuperAdmin,
        roles: userRoles.map(ur => ({
          role: ur.roleId,
          assignedBy: ur.assignedBy,
          assignedAt: ur.assignedAt,
          expiresAt: ur.expiresAt,
          notes: ur.notes
        })),
        permissions: permissions.map(p => ({
          id: p._id,
          name: p.name,
          displayName: p.displayName,
          category: p.category,
          resource: p.resource,
          action: p.action
        })),
        summary: {
          roleCount: userRoles.length,
          permissionCount: permissions.length,
          categories: [...new Set(permissions.map(p => p.category))]
        }
      };
    } catch (error) {
      console.error('Error auditing user permissions:', error);
      return { error: error.message };
    }
  }

  /**
   * Suggest role based on permissions needed
   * @param {Array} requiredPermissions - Array of permission names
   * @returns {Array} Suggested roles with match percentage
   */
  static async suggestRoles(requiredPermissions) {
    try {
      const roles = await Role.find({ isActive: true }).populate('permissions');
      
      const suggestions = roles.map(role => {
        const rolePermissionNames = role.permissions.map(p => p.name);
        const matches = requiredPermissions.filter(rp => 
          rolePermissionNames.includes(rp)
        );
        
        const matchPercentage = (matches.length / requiredPermissions.length) * 100;
        const coverage = (matches.length / rolePermissionNames.length) * 100;
        
        return {
          role,
          matchPercentage: Math.round(matchPercentage),
          coverage: Math.round(coverage),
          matches,
          missing: requiredPermissions.filter(rp => !rolePermissionNames.includes(rp)),
          extra: rolePermissionNames.filter(rp => !requiredPermissions.includes(rp))
        };
      });

      return suggestions
        .filter(s => s.matchPercentage > 0)
        .sort((a, b) => b.matchPercentage - a.matchPercentage);
    } catch (error) {
      console.error('Error suggesting roles:', error);
      return [];
    }
  }
}

module.exports = RBACUtils;