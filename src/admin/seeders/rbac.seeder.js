const mongoose = require('mongoose');
const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const UserRole = require('../models/userRole.model');

/**
 * RBAC System Seeder
 * Creates default roles and permissions based on the requirements:
 * - Super Admin: Full access incl. security settings and destructive actions
 * - Finance Admin: Billing, invoices, refunds, payouts, taxes, financial reports
 * - Growth/Marketing: Discounts, campaigns, announcements, analytics read
 * - Support: Subscriber lookup, plan changes (non-financial), resend receipts, initiate cancellations (with policy), impersonation
 * - Read-Only: All reports and dashboards, no writes
 */

class RBACSeeder {
  
  static async seedPermissions() {
    console.log('🌱 Seeding permissions...');
    
    const permissions = [
      // User Management Permissions
      {
        name: 'users.create',
        displayName: 'Create Users',
        description: 'Create new user accounts',
        category: 'user_management',
        resource: 'users',
        action: 'create'
      },
      {
        name: 'users.read',
        displayName: 'View Users',
        description: 'View user accounts and profiles',
        category: 'user_management',
        resource: 'users',
        action: 'read'
      },
      {
        name: 'users.update',
        displayName: 'Update Users',
        description: 'Update user accounts and profiles',
        category: 'user_management',
        resource: 'users',
        action: 'update'
      },
      {
        name: 'users.delete',
        displayName: 'Delete Users',
        description: 'Delete user accounts',
        category: 'user_management',
        resource: 'users',
        action: 'delete'
      },
      
      // Billing & Finance Permissions
      {
        name: 'billing.create',
        displayName: 'Create Billing Records',
        description: 'Create invoices, charges, and billing records',
        category: 'billing_finance',
        resource: 'billing',
        action: 'create'
      },
      {
        name: 'billing.read',
        displayName: 'View Billing',
        description: 'View billing information, invoices, and financial data',
        category: 'billing_finance',
        resource: 'billing',
        action: 'read'
      },
      {
        name: 'billing.update',
        displayName: 'Update Billing',
        description: 'Update billing records and payment information',
        category: 'billing_finance',
        resource: 'billing',
        action: 'update'
      },
      {
        name: 'refunds.create',
        displayName: 'Process Refunds',
        description: 'Create and process customer refunds',
        category: 'billing_finance',
        resource: 'refunds',
        action: 'create'
      },
      {
        name: 'refunds.read',
        displayName: 'View Refunds',
        description: 'View refund records and history',
        category: 'billing_finance',
        resource: 'refunds',
        action: 'read'
      },
      {
        name: 'payouts.create',
        displayName: 'Create Payouts',
        description: 'Create and manage payout transactions',
        category: 'billing_finance',
        resource: 'payouts',
        action: 'create'
      },
      {
        name: 'payouts.read',
        displayName: 'View Payouts',
        description: 'View payout information and history',
        category: 'billing_finance',
        resource: 'payouts',
        action: 'read'
      },
      {
        name: 'taxes.read',
        displayName: 'View Tax Information',
        description: 'View tax reports and calculations',
        category: 'billing_finance',
        resource: 'taxes',
        action: 'read'
      },
      {
        name: 'taxes.update',
        displayName: 'Update Tax Settings',
        description: 'Update tax rates and configurations',
        category: 'billing_finance',
        resource: 'taxes',
        action: 'update'
      },
      
      // Marketing & Growth Permissions
      {
        name: 'campaigns.create',
        displayName: 'Create Campaigns',
        description: 'Create marketing campaigns and promotions',
        category: 'marketing_growth',
        resource: 'campaigns',
        action: 'create'
      },
      {
        name: 'campaigns.read',
        displayName: 'View Campaigns',
        description: 'View marketing campaigns and their performance',
        category: 'marketing_growth',
        resource: 'campaigns',
        action: 'read'
      },
      {
        name: 'campaigns.update',
        displayName: 'Update Campaigns',
        description: 'Update marketing campaigns and promotions',
        category: 'marketing_growth',
        resource: 'campaigns',
        action: 'update'
      },
      {
        name: 'discounts.create',
        displayName: 'Create Discounts',
        description: 'Create discount codes and promotions',
        category: 'marketing_growth',
        resource: 'discounts',
        action: 'create'
      },
      {
        name: 'discounts.read',
        displayName: 'View Discounts',
        description: 'View discount codes and their usage',
        category: 'marketing_growth',
        resource: 'discounts',
        action: 'read'
      },
      {
        name: 'discounts.update',
        displayName: 'Update Discounts',
        description: 'Update discount codes and promotions',
        category: 'marketing_growth',
        resource: 'discounts',
        action: 'update'
      },
      {
        name: 'announcements.create',
        displayName: 'Create Announcements',
        description: 'Create system announcements and notifications',
        category: 'marketing_growth',
        resource: 'announcements',
        action: 'create'
      },
      {
        name: 'announcements.read',
        displayName: 'View Announcements',
        description: 'View system announcements',
        category: 'marketing_growth',
        resource: 'announcements',
        action: 'read'
      },
      {
        name: 'announcements.update',
        displayName: 'Update Announcements',
        description: 'Update system announcements and notifications',
        category: 'marketing_growth',
        resource: 'announcements',
        action: 'update'
      },
      
      // Support Operations Permissions
      {
        name: 'support.read',
        displayName: 'View Support Info',
        description: 'View customer support information and tickets',
        category: 'support_operations',
        resource: 'support',
        action: 'read'
      },
      {
        name: 'support.update',
        displayName: 'Update Support',
        description: 'Update support tickets and customer information',
        category: 'support_operations',
        resource: 'support',
        action: 'update'
      },
      {
        name: 'subscriptions.read',
        displayName: 'View Subscriptions',
        description: 'View customer subscription information',
        category: 'subscription_management',
        resource: 'subscriptions',
        action: 'read'
      },
      {
        name: 'subscriptions.update',
        displayName: 'Update Subscriptions',
        description: 'Update customer subscription plans (non-financial)',
        category: 'subscription_management',
        resource: 'subscriptions',
        action: 'update'
      },
      {
        name: 'subscriptions.cancel',
        displayName: 'Cancel Subscriptions',
        description: 'Initiate subscription cancellations with policy',
        category: 'subscription_management',
        resource: 'subscriptions',
        action: 'cancel'
      },
      {
        name: 'receipts.create',
        displayName: 'Resend Receipts',
        description: 'Resend receipts and payment confirmations',
        category: 'support_operations',
        resource: 'receipts',
        action: 'create'
      },
      {
        name: 'impersonation.execute',
        displayName: 'User Impersonation',
        description: 'Impersonate users for support purposes',
        category: 'support_operations',
        resource: 'impersonation',
        action: 'execute'
      },
      
      // Analytics & Reports Permissions
      {
        name: 'analytics.read',
        displayName: 'View Analytics',
        description: 'View analytics data and insights',
        category: 'analytics_reports',
        resource: 'analytics',
        action: 'read'
      },
      {
        name: 'reports.read',
        displayName: 'View Reports',
        description: 'View all reports and dashboards',
        category: 'analytics_reports',
        resource: 'reports',
        action: 'read'
      },
      {
        name: 'financial_reports.read',
        displayName: 'View Financial Reports',
        description: 'View financial reports and metrics',
        category: 'billing_finance',
        resource: 'financial_reports',
        action: 'read'
      },
      
      // Security & System Administration Permissions
      {
        name: 'security_settings.read',
        displayName: 'View Security Settings',
        description: 'View security configurations and audit logs',
        category: 'security_settings',
        resource: 'security_settings',
        action: 'read'
      },
      {
        name: 'security_settings.update',
        displayName: 'Update Security Settings',
        description: 'Update security configurations and policies',
        category: 'security_settings',
        resource: 'security_settings',
        action: 'update'
      },
      {
        name: 'system_admin.create',
        displayName: 'System Admin Create',
        description: 'Create system-level configurations',
        category: 'system_admin',
        resource: 'system_admin',
        action: 'create'
      },
      {
        name: 'system_admin.read',
        displayName: 'System Admin Read',
        description: 'View system-level configurations',
        category: 'system_admin',
        resource: 'system_admin',
        action: 'read'
      },
      {
        name: 'system_admin.update',
        displayName: 'System Admin Update',
        description: 'Update system-level configurations',
        category: 'system_admin',
        resource: 'system_admin',
        action: 'update'
      },
      {
        name: 'system_admin.delete',
        displayName: 'System Admin Delete',
        description: 'Delete system-level configurations and perform destructive actions',
        category: 'system_admin',
        resource: 'system_admin',
        action: 'delete'
      },
      
      // User Management (RBAC) Permissions
      {
        name: 'user_management.create',
        displayName: 'Create User Management',
        description: 'Create roles and assign permissions',
        category: 'user_management',
        resource: 'user_management',
        action: 'create'
      },
      {
        name: 'user_management.read',
        displayName: 'View User Management',
        description: 'View roles, permissions, and user assignments',
        category: 'user_management',
        resource: 'user_management',
        action: 'read'
      },
      {
        name: 'user_management.update',
        displayName: 'Update User Management',
        description: 'Update roles, permissions, and user assignments',
        category: 'user_management',
        resource: 'user_management',
        action: 'update'
      },
      {
        name: 'user_management.delete',
        displayName: 'Delete User Management',
        description: 'Delete roles and remove permissions',
        category: 'user_management',
        resource: 'user_management',
        action: 'delete'
      }
    ];

    const createdPermissions = [];
    for (const permissionData of permissions) {
      const existingPermission = await Permission.findOne({ name: permissionData.name });
      if (!existingPermission) {
        const permission = new Permission(permissionData);
        await permission.save();
        createdPermissions.push(permission);
        console.log(`✅ Created permission: ${permissionData.name}`);
      } else {
        console.log(`⏭️  Permission already exists: ${permissionData.name}`);
      }
    }

    console.log(`📊 Permissions seeding completed. Created: ${createdPermissions.length}`);
    return createdPermissions;
  }

