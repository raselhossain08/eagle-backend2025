/**
 * System Settings Management Service
 * Comprehensive system-wide configuration and settings management
 */

const SystemSettings = require('../models/systemSettings.model');
const User = require('../../user/models/user.model');
const { SignedContract } = require('../../contract/models/contract.model');
const Transaction = require('../../transaction/models/transaction.model');
const Subscription = require('../../subscription/models/subscription.model');

class SystemSettingsService {
    constructor() {
        this.settingsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get system settings with caching
     * @param {boolean} includeSecrets - Whether to include sensitive data
     * @returns {Object} System settings
     */
    async getSettings(includeSecrets = false) {
        try {
            const cacheKey = `settings_${includeSecrets}`;
            const cached = this.settingsCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
                return cached.data;
            }

            let query = SystemSettings.findOne();
            if (!includeSecrets) {
                query = query.select('-configuration.paymentGateways.stripe.secretKey -configuration.paymentGateways.stripe.webhookSecret -configuration.paymentGateways.paypal.clientSecret');
            }

            let settings = await query;

            if (!settings) {
                settings = await this.createDefaultSettings();
            }

            // Cache the result
            this.settingsCache.set(cacheKey, {
                data: settings,
                timestamp: Date.now()
            });

            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.getSettings Error:', error);
            throw error;
        }
    }

    /**
     * Create default system settings
     * @returns {Object} Created settings document
     */
    async createDefaultSettings() {
        try {
            const defaultSettings = {
                organizationName: 'Eagle Investors',
                supportEmail: 'support@eagle-investors.com',
                defaultCurrency: 'USD',
                defaultTimezone: 'UTC',
                maintenanceMode: false,
                configuration: {
                    authentication: {
                        requireEmailVerification: true,
                        passwordMinLength: 8,
                        passwordRequireUppercase: true,
                        passwordRequireLowercase: true,
                        passwordRequireNumbers: true,
                        sessionTimeout: 3600000,
                        maxLoginAttempts: 5,
                        lockoutDuration: 900000
                    },
                    notifications: {
                        emailEnabled: true,
                        smsEnabled: false,
                        pushEnabled: false,
                        defaultEmailProvider: 'sendgrid'
                    },
                    billing: {
                        taxCalculationEnabled: true,
                        defaultTaxRate: 0.0825,
                        invoiceAutoGeneration: true,
                        paymentRetryAttempts: 3,
                        dunningEnabled: true
                    },
                    security: {
                        encryptionEnabled: true,
                        auditLoggingEnabled: true,
                        rateLimitEnabled: true,
                        maxRequestsPerMinute: 100
                    }
                },
                featureFlags: [
                    {
                        name: 'Advanced Analytics',
                        key: 'advanced_analytics',
                        description: 'Enable advanced analytics dashboard features',
                        enabled: true,
                        rolloutPercentage: 100
                    },
                    {
                        name: 'Two-Factor Authentication',
                        key: 'two_factor_auth',
                        description: 'Enable two-factor authentication for users',
                        enabled: false,
                        rolloutPercentage: 0
                    }
                ]
            };

            const settings = await SystemSettings.create(defaultSettings);
            console.log('✅ Default system settings created');
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.createDefaultSettings Error:', error);
            throw error;
        }
    }

    /**
     * Update system settings
     * @param {Object} updates - Settings updates
     * @param {string} userId - User ID making the update
     * @returns {Object} Updated settings
     */
    async updateSettings(updates, userId = null) {
        try {
            let settings = await SystemSettings.findOne();

            if (!settings) {
                settings = await this.createDefaultSettings();
            }

            // Update settings
            Object.assign(settings, updates);

            if (userId) {
                settings.lastModifiedBy = userId;
            }

            await settings.save();

            // Clear cache
            this.settingsCache.clear();

            console.log('✅ System settings updated successfully');
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.updateSettings Error:', error);
            throw error;
        }
    }

