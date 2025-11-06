require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * WordPress to User Model Migration Script
 * 
 * This script safely migrates WordPress users to your User model
 * Features:
 * - Dry-run mode (test without making changes)
 * - Automatic backup before migration
 * - Duplicate detection
 * - WordPress field mapping to User fields
 * - Progress reporting
 * 
 * Usage:
 * - Test mode: node scripts/migrateWordPressUsers.js --dry-run
 * - Real migration: node scripts/migrateWordPressUsers.js --migrate
 * - Specific user: node scripts/migrateWordPressUsers.js --migrate --email=user@example.com
 */

// Configuration
const WORDPRESS_API_URL = process.env.WORDPRESS_API_URL || 'http://my-testting.local/wp-json';
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME || 'admin';
const WORDPRESS_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD || '';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldMigrate = args.includes('--migrate');
const specificEmail = args.find(arg => arg.startsWith('--email='))?.split('=')[1];
const forceUpdate = args.includes('--force'); // Force update existing users

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Fetch WordPress users
 */
async function fetchWordPressUsers() {
    try {
        log('\n📡 Fetching WordPress users...', 'cyan');

        const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64');

        // Fetch users with extended information
        const response = await axios.get(`${WORDPRESS_API_URL}/wp/v2/users`, {
            headers: {
                'Authorization': `Basic ${auth}`
            },
            params: {
                per_page: 100,
                context: 'edit' // Get full user details
            }
        });

        log(`✅ Found ${response.data.length} WordPress users`, 'green');
        return response.data;

    } catch (error) {
        if (error.response?.status === 401) {
            log('❌ WordPress authentication failed', 'red');
            log('Please set WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD in .env', 'yellow');
        } else {
            log(`❌ Error fetching WordPress users: ${error.message}`, 'red');
        }
        return [];
    }
}

/**
 * Map WordPress user to User model
 */
function mapWordPressUserToUserModel(wpUser) {
    // Parse name
    const firstName = wpUser.first_name || wpUser.name.split(' ')[0] || 'User';
    const lastName = wpUser.last_name || wpUser.name.split(' ').slice(1).join(' ') || '';

    // Map WordPress roles to app roles
    const roleMapping = {
        'administrator': 'admin',
        'editor': 'user',
        'author': 'user',
        'contributor': 'subscriber',
        'subscriber': 'subscriber'
    };

    const wpRole = wpUser.roles?.[0] || 'subscriber';
    const appRole = roleMapping[wpRole] || 'subscriber';

    // Extract billing info from meta (if available)
    const billingInfo = {
        firstName: wpUser.meta?.billing_first_name || firstName,
        lastName: wpUser.meta?.billing_last_name || lastName,
        email: wpUser.meta?.billing_email || wpUser.email,
        phone: wpUser.meta?.billing_phone || '',
        country: wpUser.meta?.billing_country || '',
        city: wpUser.meta?.billing_city || '',
        address: wpUser.meta?.billing_address_1 || '',
        postalCode: wpUser.meta?.billing_postcode || ''
    };

    return {
        // Basic Info
        firstName,
        lastName,
        name: wpUser.name,
        email: wpUser.email,
        phone: billingInfo.phone,

        // WordPress Integration
        wordpressId: wpUser.id,
        isWordPressUser: true,
        lastSyncedAt: new Date(),

        // Role
        role: appRole,

        // Subscription (will be mapped from WooCommerce subscriptions later)
        subscription: 'None',

        // Address
        address: {
            country: billingInfo.country,
            streetAddress: billingInfo.address,
            townCity: billingInfo.city,
            postcodeZip: billingInfo.postalCode
        },

        // Discord username if available
        discordUsername: wpUser.meta?.billing_discord_username || '',

        // Account Status
        isActive: true,
        isEmailVerified: true, // WordPress users are already verified

        // Password will be set as temporary - users should reset via WordPress
        password: `WP_USER_${wpUser.id}_TEMP_${Date.now()}`,
        isPendingUser: false,

        // Timestamps
        createdAt: new Date(wpUser.registered_date || Date.now()),
        updatedAt: new Date()
    };
}

/**
 * Create backup of current users
 */
async function createBackup() {
    try {
        const User = require('../src/models/user.model');
        const users = await User.find().lean();

        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `users-backup-${timestamp}.json`);

        fs.writeFileSync(backupFile, JSON.stringify(users, null, 2));

        log(`✅ Backup created: ${backupFile}`, 'green');
        return backupFile;

    } catch (error) {
        log(`❌ Backup failed: ${error.message}`, 'red');
        throw error;
    }
}

/**
 * Migrate WordPress users
 */