  static async seedRoles() {
    console.log('🌱 Seeding roles...');

    // Get all permissions for role assignments
    const allPermissions = await Permission.find({ isActive: true });
    const permissionMap = {};
    allPermissions.forEach(permission => {
      permissionMap[permission.name] = permission._id;
    });

    const roles = [
      {
        name: 'super_admin',
        displayName: 'Super Administrator',
        description: 'Full access including security settings and destructive actions. No permission checks required.',
        permissions: [] // Super Admin doesn't need explicit permissions
      },
      {
        name: 'finance_admin',
        displayName: 'Finance Administrator',
        description: 'Billing, invoices, refunds, payouts, taxes, financial reports.',
        permissions: [
          'billing.create', 'billing.read', 'billing.update',
          'refunds.create', 'refunds.read',
          'payouts.create', 'payouts.read',
          'taxes.read', 'taxes.update',
          'financial_reports.read',
          'users.read', // For billing purposes
          'subscriptions.read', // For billing purposes
          'reports.read' // Financial reports
        ]
      },
      {
        name: 'growth_marketing',
        displayName: 'Growth & Marketing',
        description: 'Discounts, campaigns, announcements, analytics read access.',
        permissions: [
          'campaigns.create', 'campaigns.read', 'campaigns.update',
          'discounts.create', 'discounts.read', 'discounts.update',
          'announcements.create', 'announcements.read', 'announcements.update',
          'analytics.read',
          'reports.read',
          'users.read' // For marketing analytics
        ]
      },
      {
        name: 'support',
        displayName: 'Customer Support',
        description: 'Subscriber lookup, plan changes (non-financial), resend receipts, initiate cancellations, impersonation.',
        permissions: [
          'users.read', 'users.update', // Customer lookup and updates
          'subscriptions.read', 'subscriptions.update', 'subscriptions.cancel',
          'support.read', 'support.update',
          'receipts.create', // Resend receipts
          'impersonation.execute',
          'billing.read', // View only for support context
          'reports.read' // For support dashboards
        ]
      },
      {
        name: 'read_only',
        displayName: 'Read Only Access',
        description: 'All reports and dashboards, no write permissions.',
        permissions: [
          'users.read',
          'billing.read',
          'refunds.read',
          'payouts.read',
          'taxes.read',
          'campaigns.read',
          'discounts.read',
          'announcements.read',
          'subscriptions.read',
          'support.read',
          'analytics.read',
          'reports.read',
          'financial_reports.read'
        ]
      }
    ];

    const createdRoles = [];
    for (const roleData of roles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (!existingRole) {
        // Map permission names to IDs
        const permissionIds = roleData.permissions
          .map(permissionName => permissionMap[permissionName])
          .filter(id => id); // Remove any undefined IDs

        const role = new Role({
          name: roleData.name,
          displayName: roleData.displayName,
          description: roleData.description,
          permissions: permissionIds
        });

        await role.save();
        createdRoles.push(role);
        console.log(`✅ Created role: ${roleData.name} with ${permissionIds.length} permissions`);
      } else {
        console.log(`⏭️  Role already exists: ${roleData.name}`);
      }
    }

    console.log(`📊 Roles seeding completed. Created: ${createdRoles.length}`);
    return createdRoles;
  }

