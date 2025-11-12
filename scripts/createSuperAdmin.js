const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import AdminUser model
const AdminUser = require('../src/admin/models/adminUser.model');

/**
 * Create Super Admin User
 * Email: info@eagle-investors.com
 * Password: EagleInvestor$123
 */
const createSuperAdmin = async () => {
    try {
        // Get MongoDB URI from environment
        const mongoUri = process.env.MONGODB_URI ||
            process.env.MONGO_URI ||
            'mongodb://localhost:27017/eagle-investors';

        console.log('\n🚀 Creating Super Admin User\n');
        console.log('Connecting to database...');
        console.log('Using URI:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password in log

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to database\n');

        // Super Admin credentials
        const superAdminEmail = 'info@eagle-investors.com';
        const superAdminPassword = 'EagleInvestor$123';

        // Check if super admin already exists
        const existingAdmin = await AdminUser.findOne({ email: superAdminEmail });

        if (existingAdmin) {
            console.log('⚠️  Super Admin with this email already exists!\n');
            console.log('📌 Existing Super Admin Details:');
            console.log('   Name:', existingAdmin.fullName);
            console.log('   Email:', existingAdmin.email);
            console.log('   Username:', existingAdmin.username);
            console.log('   Admin Level:', existingAdmin.adminLevel);
            console.log('   Department:', existingAdmin.department);
            console.log('   Active:', existingAdmin.isActive);
            console.log('   Created:', existingAdmin.createdAt.toLocaleString());
            console.log('   Last Login:', existingAdmin.lastLoginAt ? existingAdmin.lastLoginAt.toLocaleString() : 'Never');

            // Ask if user wants to update password
            console.log('\n💡 To update the password, you can use the password reset functionality.');
            console.log('   Or delete this user and run the script again.\n');

            return existingAdmin;
        }

    // Create new super admin
    const superAdmin = new AdminUser({
      firstName: 'Eagle',
      lastName: 'Investor',
      email: superAdminEmail,
      username: 'eagle_admin',
      password: superAdminPassword, // Will be hashed by pre-save hook
      phone: '+1 800 324 5346',
      adminLevel: 'super_admin',
      department: 'executive',
      employeeId: `EMP-SA-${Date.now()}`,
      bio: 'Eagle Investors Super Administrator',
      isActive: true,
      isEmailVerified: true,
      isTwoFactorEnabled: false,
      permissions: [] // Super admin has implicit all permissions
    });        await superAdmin.save();

        console.log('✅ Super Admin created successfully!\n');
        console.log('='.repeat(60));
        console.log('📋 SUPER ADMIN DETAILS');
        console.log('='.repeat(60));
        console.log('Name:          ', superAdmin.fullName);
        console.log('Email:         ', superAdmin.email);
        console.log('Username:      ', superAdmin.username);
        console.log('Password:      ', superAdminPassword);
        console.log('Admin Level:   ', superAdmin.adminLevel);
        console.log('Department:    ', superAdmin.department);
        console.log('Employee ID:   ', superAdmin.employeeId);
        console.log('User ID:       ', superAdmin._id);
        console.log('Active:        ', superAdmin.isActive);
        console.log('Email Verified:', superAdmin.isEmailVerified);
        console.log('Created At:    ', superAdmin.createdAt.toLocaleString());
        console.log('='.repeat(60));

        console.log('\n🔐 LOGIN CREDENTIALS');
        console.log('='.repeat(60));
        console.log('Email:    ', superAdminEmail);
        console.log('Password: ', superAdminPassword);
        console.log('='.repeat(60));

        console.log('\n✨ Super Admin has full access to:');
        console.log('   ✓ User Management');
        console.log('   ✓ Subscription Management');
        console.log('   ✓ Financial Operations');
        console.log('   ✓ Analytics & Reports');
        console.log('   ✓ System Settings');
        console.log('   ✓ Admin Management');
        console.log('   ✓ Support & Impersonation');
        console.log('   ✓ All Platform Features\n');

        return superAdmin;

    } catch (error) {
        console.error('\n❌ Error creating super admin:', error.message);

        if (error.name === 'ValidationError') {
            console.error('\n🔴 Validation Errors:');
            Object.keys(error.errors).forEach(key => {
                console.error(`   - ${key}: ${error.errors[key].message}`);
            });
        }

        if (error.code === 11000) {
            console.error('\n🔴 Duplicate Key Error:');
            console.error('   A user with this email or username already exists.');
            console.error('   Please check existing users or use a different email/username.');
        }

        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from database\n');
    }
};

// Run the script
if (require.main === module) {
    createSuperAdmin()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Fatal Error:', error);
            process.exit(1);
        });
}

module.exports = createSuperAdmin;
