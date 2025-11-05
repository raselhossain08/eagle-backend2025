const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const UserRole = require('../models/userRole.model');
const AuditLog = require('../models/auditLog.model');
const RBACMiddleware = require('../middlewares/rbac.middleware');

class RoleController {
  
  /**
   * Get all roles
   */
  static async getAllRoles(req, res) {
    try {
      const { page = 1, limit = 10, search = '', isActive } = req.query;
      
      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
        ];
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const roles = await Role.find(query)
        .populate('permissions')
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await Role.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          roles,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get All Roles Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch roles',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get role by ID
   */
  static async getRoleById(req, res) {
    try {
      const { roleId } = req.params;
      
      const role = await Role.findById(roleId)
        .populate('permissions')
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email');

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Get users with this role
      const usersWithRole = await UserRole.find({ roleId, isActive: true })
        .populate('userId', 'firstName lastName email')
        .select('userId assignedAt assignedBy');

      res.status(200).json({
        success: true,
        data: {
          role,
          assignedUsers: usersWithRole
        }
      });
    } catch (error) {
      console.error('Get Role By ID Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create new role
   */
  static async createRole(req, res) {
    try {
      const { name, displayName, description, permissions = [] } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!name || !displayName || !description) {
        return res.status(400).json({
          success: false,
          message: 'Name, display name, and description are required'
        });
      }

      // Check if role name already exists
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }

      // Validate permissions if provided
      if (permissions.length > 0) {
        const validPermissions = await Permission.find({
          _id: { $in: permissions },
          isActive: true
        });

        if (validPermissions.length !== permissions.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more invalid permissions provided'
          });
        }
      }

      const role = new Role({
        name,
        displayName,
        description,
        permissions,
        createdBy: userId
      });

      await role.save();
      
      // Populate the role for response
      await role.populate('permissions');
      await role.populate('createdBy', 'firstName lastName email');

      // Log the action
      await AuditLog.create({
        userId,
        action: 'role_assigned',
        resource: 'roles',
        resourceId: role._id.toString(),
        details: {
          roleName: name,
          displayName,
          permissions: permissions.length
        }
      });

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role
      });
    } catch (error) {
      console.error('Create Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update role
   */
  static async updateRole(req, res) {
    try {
      const { roleId } = req.params;
      const { displayName, description, permissions, isActive } = req.body;
      const userId = req.user.id;

      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Prevent modification of super_admin role by non-super-admins
      if (role.name === 'super_admin' && !(await RBACMiddleware.isSuperAdmin(userId))) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can modify the super admin role'
        });
      }

      // Update fields
      if (displayName) role.displayName = displayName;
      if (description) role.description = description;
      if (isActive !== undefined) role.isActive = isActive;
      if (permissions) {
        // Validate permissions
        const validPermissions = await Permission.find({
          _id: { $in: permissions },
          isActive: true
        });

        if (validPermissions.length !== permissions.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more invalid permissions provided'
          });
        }
        
        role.permissions = permissions;
      }

      role.updatedBy = userId;
      await role.save();

      // Populate for response
      await role.populate('permissions');
      await role.populate('updatedBy', 'firstName lastName email');

      // Log the action
      await AuditLog.create({
        userId,
        action: 'data_modification',
        resource: 'roles',
        resourceId: role._id.toString(),
        details: {
          roleName: role.name,
          changes: { displayName, description, permissions: permissions?.length, isActive }
        }
      });

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: role
      });
    } catch (error) {
      console.error('Update Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Delete role (soft delete)
   */
  static async deleteRole(req, res) {
    try {
      const { roleId } = req.params;
      const userId = req.user.id;

      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Prevent deletion of super_admin role
      if (role.name === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Super admin role cannot be deleted'
        });
      }

      // Check if role is assigned to any users
      const assignedUsers = await UserRole.find({ roleId, isActive: true });
      if (assignedUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete role. It is assigned to ${assignedUsers.length} user(s)`,
          data: { assignedUsersCount: assignedUsers.length }
        });
      }

      // Soft delete
      role.isActive = false;
      role.updatedBy = userId;
      await role.save();

      // Log the action
      await AuditLog.create({
        userId,
        action: 'data_modification',
        resource: 'roles',
        resourceId: role._id.toString(),
        details: {
          roleName: role.name,
          action: 'soft_delete'
        }
      });

      res.status(200).json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      console.error('Delete Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Assign role to user
   */
  static async assignRoleToUser(req, res) {
    try {
      const { userId: targetUserId, roleId, expiresAt, notes = '' } = req.body;
      const assignerId = req.user.id;

      // Validate inputs
      if (!targetUserId || !roleId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Role ID are required'
        });
      }

      // Check if role exists and is active
      const role = await Role.findOne({ _id: roleId, isActive: true });
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found or inactive'
        });
      }

      // Check if user already has this role
      const existingAssignment = await UserRole.findOne({
        userId: targetUserId,
        roleId,
        isActive: true
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: 'User already has this role assigned'
        });
      }

      // Create user role assignment
      const userRole = new UserRole({
        userId: targetUserId,
        roleId,
        assignedBy: assignerId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes
      });

      await userRole.save();

      // Populate for response
      await userRole.populate('roleId');
      await userRole.populate('userId', 'firstName lastName email');
      await userRole.populate('assignedBy', 'firstName lastName email');

      // Log the action
      await AuditLog.create({
        userId: assignerId,
        action: 'role_assigned',
        resource: 'user_roles',
        resourceId: userRole._id.toString(),
        details: {
          targetUserId,
          roleName: role.name,
          expiresAt,
          notes
        }
      });

      res.status(201).json({
        success: true,
        message: 'Role assigned to user successfully',
        data: userRole
      });
    } catch (error) {
      console.error('Assign Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Remove role from user
   */
  static async removeRoleFromUser(req, res) {
    try {
      const { userRoleId } = req.params;
      const removerId = req.user.id;

      const userRole = await UserRole.findById(userRoleId)
        .populate('roleId')
        .populate('userId', 'firstName lastName email');

      if (!userRole) {
        return res.status(404).json({
          success: false,
          message: 'User role assignment not found'
        });
      }

      // Prevent removal of super_admin role by non-super-admins
      if (userRole.roleId.name === 'super_admin' && !(await RBACMiddleware.isSuperAdmin(removerId))) {
        return res.status(403).json({
          success: false,
          message: 'Only super admins can remove super admin role'
        });
      }

      // Deactivate the role assignment
      userRole.isActive = false;
      await userRole.save();

      // Log the action
      await AuditLog.create({
        userId: removerId,
        action: 'role_removed',
        resource: 'user_roles',
        resourceId: userRole._id.toString(),
        details: {
          targetUserId: userRole.userId._id,
          roleName: userRole.roleId.name,
          targetUserEmail: userRole.userId.email
        }
      });

      res.status(200).json({
        success: true,
        message: 'Role removed from user successfully'
      });
    } catch (error) {
      console.error('Remove Role Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove role',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = RoleController;