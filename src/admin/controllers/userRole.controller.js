const UserRole = require('../models/userRole.model');
const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const AuditLog = require('../models/auditLog.model');
const RBACMiddleware = require('../middlewares/rbac.middleware');

class UserRoleController {

  /**
   * Get user's roles and permissions
   */
  static async getUserRolesAndPermissions(req, res) {
    try {
      const { userId } = req.params;
      
      // Get user roles
      const userRoles = await UserRole.find({ 
        userId, 
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      })
      .populate('roleId')
      .populate('assignedBy', 'firstName lastName email')
      .sort({ assignedAt: -1 });

      // Get user permissions
      const permissions = await RBACMiddleware.getUserPermissions(userId);
      
      // Check if user is super admin
      const isSuperAdmin = await RBACMiddleware.isSuperAdmin(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          isSuperAdmin,
          roles: userRoles,
          permissions,
          roleCount: userRoles.length,
          permissionCount: permissions.length
        }
      });
    } catch (error) {
      console.error('Get User Roles and Permissions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user roles and permissions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get all user role assignments
   */
  static async getAllUserRoles(req, res) {
    try {
      const { page = 1, limit = 10, search = '', roleId, isActive = 'true' } = req.query;
      
      const query = { isActive: isActive === 'true' };
      
      if (roleId) {
        query.roleId = roleId;
      }

      let userRoles = await UserRole.find(query)
        .populate({
          path: 'userId',
          select: 'firstName lastName email',
          match: search ? {
            $or: [
              { firstName: { $regex: search, $options: 'i' } },
              { lastName: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } }
            ]
          } : {}
        })
        .populate('roleId')
        .populate('assignedBy', 'firstName lastName email')
        .sort({ assignedAt: -1 });

      // Filter out null users (from the match in populate)
      userRoles = userRoles.filter(ur => ur.userId);

      // Manual pagination since we filtered after populate
      const total = userRoles.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      userRoles = userRoles.slice(startIndex, endIndex);

      res.status(200).json({
        success: true,
        data: {
          userRoles,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get All User Roles Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user roles',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Check user permission for specific resource and action
   */
  static async checkUserPermission(req, res) {
    try {
      const { userId } = req.params;
      const { resource, action } = req.query;

      if (!resource || !action) {
        return res.status(400).json({
          success: false,
          message: 'Resource and action parameters are required'
        });
      }

      // Check if user is super admin (they have all permissions)
      const isSuperAdmin = await RBACMiddleware.isSuperAdmin(userId);
      
      let hasPermission = false;
      if (isSuperAdmin) {
        hasPermission = true;
      } else {
        hasPermission = await RBACMiddleware.userHasPermission(userId, resource, action);
      }

      // Log the permission check
      await AuditLog.create({
        userId: req.user.id, // The user making the check request
        action: 'permission_check',
        resource: `${resource}:${action}`,
        details: {
          checkedUserId: userId,
          result: hasPermission,
          isSuperAdmin
        }
      });

      res.status(200).json({
        success: true,
        data: {
          userId,
          resource,
          action,
          hasPermission,
          isSuperAdmin,
          checkPerformedBy: req.user.id
        }
      });
    } catch (error) {
      console.error('Check User Permission Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check user permission',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get users by role
   */
  static async getUsersByRole(req, res) {
    try {
      const { roleId } = req.params;
      const { page = 1, limit = 10, includeExpired = false } = req.query;

      // Verify role exists
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      const query = { roleId, isActive: true };
      
      if (!includeExpired) {
        query.$or = [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ];
      }

      const userRoles = await UserRole.find(query)
        .populate('userId', 'firstName lastName email isActive')
        .populate('assignedBy', 'firstName lastName email')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ assignedAt: -1 });

      const total = await UserRole.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          role,
          userRoles,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get Users By Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users by role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update user role assignment (extend expiration, add notes, etc.)
   */
  static async updateUserRole(req, res) {
    try {
      const { userRoleId } = req.params;
      const { expiresAt, notes, isActive } = req.body;
      const updatedBy = req.user.id;

      const userRole = await UserRole.findById(userRoleId)
        .populate('roleId')
        .populate('userId', 'firstName lastName email');

      if (!userRole) {
        return res.status(404).json({
          success: false,
          message: 'User role assignment not found'
        });
      }

      // Prevent modification of super_admin role by non-super-admins
      if (userRole.roleId.name === 'super_admin' && !(await RBACMiddleware.isSuperAdmin(updatedBy))) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can modify super admin role assignments'
        });
      }

      // Update fields
      if (expiresAt !== undefined) {
        userRole.expiresAt = expiresAt ? new Date(expiresAt) : null;
      }
      if (notes !== undefined) {
        userRole.notes = notes;
      }
      if (isActive !== undefined) {
        userRole.isActive = isActive;
      }

      await userRole.save();

      // Log the action
      await AuditLog.create({
        userId: updatedBy,
        action: 'data_modification',
        resource: 'user_roles',
        resourceId: userRole._id.toString(),
        details: {
          targetUserId: userRole.userId._id,
          roleName: userRole.roleId.name,
          changes: { expiresAt, notes, isActive }
        }
      });

      res.status(200).json({
        success: true,
        message: 'User role assignment updated successfully',
        data: userRole
      });
    } catch (error) {
      console.error('Update User Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user role assignment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get role statistics
   */
  static async getRoleStatistics(req, res) {
    try {
      const stats = await UserRole.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $group: {
            _id: '$roleId',
            userCount: { $sum: 1 },
            recentAssignments: {
              $sum: {
                $cond: {
                  if: { $gte: ['$assignedAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  then: 1,
                  else: 0
                }
              }
            }
          }
        },
        {
          $lookup: {
            from: 'roles',
            localField: '_id',
            foreignField: '_id',
            as: 'role'
          }
        },
        {
          $unwind: '$role'
        },
        {
          $project: {
            _id: 1,
            roleName: '$role.name',
            roleDisplayName: '$role.displayName',
            userCount: 1,
            recentAssignments: 1
          }
        },
        {
          $sort: { userCount: -1 }
        }
      ]);

      const totalUsers = await UserRole.distinct('userId', { isActive: true });
      const totalActiveRoles = await Role.countDocuments({ isActive: true });

      res.status(200).json({
        success: true,
        data: {
          roleStatistics: stats,
          summary: {
            totalUsersWithRoles: totalUsers.length,
            totalActiveRoles,
            totalRoleAssignments: stats.reduce((sum, stat) => sum + stat.userCount, 0)
          }
        }
      });
    } catch (error) {
      console.error('Get Role Statistics Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Bulk assign role to multiple users
   */
  static async bulkAssignRole(req, res) {
    try {
      const { userIds, roleId, expiresAt, notes = '' } = req.body;
      const assignerId = req.user.id;

      if (!Array.isArray(userIds) || userIds.length === 0 || !roleId) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array and Role ID are required'
        });
      }

      // Check if role exists
      const role = await Role.findOne({ _id: roleId, isActive: true });
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found or inactive'
        });
      }

      const results = {
        assigned: [],
        skipped: [],
        errors: []
      };

      for (const userId of userIds) {
        try {
          // Check if user already has this role
          const existingAssignment = await UserRole.findOne({
            userId,
            roleId,
            isActive: true
          });

          if (existingAssignment) {
            results.skipped.push({
              userId,
              reason: 'User already has this role'
            });
            continue;
          }

          const userRole = new UserRole({
            userId,
            roleId,
            assignedBy: assignerId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            notes
          });

          await userRole.save();
          results.assigned.push(userRole);

        } catch (error) {
          results.errors.push({
            userId,
            error: error.message
          });
        }
      }

      // Log the bulk action
      await AuditLog.create({
        userId: assignerId,
        action: 'role_assigned',
        resource: 'user_roles',
        details: {
          bulkOperation: true,
          roleName: role.name,
          assigned: results.assigned.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
          userIds
        }
      });

      res.status(200).json({
        success: true,
        message: `Bulk role assignment completed. Assigned: ${results.assigned.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
        data: results
      });
    } catch (error) {
      console.error('Bulk Assign Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk assign role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = UserRoleController;