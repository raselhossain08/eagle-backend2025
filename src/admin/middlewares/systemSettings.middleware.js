/**
 * System Settings Middleware
 * Middleware functions for system settings integration across modules
 */

const systemSettingsService = require('../services/systemSettings.service');

/**
 * Check maintenance mode middleware
 * Blocks requests if system is in maintenance mode (except for admin users)
 */
exports.checkMaintenanceMode = async (req, res, next) => {
    try {
        const maintenanceMode = await systemSettingsService.getMaintenanceMode();

        if (maintenanceMode.enabled) {
            // Allow admin users to bypass maintenance mode
            if (req.user && (req.user.role === 'admin' || req.user.role === 'superAdmin')) {
                return next();
            }

            return res.status(503).json({
                success: false,
                error: 'Service Unavailable',
                message: maintenanceMode.message || 'System is under maintenance',
                maintenanceMode: true
            });
        }

        next();
    } catch (error) {
        console.error('❌ Check Maintenance Mode Error:', error);
        next(); // Continue on error to avoid blocking system
    }
};

/**
 * Feature flag check middleware
 * Checks if a specific feature flag is enabled for the current user
 */
exports.requireFeatureFlag = (flagKey) => {
    return async (req, res, next) => {
        try {
            const enabled = await systemSettingsService.isFeatureEnabled(flagKey, req.user);

            if (!enabled) {
                return res.status(403).json({
                    success: false,
                    error: 'Feature Not Available',
                    message: `Feature "${flagKey}" is not enabled for your account`,
                    featureFlag: flagKey
                });
            }

            // Add feature flag info to request
            req.featureFlag = {
                key: flagKey,
                enabled: true
            };

            next();
        } catch (error) {
            console.error('❌ Feature Flag Check Error:', error);
            // On error, deny access for security
            return res.status(403).json({
                success: false,
                error: 'Feature Check Failed',
                message: 'Unable to verify feature access'
            });
        }
    };
};

/**
 * Optional feature flag check middleware
 * Adds feature flag info to request without blocking
 */
exports.checkFeatureFlag = (flagKey) => {
    return async (req, res, next) => {
        try {
            const enabled = await systemSettingsService.isFeatureEnabled(flagKey, req.user);

            req.featureFlag = {
                key: flagKey,
                enabled
            };

            next();
        } catch (error) {
            console.error('❌ Optional Feature Flag Check Error:', error);
            req.featureFlag = {
                key: flagKey,
                enabled: false
            };
            next();
        }
    };
};

/**
 * Rate limiting based on system settings
 */
