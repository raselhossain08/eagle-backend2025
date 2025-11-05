const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Permission = require('../models/permission.model');
const Role = require('../models/role.model');
const UserRole = require('../models/userRole.model');
const AdminUser = require('../models/adminUser.model');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

/**
 * RBAC System Seeder
 * Seeds roles, permissions, and sets up initial admin user
 */
class RBACSeeder {

  /**
   * Default permissions for the system
   */
  static getDefaultPermissions() {
    return [
      // System Admin Permissions
      { name: 'system_admin_create', displayName: 'Create System Settings', description: 'Create system configuration and settings', category: 'system_admin', resource: 'system_admin', action: 'create' },
      { name: 'system_admin_read', displayName: 'Read System Settings', description: 'View system configuration and settings', category: 'system_admin', resource: 'system_admin', action: 'read' },
      { name: 'system_admin_update', displayName: 'Update System Settings', description: 'Modify system configuration and settings', category: 'system_admin', resource: 'system_admin', action: 'update' },
      { name: 'system_admin_delete', displayName: 'Delete System Settings', description: 'Remove system configuration and settings', category: 'system_admin', resource: 'system_admin', action: 'delete' },

      // User Management Permissions
      { name: 'users_create', displayName: 'Create Users', description: 'Create new user accounts', category: 'user_management', resource: 'users', action: 'create' },
      { name: 'users_read', displayName: 'View Users', description: 'View user information and profiles', category: 'user_management', resource: 'users', action: 'read' },
      { name: 'users_update', displayName: 'Update Users', description: 'Modify user information and settings', category: 'user_management', resource: 'users', action: 'update' },
      { name: 'users_delete', displayName: 'Delete Users', description: 'Delete or deactivate user accounts', category: 'user_management', resource: 'users', action: 'delete' },

      // Billing & Finance Permissions
      { name: 'billing_create', displayName: 'Create Billing Records', description: 'Create invoices, transactions, and billing records', category: 'billing_finance', resource: 'billing', action: 'create' },
      { name: 'billing_read', displayName: 'View Billing Information', description: 'View invoices, transactions, and financial reports', category: 'billing_finance', resource: 'billing', action: 'read' },
      { name: 'billing_update', displayName: 'Update Billing Records', description: 'Modify invoices and billing information', category: 'billing_finance', resource: 'billing', action: 'update' },
      { name: 'billing_delete', displayName: 'Delete Billing Records', description: 'Remove or void billing transactions', category: 'billing_finance', resource: 'billing', action: 'delete' },
      { name: 'billing_approve', displayName: 'Approve Financial Operations', description: 'Approve refunds, chargebacks, and financial transactions', category: 'billing_finance', resource: 'billing', action: 'approve' },

      // Analytics & Reports Permissions
      { name: 'analytics_read', displayName: 'View Analytics', description: 'Access analytics dashboards and reports', category: 'analytics_reports', resource: 'analytics', action: 'read' },
      { name: 'reports_create', displayName: 'Generate Reports', description: 'Create and export custom reports', category: 'analytics_reports', resource: 'reports', action: 'create' },
      { name: 'reports_read', displayName: 'View Reports', description: 'Access generated reports and data', category: 'analytics_reports', resource: 'reports', action: 'read' },

      // Support Operations Permissions
      { name: 'support_read', displayName: 'View Support Data', description: 'Access support tickets and customer information', category: 'support_operations', resource: 'support', action: 'read' },
      { name: 'support_update', displayName: 'Handle Support Requests', description: 'Respond to and manage support tickets', category: 'support_operations', resource: 'support', action: 'update' },

      // Subscription Management Permissions
      { name: 'subscriptions_create', displayName: 'Create Subscriptions', description: 'Set up new subscription plans and packages', category: 'subscription_management', resource: 'subscriptions', action: 'create' },
      { name: 'subscriptions_read', displayName: 'View Subscriptions', description: 'View subscription information and status', category: 'subscription_management', resource: 'subscriptions', action: 'read' },
      { name: 'subscriptions_update', displayName: 'Modify Subscriptions', description: 'Change subscription plans and settings', category: 'subscription_management', resource: 'subscriptions', action: 'update' },
      { name: 'subscriptions_cancel', displayName: 'Cancel Subscriptions', description: 'Cancel or suspend user subscriptions', category: 'subscription_management', resource: 'subscriptions', action: 'delete' },

      // Marketing & Growth Permissions
      { name: 'marketing_create', displayName: 'Create Marketing Campaigns', description: 'Create discounts, promotions, and campaigns', category: 'marketing_growth', resource: 'marketing', action: 'create' },
      { name: 'marketing_read', displayName: 'View Marketing Data', description: 'Access marketing analytics and campaign performance', category: 'marketing_growth', resource: 'marketing', action: 'read' },
      { name: 'marketing_update', displayName: 'Manage Marketing Campaigns', description: 'Modify and manage active campaigns', category: 'marketing_growth', resource: 'marketing', action: 'update' },

      // Security Settings Permissions
      { name: 'security_read', displayName: 'View Security Settings', description: 'Access security logs and settings', category: 'security_settings', resource: 'security', action: 'read' },
      { name: 'security_update', displayName: 'Manage Security Settings', description: 'Modify security configurations and permissions', category: 'security_settings', resource: 'security', action: 'update' },

      // Content Management Permissions
      { name: 'content_create', displayName: 'Create Content', description: 'Create announcements, newsletters, and content', category: 'content_management', resource: 'content', action: 'create' },
      { name: 'content_read', displayName: 'View Content', description: 'Access and review all content', category: 'content_management', resource: 'content', action: 'read' },
      { name: 'content_update', displayName: 'Edit Content', description: 'Modify existing content and announcements', category: 'content_management', resource: 'content', action: 'update' },
      { name: 'content_delete', displayName: 'Delete Content', description: 'Remove content and announcements', category: 'content_management', resource: 'content', action: 'delete' }
    ];
  }

