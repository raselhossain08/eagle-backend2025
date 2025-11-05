const AdminUser = require('../models/adminUser.model');

/**
 * Admin User Seeder
 * Creates default admin users for different roles
 */
class AdminUserSeeder {
  
  static async seedAdminUsers() {
    console.log('🌱 Seeding admin users...');

    const adminUsers = [
      {
        firstName: 'Super',
        lastName: 'Administrator',
        email: 'superadmin@eagle.com',
        username: 'superadmin',
        password: 'SuperAdmin@123',
        adminLevel: 'super_admin',
        department: 'executive',
        employeeId: 'EMP-001',
        bio: 'System Super Administrator with full access',
        isEmailVerified: true,
        permissions: [] // Super admin doesn't need explicit permissions
      },
      {
        firstName: 'Finance',
        lastName: 'Manager',
        email: 'finance@eagle.com',
        username: 'financeadmin',
        password: 'Finance@123',
        adminLevel: 'finance_admin',
        department: 'finance',
        employeeId: 'EMP-002',
        bio: 'Finance Administrator managing billing and financial operations',
        isEmailVerified: true,
        permissions: [
          {
            module: 'billing',
            actions: ['create', 'read', 'update']
          },
          {
            module: 'invoices',
            actions: ['create', 'read', 'update']
          },
          {
            module: 'refunds',
            actions: ['create', 'read']
          },
          {
            module: 'reports',
            actions: ['read']
          }
        ]
      },
      {
        firstName: 'Growth',
        lastName: 'Marketer',
        email: 'marketing@eagle.com',
        username: 'growthmarketing',
        password: 'Growth@123',
        adminLevel: 'growth_marketing',
        department: 'marketing',
        employeeId: 'EMP-003',
        bio: 'Growth and Marketing specialist handling campaigns and promotions',
        isEmailVerified: true,
        permissions: [
          {
            module: 'campaigns',
            actions: ['create', 'read', 'update']
          },
          {
            module: 'discounts',
            actions: ['create', 'read', 'update']
          },
          {
            module: 'analytics',
            actions: ['read']
          },
          {
            module: 'announcements',
            actions: ['create', 'read', 'update']
          }
        ]
      },
      {
        firstName: 'Customer',
        lastName: 'Support',
        email: 'support@eagle.com',
        username: 'support',
        password: 'Support@123',
        adminLevel: 'support',
        department: 'support',
        employeeId: 'EMP-004',
        bio: 'Customer Support agent handling user queries and subscriptions',
        isEmailVerified: true,
        permissions: [
          {
            module: 'users',
            actions: ['read', 'update']
          },
          {
            module: 'subscriptions',
            actions: ['read', 'update']
          },
          {
            module: 'tickets',
            actions: ['create', 'read', 'update']
          },
          {
            module: 'receipts',
            actions: ['create']
          }
        ]
      },
      {
        firstName: 'Read',
        lastName: 'Only',
        email: 'readonly@eagle.com',
        username: 'readonly',
        password: 'ReadOnly@123',
        adminLevel: 'read_only',
        department: 'operations',
        employeeId: 'EMP-005',
        bio: 'Read-only access for viewing reports and dashboards',
        isEmailVerified: true,
        permissions: [
          {
            module: 'reports',
            actions: ['read']
          },
          {
            module: 'analytics',
            actions: ['read']
          },
          {
            module: 'dashboards',
            actions: ['read']
          }
        ]
      }
    ];

    const createdUsers = [];
    let superAdminId = null;

    for (const userData of adminUsers) {
      try {
        // Check if user already exists
        const existingUser = await AdminUser.findOne({
          $or: [
            { email: userData.email },
            { username: userData.username }
          ]
        });

        if (existingUser) {
          console.log(`⏭️  Admin user already exists: ${userData.username}`);
          if (userData.adminLevel === 'super_admin') {
            superAdminId = existingUser._id;
          }
          continue;
        }

        // Create admin user
        const adminUser = new AdminUser(userData);
        await adminUser.save();

        if (userData.adminLevel === 'super_admin') {
          superAdminId = adminUser._id;
        }

        createdUsers.push(adminUser);
        console.log(`✅ Created admin user: ${userData.username} (${userData.adminLevel})`);
      } catch (error) {
        console.error(`❌ Error creating admin user ${userData.username}:`, error.message);
      }
    }

    // Update createdBy for all created users (set to super admin)
    if (superAdminId && createdUsers.length > 0) {
      for (const user of createdUsers) {
        if (user._id.toString() !== superAdminId.toString()) {
          user.createdBy = superAdminId;
          await user.save();
        }
      }
      console.log('✅ Updated createdBy references');
    }

    console.log(`📊 Admin users seeding completed. Created: ${createdUsers.length}`);
    return { createdUsers, superAdminId };
  }