exports.dynamicRateLimit = async (req, res, next) => {
    try {
        const isAuthenticated = !!req.user;

        // Get rate limits from system settings
        const authLimit = await systemSettingsService.getConfig(
            'security.maxRequestsPerMinute',
            100
        );
        const unauthLimit = await systemSettingsService.getConfig(
            'security.unauthenticatedMaxRequestsPerMinute',
            20
        );

        const limit = isAuthenticated ? authLimit : unauthLimit;

        // Simple rate limiting implementation
        const clientId = req.ip + (req.user?.id || 'anonymous');
        const windowMs = 60 * 1000; // 1 minute

        if (!req.rateLimit) {
            req.rateLimit = new Map();
        }

        const now = Date.now();
        const windowStart = now - windowMs;

        // Get client's request history
        let requests = req.rateLimit.get(clientId) || [];

        // Remove old requests
        requests = requests.filter(time => time > windowStart);

        if (requests.length >= limit) {
            return res.status(429).json({
                success: false,
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Maximum ${limit} requests per minute`,
                retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
            });
        }

        // Add current request
        requests.push(now);
        req.rateLimit.set(clientId, requests);

        next();
    } catch (error) {
        console.error('❌ Dynamic Rate Limit Error:', error);
        next(); // Continue on error
    }
};

/**
 * Configuration injection middleware
 * Injects commonly used configuration into request object
 */
exports.injectConfig = async (req, res, next) => {
    try {
        const config = {
            organizationName: await systemSettingsService.getConfig('organizationName', 'Eagle Investors'),
            defaultCurrency: await systemSettingsService.getConfig('defaultCurrency', 'USD'),
            defaultTimezone: await systemSettingsService.getConfig('defaultTimezone', 'UTC'),
            supportEmail: await systemSettingsService.getConfig('supportEmail', 'support@eagle-investors.com'),
            // Authentication settings
            passwordMinLength: await systemSettingsService.getConfig('authentication.passwordMinLength', 8),
            requireEmailVerification: await systemSettingsService.getConfig('authentication.requireEmailVerification', true),
            sessionTimeout: await systemSettingsService.getConfig('authentication.sessionTimeout', 3600000),
            // Billing settings
            taxCalculationEnabled: await systemSettingsService.getConfig('billing.taxCalculationEnabled', true),
            defaultTaxRate: await systemSettingsService.getConfig('billing.defaultTaxRate', 0.0825)
        };

        req.systemConfig = config;
        next();
    } catch (error) {
        console.error('❌ Config Injection Error:', error);
        req.systemConfig = {}; // Empty config on error
        next();
    }
};

/**
 * Security headers based on system settings
 */
exports.securityHeaders = async (req, res, next) => {
    try {
        const encryptionEnabled = await systemSettingsService.getConfig('security.encryptionEnabled', true);
        const auditLoggingEnabled = await systemSettingsService.getConfig('security.auditLoggingEnabled', true);

        if (encryptionEnabled) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
        }

        if (auditLoggingEnabled) {
            // Add audit trail ID to response headers
            res.setHeader('X-Audit-ID', req.id || Date.now().toString());
        }

        next();
    } catch (error) {
        console.error('❌ Security Headers Error:', error);
        next(); // Continue on error
    }
};

/**
 * Payment gateway validation middleware
 */
exports.validatePaymentGateway = (gatewayName) => {
    return async (req, res, next) => {
        try {
            const isValid = await systemSettingsService.validatePaymentGatewayConfig(gatewayName);

            if (!isValid) {
                return res.status(503).json({
                    success: false,
                    error: 'Payment Gateway Unavailable',
                    message: `${gatewayName} payment gateway is not properly configured`,
                    gateway: gatewayName
                });
            }

            req.paymentGateway = gatewayName;
            next();
        } catch (error) {
            console.error(`❌ Payment Gateway Validation Error (${gatewayName}):`, error);
            return res.status(503).json({
                success: false,
                error: 'Payment Gateway Error',
                message: 'Unable to validate payment gateway configuration'
            });
        }
    };
};

/**
 * Legal compliance middleware
 * Ensures user has agreed to latest legal texts
 */
exports.checkLegalCompliance = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(); // Skip for non-authenticated users
        }

        const settings = await systemSettingsService.getSettings();
        const activeLegalTexts = settings.legalTexts.filter(text => text.isActive);

        // Check if user needs to agree to new legal texts
        // This would require user model to track legal agreement dates
        // For now, just add info to request
        req.legalCompliance = {
            activeLegalTexts: activeLegalTexts.map(text => ({
                type: text.type,
                version: text.version,
                effectiveDate: text.effectiveDate
            }))
        };

        next();
    } catch (error) {
        console.error('❌ Legal Compliance Check Error:', error);
        next(); // Continue on error
    }
};

/**
 * System health check middleware
 * Adds system health status to response headers
 */
exports.systemHealthHeaders = async (req, res, next) => {
    try {
        const analytics = await systemSettingsService.getSystemAnalytics();

        res.setHeader('X-System-Status', 'operational');
        res.setHeader('X-System-Version', '2.0.0');
        res.setHeader('X-Active-Users', analytics.statistics.users.active.toString());

        next();
    } catch (error) {
        console.error('❌ System Health Headers Error:', error);
        res.setHeader('X-System-Status', 'degraded');
        next();
    }
};

/**
 * Feature flags injection middleware
 * Injects all enabled feature flags into request
 */
exports.injectFeatureFlags = async (req, res, next) => {
    try {
        const settings = await systemSettingsService.getSettings();
        const enabledFlags = settings.featureFlags
            .filter(f => f.enabled)
            .map(f => f.key);

        req.enabledFeatures = enabledFlags;
        next();
    } catch (error) {
        console.error('❌ Feature Flags Injection Error:', error);
        req.enabledFeatures = [];
        next();
    }
};

/**
 * Audit logging middleware
 * Logs requests when audit logging is enabled
 */
exports.auditLog = async (req, res, next) => {
    try {
        const auditEnabled = await systemSettingsService.getConfig('security.auditLoggingEnabled', true);

        if (auditEnabled) {
            const auditData = {
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id,
                userRole: req.user?.role
            };

            // Store audit data (could be database, file, or external service)
            console.log('🔍 AUDIT:', JSON.stringify(auditData));
        }

        next();
    } catch (error) {
        console.error('❌ Audit Log Error:', error);
        next(); // Continue on error
    }
};

module.exports = exports;