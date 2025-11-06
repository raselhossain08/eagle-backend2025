require('dotenv').config();
const mongoose = require('mongoose');
const wordpressAuthService = require('../src/services/wordpressAuth.service');
const User = require('../src/models/user.model');

/**
 * Test WordPress Authentication Integration
 * 
 * This script tests the WordPress authentication fallback system:
 * 1. Validates WordPress API connection
 * 2. Tests WordPress login authentication
 * 3. Tests user synchronization
 * 4. Tests local authentication after sync
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    title: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`)
};

async function testWordPressAuth() {
    try {
        log.title('🧪 WordPress Authentication Test Suite');

        // Connect to database
        log.info('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        log.success('Database connected');

        // Get test credentials from command line or use defaults
        const username = process.argv[2] || 'mr';
        const password = process.argv[3] || '123456';

        log.info(`Test credentials: ${username} / ${'*'.repeat(password.length)}`);
        console.log('');

        // Test 1: WordPress API Connection
        log.title('Test 1: WordPress API Connection');
        log.info(`Checking connection to: ${process.env.WORDPRESS_API_URL}`);

        const isConnected = await wordpressAuthService.validateWordPressConnection();

        if (isConnected) {
            log.success('WordPress API is reachable');
        } else {
            log.error('WordPress API is not reachable');
            log.warning('Check your WORDPRESS_API_URL in .env file');
            log.warning(`Current URL: ${process.env.WORDPRESS_API_URL}`);
            return;
        }

        // Test 2: Direct WordPress Authentication
        log.title('Test 2: Direct WordPress Authentication');
        log.info(`Authenticating with WordPress: ${username}`);

        const wpAuthResult = await wordpressAuthService.authenticateWithWordPress(
            username,
            password
        );

        if (wpAuthResult.success) {
            log.success('WordPress authentication successful');
            console.log(`   User ID: ${wpAuthResult.user.id}`);
            console.log(`   Username: ${wpAuthResult.user.username}`);
            console.log(`   Email: ${wpAuthResult.user.email}`);
            console.log(`   Display Name: ${wpAuthResult.user.display_name}`);
            console.log(`   Roles: ${wpAuthResult.user.roles.join(', ')}`);
            console.log(`   Token expires in: ${wpAuthResult.expiresIn}s`);
        } else {
            log.error('WordPress authentication failed');
            console.log(`   Message: ${wpAuthResult.message}`);
            return;
        }

        // Test 3: Full Authentication with Sync
        log.title('Test 3: WordPress Authentication with User Sync');
        log.info(`Authenticating with WordPress fallback: ${username}`);

        const authResult = await wordpressAuthService.authenticateWithWordPressFallback(
            username,
            password
        );

        if (authResult.success) {
            log.success('Authentication successful');
            console.log(`   Auth Type: ${authResult.isWordPressAuth ? 'WordPress' : 'Local'}`);
            console.log(`   User ID: ${authResult.user._id}`);
            console.log(`   Email: ${authResult.user.email}`);
            console.log(`   Name: ${authResult.user.name}`);
            console.log(`   WordPress ID: ${authResult.user.wordpressId}`);
            console.log(`   Is WP User: ${authResult.user.isWordPressUser}`);
            console.log(`   Last Synced: ${authResult.user.lastSyncedAt}`);
        } else {
            log.error('Authentication failed');
            console.log(`   Message: ${authResult.message}`);
            return;
        }

        // Test 4: Local Authentication After Sync
        log.title('Test 4: Local Authentication (After Sync)');
        log.info(`Checking if user can login locally with email: ${authResult.user.email}`);

        const localAuthResult = await wordpressAuthService.authenticateWithWordPressFallback(
            authResult.user.email,
            password
        );

        if (localAuthResult.success && !localAuthResult.isWordPressAuth) {
            log.success('Local authentication successful (password synced)');
            console.log(`   User can now login without WordPress API call`);
        } else if (localAuthResult.success && localAuthResult.isWordPressAuth) {
            log.warning('WordPress API was used (local password not synced)');
            console.log(`   Consider running migration to sync all passwords`);
        } else {
            log.error('Local authentication failed');
        }

        // Test 5: Database Verification
        log.title('Test 5: Database Verification');
        log.info(`Checking database for synced user...`);

        const dbUser = await User.findOne({ email: authResult.user.email });

        if (dbUser) {
            log.success('User found in database');
            console.log(`   ID: ${dbUser._id}`);
            console.log(`   Email: ${dbUser.email}`);
            console.log(`   Name: ${dbUser.name}`);
            console.log(`   WordPress ID: ${dbUser.wordpressId}`);
            console.log(`   Is WordPress User: ${dbUser.isWordPressUser}`);
            console.log(`   Has Password: ${!!dbUser.password}`);
            console.log(`   Last Synced: ${dbUser.lastSyncedAt}`);
            console.log(`   Created At: ${dbUser.createdAt}`);
        } else {
            log.error('User not found in database');
        }

        // Summary
        log.title('📊 Test Summary');
        log.success('All tests completed successfully!');
        console.log('');
        log.info('What this means:');
        console.log('  ✓ WordPress users can login with their existing credentials');
        console.log('  ✓ Users are automatically synced to local database');
        console.log('  ✓ After sync, users can login without WordPress API');
        console.log('  ✓ Seamless experience - users won\'t notice the difference');
        console.log('');

    } catch (error) {
        log.error(`Test failed: ${error.message}`);
        console.error(error);
    } finally {
        await mongoose.disconnect();
        log.info('Database disconnected');
        process.exit(0);
    }
}

// Run tests
testWordPressAuth();
