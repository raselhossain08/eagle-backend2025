const crypto = require("crypto");
const User = require("../../user/models/user.model");
const emailService = require("../../services/emailService");
const createError = require("http-errors");

/**
 * @desc    Request password reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
module.exports = async (req, res, next) => {
  try {
    const { email } = req.body;

    console.log("🔐 Password reset request for:", email);

    if (!email) {
      throw createError(400, "Email is required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists for security
      console.log("⚠️ Password reset requested for non-existent email:", email);
      return res.json({
        success: true,
        message: "If that email exists, a reset link has been sent"
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save hashed token and expiry (10 minutes)
    user.resetToken = hashToken;
    user.resetTokenExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    console.log("✅ Reset token generated for:", email);

    // Send password reset email
    const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      await emailService.sendEmail(
        user.email,
        "Password Reset Request - Eagle Investors",
        `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Password Reset</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hello ${user.name},</h2>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                We received a request to reset your password for your Eagle Investors account.
              </p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Click the button below to reset your password:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
              </p>
              
              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                This link will expire in <strong>10 minutes</strong> for security reasons.
              </p>
              
              <hr style="border: none; height: 1px; background: #ddd; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999;">
                If you didn't request a password reset, please ignore this email and your password will remain unchanged.
              </p>
              
              <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
                © ${new Date().getFullYear()} Eagle Investors - Secure Trading Platform
              </p>
            </div>
          </body>
        </html>
        `
      );

      console.log("📧 Password reset email sent successfully to:", email);
    } catch (emailError) {
      console.error("❌ Error sending password reset email:", emailError);
      // Don't expose email sending errors to user
    }

    res.json({
      success: true,
      message: "If that email exists, a reset link has been sent. Please check your inbox."
    });

  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    next(err);
  }
};