async function migrateUsers(wpUsers, isDryRun = true) {
    const User = require('../src/models/user.model');

    const stats = {
        total: wpUsers.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
    };

    log('\n' + '='.repeat(60), 'cyan');
    log(`${isDryRun ? '🧪 DRY RUN MODE' : '🚀 MIGRATION MODE'}`, isDryRun ? 'yellow' : 'green');
    log('='.repeat(60), 'cyan');

    for (const wpUser of wpUsers) {
        try {
            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [
                    { email: wpUser.email },
                    { wordpressId: wpUser.id }
                ]
            });

            if (existingUser && !forceUpdate) {
                log(`⏭️  Skipping ${wpUser.email} (already exists)`, 'yellow');
                stats.skipped++;
                continue;
            }

            const userData = mapWordPressUserToUserModel(wpUser);

            if (isDryRun) {
                log(`\n📋 Would ${existingUser ? 'update' : 'create'}: ${wpUser.email}`, 'cyan');
                console.log('   Data:', {
                    name: userData.name,
                    role: userData.role,
                    wordpressId: userData.wordpressId,
                    subscription: userData.subscription
                });

                if (existingUser) stats.updated++;
                else stats.created++;

            } else {
                if (existingUser && forceUpdate) {
                    // Update existing user
                    Object.assign(existingUser, userData);
                    await existingUser.save();
                    log(`✅ Updated: ${wpUser.email}`, 'green');
                    stats.updated++;
                } else {
                    // Create new user
                    await User.create(userData);
                    log(`✅ Created: ${wpUser.email}`, 'green');
                    stats.created++;
                }
            }

        } catch (error) {
            log(`❌ Error processing ${wpUser.email}: ${error.message}`, 'red');
            stats.errors.push({
                email: wpUser.email,
                error: error.message
            });
        }
    }

    return stats;
}

/**
 * Display final report
 */
function displayReport(stats, isDryRun) {
    log('\n' + '='.repeat(60), 'cyan');
    log('📊 MIGRATION REPORT', 'magenta');
    log('='.repeat(60), 'cyan');
    log(`Total users processed: ${stats.total}`);
    log(`Would be created: ${stats.created}`, stats.created > 0 ? 'green' : 'reset');
    log(`Would be updated: ${stats.updated}`, stats.updated > 0 ? 'yellow' : 'reset');
    log(`Skipped (already exist): ${stats.skipped}`, 'yellow');
    log(`Errors: ${stats.errors.length}`, stats.errors.length > 0 ? 'red' : 'reset');

    if (stats.errors.length > 0) {
        log('\n❌ Errors:', 'red');
        stats.errors.forEach(err => {
            log(`   - ${err.email}: ${err.error}`, 'red');
        });
    }

    log('='.repeat(60), 'cyan');

    if (isDryRun) {
        log('\n💡 This was a DRY RUN - no changes were made', 'yellow');
        log('To actually migrate, run: node scripts/migrateWordPressUsers.js --migrate', 'cyan');
    } else {
        log('\n✅ Migration completed successfully!', 'green');
    }

    if (!isDryRun && stats.created > 0) {
        log('\n⚠️  IMPORTANT:', 'yellow');
        log('- Migrated users have temporary passwords', 'yellow');
        log('- They should reset password via WordPress login', 'yellow');
        log('- Or use "Forgot Password" feature', 'yellow');
    }
}

/**
 * Main migration process
 */
async function main() {
    try {
        // Show usage if no arguments
        if (!isDryRun && !shouldMigrate) {
            log('\n📖 WordPress User Migration Script', 'cyan');
            log('='.repeat(60), 'cyan');
            log('Usage:', 'yellow');
            log('  Test migration (dry-run):');
            log('    node scripts/migrateWordPressUsers.js --dry-run', 'green');
            log('\n  Run actual migration:');
            log('    node scripts/migrateWordPressUsers.js --migrate', 'green');
            log('\n  Migrate specific user:');
            log('    node scripts/migrateWordPressUsers.js --migrate --email=user@example.com', 'green');
            log('\n  Force update existing users:');
            log('    node scripts/migrateWordPressUsers.js --migrate --force', 'green');
            log('='.repeat(60), 'cyan');
            process.exit(0);
        }

        // Connect to database
        log('\n🔌 Connecting to database...', 'cyan');
        await mongoose.connect(process.env.MONGO_URI);
        log('✅ Connected to MongoDB', 'green');

        // Fetch WordPress users
        let wpUsers = await fetchWordPressUsers();

        if (wpUsers.length === 0) {
            log('❌ No WordPress users found. Check your API configuration.', 'red');
            process.exit(1);
        }

        // Filter specific user if requested
        if (specificEmail) {
            wpUsers = wpUsers.filter(u => u.email === specificEmail);
            if (wpUsers.length === 0) {
                log(`❌ User with email ${specificEmail} not found`, 'red');
                process.exit(1);
            }
        }

        // Create backup before migration (only in real migration mode)
        if (!isDryRun && shouldMigrate) {
            log('\n💾 Creating backup...', 'cyan');
            await createBackup();
        }

        // Migrate users
        const stats = await migrateUsers(wpUsers, isDryRun);

        // Display report
        displayReport(stats, isDryRun);

        // Close database connection
        await mongoose.connection.close();
        log('\n📴 Database connection closed', 'cyan');

        process.exit(0);

    } catch (error) {
        log(`\n❌ Fatal error: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run the migration
main();
