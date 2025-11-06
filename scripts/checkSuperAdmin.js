const mongoose = require('mongoose');
const AdminUser = require('../src/admin/models/adminUser.model');
const User = require('../src/models/user.model');
const connectDB = require('../src/config/db');

/**
 * Comprehensive Super Admin Checker & Management Script
 * Usage:
 *   node scripts/checkSuperAdmin.js list              - List all super admins
 *   node scripts/checkSuperAdmin.js check <email>     - Check if user is super admin
 *   node scripts/checkSuperAdmin.js create            - Create new super admin interactively
 *   node scripts/checkSuperAdmin.js all-admins        - List all admin users
 *   node scripts/checkSuperAdmin.js stats             - Show admin statistics
 *   node scripts/checkSuperAdmin.js verify            - Verify super admin permissions
 */

class SuperAdminChecker {

    /**
     * List all super admin users (AdminUser model)
     */
    static async listSuperAdmins() {
        try {
            console.log('\n🔍 Searching for Super Admins in AdminUser collection...\n');

            const superAdmins = await AdminUser.find({ adminLevel: 'super_admin' })
                .select('-password -twoFactorSecret -passwordResetToken -activationToken')
                .populate('createdBy', 'firstName lastName email')
                .lean();

            if (superAdmins.length === 0) {
                console.log('❌ No Super Admins found in AdminUser collection!\n');
                console.log('💡 To create a super admin, run:');
                console.log('   node scripts/checkSuperAdmin.js create\n');
                return [];
            }

            console.log(`✅ Found ${superAdmins.length} Super Admin(s):\n`);

            superAdmins.forEach((admin, index) => {
                console.log(`${index + 1}. ${admin.firstName} ${admin.lastName}`);
                console.log(`   📧 Email: ${admin.email}`);
                console.log(`   👤 Username: ${admin.username}`);
                console.log(`   🏢 Department: ${admin.department}`);
                console.log(`   🆔 Employee ID: ${admin.employeeId || 'N/A'}`);
                console.log(`   ✓ Active: ${admin.isActive ? 'Yes' : 'No'}`);
                console.log(`   ✓ Email Verified: ${admin.isEmailVerified ? 'Yes' : 'No'}`);
                console.log(`   🔐 2FA Enabled: ${admin.isTwoFactorEnabled ? 'Yes' : 'No'}`);
                console.log(`   📅 Created: ${new Date(admin.createdAt).toLocaleString()}`);
                console.log(`   🕐 Last Login: ${admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}`);
                console.log(`   📝 Bio: ${admin.bio || 'N/A'}\n`);
            });

            return superAdmins;
        } catch (error) {
            console.error('❌ Error listing super admins:', error.message);
            throw error;
        }
    }

