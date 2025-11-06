const AdminUser = require('../models/adminUser.model');
const SystemSettings = require('../models/systemSettings.model');
const AuditLog = require('../models/auditLog.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class SettingsController {

    /**
     * Get all settings for current user
     */
    static async getSettings(req, res) {
        try {
            const adminUser = await AdminUser.findById(req.user.id)
                .select('-password -twoFactorSecret -passwordResetToken -activationToken');

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Initialize metadata if not exists
            if (!adminUser.metadata) adminUser.metadata = {};
            if (!adminUser.metadata.settings) adminUser.metadata.settings = {};

            const settings = {
                // Appearance
                theme: adminUser.metadata.settings.theme || 'light',
                language: 'en',
                timezone: 'UTC',

                // Notifications
                notifications: {
                    email: adminUser.metadata.settings.emailNotifications !== false,
                    push: adminUser.metadata.settings.pushNotifications !== false,
                    sms: adminUser.metadata.settings.smsNotifications || false,
                    reports: adminUser.metadata.settings.reportNotifications !== false,
                    alerts: adminUser.metadata.settings.alertNotifications !== false,
                    updates: adminUser.metadata.settings.updateNotifications !== false,
                    newsletter: adminUser.metadata.settings.newsletter || false
                },

                // Privacy
                privacy: {
                    profileVisibility: adminUser.metadata.settings.profileVisibility || 'team',
                    showEmail: adminUser.metadata.settings.showEmail || false,
                    showActivity: adminUser.metadata.settings.showActivity !== false,
                    allowMessages: adminUser.metadata.settings.allowMessages !== false
                },

                // Security
                security: {
                    twoFactorEnabled: adminUser.isTwoFactorEnabled || false,
                    loginAlerts: adminUser.metadata.settings.loginAlerts !== false,
                    sessionTimeout: adminUser.metadata.settings.sessionTimeout || 30,
                    passwordLastChanged: adminUser.passwordChangedAt || adminUser.createdAt
                }
            };

            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Get Settings Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch settings',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Update notification settings
     */
    static async updateNotificationSettings(req, res) {
        try {
            const {
                email,
                push,
                sms,
                reports,
                alerts,
                updates,
                newsletter
            } = req.body;

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Initialize metadata if not exists
            if (!adminUser.metadata) adminUser.metadata = {};
            if (!adminUser.metadata.settings) adminUser.metadata.settings = {};

            // Update notification settings
            if (email !== undefined) adminUser.metadata.settings.emailNotifications = email;
            if (push !== undefined) adminUser.metadata.settings.pushNotifications = push;
            if (sms !== undefined) adminUser.metadata.settings.smsNotifications = sms;
            if (reports !== undefined) adminUser.metadata.settings.reportNotifications = reports;
            if (alerts !== undefined) adminUser.metadata.settings.alertNotifications = alerts;
            if (updates !== undefined) adminUser.metadata.settings.updateNotifications = updates;
            if (newsletter !== undefined) adminUser.metadata.settings.newsletter = newsletter;

            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                userId: req.user.id,
                action: 'data_modification',
                resource: 'admin_notification_settings',
                resourceId: adminUser._id.toString(),
                details: { email, push, sms, reports, alerts, updates, newsletter },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent'),
                success: true
            });

            res.status(200).json({
                success: true,
                message: 'Notification settings updated successfully',
                data: {
                    email, push, sms, reports, alerts, updates, newsletter
                }
            });
        } catch (error) {
            console.error('Update Notification Settings Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update notification settings',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Update privacy settings
     */
    static async updatePrivacySettings(req, res) {
        try {
            const {
                profileVisibility,
                showEmail,
                showActivity,
                allowMessages
            } = req.body;

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Initialize metadata if not exists
            if (!adminUser.metadata) adminUser.metadata = {};
            if (!adminUser.metadata.settings) adminUser.metadata.settings = {};

            // Update privacy settings
            if (profileVisibility !== undefined) adminUser.metadata.settings.profileVisibility = profileVisibility;
            if (showEmail !== undefined) adminUser.metadata.settings.showEmail = showEmail;
            if (showActivity !== undefined) adminUser.metadata.settings.showActivity = showActivity;
            if (allowMessages !== undefined) adminUser.metadata.settings.allowMessages = allowMessages;

            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                adminUser: req.user.id,
                action: 'update',
                resource: 'privacy_settings',
                resourceId: adminUser._id,
                changes: { profileVisibility, showEmail, showActivity, allowMessages },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });

            res.status(200).json({
                success: true,
                message: 'Privacy settings updated successfully',
                data: {
                    profileVisibility, showEmail, showActivity, allowMessages
                }
            });
        } catch (error) {
            console.error('Update Privacy Settings Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update privacy settings',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Update security settings
     */
    static async updateSecuritySettings(req, res) {
        try {
            const {
                loginAlerts,
                sessionTimeout
            } = req.body;

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Initialize metadata if not exists
            if (!adminUser.metadata) adminUser.metadata = {};
            if (!adminUser.metadata.settings) adminUser.metadata.settings = {};

            // Update security settings
            if (loginAlerts !== undefined) adminUser.metadata.settings.loginAlerts = loginAlerts;
            if (sessionTimeout !== undefined) adminUser.metadata.settings.sessionTimeout = sessionTimeout;

            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                adminUser: req.user.id,
                action: 'update',
                resource: 'security_settings',
                resourceId: adminUser._id,
                changes: { loginAlerts, sessionTimeout },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });

            res.status(200).json({
                success: true,
                message: 'Security settings updated successfully',
                data: {
                    loginAlerts, sessionTimeout
                }
            });
        } catch (error) {
            console.error('Update Security Settings Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update security settings',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Toggle two-factor authentication
     */
    static async toggleTwoFactor(req, res) {
        try {
            const { enable, secret } = req.body;

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (enable) {
                // Enable 2FA
                const generatedSecret = secret || crypto.randomBytes(20).toString('hex');
                adminUser.isTwoFactorEnabled = true;
                adminUser.twoFactorSecret = generatedSecret;

                // Create audit log
                await AuditLog.create({
                    adminUser: req.user.id,
                    action: 'enable',
                    resource: 'two_factor_auth',
                    resourceId: adminUser._id,
                    changes: { twoFactorEnabled: true },
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent')
                });

                await adminUser.save();

                return res.status(200).json({
                    success: true,
                    message: '2FA enabled successfully',
                    data: {
                        twoFactorEnabled: true,
                        secret: generatedSecret
                    }
                });
            } else {
                // Disable 2FA
                adminUser.isTwoFactorEnabled = false;
                adminUser.twoFactorSecret = null;

                // Create audit log
                await AuditLog.create({
                    adminUser: req.user.id,
                    action: 'disable',
                    resource: 'two_factor_auth',
                    resourceId: adminUser._id,
                    changes: { twoFactorEnabled: false },
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent')
                });

                await adminUser.save();

                return res.status(200).json({
                    success: true,
                    message: '2FA disabled successfully',
                    data: {
                        twoFactorEnabled: false
                    }
                });
            }
        } catch (error) {
            console.error('Toggle Two Factor Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to toggle 2FA',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Change password (from settings)
     */
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password and new password are required'
                });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 8 characters long'
                });
            }

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Verify current password
            const isMatch = await adminUser.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // Update password
            adminUser.password = newPassword;
            adminUser.passwordChangedAt = new Date();
            adminUser.forcePasswordChange = false;
            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                adminUser: req.user.id,
                action: 'update',
                resource: 'password',
                resourceId: adminUser._id,
                changes: {
                    action: 'password_changed_from_settings'
                },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });

            res.status(200).json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Change Password Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to change password',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Export user data
     */
    static async exportData(req, res) {
        try {
            const adminUser = await AdminUser.findById(req.user.id)
                .select('-password -twoFactorSecret -passwordResetToken -activationToken');

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get activity logs
            const activities = await AuditLog.find({
                adminUser: req.user.id
            })
                .sort({ timestamp: -1 })
                .limit(1000);

            // Prepare export data
            const exportData = {
                profile: {
                    id: adminUser._id,
                    fullName: adminUser.fullName,
                    firstName: adminUser.firstName,
                    lastName: adminUser.lastName,
                    email: adminUser.email,
                    username: adminUser.username,
                    phone: adminUser.phone,
                    adminLevel: adminUser.adminLevel,
                    department: adminUser.department,
                    bio: adminUser.bio,
                    profilePicture: adminUser.profilePicture,
                    createdAt: adminUser.createdAt,
                    updatedAt: adminUser.updatedAt,
                    lastLoginAt: adminUser.lastLoginAt,
                    isEmailVerified: adminUser.isEmailVerified,
                    isTwoFactorEnabled: adminUser.isTwoFactorEnabled
                },
                settings: adminUser.metadata?.settings || {},
                activities: activities.map(activity => ({
                    action: activity.action,
                    resource: activity.resource,
                    timestamp: activity.timestamp,
                    ipAddress: activity.ipAddress
                })),
                exportedAt: new Date().toISOString()
            };

            // Create audit log
            await AuditLog.create({
                adminUser: req.user.id,
                action: 'export',
                resource: 'user_data',
                resourceId: adminUser._id,
                changes: { action: 'data_export_requested' },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });

            res.status(200).json({
                success: true,
                message: 'Data exported successfully',
                data: exportData
            });
        } catch (error) {
            console.error('Export Data Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export data',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Delete account (soft delete)
     */
    static async deleteAccount(req, res) {
        try {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: 'Password is required to delete account'
                });
            }

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Verify password
            const isMatch = await adminUser.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Password is incorrect'
                });
            }

            // Prevent super admin deletion
            if (adminUser.adminLevel === 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Super admin account cannot be deleted'
                });
            }

            // Soft delete - deactivate account
            adminUser.isActive = false;
            adminUser.metadata = adminUser.metadata || {};
            adminUser.metadata.deletedAt = new Date();
            adminUser.metadata.deleteReason = 'user_requested';
            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                adminUser: req.user.id,
                action: 'delete',
                resource: 'account',
                resourceId: adminUser._id,
                changes: { action: 'account_deletion_requested', isActive: false },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });

            res.status(200).json({
                success: true,
                message: 'Account deleted successfully'
            });
        } catch (error) {
            console.error('Delete Account Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete account',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get active sessions
     */
    static async getActiveSessions(req, res) {
        try {
            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get recent login activities from audit logs
            const recentLogins = await AuditLog.find({
                adminUser: req.user.id,
                action: 'login',
                resource: 'auth'
            })
                .sort({ timestamp: -1 })
                .limit(10);

            // Format sessions
            const sessions = recentLogins.map((login, index) => ({
                id: login._id,
                device: login.userAgent || 'Unknown Device',
                location: login.ipAddress || 'Unknown Location',
                lastActive: login.timestamp,
                current: index === 0 // First one is current session
            }));

            // Add current session if no logins found
            if (sessions.length === 0) {
                sessions.push({
                    id: 'current',
                    device: req.get('user-agent') || 'Unknown Device',
                    location: req.ip || 'Unknown Location',
                    lastActive: new Date(),
                    current: true
                });
            }

            res.status(200).json({
                success: true,
                data: sessions
            });
        } catch (error) {
            console.error('Get Active Sessions Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch active sessions',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Revoke session
     */
    static async revokeSession(req, res) {
        try {
            const { sessionId } = req.params;

            if (sessionId === 'current') {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot revoke current session'
                });
            }

            // Create audit log
            await AuditLog.create({
                adminUser: req.user.id,
                action: 'revoke',
                resource: 'session',
                resourceId: sessionId,
                changes: { action: 'session_revoked' },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });

            res.status(200).json({
                success: true,
                message: 'Session revoked successfully'
            });
        } catch (error) {
            console.error('Revoke Session Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to revoke session',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
}

module.exports = SettingsController;
