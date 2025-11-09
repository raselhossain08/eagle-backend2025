const SystemSettings = require('../models/systemSettings.model');
const systemSettingsService = require('../services/systemSettings.service');
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
        // Determine if user is admin
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superAdmin');

        if (isAdmin) {
            // Return all settings for admin
            const settings = await systemSettingsService.getSettings(true);
            return res.status(200).json({
                success: true,
                data: settings
            });
        } else {
            // Return only public settings for non-admin users
            const publicSettings = await systemSettingsService.getPublicSettings();
            return res.status(200).json({
                success: true,
                data: publicSettings
            });
        }
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
        const settings = await systemSettingsService.updateSettings(req.body, req.user.id);

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
        const settings = await systemSettingsService.getSettings();

        if (!settings) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Filter enabled flags only for non-admin users
        const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'superAdmin');
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
        const settings = await systemSettingsService.updateFeatureFlag(req.body);

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
        const analytics = await systemSettingsService.getSystemAnalytics();

        res.status(200).json({
            success: true,
            data: analytics
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

/**
 * Get Public Settings (No Auth Required)
 * @route GET /api/system-settings/public
 * @access Public
 */
exports.getPublicSettings = async (req, res) => {
    try {
        const publicSettings = await systemSettingsService.getPublicSettings();

        res.status(200).json({
            success: true,
            data: publicSettings
        });
    } catch (error) {
        console.error('❌ Get Public Settings Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch public settings',
            message: error.message
        });
    }
};

/**
 * Check Feature Flag for Current User
 * @route GET /api/system-settings/feature-flag/:key/check
 * @access Public/User
 */
exports.checkFeatureFlag = async (req, res) => {
    try {
        const { key } = req.params;
        const enabled = await systemSettingsService.isFeatureEnabled(key, req.user);

        res.status(200).json({
            success: true,
            data: {
                key,
                enabled,
                userId: req.user?.id,
                userRole: req.user?.role
            }
        });
    } catch (error) {
        console.error('❌ Check Feature Flag Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check feature flag',
            message: error.message
        });
    }
};

/**
 * Update Legal Text
 * @route PUT /api/system-settings/legal-texts/:id
 * @access Admin
 */
exports.updateLegalText = async (req, res) => {
    try {
        const { id } = req.params;
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        const textIndex = settings.legalTexts.findIndex(t => t._id.toString() === id);

        if (textIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Legal text not found'
            });
        }

        // Update legal text
        settings.legalTexts[textIndex] = {
            ...settings.legalTexts[textIndex].toObject(),
            ...req.body,
            updatedBy: req.user._id,
            updatedAt: new Date()
        };

        await settings.save();

        res.status(200).json({
            success: true,
            data: settings.legalTexts[textIndex]
        });
    } catch (error) {
        console.error('❌ Update Legal Text Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update legal text',
            message: error.message
        });
    }
};

/**
 * Approve Legal Text
 * @route POST /api/system-settings/legal-texts/:id/approve
 * @access Admin
 */
exports.approveLegalText = async (req, res) => {
    try {
        const { id } = req.params;
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        const textIndex = settings.legalTexts.findIndex(t => t._id.toString() === id);

        if (textIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Legal text not found'
            });
        }

        settings.legalTexts[textIndex].approvalStatus = 'approved';
        settings.legalTexts[textIndex].approvedBy = req.user._id;
        settings.legalTexts[textIndex].approvedAt = new Date();
        settings.legalTexts[textIndex].isActive = true;

        await settings.save();

        res.status(200).json({
            success: true,
            data: settings.legalTexts[textIndex]
        });
    } catch (error) {
        console.error('❌ Approve Legal Text Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve legal text',
            message: error.message
        });
    }
};

/**
 * Update Policy URL
 * @route PUT /api/system-settings/policy-urls/:key
 * @access Admin
 */
