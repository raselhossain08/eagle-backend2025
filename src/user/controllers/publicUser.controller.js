const PublicUser = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      username,
      phone,
      userType,
      subscription,
      address,
      discordUsername,
      telegramUsername,
      company,
      preferences,
      referralCode
    } = req.body;

    // Check if user already exists
    const existingUser = await PublicUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    // Check username uniqueness if provided
    if (username) {
      const existingUsername = await PublicUser.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken"
        });
      }
    }

    // Create new user
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      username: username?.toLowerCase(),
      phone,
      userType: userType || 'individual',
      subscription: subscription || 'None',
      address,
      discordUsername,
      telegramUsername,
      company,
      preferences,
      referralCode,
      source: 'website'
    };

    const user = new PublicUser(userData);
    
    // Create activation token
    const activationToken = user.createActivationToken();
    
    await user.save();

    // Generate JWT
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for activation.",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          username: user.username,
          role: user.role,
          userType: user.userType,
          subscription: user.subscription,
          isEmailVerified: user.isEmailVerified
        },
        token,
        activationToken // In production, send this via email
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Find user by email or username
    const user = await PublicUser.findByEmailOrUsername(email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: "Account is temporarily locked due to too many failed login attempts"
      });
    }

    // Check if account is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: `Account is blocked. Reason: ${user.blockedReason || 'Contact support'}`
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Please contact support."
      });
    }

    // Verify password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      await user.incrementFailedLogin();
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Reset failed login attempts
    await user.resetFailedLogin();

    // Update login info
    const clientIP = req.ip || req.connection.remoteAddress;
    await user.updateLoginInfo(clientIP);

    // Generate JWT
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          role: user.role,
          userType: user.userType,
          subscription: user.subscription,
          subscriptionStatus: user.subscriptionStatus,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt
        },
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await PublicUser.findById(req.user._id).select('-password');
    
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
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      phone,
      address,
      discordUsername,
      telegramUsername,
      bio,
      dateOfBirth,
      gender,
      timezone,
      language,
      company,
      preferences,
      socialLinks
    } = req.body;

    const user = await PublicUser.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check username uniqueness if being updated
    if (username && username !== user.username) {
      const existingUsername = await PublicUser.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: user._id }
      });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken"
        });
      }
    }

    // Update user fields
    const updateFields = {
      firstName,
      lastName,
      username: username?.toLowerCase(),
      phone,
      address,
      discordUsername,
      telegramUsername,
      bio,
      dateOfBirth,
      gender,
      timezone,
      language,
      company,
      preferences,
      socialLinks
    };

    // Remove undefined fields
    Object.keys(updateFields).forEach(key => 
      updateFields[key] === undefined && delete updateFields[key]
    );

    const updatedUser = await PublicUser.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: { user: updatedUser }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message
    });
  }
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password"
      });
    }

    const user = await PublicUser.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify current password
    const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message
    });
  }
};

// @desc    Forgot password
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address"
      });
    }

    const user = await PublicUser.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist"
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // In production, send reset token via email
    res.json({
      success: true,
      message: "Password reset token sent to your email",
      resetToken // Remove this in production
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process forgot password request",
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/users/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Please provide new password"
      });
    }

    // Hash the token and find user
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await PublicUser.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token is invalid or has expired"
      });
    }

    // Update password and clear reset token
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successful"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message
    });
  }
};

// @desc    Activate account
// @route   POST /api/users/activate/:token
// @access  Public
const activateAccount = async (req, res) => {
  try {
    const { token } = req.params;

    // Hash the token and find user
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await PublicUser.findOne({
      activationToken: hashedToken,
      activationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token is invalid or has expired"
      });
    }

    // Activate account
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.activationToken = undefined;
    user.activationTokenExpiry = undefined;
    user.isActive = true;
    await user.save();

    res.json({
      success: true,
      message: "Account activated successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to activate account",
      error: error.message
    });
  }
};

// @desc    Update subscription
// @route   PUT /api/users/subscription
// @access  Private
const updateSubscription = async (req, res) => {
  try {
    const { subscription, subscriptionStatus, billingCycle } = req.body;

    const user = await PublicUser.findById(req.user._id);
    
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
    
    if (subscriptionStatus === 'active') {
      updateData.subscriptionStartDate = new Date();
      // Set end date based on billing cycle
      const now = new Date();
      switch (billingCycle) {
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
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: "Subscription updated successfully",
      data: { user: updatedUser }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update subscription",
      error: error.message
    });
  }
};

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    const user = await PublicUser.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get user's access permissions
    const accessFeatures = {
      newsletter: user.hasAccess('newsletter'),
      basicContent: user.hasAccess('basic_content'),
      userDashboard: user.hasAccess('user_dashboard'),
      basicFeatures: user.hasAccess('basic_features'),
      premiumFeatures: user.hasAccess('premium_features'),
      apiAccess: user.hasAccess('api_access'),
      vipFeatures: user.hasAccess('vip_features'),
      prioritySupport: user.hasAccess('priority_support')
    };

    const dashboardData = {
      user: {
        ...user.toJSON(),
        accessFeatures
      },
      stats: {
        loginCount: user.loginCount,
        lastLoginAt: user.lastLoginAt,
        subscriptionActive: user.subscriptionActive,
        daysUntilExpiry: user.subscriptionEndDate ? 
          Math.ceil((user.subscriptionEndDate - new Date()) / (1000 * 60 * 60 * 24)) : null
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  activateAccount,
  updateSubscription,
  getDashboardData
};