  static async assignSuperAdminRole(userId) {
    console.log(`🌱 Assigning Super Admin role to user: ${userId}`);

    try {
      // Find super admin role
      const superAdminRole = await Role.findOne({ name: 'super_admin' });
      if (!superAdminRole) {
        console.error('❌ Super Admin role not found. Please run role seeding first.');
        return false;
      }

      // Check if user already has super admin role
      const existingAssignment = await UserRole.findOne({
        userId,
        roleId: superAdminRole._id,
        isActive: true
      });

      if (existingAssignment) {
        console.log('⏭️  User already has Super Admin role');
        return true;
      }

      // Assign super admin role
      const userRole = new UserRole({
        userId,
        roleId: superAdminRole._id,
        assignedBy: userId, // Self-assigned during seeding
        notes: 'Assigned during system initialization'
      });

      await userRole.save();
      console.log('✅ Super Admin role assigned successfully');
      return true;

    } catch (error) {
      console.error('❌ Error assigning Super Admin role:', error.message);
      return false;
    }
  }

  static async seedAll(superAdminUserId = null) {
    try {
      console.log('🚀 Starting RBAC system seeding...');
      
      await this.seedPermissions();
      await this.seedRoles();
      
      if (superAdminUserId) {
        await this.assignSuperAdminRole(superAdminUserId);
      }
      
      console.log('🎉 RBAC system seeding completed successfully!');
      return true;
      
    } catch (error) {
      console.error('❌ RBAC seeding failed:', error.message);
      throw error;
    }
  }