  static async createSuperAdmin(userData) {
    console.log('🌱 Creating Super Admin...');

    const {
      firstName = 'Super',
      lastName = 'Administrator',
      email,
      username,
      password,
      employeeId
    } = userData;

    if (!email || !username || !password) {
      throw new Error('Email, username, and password are required for Super Admin creation');
    }

    try {
      // Check if super admin already exists
      const existingSuperAdmin = await AdminUser.findOne({ adminLevel: 'super_admin' });
      if (existingSuperAdmin) {
        console.log('⏭️  Super Admin already exists');
        return existingSuperAdmin;
      }

      // Check if email/username already exists
      const existingUser = await AdminUser.findOne({
        $or: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      });

      if (existingUser) {
        throw new Error('Admin user with this email or username already exists');
      }

      const superAdmin = new AdminUser({
        firstName,
        lastName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password,
        adminLevel: 'super_admin',
        department: 'executive',
        employeeId,
        bio: 'System Super Administrator',
        isEmailVerified: true,
        isActive: true
      });

      await superAdmin.save();
      console.log(`✅ Super Admin created: ${username}`);
      return superAdmin;

    } catch (error) {
      console.error('❌ Error creating Super Admin:', error.message);
      throw error;
    }
  }

  static async resetAdminUsers() {
    try {
      console.log('🧹 Resetting admin users...');
      
      const result = await AdminUser.deleteMany({});
      console.log(`✅ Deleted ${result.deletedCount} admin users`);
      
      return result;
    } catch (error) {
      console.error('❌ Error resetting admin users:', error.message);
      throw error;
    }
  }

  static async updateAdminPermissions() {
    console.log('🔄 Updating admin permissions based on roles...');

    try {
      // Update Finance Admin permissions
      await AdminUser.updateMany(
        { adminLevel: 'finance_admin' },
        {
          $set: {
            permissions: [
              { module: 'billing', actions: ['create', 'read', 'update'] },
              { module: 'invoices', actions: ['create', 'read', 'update'] },
              { module: 'refunds', actions: ['create', 'read'] },
              { module: 'payouts', actions: ['create', 'read'] },
              { module: 'taxes', actions: ['read', 'update'] },
              { module: 'financial_reports', actions: ['read'] },
              { module: 'users', actions: ['read'] }
            ]
          }
        }
      );

      // Update Growth/Marketing permissions
      await AdminUser.updateMany(
        { adminLevel: 'growth_marketing' },
        {
          $set: {
            permissions: [
              { module: 'campaigns', actions: ['create', 'read', 'update'] },
              { module: 'discounts', actions: ['create', 'read', 'update'] },
              { module: 'announcements', actions: ['create', 'read', 'update'] },
              { module: 'analytics', actions: ['read'] },
              { module: 'reports', actions: ['read'] },
              { module: 'users', actions: ['read'] }
            ]
          }
        }
      );

      // Update Support permissions
      await AdminUser.updateMany(
        { adminLevel: 'support' },
        {
          $set: {
            permissions: [
              { module: 'users', actions: ['read', 'update'] },
              { module: 'subscriptions', actions: ['read', 'update'] },
              { module: 'support', actions: ['read', 'update'] },
              { module: 'receipts', actions: ['create'] },
              { module: 'impersonation', actions: ['execute'] },
              { module: 'billing', actions: ['read'] }
            ]
          }
        }
      );

      // Update Read-Only permissions
      await AdminUser.updateMany(
        { adminLevel: 'read_only' },
        {
          $set: {
            permissions: [
              { module: 'users', actions: ['read'] },
              { module: 'billing', actions: ['read'] },
              { module: 'subscriptions', actions: ['read'] },
              { module: 'analytics', actions: ['read'] },
              { module: 'reports', actions: ['read'] },
              { module: 'campaigns', actions: ['read'] },
              { module: 'support', actions: ['read'] }
            ]
          }
        }
      );

      console.log('✅ Admin permissions updated successfully');
    } catch (error) {
      console.error('❌ Error updating admin permissions:', error.message);
      throw error;
    }
  }

  static async seedAll() {
    try {
      console.log('🚀 Starting admin users seeding...');
      
      const result = await this.seedAdminUsers();
      await this.updateAdminPermissions();
      
      console.log('🎉 Admin users seeding completed successfully!');
      return result;
      
    } catch (error) {
      console.error('❌ Admin users seeding failed:', error.message);
      throw error;
    }
  }
}

module.exports = AdminUserSeeder;

// If running directly
if (require.main === module) {
  const connectDB = require('../../../config/db');
  
  const runSeeder = async () => {
    try {
      await connectDB();
      
      const command = process.argv[2];
      
      switch (command) {
        case 'seed':
          await AdminUserSeeder.seedAll();
          break;
        case 'reset':
          await AdminUserSeeder.resetAdminUsers();
          break;
        case 'update-permissions':
          await AdminUserSeeder.updateAdminPermissions();
          break;
        case 'create-super-admin':
          const email = process.argv[3];
          const username = process.argv[4];
          const password = process.argv[5];
          
          if (!email || !username || !password) {
            console.error('❌ Usage: node adminUser.seeder.js create-super-admin <email> <username> <password>');
            process.exit(1);
          }
          
          await AdminUserSeeder.createSuperAdmin({ email, username, password });
          break;
        default:
          console.log('📖 Usage:');
          console.log('  node adminUser.seeder.js seed                               - Seed all admin users');
          console.log('  node adminUser.seeder.js reset                             - Reset admin users');
          console.log('  node adminUser.seeder.js update-permissions                - Update permissions');
          console.log('  node adminUser.seeder.js create-super-admin <email> <username> <password> - Create super admin');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Seeder error:', error.message);
      process.exit(1);
    }
  };
  
  runSeeder();
}