    /**
     * Get feature flag status
     * @param {string} flagKey - Feature flag key
     * @param {Object} user - User object for targeting
     * @returns {boolean} Feature flag status
     */
    async isFeatureEnabled(flagKey, user = null) {
        try {
            const settings = await this.getSettings();
            const flag = settings.featureFlags.find(f => f.key === flagKey);

            if (!flag) {
                return false;
            }

            if (!flag.enabled) {
                return false;
            }

            // Check rollout percentage
            if (flag.rolloutPercentage < 100) {
                const hash = this.hashUserId(user?.id || 'anonymous', flagKey);
                const bucket = hash % 100;
                if (bucket >= flag.rolloutPercentage) {
                    return false;
                }
            }

            // Check target audience
            if (flag.targetAudience && flag.targetAudience.length > 0 && user) {
                if (!flag.targetAudience.includes(user.role)) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ SystemSettingsService.isFeatureEnabled Error:', error);
            return false;
        }
    }

    /**
     * Add or update feature flag
     * @param {Object} flagData - Feature flag data
     * @returns {Object} Updated settings
     */
    async updateFeatureFlag(flagData) {
        try {
            const settings = await this.getSettings();

            const existingIndex = settings.featureFlags.findIndex(f => f.key === flagData.key);

            if (existingIndex !== -1) {
                // Update existing flag
                settings.featureFlags[existingIndex] = {
                    ...settings.featureFlags[existingIndex].toObject(),
                    ...flagData
                };
            } else {
                // Add new flag
                settings.featureFlags.push(flagData);
            }

            await settings.save();
            this.settingsCache.clear();

            console.log(`✅ Feature flag ${flagData.key} updated`);
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.updateFeatureFlag Error:', error);
            throw error;
        }
    }

    /**
     * Remove feature flag
     * @param {string} flagKey - Feature flag key
     * @returns {Object} Updated settings
     */
    async removeFeatureFlag(flagKey) {
        try {
            const settings = await this.getSettings();

            settings.featureFlags = settings.featureFlags.filter(f => f.key !== flagKey);
            await settings.save();

            this.settingsCache.clear();

            console.log(`✅ Feature flag ${flagKey} removed`);
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.removeFeatureFlag Error:', error);
            throw error;
        }
    }

    /**
     * Get configuration value
     * @param {string} path - Configuration path (e.g., 'authentication.passwordMinLength')
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Configuration value
     */
    async getConfig(path, defaultValue = null) {
        try {
            const settings = await this.getSettings();

            const pathArray = path.split('.');
            let value = settings.configuration;

            for (const key of pathArray) {
                value = value?.[key];
                if (value === undefined) {
                    return defaultValue;
                }
            }

            return value;
        } catch (error) {
            console.error('❌ SystemSettingsService.getConfig Error:', error);
            return defaultValue;
        }
    }

    /**
     * Update configuration value
     * @param {string} path - Configuration path
     * @param {*} value - New value
     * @returns {Object} Updated settings
     */
    async setConfig(path, value) {
        try {
            const settings = await this.getSettings();

            const pathArray = path.split('.');
            let current = settings.configuration;

            // Navigate to parent object
            for (let i = 0; i < pathArray.length - 1; i++) {
                const key = pathArray[i];
                if (!current[key]) {
                    current[key] = {};
                }
                current = current[key];
            }

            // Set the final value
            current[pathArray[pathArray.length - 1]] = value;

            await settings.save();
            this.settingsCache.clear();

            console.log(`✅ Configuration ${path} updated to:`, value);
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.setConfig Error:', error);
            throw error;
        }
    }

    /**
     * Get maintenance mode status
     * @returns {Object} Maintenance mode info
     */
    async getMaintenanceMode() {
        try {
            const settings = await this.getSettings();
            return {
                enabled: settings.maintenanceMode || false,
                message: settings.maintenanceMessage || 'System is under maintenance'
            };
        } catch (error) {
            console.error('❌ SystemSettingsService.getMaintenanceMode Error:', error);
            return { enabled: false, message: '' };
        }
    }

    /**
     * Toggle maintenance mode
     * @param {boolean} enabled - Maintenance mode status
     * @param {string} message - Maintenance message
     * @returns {Object} Updated settings
     */
    async toggleMaintenanceMode(enabled, message = null) {
        try {
            const updates = {
                maintenanceMode: enabled
            };

            if (message) {
                updates.maintenanceMessage = message;
            }

            const settings = await this.updateSettings(updates);

            console.log(`✅ Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.toggleMaintenanceMode Error:', error);
            throw error;
        }
    }

    /**
     * Get system analytics
     * @returns {Object} System analytics data
     */
    async getSystemAnalytics() {
        try {
            const settings = await this.getSettings();

            // Get parallel statistics
            const [
                totalUsers,
                activeUsers,
                totalContracts,
                completedContracts,
                totalTransactions,
                revenueData,
                activeSubscriptions,
                recentActivity
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isActive: true }),
                SignedContract.countDocuments(),
                SignedContract.countDocuments({ status: 'fully_signed' }),
                Transaction.countDocuments(),
                Transaction.aggregate([
                    { $match: { status: 'completed' } },
                    { $group: { _id: null, total: { $sum: '$amounts.gross' } } }
                ]),
                Subscription.countDocuments({ status: 'active' }),
                this.getRecentActivity()
            ]);

            return {
                systemInfo: {
                    name: settings.organizationName,
                    version: '2.0.0',
                    maintenanceMode: settings.maintenanceMode,
                    lastUpdated: settings.updatedAt,
                    uptime: process.uptime()
                },
                statistics: {
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                        inactive: totalUsers - activeUsers
                    },
                    contracts: {
                        total: totalContracts,
                        completed: completedContracts,
                        pending: totalContracts - completedContracts
                    },
                    transactions: {
                        total: totalTransactions,
                        revenue: revenueData.length > 0 ? revenueData[0].total : 0
                    },
                    subscriptions: {
                        active: activeSubscriptions
                    }
                },
                featureFlags: {
                    total: settings.featureFlags.length,
                    enabled: settings.featureFlags.filter(f => f.enabled).length,
                    disabled: settings.featureFlags.filter(f => !f.enabled).length
                },
                recentActivity,
                configuration: {
                    authenticationEnabled: settings.configuration.authentication.requireEmailVerification,
                    notificationsEnabled: settings.configuration.notifications.emailEnabled,
                    billingEnabled: settings.configuration.billing.taxCalculationEnabled,
                    securityEnabled: settings.configuration.security.encryptionEnabled
                }
            };
        } catch (error) {
            console.error('❌ SystemSettingsService.getSystemAnalytics Error:', error);
            throw error;
        }
    }

    /**
     * Get recent activity statistics
     * @returns {Object} Recent activity data
     */
    async getRecentActivity() {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const [
                dailyUsers,
                weeklyUsers,
                dailyContracts,
                weeklyContracts,
                dailyTransactions,
                weeklyTransactions,
                dailySubscriptions,
                weeklySubscriptions
            ] = await Promise.all([
                User.countDocuments({ createdAt: { $gte: oneDayAgo } }),
                User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
                SignedContract.countDocuments({ createdAt: { $gte: oneDayAgo } }),
                SignedContract.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
                Transaction.countDocuments({ 'timeline.initiatedAt': { $gte: oneDayAgo } }),
                Transaction.countDocuments({ 'timeline.initiatedAt': { $gte: oneWeekAgo } }),
                Subscription.countDocuments({ createdAt: { $gte: oneDayAgo } }),
                Subscription.countDocuments({ createdAt: { $gte: oneWeekAgo } })
            ]);

            return {
                last24Hours: {
                    users: dailyUsers,
                    contracts: dailyContracts,
                    transactions: dailyTransactions,
                    subscriptions: dailySubscriptions
                },
                lastWeek: {
                    users: weeklyUsers,
                    contracts: weeklyContracts,
                    transactions: weeklyTransactions,
                    subscriptions: weeklySubscriptions
                }
            };
        } catch (error) {
            console.error('❌ SystemSettingsService.getRecentActivity Error:', error);
            return {
                last24Hours: { users: 0, contracts: 0, transactions: 0, subscriptions: 0 },
                lastWeek: { users: 0, contracts: 0, transactions: 0, subscriptions: 0 }
            };
        }
    }

    /**
     * Export system settings
     * @returns {Object} Exportable settings data
     */
    async exportSettings() {
        try {
            const settings = await this.getSettings(true); // Include secrets for admin export

            return {
                exportDate: new Date().toISOString(),
                version: '2.0.0',
                systemInfo: {
                    name: settings.organizationName,
                    version: '2.0.0'
                },
                settings: settings.toObject()
            };
        } catch (error) {
            console.error('❌ SystemSettingsService.exportSettings Error:', error);
            throw error;
        }
    }

    /**
     * Import system settings
     * @param {Object} settingsData - Settings data to import
     * @param {string} userId - User ID performing import
     * @returns {Object} Updated settings
     */
    async importSettings(settingsData, userId = null) {
        try {
            if (!settingsData.settings) {
                throw new Error('Invalid settings data format');
            }

            // Validate version compatibility
            if (settingsData.version && settingsData.version !== '2.0.0') {
                console.warn('⚠️ Importing settings from different version:', settingsData.version);
            }

            const settings = await this.updateSettings(settingsData.settings, userId);

            console.log('✅ System settings imported successfully');
            return settings;
        } catch (error) {
            console.error('❌ SystemSettingsService.importSettings Error:', error);
            throw error;
        }
    }

    /**
     * Hash user ID for consistent feature flag rollouts
     * @param {string} userId - User ID
     * @param {string} flagKey - Feature flag key
     * @returns {number} Hash value
     */
    hashUserId(userId, flagKey) {
        const str = `${userId}_${flagKey}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Clear settings cache
     */
    clearCache() {
        this.settingsCache.clear();
        console.log('✅ System settings cache cleared');
    }

    /**
     * Validate payment gateway configuration
     * @param {string} gateway - Gateway name (stripe, paypal)
     * @returns {boolean} Validation result
     */
    async validatePaymentGatewayConfig(gateway) {
        try {
            const settings = await this.getSettings(true);
            const gatewayConfig = settings.configuration.paymentGateways[gateway];

            if (!gatewayConfig || !gatewayConfig.enabled) {
                return false;
            }

            // Basic validation for required fields
            switch (gateway) {
                case 'stripe':
                    return !!(gatewayConfig.publishableKey && gatewayConfig.secretKey);
                case 'paypal':
                    return !!(gatewayConfig.clientId && gatewayConfig.clientSecret);
                default:
                    return false;
            }
        } catch (error) {
            console.error('❌ SystemSettingsService.validatePaymentGatewayConfig Error:', error);
            return false;
        }
    }

    /**
     * Get public settings (safe for frontend)
     * @returns {Object} Public settings
     */
    async getPublicSettings() {
        try {
            const settings = await this.getSettings(false);

            return {
                organizationName: settings.organizationName,
                organizationLogo: settings.organizationLogo,
                supportEmail: settings.supportEmail,
                defaultCurrency: settings.defaultCurrency,
                defaultTimezone: settings.defaultTimezone,
                maintenanceMode: settings.maintenanceMode,
                maintenanceMessage: settings.maintenanceMessage,
                featureFlags: settings.featureFlags
                    .filter(f => f.enabled)
                    .map(f => ({
                        key: f.key,
                        name: f.name,
                        description: f.description
                    })),
                policyUrls: settings.policyUrls.filter(p => p.isActive),
                configuration: {
                    authentication: {
                        requireEmailVerification: settings.configuration.authentication.requireEmailVerification,
                        passwordMinLength: settings.configuration.authentication.passwordMinLength,
                        passwordRequireUppercase: settings.configuration.authentication.passwordRequireUppercase,
                        passwordRequireLowercase: settings.configuration.authentication.passwordRequireLowercase,
                        passwordRequireNumbers: settings.configuration.authentication.passwordRequireNumbers,
                        passwordRequireSymbols: settings.configuration.authentication.passwordRequireSymbols
                    },
                    notifications: {
                        emailEnabled: settings.configuration.notifications.emailEnabled,
                        smsEnabled: settings.configuration.notifications.smsEnabled
                    }
                }
            };
        } catch (error) {
            console.error('❌ SystemSettingsService.getPublicSettings Error:', error);
            throw error;
        }
    }
}

module.exports = new SystemSettingsService();