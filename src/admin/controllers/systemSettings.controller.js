const SystemSettings = require('../models/systemSettings.model');
const User = require('../../user/models/user.model');
const { SignedContract } = require('../../contract/models/contract.model');
const Transaction = require('../../transaction/models/transaction.model');
const Subscription = require('../../subscription/models/subscription.model');

/**
 * Get System Settings
 * @route GET /api/system-settings
 * @access Public (for basic settings) / Admin (for sensitive settings)
 */
exports.getSystemSettings = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();

        // If no settings exist, create default settings
        if (!settings) {
            settings = await SystemSettings.create({
                maintenanceMode: {
                    enabled: false,
                    message: 'The system is currently under maintenance. Please check back soon.'
                },
                registrationOpen: true,
                defaultUserRole: 'user',
                systemName: 'Eagle Investors',
                systemLogo: '',
                contactEmail: 'support@eagle-investors.com',
                supportUrl: 'https://eagle-investors.com/support',
                featureFlags: [],
                legalTexts: [],
                policyUrls: [],
                apiRateLimits: {
                    authenticated: { requestsPerMinute: 100 },
                    unauthenticated: { requestsPerMinute: 20 }
                },
                emailSettings: {
                    fromName: 'Eagle Investors',
                    fromEmail: 'noreply@eagle-investors.com',
                    replyToEmail: 'support@eagle-investors.com'
                },
                smsSettings: {
                    enabled: false,
                    provider: 'twilio'
                },
                socialLogin: {
                    google: { enabled: false },
                    facebook: { enabled: false },
                    apple: { enabled: false }
                },
                securitySettings: {
                    passwordMinLength: 8,
                    passwordRequireUppercase: true,
                    passwordRequireLowercase: true,
                    passwordRequireNumber: true,
                    passwordRequireSpecialChar: true,
                    sessionTimeout: 3600,
                    maxLoginAttempts: 5,
                    lockoutDuration: 900,
                    twoFactorRequired: false
                }
            });
        }

        // For non-admin users, hide sensitive information
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isAdmin) {
            // Return only public settings
            const publicSettings = {
                maintenanceMode: settings.maintenanceMode,
                registrationOpen: settings.registrationOpen,
                systemName: settings.systemName,
                systemLogo: settings.systemLogo,
                contactEmail: settings.contactEmail,
                supportUrl: settings.supportUrl,
                policyUrls: settings.policyUrls.filter(p => p.isActive),
                socialLogin: {
                    google: { enabled: settings.socialLogin.google.enabled },
                    facebook: { enabled: settings.socialLogin.facebook.enabled },
                    apple: { enabled: settings.socialLogin.apple.enabled }
                }
            };

            return res.status(200).json({
                success: true,
                data: publicSettings
            });
        }

        // Return all settings for admin
        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('❌ Get System Settings Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system settings',
            message: error.message
        });
    }
};

/**
 * Update System Settings
 * @route PUT /api/system-settings
 * @access Admin only
 */
exports.updateSystemSettings = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();

        if (!settings) {
            settings = await SystemSettings.create(req.body);
        } else {
            settings = await SystemSettings.findByIdAndUpdate(
                settings._id,
                { $set: req.body },
                { new: true, runValidators: true }
            );
        }

        res.status(200).json({
            success: true,
            message: 'System settings updated successfully',
            data: settings
        });
    } catch (error) {
        console.error('❌ Update System Settings Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update system settings',
            message: error.message
        });
    }
};

/**
 * Get Feature Flags
 * @route GET /api/system-settings/feature-flags
 * @access Public
 */
exports.getFeatureFlags = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Filter enabled flags only for non-admin users
        const isAdmin = req.user && req.user.role === 'admin';
        const flags = isAdmin
            ? settings.featureFlags
            : settings.featureFlags.filter(f => f.enabled);

        res.status(200).json({
            success: true,
            data: flags
        });
    } catch (error) {
        console.error('❌ Get Feature Flags Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch feature flags',
            message: error.message
        });
    }
};

/**
 * Add Feature Flag
 * @route POST /api/system-settings/feature-flags
 * @access Admin only
 */
exports.addFeatureFlag = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();

        if (!settings) {
            settings = await SystemSettings.create({});
        }

        settings.addFeatureFlag(req.body);
        await settings.save();

        res.status(201).json({
            success: true,
            message: 'Feature flag added successfully',
            data: settings.featureFlags
        });
    } catch (error) {
        console.error('❌ Add Feature Flag Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add feature flag',
            message: error.message
        });
    }
};

/**
 * Update Feature Flag
 * @route PUT /api/system-settings/feature-flags/:flagId
 * @access Admin only
 */
exports.updateFeatureFlag = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        settings.updateFeatureFlag(req.params.flagId, req.body);
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Feature flag updated successfully',
            data: settings.featureFlags
        });
    } catch (error) {
        console.error('❌ Update Feature Flag Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update feature flag',
            message: error.message
        });
    }
};

/**
 * Delete Feature Flag
 * @route DELETE /api/system-settings/feature-flags/:flagId
 * @access Admin only
 */
exports.deleteFeatureFlag = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        settings.removeFeatureFlag(req.params.flagId);
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Feature flag deleted successfully',
            data: settings.featureFlags
        });
    } catch (error) {
        console.error('❌ Delete Feature Flag Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete feature flag',
            message: error.message
        });
    }
};

/**
 * Get Legal Texts
 * @route GET /api/system-settings/legal-texts
 * @access Public
 */
