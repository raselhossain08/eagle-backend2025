const axios = require('axios');
const User = require('../user/models/user.model');
const bcrypt = require('bcryptjs');

/**
 * WordPress Authentication Service
 * 
 * This service provides seamless authentication between local database and WordPress.
 * Users can login with their WordPress credentials even if they haven't been migrated yet.
 * 
 * Flow:
 * 1. Try local authentication first (faster)
 * 2. If fails, try WordPress authentication
 * 3. If WordPress succeeds, sync user to local database
 * 4. Return JWT token for local system
 */

const WORDPRESS_API_URL = process.env.WORDPRESS_API_URL || 'http://my-testting.local/wp-json';
const WORDPRESS_AUTH_ENDPOINT = process.env.WORDPRESS_AUTH_ENDPOINT || '/api_master/v1/auth/login';

class WordPressAuthService {

    /**
     * Authenticate user with WordPress fallback
     * @param {string} usernameOrEmail - Username or email
     * @param {string} password - User password
     * @returns {Promise<{success: boolean, user: object, isWordPressAuth: boolean}>}
     */
    async authenticateWithWordPressFallback(usernameOrEmail, password) {
        try {
            // Step 1: Try local authentication first
            console.log(`🔐 Attempting local authentication for: ${usernameOrEmail}`);

            const localUser = await User.findOne({
                $or: [
                    { email: usernameOrEmail.toLowerCase() },
                    { name: usernameOrEmail }
                ]
            });

            if (localUser && !localUser.isWordPressUser) {
                // Pure local user - authenticate normally
                const isPasswordValid = await localUser.comparePassword(password);
                if (isPasswordValid) {
                    console.log(`✅ Local authentication successful for: ${usernameOrEmail}`);
                    return {
                        success: true,
                        user: localUser,
                        isWordPressAuth: false,
                        message: 'Local authentication successful'
                    };
                }
            }

            if (localUser && localUser.isWordPressUser) {
                // WordPress user already synced - try local password first
                const isPasswordValid = await localUser.comparePassword(password);
                if (isPasswordValid) {
                    console.log(`✅ Local authentication successful for synced WP user: ${usernameOrEmail}`);
                    return {
                        success: true,
                        user: localUser,
                        isWordPressAuth: false,
                        message: 'Local authentication successful'
                    };
                }
                // If local password fails, try WordPress authentication
                console.log(`⚠️ Local password failed for WP user, trying WordPress API...`);
            }

            // Step 2: Try WordPress authentication
            console.log(`🌐 Attempting WordPress authentication for: ${usernameOrEmail}`);

            const wpAuthResult = await this.authenticateWithWordPress(usernameOrEmail, password);

            if (!wpAuthResult.success) {
                console.log(`❌ WordPress authentication failed for: ${usernameOrEmail}`);
                return {
                    success: false,
                    message: 'Invalid credentials',
                    isWordPressAuth: true
                };
            }

            console.log(`✅ WordPress authentication successful for: ${usernameOrEmail}`);

            // Step 3: Sync user to local database
            const syncedUser = await this.syncWordPressUser(wpAuthResult.user, password);

            return {
                success: true,
                user: syncedUser,
                isWordPressAuth: true,
                wordPressToken: wpAuthResult.token,
                message: 'WordPress authentication successful and user synced'
            };

        } catch (error) {
            console.error('❌ Error in authenticateWithWordPressFallback:', error.message);
            return {
                success: false,
                message: error.message || 'Authentication failed',
                error: error
            };
        }
    }