exports.updatePolicyUrl = async (req, res) => {
    try {
        const { key } = req.params;
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        const urlIndex = settings.policyUrls.findIndex(p => p.key === key);

        if (urlIndex === -1) {
            // Create new policy URL if not exists
            const newPolicyUrl = {
                key: key,
                ...req.body,
                createdBy: req.user._id,
                createdAt: new Date()
            };
            settings.policyUrls.push(newPolicyUrl);
        } else {
            // Update existing policy URL
            settings.policyUrls[urlIndex] = {
                ...settings.policyUrls[urlIndex].toObject(),
                ...req.body,
                key: key,
                updatedBy: req.user._id,
                updatedAt: new Date()
            };
        }

        await settings.save();

        const updatedUrl = urlIndex === -1
            ? settings.policyUrls[settings.policyUrls.length - 1]
            : settings.policyUrls[urlIndex];

        res.status(200).json({
            success: true,
            data: updatedUrl
        });
    } catch (error) {
        console.error('❌ Update Policy URL Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update policy URL',
            message: error.message
        });
    }
};

/**
 * Delete Policy URL
 * @route DELETE /api/system-settings/policy-urls/:key
 * @access Admin
 */
exports.deletePolicyUrl = async (req, res) => {
    try {
        const { key } = req.params;
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        settings.policyUrls = settings.policyUrls.filter(p => p.key !== key);
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Policy URL deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete Policy URL Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete policy URL',
            message: error.message
        });
    }
};

/**
 * Get Configurations
 * @route GET /api/system-settings/configurations
 * @access Admin
 */
exports.getConfigurations = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        // Return configurations array from settings
        const configurations = settings.configurations || [];

        res.status(200).json({
            success: true,
            data: configurations
        });
    } catch (error) {
        console.error('❌ Get Configurations Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch configurations',
            message: error.message
        });
    }
};

/**
 * Update Configuration
 * @route PUT /api/system-settings/configurations/:key
 * @access Admin
 */
exports.updateConfiguration = async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        if (!settings.configurations) {
            settings.configurations = [];
        }

        const configIndex = settings.configurations.findIndex(c => c.key === key);

        if (configIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Configuration not found'
            });
        }

        if (settings.configurations[configIndex].isReadOnly) {
            return res.status(403).json({
                success: false,
                error: 'This configuration is read-only'
            });
        }

        settings.configurations[configIndex].value = value;
        settings.configurations[configIndex].lastModified = new Date();
        settings.configurations[configIndex].modifiedBy = req.user._id;

        await settings.save();

        res.status(200).json({
            success: true,
            data: settings.configurations[configIndex]
        });
    } catch (error) {
        console.error('❌ Update Configuration Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration',
            message: error.message
        });
    }
};

/**
 * Toggle Maintenance Mode
 * @route POST /api/system-settings/maintenance-mode
 * @access Admin
 */
exports.toggleMaintenanceMode = async (req, res) => {
    try {
        const { enabled, message } = req.body;
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        settings.maintenanceMode.enabled = enabled;
        if (message) {
            settings.maintenanceMode.message = message;
        }

        await settings.save();

        res.status(200).json({
            success: true,
            data: {
                maintenanceMode: settings.maintenanceMode.enabled,
                maintenanceMessage: settings.maintenanceMode.message
            }
        });
    } catch (error) {
        console.error('❌ Toggle Maintenance Mode Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle maintenance mode',
            message: error.message
        });
    }
};

/**
 * Export Settings
 * @route GET /api/system-settings/export
 * @access Admin
 */
exports.exportSettings = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        if (!settings) {
            return res.status(404).json({
                success: false,
                error: 'System settings not found'
            });
        }

        // Create backup object
        const backup = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            settings: settings.toObject()
        };

        // Send as downloadable JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=system-settings-backup-${Date.now()}.json`);
        res.status(200).send(JSON.stringify(backup, null, 2));
    } catch (error) {
        console.error('❌ Export Settings Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export settings',
            message: error.message
        });
    }
};
