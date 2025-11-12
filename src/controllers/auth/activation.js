const User = require("../../user/models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const emailService = require("../../services/emailService");

// @desc    Activate user account via email token
// @route   GET /api/auth/activate/:token
// @access  Public
const activateAccount = async (req, res) => {
  try {
    const { token } = req.params;

    console.log("🔍 Attempting to activate account with token:", token);

    // Find user with the activation token and check expiry
    const user = await User.findOne({
      activationToken: token,
      activationTokenExpiry: { $gt: Date.now() },
      isPendingUser: true,
    });

    if (!user) {
      console.log("❌ Invalid or expired activation token");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired activation token. Please request a new activation email.",
        code: "INVALID_TOKEN"
      });
    }

    console.log("✅ Valid activation token found for user:", user.email);

    // If user already has a password, just activate the account
    if (user.password) {
      user.isPendingUser = false;
      user.isEmailVerified = true;
      user.activationToken = undefined;
      user.activationTokenExpiry = undefined;
      await user.save();

      console.log("✅ User account activated:", user.email);

      return res.json({
        success: true,
        message: "Account activated successfully! You can now log in.",
        data: {
          email: user.email,
          name: user.name,
          needsPassword: false
        }
      });
    }

    // User needs to set a password
    console.log("👤 User needs to set password:", user.email);

    res.json({
      success: true,
      message: "Account activation verified! Please set your password to complete the process.",
      data: {
        email: user.email,
        name: user.name,
        needsPassword: true,
        activationToken: token // Pass token to set password
      }
    });

  } catch (error) {
    console.error("❌ Error activating account:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Set password for activated account
// @route   POST /api/auth/set-password
// @access  Public
const setPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    console.log("🔐 Setting password for user with token:", token);

    // Validate required fields
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, password, and confirm password are required",
      });
    }

    // Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Find user with the activation token and check expiry
    const user = await User.findOne({
      activationToken: token,
      activationTokenExpiry: { $gt: Date.now() },
      isPendingUser: true,
    });

    if (!user) {
      console.log("❌ Invalid or expired token for password setup");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token. Please request a new activation email.",
        code: "INVALID_TOKEN"
      });
    }

    console.log("✅ Valid token found, setting password for user:", user.email);

    // Set the password (will be hashed by pre-save middleware)
    user.password = password;
    user.isPendingUser = false;
    user.isEmailVerified = true;
    user.activationToken = undefined;
    user.activationTokenExpiry = undefined;
    await user.save();

    console.log("✅ Password set and account activated:", user.email);

    // Generate JWT token for immediate login
    const jwtToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(
        user.email,
        user.name,
        'account-activation',
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );
      console.log("📧 Welcome email sent successfully");
    } catch (emailError) {
      console.error("❌ Error sending welcome email:", emailError);
    }

    res.json({
      success: true,
      message: "Password set successfully! Your account is now active and you are logged in.",
      data: {
        token: jwtToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
          isPendingUser: user.isPendingUser
        }
      }
    });

  } catch (error) {
    console.error("❌ Error setting password:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Resend activation email
// @route   POST /api/auth/resend-activation
// @access  Public
const resendActivation = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("📧 Resending activation email for:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find pending user
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      isPendingUser: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No pending account found with this email address",
      });
    }

    // Generate new activation token
    user.activationToken = crypto.randomBytes(32).toString('hex');
    user.activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    console.log("🔄 New activation token generated for:", email);

    // Send activation email
    await emailService.sendAccountActivationEmail(
      user.email,
      user.name,
      user.activationToken,
      process.env.FRONTEND_URL || 'http://localhost:3000'
    );

    console.log("📧 Activation email resent successfully");

    res.json({
      success: true,
      message: "Activation email sent successfully! Please check your email and follow the instructions.",
    });

  } catch (error) {
    console.error("❌ Error resending activation email:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  activateAccount,
  setPassword,
  resendActivation,
};