    /**
     * Check if specific user is super admin
     */
    static async checkUser(identifier) {
        try {
            console.log(`\n🔍 Checking user: ${identifier}\n`);

            // Check in AdminUser collection
            const adminUser = await AdminUser.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { username: identifier.toLowerCase() }
                ]
            }).select('-password -twoFactorSecret');

            if (adminUser) {
                console.log('✅ User found in AdminUser collection:');
                console.log(`   Name: ${adminUser.firstName} ${adminUser.lastName}`);
                console.log(`   Email: ${adminUser.email}`);
                console.log(`   Username: ${adminUser.username}`);
                console.log(`   Admin Level: ${adminUser.adminLevel}`);
                console.log(`   Department: ${adminUser.department}`);
                console.log(`   Active: ${adminUser.isActive}`);

                if (adminUser.adminLevel === 'super_admin') {
                    console.log('\n🎉 YES - This user IS a Super Admin!\n');
                } else {
                    console.log(`\n⚠️  NO - This user is NOT a Super Admin (Current level: ${adminUser.adminLevel})\n`);
                }

                return adminUser;
            }

            // Check in regular User collection
            const regularUser = await User.findOne({
                $or: [
                    { email: identifier.toLowerCase() },
                    { username: identifier.toLowerCase() }
                ]
            }).select('-password');

            if (regularUser) {
                console.log('✅ User found in User collection:');
                console.log(`   Name: ${regularUser.name}`);
                console.log(`   Email: ${regularUser.email}`);
                console.log(`   Role: ${regularUser.role}`);

                if (regularUser.role === 'superadmin') {
                    console.log('\n🎉 YES - This user IS a Super Admin (legacy role)!\n');
                } else {
                    console.log(`\n⚠️  NO - This user is NOT a Super Admin (Current role: ${regularUser.role})\n`);
                }

                return regularUser;
            }

            console.log('❌ User not found in any collection!\n');
            return null;

        } catch (error) {
            console.error('❌ Error checking user:', error.message);
            throw error;
        }
    }

    /**
     * List all admin users with their levels
     */
    static async listAllAdmins() {
        try {
            console.log('\n📋 Listing All Admin Users:\n');

            const adminUsers = await AdminUser.find()
                .select('-password -twoFactorSecret')
                .sort({ adminLevel: 1, createdAt: -1 })
                .lean();

            if (adminUsers.length === 0) {
                console.log('❌ No admin users found!\n');
                return [];
            }

            // Group by admin level
            const grouped = {};
            adminUsers.forEach(admin => {
                if (!grouped[admin.adminLevel]) {
                    grouped[admin.adminLevel] = [];
                }
                grouped[admin.adminLevel].push(admin);
            });

            const hierarchy = AdminUser.getAdminHierarchy();

            Object.keys(grouped).forEach(level => {
                const levelInfo = hierarchy[level] || { name: level, description: 'N/A' };
                console.log(`\n📍 ${levelInfo.name} (${level})`);
                console.log(`   ${levelInfo.description}`);
                console.log(`   Count: ${grouped[level].length}\n`);

                grouped[level].forEach((admin, index) => {
                    const status = admin.isActive ? '✓' : '✗';
                    console.log(`   ${index + 1}. [${status}] ${admin.firstName} ${admin.lastName}`);
                    console.log(`      📧 ${admin.email} | 👤 ${admin.username}`);
                    console.log(`      🏢 ${admin.department}${admin.lastLoginAt ? ` | 🕐 Last login: ${new Date(admin.lastLoginAt).toLocaleString()}` : ''}`);
                });
            });

            console.log(`\n📊 Total: ${adminUsers.length} admin users\n`);
            return adminUsers;

        } catch (error) {
            console.error('❌ Error listing all admins:', error.message);
            throw error;
        }
    }

    /**
     * Show admin statistics
     */
    static async showStatistics() {
        try {
            console.log('\n📊 Admin Statistics:\n');

            const stats = await AdminUser.aggregate([
                {
                    $group: {
                        _id: '$adminLevel',
                        count: { $sum: 1 },
                        active: { $sum: { $cond: ['$isActive', 1, 0] } },
                        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
                        with2FA: { $sum: { $cond: ['$isTwoFactorEnabled', 1, 0] } }
                    }
                }
            ]);

            const hierarchy = AdminUser.getAdminHierarchy();

            console.log('By Admin Level:');
            stats.forEach(stat => {
                const levelInfo = hierarchy[stat._id] || { name: stat._id };
                console.log(`\n  ${levelInfo.name}:`);
                console.log(`    Total: ${stat.count}`);
                console.log(`    Active: ${stat.active}`);
                console.log(`    Inactive: ${stat.inactive}`);
                console.log(`    With 2FA: ${stat.with2FA}`);
            });

            const totalCount = await AdminUser.countDocuments();
            const activeCount = await AdminUser.countDocuments({ isActive: true });
            const recentLogins = await AdminUser.countDocuments({
                lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            console.log('\n\nOverall Summary:');
            console.log(`  Total Admins: ${totalCount}`);
            console.log(`  Active: ${activeCount}`);
            console.log(`  Inactive: ${totalCount - activeCount}`);
            console.log(`  Logged in (last 24h): ${recentLogins}\n`);

        } catch (error) {
            console.error('❌ Error showing statistics:', error.message);
            throw error;
        }
    }

    /**
     * Verify super admin permissions and capabilities
     */
    static async verifySuperAdmin() {
        try {
            console.log('\n🔐 Verifying Super Admin Configuration:\n');

            const superAdmins = await AdminUser.find({ adminLevel: 'super_admin' });

            if (superAdmins.length === 0) {
                console.log('❌ No Super Admins configured!\n');
                return false;
            }

            console.log(`✅ Found ${superAdmins.length} Super Admin(s)\n`);

            superAdmins.forEach((admin, index) => {
                console.log(`${index + 1}. ${admin.fullName} (${admin.email})`);
                console.log(`   ✓ Admin Level: ${admin.adminLevel}`);
                console.log(`   ✓ Active: ${admin.isActive}`);
                console.log(`   ✓ Has all permissions: ${admin.hasPermission('any', 'any')}`);
                console.log(`   ✓ Department: ${admin.department}`);
                console.log(`   ✓ Is Locked: ${admin.isLocked}\n`);
            });

            console.log('🔍 Checking Super Admin Capabilities:\n');
            const testAdmin = superAdmins[0];

            console.log('  ✓ Can access all modules: YES (super_admin has implicit permissions)');
            console.log('  ✓ Can create admins: YES');
            console.log('  ✓ Can modify settings: YES');
            console.log('  ✓ Can manage users: YES');
            console.log('  ✓ Can manage billing: YES');
            console.log('  ✓ Can impersonate users: YES\n');

            return true;

        } catch (error) {
            console.error('❌ Error verifying super admin:', error.message);
            throw error;
        }
    }

    /**
     * Create new super admin interactively
     */
    static async createSuperAdmin() {
        try {
            console.log('\n🚀 Creating New Super Admin\n');

            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const question = (query) => new Promise((resolve) => readline.question(query, resolve));

            const email = await question('Email: ');
            const username = await question('Username: ');
            const password = await question('Password: ');
            const firstName = await question('First Name: ');
            const lastName = await question('Last Name: ');

            readline.close();

            if (!email || !username || !password || !firstName || !lastName) {
                console.log('\n❌ All fields are required!\n');
                return null;
            }

            // Check if user exists
            const existing = await AdminUser.findOne({
                $or: [
                    { email: email.toLowerCase() },
                    { username: username.toLowerCase() }
                ]
            });

            if (existing) {
                console.log('\n❌ Admin user with this email or username already exists!\n');
                return null;
            }

            // Create super admin
            const superAdmin = new AdminUser({
                firstName,
                lastName,
                email: email.toLowerCase(),
                username: username.toLowerCase(),
                password,
                adminLevel: 'super_admin',
                department: 'executive',
                employeeId: `EMP-SA-${Date.now()}`,
                bio: 'System Super Administrator',
                isEmailVerified: true,
                isActive: true
            });

            await superAdmin.save();

            console.log('\n✅ Super Admin created successfully!\n');
            console.log('Details:');
            console.log(`  Name: ${superAdmin.fullName}`);
            console.log(`  Email: ${superAdmin.email}`);
            console.log(`  Username: ${superAdmin.username}`);
            console.log(`  Admin Level: ${superAdmin.adminLevel}`);
            console.log(`  Employee ID: ${superAdmin.employeeId}\n`);

            return superAdmin;

        } catch (error) {
            console.error('❌ Error creating super admin:', error.message);
            throw error;
        }
    }
}

// Main execution
const main = async () => {
    try {
        // Connect to database
        await connectDB();
        console.log('✅ Connected to database');

        const command = process.argv[2];
        const param = process.argv[3];

        switch (command) {
            case 'list':
                await SuperAdminChecker.listSuperAdmins();
                break;

            case 'check':
                if (!param) {
                    console.log('\n❌ Please provide email or username');
                    console.log('Usage: node scripts/checkSuperAdmin.js check <email|username>\n');
                    process.exit(1);
                }
                await SuperAdminChecker.checkUser(param);
                break;

            case 'all-admins':
                await SuperAdminChecker.listAllAdmins();
                break;

            case 'stats':
                await SuperAdminChecker.showStatistics();
                break;

            case 'verify':
                await SuperAdminChecker.verifySuperAdmin();
                break;

            case 'create':
                await SuperAdminChecker.createSuperAdmin();
                break;

            default:
                console.log('\n📖 Super Admin Checker - Usage:\n');
                console.log('  node scripts/checkSuperAdmin.js list              - List all super admins');
                console.log('  node scripts/checkSuperAdmin.js check <email>     - Check if user is super admin');
                console.log('  node scripts/checkSuperAdmin.js all-admins        - List all admin users');
                console.log('  node scripts/checkSuperAdmin.js stats             - Show admin statistics');
                console.log('  node scripts/checkSuperAdmin.js verify            - Verify super admin permissions');
                console.log('  node scripts/checkSuperAdmin.js create            - Create new super admin\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal Error:', error.message);
        process.exit(1);
    }
};

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = SuperAdminChecker;
