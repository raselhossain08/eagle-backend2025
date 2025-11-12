const crypto = require("crypto");
const User = require("../../user/models/user.model");
const createError = require("http-errors");

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
module.exports = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    console.log("🔐 Password reset attempt with token");

    // Validate inputs
    if (!password || !confirmPassword) {
      throw createError(400, "Password and confirm password are required");
    }

    if (password !== confirmPassword) {
      throw createError(400, "Passwords do not match");
    }

    if (password.length < 6) {
      throw createError(400, "Password must be at least 6 characters long");
    }

    // Hash the token to match what's stored
    const hashToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      resetToken: hashToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      console.log("❌ Invalid or expired reset token");
      throw createError(400, "Password reset link is invalid or has expired. Please request a new one.");
    }

    console.log("✅ Valid reset token found for user:", user.email);

    // Set new password (will be hashed by pre-save middleware)
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log("✅ Password reset successful for:", user.email);

    res.json({
      success: true,
      message: "Password has been reset successfully! You can now log in with your new password."
    });

  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    next(err);
  }
};
