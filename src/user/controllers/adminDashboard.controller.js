const User = require("../models/user.model");
const mongoose = require("mongoose");

// @desc    Get all users (Admin Dashboard)
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      subscription,
      subscriptionStatus,
      userType,
      isActive,
      isBlocked,
      isEmailVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search query
    const searchQuery = {};

    if (search) {
      searchQuery.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) searchQuery.role = role;
    if (subscription) searchQuery.subscription = subscription;
    if (subscriptionStatus) searchQuery.subscriptionStatus = subscriptionStatus;
    if (userType) searchQuery.userType = userType;
    if (isActive !== undefined) searchQuery.isActive = isActive === 'true';
    if (isBlocked !== undefined) searchQuery.isBlocked = isBlocked === 'true';
    if (isEmailVerified !== undefined) searchQuery.isEmailVerified = isEmailVerified === 'true';

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, totalUsers] = await Promise.all([
      PublicUser.find(searchQuery)
        .select('-password -resetToken -activationToken')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PublicUser.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

// @desc    Get single user details (Admin Dashboard)
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await PublicUser.findById(id)
      .select('-password -resetToken -activationToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message
    });
  }
};

// @desc    Update user (Admin Dashboard)
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await PublicUser.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prevent updating sensitive fields directly
    delete updateData.password;
    delete updateData.resetToken;
    delete updateData.activationToken;
    delete updateData._id;
    delete updateData.__v;

    // Check username uniqueness if being updated
    if (updateData.username && updateData.username !== user.username) {
      const existingUsername = await PublicUser.findOne({ 
        username: updateData.username.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken"
        });
      }
    }

    // Check email uniqueness if being updated
    if (updateData.email && updateData.email !== user.email) {
      const existingEmail = await PublicUser.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    const updatedUser = await PublicUser.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetToken -activationToken');

    res.json({
      success: true,
      message: "User updated successfully",
      data: { user: updatedUser }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message
    });
  }
};

// @desc    Block/Unblock user (Admin Dashboard)
// @route   PUT /api/admin/users/:id/block
// @access  Private (Admin only)
const toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked, blockedReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await PublicUser.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const updateData = {
      isBlocked: isBlocked === true,
      blockedAt: isBlocked === true ? new Date() : null,
      blockedReason: isBlocked === true ? (blockedReason || 'Blocked by admin') : null
    };

    const updatedUser = await PublicUser.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password -resetToken -activationToken');

    res.json({
      success: true,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      data: { user: updatedUser }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message
    });
  }
};

// @desc    Activate/Deactivate user (Admin Dashboard)
// @route   PUT /api/admin/users/:id/activate
// @access  Private (Admin only)
const toggleActivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await PublicUser.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const updatedUser = await PublicUser.findByIdAndUpdate(
      id,
      { isActive: isActive === true },
      { new: true }
    ).select('-password -resetToken -activationToken');

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: updatedUser }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message
    });
  }
};

// @desc    Update user subscription (Admin Dashboard)
// @route   PUT /api/admin/users/:id/subscription
// @access  Private (Admin only)
const updateUserSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription, subscriptionStatus, billingCycle, subscriptionEndDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await PublicUser.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const updateData = {};
    
    if (subscription) updateData.subscription = subscription;
    if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
    if (billingCycle) updateData.billingCycle = billingCycle;
    if (subscriptionEndDate) updateData.subscriptionEndDate = new Date(subscriptionEndDate);
    
    if (subscriptionStatus === 'active' && !subscriptionEndDate) {
      updateData.subscriptionStartDate = new Date();
      
      // Set end date based on billing cycle if not provided
      const now = new Date();
      switch (billingCycle || user.billingCycle) {
        case 'monthly':
          updateData.subscriptionEndDate = new Date(now.setMonth(now.getMonth() + 1));
          break;
        case 'quarterly':
          updateData.subscriptionEndDate = new Date(now.setMonth(now.getMonth() + 3));
          break;
        case 'yearly':
          updateData.subscriptionEndDate = new Date(now.setFullYear(now.getFullYear() + 1));
          break;
        case 'lifetime':
          updateData.subscriptionEndDate = new Date('2099-12-31');
          break;
      }
    }

    const updatedUser = await PublicUser.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetToken -activationToken');

    res.json({
      success: true,
      message: "User subscription updated successfully",
      data: { user: updatedUser }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user subscription",
      error: error.message
    });
  }
};

// @desc    Delete user (Admin Dashboard)
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await PublicUser.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await PublicUser.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message
    });
  }
};

// @desc    Get user statistics (Admin Dashboard)
// @route   GET /api/admin/users/stats
// @access  Private (Admin only)
const getUserStats = async (req, res) => {
  try {
    // Get basic counts
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      verifiedUsers,
      subscriberStats,
      subscriptionStats
    ] = await Promise.all([
      PublicUser.countDocuments(),
      PublicUser.countDocuments({ isActive: true }),
      PublicUser.countDocuments({ isBlocked: true }),
      PublicUser.countDocuments({ isEmailVerified: true }),
      PublicUser.getSubscriberStats(),
      PublicUser.getSubscriptionStats()
    ]);

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRegistrations = await PublicUser.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get monthly growth data (last 6 months)
    const monthlyGrowth = await PublicUser.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          blockedUsers,
          verifiedUsers,
          recentRegistrations
        },
        roleDistribution: subscriberStats,
        subscriptionDistribution: subscriptionStats,
        monthlyGrowth
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
      error: error.message
    });
  }
};

// @desc    Export users data (Admin Dashboard)
// @route   GET /api/admin/users/export
// @access  Private (Admin only)
const exportUsers = async (req, res) => {
  try {
    const {
      format = 'json',
      role,
      subscription,
      subscriptionStatus,
      isActive,
      isBlocked
    } = req.query;

    // Build query
    const query = {};
    if (role) query.role = role;
    if (subscription) query.subscription = subscription;
    if (subscriptionStatus) query.subscriptionStatus = subscriptionStatus;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';

    const users = await PublicUser.find(query)
      .select('-password -resetToken -activationToken')
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'ID', 'First Name', 'Last Name', 'Email', 'Username', 'Role', 'User Type',
        'Subscription', 'Subscription Status', 'Is Active', 'Is Blocked', 
        'Email Verified', 'Created At', 'Last Login'
      ];

      const csvRows = users.map(user => [
        user._id,
        user.firstName,
        user.lastName,
        user.email,
        user.username || '',
        user.role,
        user.userType,
        user.subscription,
        user.subscriptionStatus,
        user.isActive,
        user.isBlocked,
        user.isEmailVerified,
        user.createdAt,
        user.lastLoginAt || ''
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      res.send(csvContent);

    } else {
      // Return JSON format
      res.json({
        success: true,
        data: {
          users,
          exportedAt: new Date(),
          totalRecords: users.length
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to export users",
      error: error.message
    });
  }
};

// @desc    Search users (Admin Dashboard)
// @route   POST /api/admin/users/search
// @access  Private (Admin only)
const searchUsers = async (req, res) => {
  try {
    const { searchTerm, filters = {} } = req.body;

    const searchQuery = { ...filters };

    if (searchTerm) {
      searchQuery.$or = [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { username: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const users = await PublicUser.find(searchQuery)
      .select('-password -resetToken -activationToken')
      .limit(50)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        users,
        resultsCount: users.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  updateUser,
  toggleBlockUser,
  toggleActivateUser,
  updateUserSubscription,
  deleteUser,
  getUserStats,
  exportUsers,
  searchUsers
};