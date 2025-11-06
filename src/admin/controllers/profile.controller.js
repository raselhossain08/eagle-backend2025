const AdminUser = require('../models/adminUser.model');
const AuditLog = require('../models/auditLog.model');
const bcrypt = require('bcryptjs');
const { cloudinary } = require('../../config/cloudinary');
const multer = require('multer');
const path = require('path');

class ProfileController {

    /**
     * Get current admin user's profile
     */
    static async getProfile(req, res) {
        try {
            const adminUser = await AdminUser.findById(req.user.id)
                .select('-password -twoFactorSecret -passwordResetToken -activationToken');

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            // Map admin user to profile format expected by frontend
            const profile = {
                id: adminUser._id,
                fullName: adminUser.fullName,
                firstName: adminUser.firstName,
                lastName: adminUser.lastName,
                email: adminUser.email,
                username: adminUser.username,
                phone: adminUser.phone || '',
                bio: adminUser.bio || '',
                company: adminUser.department || '',
                location: '',
                website: '',
                position: adminUser.adminLevel || '',
                profilePicture: adminUser.profilePicture || null,
                createdAt: adminUser.createdAt,
                updatedAt: adminUser.updatedAt,
                lastLoginAt: adminUser.lastLoginAt,
                isEmailVerified: adminUser.isEmailVerified,
                isTwoFactorEnabled: adminUser.isTwoFactorEnabled
            };

            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error) {
            console.error('Get Profile Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch profile',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Update current admin user's profile
     */
    static async updateProfile(req, res) {
        try {
            const {
                firstName,
                lastName,
                phone,
                bio,
                company,
                location,
                website,
                position
            } = req.body;

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            // Update allowed fields
            if (firstName) adminUser.firstName = firstName;
            if (lastName) adminUser.lastName = lastName;
            if (phone !== undefined) adminUser.phone = phone;
            if (bio !== undefined) adminUser.bio = bio;

            // Store location and website in metadata since they're not in the schema
            if (!adminUser.metadata) adminUser.metadata = {};
            if (location !== undefined) adminUser.metadata.location = location;
            if (website !== undefined) adminUser.metadata.website = website;

            // Update department if company provided (mapping company to department)
            if (company) {
                const validDepartments = ["technology", "finance", "marketing", "support", "operations", "hr", "legal", "executive"];
                if (validDepartments.includes(company.toLowerCase())) {
                    adminUser.department = company.toLowerCase();
                }
            }

            adminUser.updatedBy = req.user.id;
            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                userId: req.user.id,
                action: 'data_modification',
                resource: 'admin_profile',
                resourceId: adminUser._id.toString(),
                details: {
                    updatedFields: { firstName, lastName, phone, bio, company, location, website }
                },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent'),
                success: true
            });

            // Return updated profile
            const profile = {
                id: adminUser._id,
                fullName: adminUser.fullName,
                firstName: adminUser.firstName,
                lastName: adminUser.lastName,
                email: adminUser.email,
                username: adminUser.username,
                phone: adminUser.phone || '',
                bio: adminUser.bio || '',
                company: adminUser.department || company || '',
                location: adminUser.metadata?.location || '',
                website: adminUser.metadata?.website || '',
                position: adminUser.adminLevel || '',
                profilePicture: adminUser.profilePicture || null,
                updatedAt: adminUser.updatedAt
            };

            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: profile
            });
        } catch (error) {
            console.error('Update Profile Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update profile',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Upload profile avatar
     */
    static async uploadAvatar(req, res) {
        try {
            console.log('Upload Avatar - Request received');
            console.log('Request body:', req.body);
            console.log('Request file:', req.file);
            console.log('Request headers:', req.headers);

            if (!req.file) {
                console.error('No file in request');
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Profile not found'
                });
            }

            let avatarUrl;

            // Try to upload to cloudinary, fallback to local storage
            if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
                try {
                    // Delete old avatar from cloudinary if exists
                    if (adminUser.profilePicture && adminUser.profilePicture.includes('cloudinary')) {
                        try {
                            const publicId = adminUser.profilePicture.split('/').pop().split('.')[0];
                            await cloudinary.uploader.destroy(`avatars/${publicId}`);
                        } catch (err) {
                            console.error('Error deleting old avatar:', err);
                        }
                    }

                    // Upload new avatar to cloudinary
                    const result = await cloudinary.uploader.upload(req.file.path, {
                        folder: 'avatars',
                        width: 500,
                        height: 500,
                        crop: 'fill',
                        gravity: 'face'
                    });

                    avatarUrl = result.secure_url;
                } catch (cloudinaryError) {
                    console.error('Cloudinary upload failed, using local storage:', cloudinaryError);
                    // Use local file path as fallback
                    avatarUrl = `/uploads/avatars/${req.file.filename}`;
                }
            } else {
                // Use local storage if cloudinary not configured
                avatarUrl = `/uploads/avatars/${req.file.filename}`;
            }

            adminUser.profilePicture = avatarUrl;
            adminUser.updatedBy = req.user.id;
            await adminUser.save();

            // Create audit log
            await AuditLog.create({
                userId: req.user.id,
                action: 'data_modification',
                resource: 'admin_profile_avatar',
                resourceId: adminUser._id.toString(),
                details: {
                    profilePicture: avatarUrl,
                    uploadType: avatarUrl.includes('cloudinary') ? 'cloudinary' : 'local'
                },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent'),
                success: true
            });

            res.status(200).json({
                success: true,
                message: 'Avatar uploaded successfully',
                data: {
                    profilePicture: avatarUrl
                }
            });
        } catch (error) {
            console.error('Upload Avatar Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upload avatar',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }    /**
     * Change password
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
                userId: req.user.id,
                action: 'data_modification',
                resource: 'admin_password',
                resourceId: adminUser._id.toString(),
                details: {
                    action: 'password_changed'
                },
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent'),
                success: true
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
     * Get account statistics
     */
    static async getAccountStats(req, res) {
        try {
            const adminUser = await AdminUser.findById(req.user.id);

            if (!adminUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get total actions from audit logs
            const totalActions = await AuditLog.countDocuments({
                adminUser: req.user.id
            });

            // Get recent activity count (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const recentActions = await AuditLog.countDocuments({
                adminUser: req.user.id,
                timestamp: { $gte: thirtyDaysAgo }
            });

            const stats = {
                totalActions,
                recentActions,
                activeSessions: 1, // Default to 1 (current session)
                lastLogin: adminUser.lastLoginAt || new Date(),
                accountCreated: adminUser.createdAt,
                loginCount: adminUser.loginAttempts || 0,
                emailVerified: adminUser.isEmailVerified,
                twoFactorEnabled: adminUser.isTwoFactorEnabled
            };

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Get Account Stats Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch account statistics',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    /**
     * Get activity log
     */
    static async getActivityLog(req, res) {
        try {
            const { limit = 10 } = req.query;

            const activities = await AuditLog.find({
                adminUser: req.user.id
            })
                .sort({ timestamp: -1 })
                .limit(parseInt(limit))
                .select('action resource resourceId timestamp ipAddress userAgent changes');

            const formattedActivities = activities.map(activity => ({
                id: activity._id,
                action: activity.action,
                resource: activity.resource,
                resourceId: activity.resourceId,
                timestamp: activity.timestamp,
                ipAddress: activity.ipAddress,
                description: `${activity.action} ${activity.resource}`,
                details: activity.changes
            }));

            res.status(200).json({
                success: true,
                data: formattedActivities
            });
        } catch (error) {
            console.error('Get Activity Log Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch activity log',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
}

module.exports = ProfileController;
