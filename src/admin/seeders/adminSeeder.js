const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/adminUser.model');
const Role = require('../models/role.model');
const Permission = require('../models/permission.model');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ MongoDB connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Seed Permissions
 */
const seedPermissions = async () => {
  console.log('🌱 Seeding permissions...');

  const permissions = [
    // User Management
    { name: 'users.create', displayName: 'Create Users', description: 'Create new user accounts', category: 'user_management', resource: 'users', action: 'create' },
    { name: 'users.read', displayName: 'Read Users', description: 'View user profiles and lists', category: 'user_management', resource: 'users', action: 'read' },
    { name: 'users.update', displayName: 'Update Users', description: 'Modify user accounts', category: 'user_management', resource: 'users', action: 'update' },
    { name: 'users.delete', displayName: 'Delete Users', description: 'Remove user accounts', category: 'user_management', resource: 'users', action: 'delete' },
    
    // Billing & Finance
    { name: 'billing.read', displayName: 'Read Billing', description: 'View billing information', category: 'billing_finance', resource: 'billing', action: 'read' },
    { name: 'billing.update', displayName: 'Update Billing', description: 'Modify billing settings', category: 'billing_finance', resource: 'billing', action: 'update' },
    { name: 'invoices.create', displayName: 'Create Invoices', description: 'Generate invoices', category: 'billing_finance', resource: 'invoices', action: 'create' },
    { name: 'invoices.read', displayName: 'Read Invoices', description: 'View invoices', category: 'billing_finance', resource: 'invoices', action: 'read' },
    { name: 'refunds.create', displayName: 'Process Refunds', description: 'Process customer refunds', category: 'billing_finance', resource: 'refunds', action: 'create' },
    { name: 'refunds.approve', displayName: 'Approve Refunds', description: 'Approve refund requests', category: 'billing_finance', resource: 'refunds', action: 'approve' },
    { name: 'payouts.execute', displayName: 'Execute Payouts', description: 'Process payouts', category: 'billing_finance', resource: 'payouts', action: 'execute' },
    
    // Marketing & Growth
    { name: 'campaigns.create', displayName: 'Create Campaigns', description: 'Create marketing campaigns', category: 'marketing_growth', resource: 'campaigns', action: 'create' },
    { name: 'campaigns.read', displayName: 'Read Campaigns', description: 'View marketing campaigns', category: 'marketing_growth', resource: 'campaigns', action: 'read' },
    { name: 'campaigns.update', displayName: 'Update Campaigns', description: 'Modify marketing campaigns', category: 'marketing_growth', resource: 'campaigns', action: 'update' },
    { name: 'discounts.create', displayName: 'Create Discounts', description: 'Create discount codes', category: 'marketing_growth', resource: 'discounts', action: 'create' },
    { name: 'discounts.read', displayName: 'Read Discounts', description: 'View discount codes', category: 'marketing_growth', resource: 'discounts', action: 'read' },
    { name: 'announcements.create', displayName: 'Create Announcements', description: 'Create announcements', category: 'marketing_growth', resource: 'announcements', action: 'create' },
    
    // Support Operations
    { name: 'support.read', displayName: 'Read Support Tickets', description: 'View support tickets', category: 'support_operations', resource: 'support', action: 'read' },
    { name: 'support.update', displayName: 'Update Support Tickets', description: 'Respond to support tickets', category: 'support_operations', resource: 'support', action: 'update' },
    { name: 'subscriptions.update', displayName: 'Update Subscriptions', description: 'Modify user subscriptions', category: 'subscription_management', resource: 'subscriptions', action: 'update' },
    { name: 'subscriptions.cancel', displayName: 'Cancel Subscriptions', description: 'Cancel user subscriptions', category: 'subscription_management', resource: 'subscriptions', action: 'cancel' },
    
    // Analytics & Reports
    { name: 'analytics.read', displayName: 'Read Analytics', description: 'View analytics and reports', category: 'analytics_reports', resource: 'analytics', action: 'read' },
    { name: 'reports.read', displayName: 'Read Reports', description: 'View system reports', category: 'analytics_reports', resource: 'reports', action: 'read' },
    
    // Security & System Admin
    { name: 'admin.create', displayName: 'Create Admins', description: 'Create new admin accounts', category: 'system_admin', resource: 'admin', action: 'create' },
    { name: 'admin.read', displayName: 'Read Admins', description: 'View admin accounts', category: 'system_admin', resource: 'admin', action: 'read' },
    { name: 'admin.update', displayName: 'Update Admins', description: 'Modify admin accounts', category: 'system_admin', resource: 'admin', action: 'update' },
    { name: 'admin.delete', displayName: 'Delete Admins', description: 'Remove admin accounts', category: 'system_admin', resource: 'admin', action: 'delete' },
    { name: 'security.read', displayName: 'Read Security', description: 'View security settings', category: 'security_settings', resource: 'security', action: 'read' },
    { name: 'security.update', displayName: 'Update Security', description: 'Modify security settings', category: 'security_settings', resource: 'security', action: 'update' },
  ];

  try {
    // Drop the entire collection to avoid index issues
    await Permission.collection.drop().catch(() => console.log('Permissions collection did not exist'));
    
    // Insert new permissions
    const createdPermissions = await Permission.insertMany(permissions);
    console.log(`✅ Created ${createdPermissions.length} permissions`);
    
    return createdPermissions;
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  }
};

