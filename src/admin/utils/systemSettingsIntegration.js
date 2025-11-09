/**
 * System Settings Integration Utility
 * Helper functions for integrating system settings across different modules
 */

const systemSettingsService = require('../services/systemSettings.service');

class SystemSettingsIntegration {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 2 * 60 * 1000; // 2 minutes
    }

    /**
     * Get cached configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value
     * @returns {*} Configuration value
     */
    async getCachedConfig(key, defaultValue = null) {
        const cacheKey = `config_${key}`;
        const cached = this.cache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.value;
        }

        try {
            const value = await systemSettingsService.getConfig(key, defaultValue);
            this.cache.set(cacheKey, {
                value,
                timestamp: Date.now()
            });
            return value;
        } catch (error) {
            console.error(`❌ Failed to get config ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * User Module Integration
     * Get user-related system settings
     */
    async getUserModuleConfig() {
        return {
            // Authentication settings
            requireEmailVerification: await this.getCachedConfig('authentication.requireEmailVerification', true),
            requirePhoneVerification: await this.getCachedConfig('authentication.requirePhoneVerification', false),
            passwordMinLength: await this.getCachedConfig('authentication.passwordMinLength', 8),
            passwordRequireUppercase: await this.getCachedConfig('authentication.passwordRequireUppercase', true),
            passwordRequireLowercase: await this.getCachedConfig('authentication.passwordRequireLowercase', true),
            passwordRequireNumbers: await this.getCachedConfig('authentication.passwordRequireNumbers', true),
            passwordRequireSymbols: await this.getCachedConfig('authentication.passwordRequireSymbols', false),
            sessionTimeout: await this.getCachedConfig('authentication.sessionTimeout', 3600000),
            maxLoginAttempts: await this.getCachedConfig('authentication.maxLoginAttempts', 5),
            lockoutDuration: await this.getCachedConfig('authentication.lockoutDuration', 900000),

            // Security settings
            encryptionEnabled: await this.getCachedConfig('security.encryptionEnabled', true),
            auditLoggingEnabled: await this.getCachedConfig('security.auditLoggingEnabled', true),
            ipWhitelistEnabled: await this.getCachedConfig('security.ipWhitelistEnabled', false),
            rateLimitEnabled: await this.getCachedConfig('security.rateLimitEnabled', true),
            maxRequestsPerMinute: await this.getCachedConfig('security.maxRequestsPerMinute', 100)
        };
    }

    /**
     * Payment Module Integration
     * Get payment-related system settings
     */
    async getPaymentModuleConfig() {
        return {
            // Billing settings
            taxCalculationEnabled: await this.getCachedConfig('billing.taxCalculationEnabled', true),
            defaultTaxRate: await this.getCachedConfig('billing.defaultTaxRate', 0.0825),
            invoiceAutoGeneration: await this.getCachedConfig('billing.invoiceAutoGeneration', true),
            paymentRetryAttempts: await this.getCachedConfig('billing.paymentRetryAttempts', 3),
            dunningEnabled: await this.getCachedConfig('billing.dunningEnabled', true),

            // Payment gateway settings
            stripeEnabled: await this.getCachedConfig('paymentGateways.stripe.enabled', false),
            stripeMode: await this.getCachedConfig('paymentGateways.stripe.mode', 'test'),
            paypalEnabled: await this.getCachedConfig('paymentGateways.paypal.enabled', false),
            paypalMode: await this.getCachedConfig('paymentGateways.paypal.mode', 'sandbox'),

            // Organization details for invoices
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            defaultCurrency: await this.getCachedConfig('defaultCurrency', 'USD'),
            supportEmail: await this.getCachedConfig('supportEmail', 'support@eagle-investors.com')
        };
    }

    /**
     * Notification Module Integration
     * Get notification-related system settings
     */
    async getNotificationModuleConfig() {
        return {
            emailEnabled: await this.getCachedConfig('notifications.emailEnabled', true),
            smsEnabled: await this.getCachedConfig('notifications.smsEnabled', false),
            pushEnabled: await this.getCachedConfig('notifications.pushEnabled', false),
            defaultEmailProvider: await this.getCachedConfig('notifications.defaultEmailProvider', 'sendgrid'),
            defaultSmsProvider: await this.getCachedConfig('notifications.defaultSmsProvider', 'twilio'),

            // Organization details for notifications
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            supportEmail: await this.getCachedConfig('supportEmail', 'support@eagle-investors.com'),
            supportPhone: await this.getCachedConfig('supportPhone', null)
        };
    }

    /**
     * Analytics Module Integration
     * Get analytics-related system settings
     */
    async getAnalyticsModuleConfig() {
        return {
            dataRetentionDays: await this.getCachedConfig('analytics.dataRetentionDays', 365),
            anonymizeData: await this.getCachedConfig('analytics.anonymizeData', true),
            trackingEnabled: await this.getCachedConfig('analytics.trackingEnabled', true),

            // Feature flags for analytics
            advancedAnalyticsEnabled: await systemSettingsService.isFeatureEnabled('advanced_analytics'),
            realTimeAnalyticsEnabled: await systemSettingsService.isFeatureEnabled('real_time_analytics'),

            // Organization details
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            defaultTimezone: await this.getCachedConfig('defaultTimezone', 'UTC')
        };
    }

    /**
     * Contract Module Integration
     * Get contract-related system settings
     */
    async getContractModuleConfig() {
        return {
            autoSigningEnabled: await this.getCachedConfig('contracts.autoSigningEnabled', false),
            digitalSignatureRequired: await this.getCachedConfig('contracts.digitalSignatureRequired', true),
            contractRetentionDays: await this.getCachedConfig('contracts.retentionDays', 2555), // 7 years
            auditTrailRequired: await this.getCachedConfig('contracts.auditTrailRequired', true),

            // Organization details for contracts
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            organizationLogo: await this.getCachedConfig('organizationLogo', null),
            supportEmail: await this.getCachedConfig('supportEmail', 'support@eagle-investors.com')
        };
    }

    /**
     * Subscription Module Integration
     * Get subscription-related system settings
     */
    async getSubscriptionModuleConfig() {
        return {
            // Billing integration
            taxCalculationEnabled: await this.getCachedConfig('billing.taxCalculationEnabled', true),
            defaultTaxRate: await this.getCachedConfig('billing.defaultTaxRate', 0.0825),
            invoiceAutoGeneration: await this.getCachedConfig('billing.invoiceAutoGeneration', true),
            paymentRetryAttempts: await this.getCachedConfig('billing.paymentRetryAttempts', 3),
            dunningEnabled: await this.getCachedConfig('billing.dunningEnabled', true),

            // Subscription specific
            autoRenewalEnabled: await this.getCachedConfig('subscriptions.autoRenewalEnabled', true),
            gracePeriodDays: await this.getCachedConfig('subscriptions.gracePeriodDays', 3),
            cancellationBufferDays: await this.getCachedConfig('subscriptions.cancellationBufferDays', 0),

            // Organization details
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            defaultCurrency: await this.getCachedConfig('defaultCurrency', 'USD'),
            supportEmail: await this.getCachedConfig('supportEmail', 'support@eagle-investors.com')
        };
    }

    /**
     * Admin Module Integration
     * Get admin-related system settings
     */
    async getAdminModuleConfig() {
        return {
            // Admin access settings
            adminSessionTimeout: await this.getCachedConfig('admin.sessionTimeout', 1800000), // 30 minutes
            requireTwoFactor: await this.getCachedConfig('admin.requireTwoFactor', false),
            auditAllActions: await this.getCachedConfig('admin.auditAllActions', true),

            // System management
            maintenanceMode: await systemSettingsService.getMaintenanceMode(),
            backupEnabled: await this.getCachedConfig('admin.backupEnabled', true),
            backupFrequency: await this.getCachedConfig('admin.backupFrequency', 'daily'),

            // Feature flags for admin
            advancedAnalyticsEnabled: await systemSettingsService.isFeatureEnabled('advanced_analytics'),
            systemMonitoringEnabled: await systemSettingsService.isFeatureEnabled('system_monitoring'),
            bulkOperationsEnabled: await systemSettingsService.isFeatureEnabled('bulk_operations')
        };
    }

    /**
     * WordPress Integration
     * Get WordPress integration settings
     */
    async getWordPressIntegrationConfig() {
        return {
            wpIntegrationEnabled: await this.getCachedConfig('wordpress.integrationEnabled', true),
            wpApiUrl: await this.getCachedConfig('wordpress.apiUrl', null),
            wpApiKey: await this.getCachedConfig('wordpress.apiKey', null),
            contentSyncEnabled: await this.getCachedConfig('wordpress.contentSyncEnabled', false),
            accessControlEnabled: await this.getCachedConfig('wordpress.accessControlEnabled', true),

            // Organization details for WP
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            supportEmail: await this.getCachedConfig('supportEmail', 'support@eagle-investors.com')
        };
    }

    /**
     * Email Template Integration
     * Get settings for email templates
     */
    async getEmailTemplateConfig() {
        return {
            organizationName: await this.getCachedConfig('organizationName', 'Eagle Investors'),
            organizationLogo: await this.getCachedConfig('organizationLogo', null),
            supportEmail: await this.getCachedConfig('supportEmail', 'support@eagle-investors.com'),
            supportPhone: await this.getCachedConfig('supportPhone', null),
            defaultCurrency: await this.getCachedConfig('defaultCurrency', 'USD'),

            // Email settings
            emailEnabled: await this.getCachedConfig('notifications.emailEnabled', true),
            defaultEmailProvider: await this.getCachedConfig('notifications.defaultEmailProvider', 'sendgrid'),

            // Legal URLs for email footers
            privacyPolicyUrl: await this.getCachedConfig('policyUrls.privacy_policy', '#'),
            termsOfServiceUrl: await this.getCachedConfig('policyUrls.terms_of_service', '#'),
            supportUrl: await this.getCachedConfig('policyUrls.support', '#')
        };
    }

    /**
     * Feature Flag Helpers
     * Common feature flag checks used across modules
     */
    async getCommonFeatureFlags(user = null) {
        const flags = await Promise.allSettled([
            systemSettingsService.isFeatureEnabled('advanced_analytics', user),
            systemSettingsService.isFeatureEnabled('two_factor_auth', user),
            systemSettingsService.isFeatureEnabled('real_time_notifications', user),
            systemSettingsService.isFeatureEnabled('bulk_operations', user),
            systemSettingsService.isFeatureEnabled('wordpress_integration', user),
            systemSettingsService.isFeatureEnabled('api_v2', user),
            systemSettingsService.isFeatureEnabled('mobile_app', user),
            systemSettingsService.isFeatureEnabled('advanced_security', user)
        ]);

        return {
            advancedAnalytics: flags[0].status === 'fulfilled' ? flags[0].value : false,
            twoFactorAuth: flags[1].status === 'fulfilled' ? flags[1].value : false,
            realTimeNotifications: flags[2].status === 'fulfilled' ? flags[2].value : false,
            bulkOperations: flags[3].status === 'fulfilled' ? flags[3].value : false,
            wordpressIntegration: flags[4].status === 'fulfilled' ? flags[4].value : false,
            apiV2: flags[5].status === 'fulfilled' ? flags[5].value : false,
            mobileApp: flags[6].status === 'fulfilled' ? flags[6].value : false,
            advancedSecurity: flags[7].status === 'fulfilled' ? flags[7].value : false
        };
    }

    /**
     * Get validation rules from system settings
     */
    async getValidationRules() {
        return {
            password: {
                minLength: await this.getCachedConfig('authentication.passwordMinLength', 8),
                requireUppercase: await this.getCachedConfig('authentication.passwordRequireUppercase', true),
                requireLowercase: await this.getCachedConfig('authentication.passwordRequireLowercase', true),
                requireNumbers: await this.getCachedConfig('authentication.passwordRequireNumbers', true),
                requireSymbols: await this.getCachedConfig('authentication.passwordRequireSymbols', false)
            },
            email: {
                verificationRequired: await this.getCachedConfig('authentication.requireEmailVerification', true)
            },
            phone: {
                verificationRequired: await this.getCachedConfig('authentication.requirePhoneVerification', false)
            },
            session: {
                timeout: await this.getCachedConfig('authentication.sessionTimeout', 3600000),
                maxLoginAttempts: await this.getCachedConfig('authentication.maxLoginAttempts', 5),
                lockoutDuration: await this.getCachedConfig('authentication.lockoutDuration', 900000)
            }
        };
    }

    /**
     * Clear integration cache
     */
    clearCache() {
        this.cache.clear();
        systemSettingsService.clearCache();
        console.log('✅ System settings integration cache cleared');
    }

    /**
     * Get all module configurations at once
     */
    async getAllModuleConfigurations(user = null) {
        const [
            userConfig,
            paymentConfig,
            notificationConfig,
            analyticsConfig,
            contractConfig,
            subscriptionConfig,
            adminConfig,
            wordpressConfig,
            emailConfig,
            featureFlags,
            validationRules
        ] = await Promise.allSettled([
            this.getUserModuleConfig(),
            this.getPaymentModuleConfig(),
            this.getNotificationModuleConfig(),
            this.getAnalyticsModuleConfig(),
            this.getContractModuleConfig(),
            this.getSubscriptionModuleConfig(),
            this.getAdminModuleConfig(),
            this.getWordPressIntegrationConfig(),
            this.getEmailTemplateConfig(),
            this.getCommonFeatureFlags(user),
            this.getValidationRules()
        ]);

        return {
            user: userConfig.status === 'fulfilled' ? userConfig.value : {},
            payment: paymentConfig.status === 'fulfilled' ? paymentConfig.value : {},
            notification: notificationConfig.status === 'fulfilled' ? notificationConfig.value : {},
            analytics: analyticsConfig.status === 'fulfilled' ? analyticsConfig.value : {},
            contract: contractConfig.status === 'fulfilled' ? contractConfig.value : {},
            subscription: subscriptionConfig.status === 'fulfilled' ? subscriptionConfig.value : {},
            admin: adminConfig.status === 'fulfilled' ? adminConfig.value : {},
            wordpress: wordpressConfig.status === 'fulfilled' ? wordpressConfig.value : {},
            email: emailConfig.status === 'fulfilled' ? emailConfig.value : {},
            featureFlags: featureFlags.status === 'fulfilled' ? featureFlags.value : {},
            validation: validationRules.status === 'fulfilled' ? validationRules.value : {}
        };
    }
}

module.exports = new SystemSettingsIntegration();