const AdminUser = require('../models/adminUser.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class AdminUserController {

  /**
   * Get all admin users
   */
  static async getAllAdminUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        adminLevel, 
        department,
        isActive 
      } = req.query;
      
      const query = {};
      
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (adminLevel) query.adminLevel = adminLevel;
      if (department) query.department = department;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      const adminUsers = await AdminUser.find(query)
        .populate('createdBy', 'firstName lastName email username')
        .populate('updatedBy', 'firstName lastName email username')
        .select('-password -twoFactorSecret -passwordResetToken -activationToken')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await AdminUser.countDocuments(query);

      // Get admin hierarchy for reference
      const adminHierarchy = AdminUser.getAdminHierarchy();

      res.status(200).json({
        success: true,
        data: {
          adminUsers,
          adminHierarchy,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get All Admin Users Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin users',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get admin user by ID
   */
  static async getAdminUserById(req, res) {
    try {
      const { adminUserId } = req.params;
      
      const adminUser = await AdminUser.findById(adminUserId)
        .populate('createdBy', 'firstName lastName email username')
        .populate('updatedBy', 'firstName lastName email username')
        .select('-password -twoFactorSecret -passwordResetToken -activationToken');

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      res.status(200).json({
        success: true,
        data: adminUser
      });
    } catch (error) {
      console.error('Get Admin User By ID Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create new admin user
   */
  static async createAdminUser(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        username,
        password,
        phone,
        adminLevel,
        department,
        employeeId,
        permissions = [],
        bio
      } = req.body;

      const createdById = req.user.id;

      // Validate required fields
      if (!firstName || !lastName || !email || !username || !password || !adminLevel || !department) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: firstName, lastName, email, username, password, adminLevel, department'
        });
      }

      // Check if email or username already exists
      const existingUser = await AdminUser.findOne({
        $or: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Admin user with this email or username already exists'
        });
      }

      // Check if employeeId is provided and unique
      if (employeeId) {
        const existingEmployee = await AdminUser.findOne({ employeeId });
        if (existingEmployee) {
          return res.status(400).json({
            success: false,
            message: 'Employee ID already exists'
          });
        }
      }

      // Create admin user
      const adminUser = new AdminUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        password,
        phone,
        adminLevel,
        department,
        employeeId,
        permissions,
        bio,
        createdBy: createdById,
        forcePasswordChange: true // Force password change on first login
      });

      // Generate activation token
      const activationToken = adminUser.createActivationToken();
      await adminUser.save();

      // Remove sensitive data from response
      const responseUser = adminUser.toObject();
      delete responseUser.password;
      delete responseUser.activationToken;

      res.status(201).json({
        success: true,
        message: 'Admin user created successfully',
        data: {
          adminUser: responseUser,
          activationToken // Send token for account activation
        }
      });
    } catch (error) {
      console.error('Create Admin User Error:', error);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create admin user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update admin user
   */
  static async updateAdminUser(req, res) {
    try {
      const { adminUserId } = req.params;
      const {
        firstName,
        lastName,
        phone,
        adminLevel,
        department,
        employeeId,
        permissions,
        bio,
        isActive,
        isTwoFactorEnabled
      } = req.body;

      const updatedById = req.user.id;

      const adminUser = await AdminUser.findById(adminUserId);
      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Update fields
      if (firstName) adminUser.firstName = firstName.trim();
      if (lastName) adminUser.lastName = lastName.trim();
      if (phone !== undefined) adminUser.phone = phone;
      if (adminLevel) adminUser.adminLevel = adminLevel;
      if (department) adminUser.department = department;
      if (employeeId !== undefined) adminUser.employeeId = employeeId;
      if (permissions) adminUser.permissions = permissions;
      if (bio !== undefined) adminUser.bio = bio;
      if (isActive !== undefined) adminUser.isActive = isActive;
      if (isTwoFactorEnabled !== undefined) adminUser.isTwoFactorEnabled = isTwoFactorEnabled;

      adminUser.updatedBy = updatedById;
      await adminUser.save();

      // Populate for response
      await adminUser.populate('updatedBy', 'firstName lastName email username');

      res.status(200).json({
        success: true,
        message: 'Admin user updated successfully',
        data: adminUser
      });
    } catch (error) {
      console.error('Update Admin User Error:', error);
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update admin user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Delete admin user (soft delete)
   */
  static async deleteAdminUser(req, res) {
    try {
      const { adminUserId } = req.params;
      const updatedById = req.user.id;

      const adminUser = await AdminUser.findById(adminUserId);
      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Prevent self-deletion
      if (adminUserId === updatedById) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Soft delete by setting isActive to false
      adminUser.isActive = false;
      adminUser.updatedBy = updatedById;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Admin user deleted successfully'
      });
    } catch (error) {
      console.error('Delete Admin User Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete admin user',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Change admin user password
   */
  static async changePassword(req, res) {
    try {
      const { adminUserId } = req.params;
      const { currentPassword, newPassword } = req.body;
      const requesterId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      const adminUser = await AdminUser.findById(adminUserId);
      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Allow user to change their own password or super admin to change any password
      const requester = await AdminUser.findById(requesterId);
      const canChangePassword = adminUserId === requesterId || requester.adminLevel === 'super_admin';

      if (!canChangePassword) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to change password'
        });
      }

      // Verify current password (only if changing own password)
      if (adminUserId === requesterId) {
        const isCurrentPasswordValid = await adminUser.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
      }

      // Update password
      adminUser.password = newPassword;
      adminUser.forcePasswordChange = false;
      adminUser.updatedBy = requesterId;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change Password Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Reset admin user password
   */
  static async resetPassword(req, res) {
    try {
      const { adminUserId } = req.params;
      const requesterId = req.user.id;

      const adminUser = await AdminUser.findById(adminUserId);
      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(12).toString('hex');
      
      adminUser.password = tempPassword;
      adminUser.forcePasswordChange = true;
      adminUser.updatedBy = requesterId;
      await adminUser.save();

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        data: {
          tempPassword,
          message: 'User must change password on next login'
        }
      });
    } catch (error) {
      console.error('Reset Password Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset password',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get admin statistics
   */
  static async getAdminStatistics(req, res) {
    try {
      const stats = await AdminUser.aggregate([
        {
          $group: {
            _id: '$adminLevel',
            count: { $sum: 1 },
            active: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            inactive: {
              $sum: { $cond: ['$isActive', 0, 1] }
            }
          }
        }
      ]);

      const departmentStats = await AdminUser.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalAdmins = await AdminUser.countDocuments();
      const activeAdmins = await AdminUser.countDocuments({ isActive: true });
      const recentLogins = await AdminUser.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      res.status(200).json({
        success: true,
        data: {
          summary: {
            total: totalAdmins,
            active: activeAdmins,
            inactive: totalAdmins - activeAdmins,
            recentLogins
          },
          byAdminLevel: stats,
          byDepartment: departmentStats,
          adminHierarchy: AdminUser.getAdminHierarchy()
        }
      });
    } catch (error) {
      console.error('Get Admin Statistics Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = AdminUserController;