  /**
   * Default roles with their permission mappings
   */
  static getDefaultRoles() {
    return [
      {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'Full access to all system features including security settings and destructive actions',
        permissions: 'all' // Super admin gets all permissions
      },
      {
        name: 'finance_admin',
        displayName: 'Finance Administrator', 
        description: 'Manages billing, invoices, refunds, payouts, taxes, and financial reports',
        permissions: [
          'billing_create', 'billing_read', 'billing_update', 'billing_delete', 'billing_approve',
          'subscriptions_read', 'subscriptions_update', 'subscriptions_cancel',
          'analytics_read', 'reports_read', 'reports_create',
          'users_read'
        ]
      },
      {
        name: 'growth_marketing',
        displayName: 'Growth/Marketing',
        description: 'Handles discounts, campaigns, announcements, and analytics',
        permissions: [
          'marketing_create', 'marketing_read', 'marketing_update',
          'content_create', 'content_read', 'content_update',
          'analytics_read', 'reports_read',
          'users_read', 'subscriptions_read'
        ]
      },
      {
        name: 'support',
        displayName: 'Support Agent',
        description: 'Customer support - user lookup, plan changes (non-financial), resend receipts, initiate cancellations',
        permissions: [
          'support_read', 'support_update',
          'users_read', 'users_update',
          'subscriptions_read', 'subscriptions_update',
          'billing_read'
        ]
      },
      {
        name: 'read_only',
        displayName: 'Read-Only Access',
        description: 'View-only access to all reports and dashboards, no write permissions',
        permissions: [
          'analytics_read', 'reports_read',
          'users_read', 'subscriptions_read', 'billing_read',
          'marketing_read', 'content_read', 'support_read'
        ]
      }
    ];
  }

  /**
   * Seed permissions into the database
   */
  static async seedPermissions() {
    console.log('🌱 Seeding permissions...');
    
    const permissions = this.getDefaultPermissions();
    const seededPermissions = {};
    
    for (const permissionData of permissions) {
      try {
        let permission = await Permission.findOne({ name: permissionData.name });
        
        if (!permission) {
          permission = new Permission(permissionData);
          await permission.save();
          console.log(`✅ Created permission: ${permission.name}`);
        } else {
          console.log(`⚪ Permission already exists: ${permission.name}`);
        }
        
        seededPermissions[permission.name] = permission;
      } catch (error) {
        console.error(`❌ Error creating permission ${permissionData.name}:`, error.message);
      }
    }
    
    return seededPermissions;
  }

  /**
   * Seed roles into the database
   */
  static async seedRoles(permissions) {
    console.log('🌱 Seeding roles...');
    
    const roles = this.getDefaultRoles();
    const seededRoles = {};
    
    for (const roleData of roles) {
      try {
        let role = await Role.findOne({ name: roleData.name });
        
        if (!role) {
          // Determine role permissions
          let rolePermissions = [];
          
          if (roleData.permissions === 'all') {
            // Super admin gets all permissions
            rolePermissions = Object.values(permissions).map(p => p._id);
          } else if (Array.isArray(roleData.permissions)) {
            // Map permission names to IDs
            rolePermissions = roleData.permissions
              .map(permName => permissions[permName]?._id)
              .filter(Boolean);
          }
          
          role = new Role({
            name: roleData.name,
            displayName: roleData.displayName,
            description: roleData.description,
            permissions: rolePermissions
          });
          
          await role.save();
          console.log(`✅ Created role: ${role.name} with ${rolePermissions.length} permissions`);
        } else {
          console.log(`⚪ Role already exists: ${role.name}`);
        }
        
        seededRoles[role.name] = role;
      } catch (error) {
        console.error(`❌ Error creating role ${roleData.name}:`, error.message);
      }
    }
    
    return seededRoles;
  }