/**
 * Seed Roles with Permissions
 */
const seedRoles = async (permissions) => {
  console.log('🌱 Seeding roles...');

  // Create permission lookup
  const permissionMap = {};
  permissions.forEach(p => {
    permissionMap[p.name] = p._id;
  });

  const roles = [
    {
      name: 'super_admin',
      displayName: 'Super Administrator',
      description: 'Full system access including security settings and destructive actions',
      permissions: Object.values(permissionMap), // All permissions
      isActive: true
    },
    {
      name: 'finance_admin',
      displayName: 'Finance Administrator',
      description: 'Billing, invoices, refunds, payouts, taxes, financial reports',
      permissions: [
        permissionMap['users.read'],
        permissionMap['billing.read'],
        permissionMap['billing.update'],
        permissionMap['invoices.create'],
        permissionMap['invoices.read'],
        permissionMap['refunds.create'],
        permissionMap['refunds.approve'],
        permissionMap['payouts.execute'],
        permissionMap['analytics.read'],
        permissionMap['reports.read'],
        permissionMap['subscriptions.update'],
        permissionMap['subscriptions.cancel']
      ].filter(Boolean),
      isActive: true
    },
    {
      name: 'growth_marketing',
      displayName: 'Growth/Marketing',
      description: 'Discounts, campaigns, announcements, analytics read',
      permissions: [
        permissionMap['users.read'],
        permissionMap['campaigns.create'],
        permissionMap['campaigns.read'],
        permissionMap['campaigns.update'],
        permissionMap['discounts.create'],
        permissionMap['discounts.read'],
        permissionMap['announcements.create'],
        permissionMap['analytics.read'],
        permissionMap['reports.read']
      ].filter(Boolean),
      isActive: true
    },
    {
      name: 'support',
      displayName: 'Support Agent',
      description: 'Customer support, subscription management (non-financial), user lookup',
      permissions: [
        permissionMap['users.read'],
        permissionMap['support.read'],
        permissionMap['support.update'],
        permissionMap['subscriptions.update'],
        permissionMap['subscriptions.cancel'],
        permissionMap['analytics.read']
      ].filter(Boolean),
      isActive: true
    },
    {
      name: 'read_only',
      displayName: 'Read-Only Access',
      description: 'All reports and dashboards, no write permissions',
      permissions: [
        permissionMap['users.read'],
        permissionMap['billing.read'],
        permissionMap['invoices.read'],
        permissionMap['campaigns.read'],
        permissionMap['discounts.read'],
        permissionMap['support.read'],
        permissionMap['analytics.read'],
        permissionMap['reports.read']
      ].filter(Boolean),
      isActive: true
    }
  ];

  try {
    // Drop the entire collection to avoid index issues
    await Role.collection.drop().catch(() => console.log('Roles collection did not exist'));
    
    // Insert new roles one by one to avoid bulk insert issues
    const createdRoles = [];
    for (const roleData of roles) {
      const role = new Role(roleData);
      const savedRole = await role.save();
      createdRoles.push(savedRole);
    }
    console.log(`✅ Created ${createdRoles.length} roles`);
    
    return createdRoles;
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
    throw error;
  }
};

/**
 * Seed Initial Admin Users
 */
