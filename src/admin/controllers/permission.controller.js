const Permission = require('../models/permission.model');
const AuditLog = require('../models/auditLog.model');

class PermissionController {

  /**
   * Get all permissions
   */
  static async getAllPermissions(req, res) {
    try {
      const { page = 1, limit = 50, search = '', category, isActive } = req.query;
      
      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { resource: { $regex: search, $options: 'i' } }
        ];
      }
      if (category) {
        query.category = category;
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const permissions = await Permission.find(query)
        .populate('createdBy', 'firstName lastName email')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ category: 1, resource: 1, action: 1 });

      const total = await Permission.countDocuments(query);

      // Group permissions by category for better organization
      const groupedPermissions = permissions.reduce((acc, permission) => {
        if (!acc[permission.category]) {
          acc[permission.category] = [];
        }
        acc[permission.category].push(permission);
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          permissions,
          groupedPermissions,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get All Permissions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch permissions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get permission by ID
   */
  static async getPermissionById(req, res) {
    try {
      const { permissionId } = req.params;
      
      const permission = await Permission.findById(permissionId)
        .populate('createdBy', 'firstName lastName email');

      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
      }

      res.status(200).json({
        success: true,
        data: permission
      });
    } catch (error) {
      console.error('Get Permission By ID Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch permission',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create new permission
   */
  static async createPermission(req, res) {
    try {
      const { name, displayName, description, category, resource, action } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!name || !displayName || !description || !category || !resource || !action) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: name, displayName, description, category, resource, action'
        });
      }

      // Check if permission already exists
      const existingPermission = await Permission.findOne({ name });
      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: 'Permission with this name already exists'
        });
      }

      // Check for duplicate resource-action combination
      const duplicatePermission = await Permission.findOne({ resource, action });
      if (duplicatePermission) {
        return res.status(400).json({
          success: false,
          message: `Permission for ${resource}:${action} already exists`
        });
      }

      const permission = new Permission({
        name,
        displayName,
        description,
        category,
        resource,
        action,
        createdBy: userId
      });

      await permission.save();
      
      // Populate the permission for response
      await permission.populate('createdBy', 'firstName lastName email');

      // Log the action
      await AuditLog.create({
        userId,
        action: 'permission_granted',
        resource: 'permissions',
        resourceId: permission._id.toString(),
        details: {
          permissionName: name,
          category,
          resource,
          action
        }
      });

      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: permission
      });
    } catch (error) {
      console.error('Create Permission Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create permission',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update permission
   */
  static async updatePermission(req, res) {
    try {
      const { permissionId } = req.params;
      const { displayName, description, category, isActive } = req.body;
      const userId = req.user.id;

      const permission = await Permission.findById(permissionId);
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
      }

      // Update fields
      if (displayName) permission.displayName = displayName;
      if (description) permission.description = description;
      if (category) permission.category = category;
      if (isActive !== undefined) permission.isActive = isActive;

      await permission.save();

      // Populate for response
      await permission.populate('createdBy', 'firstName lastName email');

      // Log the action
      await AuditLog.create({
        userId,
        action: 'data_modification',
        resource: 'permissions',
        resourceId: permission._id.toString(),
        details: {
          permissionName: permission.name,
          changes: { displayName, description, category, isActive }
        }
      });

      res.status(200).json({
        success: true,
        message: 'Permission updated successfully',
        data: permission
      });
    } catch (error) {
      console.error('Update Permission Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update permission',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Delete permission (soft delete)
   */
  static async deletePermission(req, res) {
    try {
      const { permissionId } = req.params;
      const userId = req.user.id;

      const permission = await Permission.findById(permissionId);
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
      }

      // Soft delete
      permission.isActive = false;
      await permission.save();

      // Log the action
      await AuditLog.create({
        userId,
        action: 'permission_revoked',
        resource: 'permissions',
        resourceId: permission._id.toString(),
        details: {
          permissionName: permission.name,
          action: 'soft_delete'
        }
      });

      res.status(200).json({
        success: true,
        message: 'Permission deleted successfully'
      });
    } catch (error) {
      console.error('Delete Permission Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete permission',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get permissions by category
   */
  static async getPermissionsByCategory(req, res) {
    try {
      const { category } = req.params;
      
      const permissions = await Permission.find({ 
        category, 
        isActive: true 
      })
      .populate('createdBy', 'firstName lastName email')
      .sort({ resource: 1, action: 1 });

      res.status(200).json({
        success: true,
        data: {
          category,
          permissions
        }
      });
    } catch (error) {
      console.error('Get Permissions By Category Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch permissions by category',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get all categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await Permission.distinct('category', { isActive: true });
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Get Categories Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Bulk create permissions
   */
  static async bulkCreatePermissions(req, res) {
    try {
      const { permissions } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Permissions array is required and must not be empty'
        });
      }

      const results = {
        created: [],
        skipped: [],
        errors: []
      };

      for (const permissionData of permissions) {
        try {
          const { name, displayName, description, category, resource, action } = permissionData;

          // Check if permission already exists
          const existingPermission = await Permission.findOne({ name });
          if (existingPermission) {
            results.skipped.push({
              name,
              reason: 'Permission already exists'
            });
            continue;
          }

          const permission = new Permission({
            name,
            displayName,
            description,
            category,
            resource,
            action,
            createdBy: userId
          });

          await permission.save();
          results.created.push(permission);

        } catch (error) {
          results.errors.push({
            permission: permissionData,
            error: error.message
          });
        }
      }

      // Log the bulk action
      await AuditLog.create({
        userId,
        action: 'permission_granted',
        resource: 'permissions',
        details: {
          bulkOperation: true,
          created: results.created.length,
          skipped: results.skipped.length,
          errors: results.errors.length
        }
      });

      res.status(200).json({
        success: true,
        message: `Bulk permission creation completed. Created: ${results.created.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
        data: results
      });
    } catch (error) {
      console.error('Bulk Create Permissions Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk create permissions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = PermissionController;