    /**
     * Authenticate directly with WordPress API
     * @param {string} username - WordPress username or email
     * @param {string} password - WordPress password
     * @returns {Promise<{success: boolean, token: string, user: object}>}
     */
    async authenticateWithWordPress(username, password) {
        try {
            const response = await axios.post(
                `${WORDPRESS_API_URL}${WORDPRESS_AUTH_ENDPOINT}`,
                {
                    username,
                    password
                },
                {
                    timeout: 10000, // 10 second timeout
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success && response.data.token) {
                return {
                    success: true,
                    token: response.data.token,
                    user: response.data.user,
                    expiresIn: response.data.expires_in
                };
            }

            return {
                success: false,
                message: 'WordPress authentication failed'
            };

        } catch (error) {
            if (error.response?.status === 401) {
                return {
                    success: false,
                    message: 'Invalid WordPress credentials'
                };
            }

            console.error('WordPress API error:', error.message);
            throw new Error(`WordPress API unavailable: ${error.message}`);
        }
    }

    /**
     * Sync WordPress user to local database
     * @param {object} wpUser - WordPress user data from API
     * @param {string} password - Plain text password (will be hashed)
     * @returns {Promise<User>}
     */
    async syncWordPressUser(wpUser, password) {
        try {
            // Check if user already exists
            let localUser = await User.findOne({
                $or: [
                    { email: wpUser.email },
                    { wordpressId: wpUser.id }
                ]
            });

            const userData = {
                firstName: wpUser.display_name?.split(' ')[0] || 'User',
                lastName: wpUser.display_name?.split(' ').slice(1).join(' ') || '',
                name: wpUser.display_name || wpUser.username,
                username: wpUser.username,
                email: wpUser.email,
                wordpressId: wpUser.id,
                isWordPressUser: true,
                lastSyncedAt: new Date(),
                isEmailVerified: true,
                isActive: true,
                role: this.mapWordPressRole(wpUser.roles?.[0] || 'subscriber'),
                source: 'wordpress'
            };

            if (localUser) {
                // Update existing user
                console.log(`🔄 Updating existing user: ${wpUser.email}`);

                Object.assign(localUser, userData);

                // Update password if provided
                if (password) {
                    localUser.password = password; // Will be hashed by pre-save hook
                }

                // Update last activity
                localUser.lastActivityAt = new Date();

                await localUser.save();
                console.log(`✅ User updated: ${wpUser.email}`);

            } else {
                // Create new user
                console.log(`➕ Creating new user from WordPress: ${wpUser.email}`);

                localUser = await User.create({
                    ...userData,
                    password: password || `WP_TEMP_${wpUser.id}_${Date.now()}`,
                    subscription: 'None',
                    subscriptionStatus: 'none',
                    lastLoginAt: new Date()
                });

                console.log(`✅ User created: ${wpUser.email}`);
            }

            return localUser;

        } catch (error) {
            console.error('Error syncing WordPress user:', error);
            throw error;
        }
    }

    /**
     * Map WordPress roles to app roles
     * @param {string} wpRole - WordPress role
     * @returns {string} - App role
     */
    mapWordPressRole(wpRole) {
        const roleMapping = {
            'administrator': 'admin',
            'editor': 'user',
            'author': 'user',
            'contributor': 'subscriber',
            'subscriber': 'subscriber'
        };

        return roleMapping[wpRole] || 'subscriber';
    }

    /**
     * Fetch full WordPress user data
     * @param {number} userId - WordPress user ID
     * @param {string} wpToken - WordPress JWT token
     * @returns {Promise<object>}
     */
    async fetchWordPressUserData(userId, wpToken) {
        try {
            const response = await axios.get(
                `${WORDPRESS_API_URL}/wp/v2/users/${userId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${wpToken}`
                    },
                    params: {
                        context: 'edit'
                    }
                }
            );

            return response.data;

        } catch (error) {
            console.error('Error fetching WordPress user data:', error.message);
            return null;
        }
    }

    /**
     * Validate WordPress connection
     * @returns {Promise<boolean>}
     */
    async validateWordPressConnection() {
        try {
            const response = await axios.get(`${WORDPRESS_API_URL}`, {
                timeout: 5000
            });

            return response.status === 200;

        } catch (error) {
            console.error('WordPress connection validation failed:', error.message);
            return false;
        }
    }
}

module.exports = new WordPressAuthService();