exports.getLegalTexts = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();
        const { type, language = 'en' } = req.query;

        if (!settings) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        let legalTexts = settings.legalTexts.filter(text => text.isActive);

        if (type) {
            legalTexts = legalTexts.filter(text => text.type === type);
        }

        if (language) {
            legalTexts = legalTexts.filter(text => text.language === language);
        }

        res.status(200).json({
            success: true,
            data: legalTexts
        });
    } catch (error) {
        console.error('❌ Get Legal Texts Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch legal texts',
            message: error.message
        });
    }
};

/**
 * Add Legal Text
 * @route POST /api/system-settings/legal-texts
 * @access Admin only
 */
exports.addLegalText = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();

        if (!settings) {
            settings = await SystemSettings.create({});
        }

        settings.addLegalText(req.body);
        await settings.save();

        res.status(201).json({
            success: true,
            message: 'Legal text added successfully',
            data: settings.legalTexts
        });
    } catch (error) {
        console.error('❌ Add Legal Text Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add legal text',
            message: error.message
        });
    }
};

/**
 * Get Policy URLs
 * @route GET /api/system-settings/policy-urls
 * @access Public
 */
exports.getPolicyUrls = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const policyUrls = settings.policyUrls.filter(url => url.isActive);

        res.status(200).json({
            success: true,
            data: policyUrls
        });
    } catch (error) {
        console.error('❌ Get Policy URLs Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch policy URLs',
            message: error.message
        });
    }
};

/**
 * Add Policy URL
 * @route POST /api/system-settings/policy-urls
 * @access Admin only
 */
exports.addPolicyUrl = async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();

        if (!settings) {
            settings = await SystemSettings.create({});
        }

        settings.addPolicyUrl(req.body);
        await settings.save();

        res.status(201).json({
            success: true,
            message: 'Policy URL added successfully',
            data: settings.policyUrls
        });
    } catch (error) {
        console.error('❌ Add Policy URL Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add policy URL',
            message: error.message
        });
    }
};

/**
 * Get System Settings Analytics
 * @route GET /api/system-settings/analytics
 * @access Admin only
 */
exports.getSystemSettingsAnalytics = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        // Get statistics in parallel
        const [
            totalUsers,
            activeUsers,
            totalContracts,
            completedContracts,
            totalTransactions,
            totalRevenue,
            activeSubscriptions,
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
        ]);

        // Feature flags usage
        const featureFlagsStats = settings?.featureFlags?.length
            ? {
                total: settings.featureFlags.length,
                enabled: settings.featureFlags.filter(f => f.enabled).length,
                disabled: settings.featureFlags.filter(f => !f.enabled).length,
            }
            : { total: 0, enabled: 0, disabled: 0 };

        // Legal texts stats
        const legalTextsStats = settings?.legalTexts?.length
            ? {
                total: settings.legalTexts.length,
                active: settings.legalTexts.filter(t => t.isActive).length,
                inactive: settings.legalTexts.filter(t => !t.isActive).length,
                byType: settings.legalTexts.reduce((acc, text) => {
                    acc[text.type] = (acc[text.type] || 0) + 1;
                    return acc;
                }, {}),
            }
            : { total: 0, active: 0, inactive: 0, byType: {} };

        // Policy URLs stats
        const policyUrlsStats = settings?.policyUrls?.length
            ? {
                total: settings.policyUrls.length,
                active: settings.policyUrls.filter(p => p.isActive).length,
                inactive: settings.policyUrls.filter(p => !p.isActive).length,
            }
            : { total: 0, active: 0, inactive: 0 };

        // Get recent activity (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [recentUsers, recentContracts, recentTransactions] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: oneDayAgo } }),
            SignedContract.countDocuments({ createdAt: { $gte: oneDayAgo } }),
            Transaction.countDocuments({ 'timeline.initiatedAt': { $gte: oneDayAgo } }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                systemInfo: {
                    name: settings?.systemName || 'Eagle Investors',
                    maintenanceMode: settings?.maintenanceMode?.enabled || false,
                    registrationOpen: settings?.registrationOpen !== false,
                    lastUpdated: settings?.updatedAt,
                },
                userStats: {
                    total: totalUsers,
                    active: activeUsers,
                    inactive: totalUsers - activeUsers,
                },
                contractStats: {
                    total: totalContracts,
                    completed: completedContracts,
                    pending: totalContracts - completedContracts,
                },
                transactionStats: {
                    total: totalTransactions,
                    totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
                },
                subscriptionStats: {
                    active: activeSubscriptions,
                },
                featureFlags: featureFlagsStats,
                legalTexts: legalTextsStats,
                policyUrls: policyUrlsStats,
                recentActivity: {
                    last24Hours: {
                        newUsers: recentUsers,
                        newContracts: recentContracts,
                        newTransactions: recentTransactions,
                    },
                },
                apiRateLimits: settings?.apiRateLimits || {
                    authenticated: { requestsPerMinute: 100 },
                    unauthenticated: { requestsPerMinute: 20 },
                },
                securitySettings: {
                    twoFactorRequired: settings?.securitySettings?.twoFactorRequired || false,
                    maxLoginAttempts: settings?.securitySettings?.maxLoginAttempts || 5,
                    sessionTimeout: settings?.securitySettings?.sessionTimeout || 3600,
                },
            },
        });
    } catch (error) {
        console.error('❌ Get System Settings Analytics Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system settings analytics',
            message: error.message,
        });
    }
};
