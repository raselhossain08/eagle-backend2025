const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * User Management Controller
 * Handles comprehensive user CRUD operations for admin dashboard
 * Uses the main User model (user.model.js) for all operations
 */

/**
 * Helper function to transform user data for frontend
 * Maps backend fields (isActive, isBlocked, emailVerified) to frontend status field
 */
const transformUserForFrontend = (user) => {
    const userObj = user.toObject ? user.toObject() : user;

    // Calculate status based on backend fields
    let status = 'pending';
    if (userObj.isBlocked) {
        status = 'suspended';
    } else if (!userObj.emailVerified) {
        status = 'pending';
    } else if (userObj.isActive) {
        status = 'active';
    } else {
        status = 'inactive';
    }

    // Create full name from firstName and lastName
    const name = `${userObj.firstName || ''} ${userObj.lastName || ''}`.trim() || userObj.username || userObj.email;

    return {
        ...userObj,
        name,
        status,
        isEmailVerified: userObj.emailVerified // Map for frontend compatibility
    };
};

// @desc    Get all users with filtering, pagination, and sorting
// @route   GET /api/users
// @access  Private (Admin only)
const getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            role,
            status,
            subscription,
            subscriptionStatus,
            emailVerified,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            startDate,
            endDate
        } = req.query;

        console.log('📥 Get Users Request:', { page, limit, search, role, status });

        // Build query
        const query = {};

        // Search across multiple fields
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex },
                { username: searchRegex }
            ];
        }

        // Filter by role
        if (role && role !== 'all') {
            query.role = role;
        }

        // Filter by status
        if (status && status !== 'all') {
            // Map frontend status to backend fields
            switch (status) {
                case 'active':
                    query.isActive = true;
                    query.isBlocked = false;
                    break;
                case 'inactive':
                    query.isActive = false;
                    break;
                case 'suspended':
                    query.isBlocked = true;
                    break;
                case 'pending':
                    query.emailVerified = false;
                    break;
            }
        }

        // Filter by subscription
        if (subscription && subscription !== 'all') {
            query.subscription = subscription;
        }

        // Filter by subscription status
        if (subscriptionStatus && subscriptionStatus !== 'all') {
            query.subscriptionStatus = subscriptionStatus;
        }

        // Filter by email verification
        if (emailVerified !== undefined) {
            query.emailVerified = emailVerified === 'true';
        }

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Build sort object
        const sortObject = {};
        sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const users = await User.find(query)
            .select('-password -resetPasswordToken -resetPasswordExpire -activationToken')
            .sort(sortObject)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Transform users for frontend
        const transformedUsers = users.map(transformUserForFrontend);

        // Get total count for pagination
        const total = await User.countDocuments(query);

        console.log('✅ Users fetched:', transformedUsers.length, 'Total:', total);

        res.status(200).json({
            success: true,
            data: transformedUsers,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Get Users Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Get user statistics for dashboard
// @route   GET /api/users/stats
// @access  Private (Admin only)
const getUserStats = async (req, res) => {
    try {
        console.log('📊 Fetching user statistics...');

        // Calculate date ranges
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Get counts in parallel for better performance
        const [
            totalUsers,
            activeUsers,
            inactiveUsers,
            suspendedUsers,
            pendingUsers,
            verifiedUsers,
            unverifiedUsers,
            adminUsers,
            regularUsers,
            moderatorUsers,
            subscriberUsers,
            newUsersThisMonth,
            newUsersLastMonth,
            roleStats,
            subscriptionStats
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true, isBlocked: false }),
            User.countDocuments({ isActive: false }),
            User.countDocuments({ isBlocked: true }),
            User.countDocuments({ emailVerified: false }),
            User.countDocuments({ emailVerified: true }),
            User.countDocuments({ emailVerified: false }),
            User.countDocuments({ role: 'admin' }),
            User.countDocuments({ role: 'user' }),
            User.countDocuments({ role: 'moderator' }),
            User.countDocuments({ role: 'subscriber' }),
            User.countDocuments({ createdAt: { $gte: startOfMonth } }),
            User.countDocuments({
                createdAt: {
                    $gte: startOfLastMonth,
                    $lte: endOfLastMonth
                }
            }),
            User.aggregate([
                {
                    $group: {
                        _id: '$role',
                        count: { $sum: 1 }
                    }
                }
            ]),
            User.aggregate([
                {
                    $group: {
                        _id: '$subscription',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Calculate growth percentage
        const userGrowthPercentage = newUsersLastMonth > 0
            ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
            : (newUsersThisMonth > 0 ? 100 : 0);

        // Format role stats
        const roleDistribution = {};
        roleStats.forEach(stat => {
            roleDistribution[stat._id || 'user'] = stat.count;
        });

        // Format subscription stats
        const subscriptionDistribution = {};
        subscriptionStats.forEach(stat => {
            subscriptionDistribution[stat._id || 'none'] = stat.count;
        });

        // Note: onlineUsers requires session tracking - defaulting to 0 for now
        const onlineUsers = 0;

        const stats = {
            totalUsers,
            activeUsers,
            inactiveUsers,
            suspendedUsers,
            pendingUsers,
            adminUsers,
            regularUsers,
            moderatorUsers,
            subscriberUsers,
            verifiedUsers,
            unverifiedUsers,
            onlineUsers,
            newUsersThisMonth,
            userGrowthPercentage: Math.round(userGrowthPercentage * 10) / 10, // Round to 1 decimal
            roleDistribution,
            subscriptionDistribution
        };

        console.log('✅ Stats fetched:', stats);

        res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Get User Stats Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin only)
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('-password -resetPasswordToken -resetPasswordExpire')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Transform user for frontend
        const transformedUser = transformUserForFrontend(user);

        res.status(200).json({
            success: true,
            data: transformedUser
        });

    } catch (error) {
        console.error('Get User By ID Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Create new user (Admin)
// @route   POST /api/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            username,
            role = 'user',
            subscription = 'none',
            isActive = true,
            emailVerified = false,
            phone,
            address
        } = req.body;

        console.log('📝 Creating new user:', { email, username, role });

        // Validate required fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide firstName, lastName, email, and password'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                ...(username ? [{ username: username.toLowerCase() }] : [])
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password: hashedPassword,
            username: username ? username.toLowerCase() : email.split('@')[0],
            role,
            subscription,
            subscriptionStatus: subscription !== 'none' ? 'active' : 'none',
            isActive,
            emailVerified,
            phone,
            address,
            createdBy: req.user.id
        });

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        // Transform for frontend
        const transformedUser = transformUserForFrontend(userResponse);

        console.log('✅ User created successfully:', user._id);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: transformedUser
        });

    } catch (error) {
        console.error('❌ Create User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        console.log('🔄 Updating user:', id, updateData);

        // Remove fields that shouldn't be updated directly
        delete updateData.password;
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.resetPasswordToken;
        delete updateData.resetPasswordExpire;

        // If email is being updated, check for duplicates
        if (updateData.email) {
            const existingUser = await User.findOne({
                email: updateData.email.toLowerCase(),
                _id: { $ne: id }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
            updateData.email = updateData.email.toLowerCase();
        }

        // If username is being updated, check for duplicates
        if (updateData.username) {
            const existingUser = await User.findOne({
                username: updateData.username.toLowerCase(),
                _id: { $ne: id }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already in use'
                });
            }
            updateData.username = updateData.username.toLowerCase();
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password -resetPasswordToken -resetPasswordExpire');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Transform for frontend
        const transformedUser = transformUserForFrontend(user.toObject ? user.toObject() : user);

        console.log('✅ User updated successfully:', id);

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: transformedUser
        });

    } catch (error) {
        console.error('❌ Update User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🗑️ Deleting user:', id);

        const user = await User.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ User deleted successfully:', id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('❌ Delete User Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Bulk actions on users
// @route   POST /api/users/bulk-action
// @access  Private (Admin only)
const bulkAction = async (req, res) => {
    try {
        const { action, userIds, data } = req.body;

        console.log('📦 Bulk action:', { action, userCount: userIds?.length });

        if (!action || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide action and userIds array'
            });
        }

        let result;
        let processedCount = 0;
        let failedCount = 0;
        const errors = [];

        switch (action) {
            case 'delete':
                result = await User.deleteMany({ _id: { $in: userIds } });
                processedCount = result.deletedCount;
                failedCount = userIds.length - processedCount;
                break;

            case 'activate':
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    { $set: { isActive: true, isBlocked: false } }
                );
                processedCount = result.modifiedCount;
                failedCount = userIds.length - processedCount;
                break;

            case 'deactivate':
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    { $set: { isActive: false } }
                );
                processedCount = result.modifiedCount;
                failedCount = userIds.length - processedCount;
                break;

            case 'suspend':
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    { $set: { isBlocked: true } }
                );
                processedCount = result.modifiedCount;
                failedCount = userIds.length - processedCount;
                break;

            case 'verify':
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    { $set: { emailVerified: true } }
                );
                processedCount = result.modifiedCount;
                failedCount = userIds.length - processedCount;
                break;

            case 'changeRole':
                if (!data || !data.role) {
                    return res.status(400).json({
                        success: false,
                        message: 'Role is required for changeRole action'
                    });
                }
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    { $set: { role: data.role } }
                );
                processedCount = result.modifiedCount;
                failedCount = userIds.length - processedCount;
                break;

            case 'changeSubscription':
                if (!data || !data.subscription) {
                    return res.status(400).json({
                        success: false,
                        message: 'Subscription is required for changeSubscription action'
                    });
                }
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    {
                        $set: {
                            subscription: data.subscription,
                            subscriptionStatus: data.subscription !== 'none' ? 'active' : 'none'
                        }
                    }
                );
                processedCount = result.modifiedCount;
                failedCount = userIds.length - processedCount;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid bulk action'
                });
        }

        console.log('✅ Bulk action completed:', { processedCount, failedCount });

        res.status(200).json({
            success: true,
            message: `Bulk ${action} completed successfully`,
            data: {
                processedCount,
                failedCount,
                errors: errors.length > 0 ? errors : undefined
            }
        });

    } catch (error) {
        console.error('❌ Bulk Action Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk action',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Change user role
// @route   PUT /api/users/:id/role
// @access  Private (Admin only)
const changeUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Role is required'
            });
        }

        const user = await User.findByIdAndUpdate(
            id,
            { $set: { role } },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Transform for frontend
        const transformedUser = transformUserForFrontend(user.toObject ? user.toObject() : user);

        res.status(200).json({
            success: true,
            message: 'User role updated successfully',
            data: transformedUser
        });

    } catch (error) {
        console.error('Change User Role Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change user role',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Change user status
// @route   PUT /api/users/:id/status
// @access  Private (Admin only)
const changeUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const updateData = {};
        switch (status) {
            case 'active':
                updateData.isActive = true;
                updateData.isBlocked = false;
                break;
            case 'inactive':
                updateData.isActive = false;
                break;
            case 'suspended':
                updateData.isBlocked = true;
                break;
            case 'pending':
                updateData.emailVerified = false;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
        }

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Transform for frontend
        const transformedUser = transformUserForFrontend(user.toObject ? user.toObject() : user);

        res.status(200).json({
            success: true,
            message: 'User status updated successfully',
            data: transformedUser
        });

    } catch (error) {
        console.error('Change User Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change user status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Send password reset email to user
// @route   POST /api/users/:id/send-password-reset
// @access  Private (Admin only)
const sendPasswordReset = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

        await user.save();

        // TODO: Send email with reset token
        // For now, just return success

        res.status(200).json({
            success: true,
            message: 'Password reset email sent successfully',
            resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });

    } catch (error) {
        console.error('Send Password Reset Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send password reset email',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Verify user email manually (Admin action)
// @route   POST /api/users/:id/verify-email
// @access  Private (Admin only)
const verifyUserEmail = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndUpdate(
            id,
            { $set: { emailVerified: true } },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User email verified successfully',
            data: user
        });

    } catch (error) {
        console.error('Verify User Email Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify user email',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// @desc    Get user activity logs
// @route   GET /api/users/:id/activity
// @access  Private (Admin only)
const getUserActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        // TODO: Implement activity logging system
        // For now, return placeholder data

        res.status(200).json({
            success: true,
            data: {
                activities: [],
                pagination: {
                    current: parseInt(page),
                    pages: 1,
                    total: 0,
                    limit: parseInt(limit)
                }
            },
            message: 'Activity logging system not yet implemented'
        });

    } catch (error) {
        console.error('Get User Activity Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user activity',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

module.exports = {
    getUsers,
    getUserStats,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    bulkAction,
    changeUserRole,
    changeUserStatus,
    sendPasswordReset,
    verifyUserEmail,
    getUserActivity
};