  /**
   * Create default super admin user if none exists
   */
  static async createDefaultSuperAdmin(roles) {
    console.log('🌱 Creating default super admin...');
    
    try {
      // Check if super admin already exists
      const existingSuperAdmin = await AdminUser.findOne({ adminLevel: 'super_admin' });
      
      if (existingSuperAdmin) {
        console.log('⚪ Super admin already exists:', existingSuperAdmin.email);
        
        // Ensure the super admin has the role assigned
        const superAdminRole = roles.super_admin;
        if (superAdminRole) {
          const existingUserRole = await UserRole.findOne({ 
            userId: existingSuperAdmin._id, 
            roleId: superAdminRole._id 
          });
          
          if (!existingUserRole) {
            await UserRole.create({
              userId: existingSuperAdmin._id,
              roleId: superAdminRole._id,
              assignedBy: existingSuperAdmin._id,
              isActive: true
            });
            console.log('✅ Assigned super_admin role to existing admin user');
          }
        }
        
        return existingSuperAdmin;
      }

      // Create default super admin
      const defaultAdmin = {
        firstName: 'System',
        lastName: 'Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@eagle.com',
        username: 'superadmin',
        password: process.env.ADMIN_PASSWORD || 'EagleAdmin@2024!',
        adminLevel: 'super_admin',
        department: 'executive',
        isActive: true,
        isEmailVerified: true
      };

      const adminUser = new AdminUser(defaultAdmin);
      await adminUser.save();
      
      console.log('✅ Created default super admin:', adminUser.email);

      // Assign super admin role
      const superAdminRole = roles.super_admin;
      if (superAdminRole) {
        await UserRole.create({
          userId: adminUser._id,
          roleId: superAdminRole._id,
          assignedBy: adminUser._id,
          isActive: true
        });
        console.log('✅ Assigned super_admin role to new admin user');
      }

      return adminUser;
      
    } catch (error) {
      console.error('❌ Error creating default super admin:', error.message);
      throw error;
    }
  }

  /**
   * Run the complete RBAC seeding process
   */
  static async seed() {
    try {
      console.log('🚀 Starting RBAC seeding process...');
      
      // Connect to database if not connected
      if (mongoose.connection.readyState !== 1) {
        console.log('📡 Connecting to database...');
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/eagle_db';
        console.log('🔗 Using MongoDB URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
        await mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });
        console.log('✅ Connected to database');
      }
      
      // 1. Seed permissions
      const permissions = await this.seedPermissions();
      
      // 2. Seed roles
      const roles = await this.seedRoles(permissions);
      
      // 3. Create default super admin
      const superAdmin = await this.createDefaultSuperAdmin(roles);
      
      console.log('🎉 RBAC seeding completed successfully!');
      console.log(`📊 Seeded ${Object.keys(permissions).length} permissions`);
      console.log(`👥 Seeded ${Object.keys(roles).length} roles`);
      console.log(`👤 Super admin: ${superAdmin.email}`);
      
      return {
        success: true,
        permissions: Object.keys(permissions).length,
        roles: Object.keys(roles).length,
        superAdmin: superAdmin.email
      };
      
    } catch (error) {
      console.error('💥 RBAC seeding failed:', error);
      throw error;
    }
  }

  /**
   * Reset RBAC data (use with caution!)
   */
  static async reset() {
    console.log('🧹 Resetting RBAC data...');
    
    try {
      // Remove all user roles first
      await UserRole.deleteMany({});
      console.log('✅ Cleared user roles');
      
      // Remove all roles
      await Role.deleteMany({});
      console.log('✅ Cleared roles');
      
      // Remove all permissions
      await Permission.deleteMany({});
      console.log('✅ Cleared permissions');
      
      console.log('🎉 RBAC reset completed');
      
    } catch (error) {
      console.error('💥 RBAC reset failed:', error);
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'seed') {
    RBACSeeder.seed()
      .then(() => {
        console.log('✅ Seeding completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
      });
  } else if (command === 'reset') {
    RBACSeeder.reset()
      .then(() => {
        console.log('✅ Reset completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Reset failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node rbac-seeder.js [seed|reset]');
    process.exit(1);
  }
}

module.exports = RBACSeeder;