  static async resetRBAC() {
    try {
      console.log('🧹 Resetting RBAC system...');
      
      await UserRole.deleteMany({});
      console.log('✅ Cleared user role assignments');
      
      await Role.deleteMany({});
      console.log('✅ Cleared roles');
      
      await Permission.deleteMany({});
      console.log('✅ Cleared permissions');
      
      console.log('🎉 RBAC system reset completed!');
      return true;
      
    } catch (error) {
      console.error('❌ RBAC reset failed:', error.message);
      throw error;
    }
  }
}

module.exports = RBACSeeder;

// If running directly
if (require.main === module) {
  const connectDB = require('../../../config/db');
  
  const runSeeder = async () => {
    try {
      await connectDB();
      
      const command = process.argv[2];
      const userId = process.argv[3];
      
      switch (command) {
        case 'seed':
          await RBACSeeder.seedAll(userId);
          break;
        case 'reset':
          await RBACSeeder.resetRBAC();
          break;
        case 'assign-super-admin':
          if (!userId) {
            console.error('❌ User ID is required for assign-super-admin command');
            process.exit(1);
          }
          await RBACSeeder.assignSuperAdminRole(userId);
          break;
        default:
          console.log('📖 Usage:');
          console.log('  node rbac.seeder.js seed [userId]           - Seed all roles and permissions');
          console.log('  node rbac.seeder.js reset                   - Reset RBAC system');
          console.log('  node rbac.seeder.js assign-super-admin <userId> - Assign super admin role to user');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Seeder error:', error.message);
      process.exit(1);
    }
  };
  
  runSeeder();
}