const seedAdminUsers = async () => {
  console.log('🌱 Seeding admin users...');

  const adminUsers = [
    {
      firstName: 'Rasel',
      lastName: 'Hossain',
      email: 'raselhossain86666@gmail.com',
      username: 'raselhossain',
      password: 'Admin123@@', // This will be hashed by the model
      adminLevel: 'super_admin',
      department: 'executive',
      employeeId: 'EMP001',
      isActive: true,
      isEmailVerified: true,
      forcePasswordChange: false, // Set to true if you want to force password change on first login
      permissions: [
        { module: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { module: 'billing', actions: ['create', 'read', 'update', 'delete', 'approve'] },
        { module: 'security', actions: ['read', 'update'] },
        { module: 'admin', actions: ['create', 'read', 'update', 'delete'] }
      ],
      bio: 'System Administrator with full access to all platform features.'
    },
    {
      firstName: 'Finance',
      lastName: 'Manager',
      email: 'finance@eagle.com',
      username: 'financeadmin',
      password: 'Finance123!@#',
      adminLevel: 'finance_admin',
      department: 'finance',
      employeeId: 'EMP002',
      isActive: true,
      isEmailVerified: true,
      forcePasswordChange: true,
      permissions: [
        { module: 'billing', actions: ['read', 'update'] },
        { module: 'invoices', actions: ['create', 'read'] },
        { module: 'refunds', actions: ['create', 'approve'] },
        { module: 'reports', actions: ['read'] }
      ],
      bio: 'Finance administrator managing billing, invoices, and financial operations.'
    },
    {
      firstName: 'Marketing',
      lastName: 'Lead',
      email: 'marketing@eagle.com',
      username: 'marketinglead',
      password: 'Marketing123!@#',
      adminLevel: 'growth_marketing',
      department: 'marketing',
      employeeId: 'EMP003',
      isActive: true,
      isEmailVerified: true,
      forcePasswordChange: true,
      permissions: [
        { module: 'campaigns', actions: ['create', 'read', 'update'] },
        { module: 'discounts', actions: ['create', 'read'] },
        { module: 'analytics', actions: ['read'] }
      ],
      bio: 'Marketing lead responsible for growth campaigns and promotional activities.'
    },
    {
      firstName: 'Support',
      lastName: 'Agent',
      email: 'support@eagle.com',
      username: 'supportagent',
      password: 'Support123!@#',
      adminLevel: 'support',
      department: 'support',
      employeeId: 'EMP004',
      isActive: true,
      isEmailVerified: true,
      forcePasswordChange: true,
      permissions: [
        { module: 'users', actions: ['read'] },
        { module: 'support', actions: ['read', 'update'] },
        { module: 'subscriptions', actions: ['read', 'update'] }
      ],
      bio: 'Customer support agent helping users with their inquiries and issues.'
    },
    {
      firstName: 'Read',
      lastName: 'Only',
      email: 'readonly@eagle.com',
      username: 'readonly',
      password: 'ReadOnly123!@#',
      adminLevel: 'read_only',
      department: 'operations',
      employeeId: 'EMP005',
      isActive: true,
      isEmailVerified: true,
      forcePasswordChange: true,
      permissions: [
        { module: 'analytics', actions: ['read'] },
        { module: 'reports', actions: ['read'] },
        { module: 'users', actions: ['read'] }
      ],
      bio: 'Read-only access for monitoring and reporting purposes.'
    }
  ];

  try {
    // Drop the entire collection to avoid index issues
    await AdminUser.collection.drop().catch(() => console.log('AdminUsers collection did not exist'));
    
    // Insert new admin users
    for (const userData of adminUsers) {
      const adminUser = new AdminUser(userData);
      await adminUser.save();
      console.log(`✅ Created admin user: ${userData.email} (${userData.adminLevel})`);
    }
    
    console.log(`✅ Created ${adminUsers.length} admin users`);
    return adminUsers.length;
  } catch (error) {
    console.error('❌ Error seeding admin users:', error);
    throw error;
  }
};

/**
 * Main seeder function
 */
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    await connectDB();
    
    // Seed in order: Permissions -> Roles -> Admin Users
    const permissions = await seedPermissions();
    const roles = await seedRoles(permissions);
    const adminUsersCount = await seedAdminUsers();
    
    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Permissions: ${permissions.length}`);
    console.log(`   - Roles: ${roles.length}`);
    console.log(`   - Admin Users: ${adminUsersCount}`);
    
    console.log('\n🔐 Admin Login Credentials:');
    console.log('┌─────────────────┬──────────────────────────┬─────────────────┬─────────────────┐');
    console.log('│ Role            │ Email                    │ Username        │ Password        │');
    console.log('├─────────────────┼──────────────────────────┼─────────────────┼─────────────────┤');
    console.log('│ Super Admin     │ raselhossain86666@gmail..│ raselhossain    │ Admin123@@      │');
    console.log('│ Finance Admin   │ finance@eagle.com        │ financeadmin    │ Finance123!@#   │');
    console.log('│ Marketing Lead  │ marketing@eagle.com      │ marketinglead   │ Marketing123!@# │');
    console.log('│ Support Agent   │ support@eagle.com        │ supportagent    │ Support123!@#   │');
    console.log('│ Read Only       │ readonly@eagle.com       │ readonly        │ ReadOnly123!@#  │');
    console.log('└─────────────────┴──────────────────────────┴─────────────────┴─────────────────┘');
    
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('   - All users except Super Admin have forcePasswordChange = true');
    console.log('   - Change these default passwords in production');
    console.log('   - Super Admin has access to all features');
    console.log('   - Each role has specific permissions as per business requirements');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedPermissions, seedRoles, seedAdminUsers };