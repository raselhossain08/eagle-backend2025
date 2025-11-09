const EmailVerification = require('../models/EmailVerification');
const VerificationSettings = require('../models/VerificationSettings');
const User = require('../user/models/user.model');
const AdminUser = require('../admin/models/adminUser.model');
const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

// Generate verification email HTML
const generateVerificationEmail = (settings, token, userName) => {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${settings.emailTemplate.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  ${settings.emailTemplate.logoUrl ? `<img src="${settings.emailTemplate.logoUrl}" alt="${settings.emailTemplate.fromName}" style="max-width: 150px; height: auto;">` : `<h1 style="margin: 0; color: #333;">${settings.emailTemplate.fromName}</h1>`}
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 20px 40px;">
                  <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">Hi ${userName || 'there'}!</h2>
                  <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.5;">
                    Thank you for signing up! Please verify your email address to activate your account.
                  </p>
                  <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.5;">
                    Click the button below to verify your email:
                  </p>
                  
                  <!-- Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center" style="padding: 0;">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; background-color: ${settings.emailTemplate.buttonColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">${settings.emailTemplate.buttonText}</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 20px 0; color: #666; font-size: 14px; line-height: 1.5;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="margin: 0 0 20px 0; color: #3B82F6; font-size: 14px; word-break: break-all;">
                    ${verificationUrl}
                  </p>
                  
                  <p style="margin: 20px 0 0 0; color: #999; font-size: 14px; line-height: 1.5;">
                    This link will expire in ${settings.emailVerification.tokenExpiry} hours.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #eee;">
                  <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.5; text-align: center;">
                    ${settings.emailTemplate.footerText}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// @desc    Send verification email
// @route   POST /api/verification/send
// @access  Private
exports.sendVerificationEmail = async (req, res) => {
    try {
        const userId = req.user._id;
        const isAdmin = req.tokenPayload?.adminLevel || req.user.adminLevel;
        const settings = await VerificationSettings.getSettings();

        // Check if email verification is enabled
        if (!settings.emailVerification.enabled) {
            return res.status(400).json({
                success: false,
                message: 'Email verification is currently disabled'
            });
        }

        // Get user (admin or regular)
        let user;
        if (isAdmin) {
            user = await AdminUser.findById(userId);
        } else {
            user = await User.findById(userId);
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already verified
        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        // Check recent verification attempts (rate limiting)
        const recentVerification = await EmailVerification.findOne({
            userId,
            createdAt: {
                $gte: new Date(Date.now() - settings.emailVerification.resendCooldown * 60 * 1000)
            }
        });

        if (recentVerification) {
            const remainingTime = Math.ceil(
                (settings.emailVerification.resendCooldown * 60 * 1000 -
                    (Date.now() - recentVerification.createdAt.getTime())) / 1000
            );

            return res.status(429).json({
                success: false,
                message: `Please wait ${remainingTime} seconds before requesting another verification email`,
                remainingTime
            });
        }

        // Create verification token
        const verification = await EmailVerification.createVerificationToken(
            userId,
            user.email,
            settings.emailVerification.tokenExpiry
        );

        // Send email
        const transporter = createTransporter();
        const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const emailHtml = generateVerificationEmail(settings, verification.token, userName);

        await transporter.sendMail({
            from: `"${settings.emailTemplate.fromName}" <${settings.emailTemplate.fromEmail}>`,
            to: user.email,
            subject: settings.emailTemplate.subject,
            html: emailHtml
        });

        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully',
            data: {
                email: user.email,
                expiresAt: verification.expiresAt
            }
        });

    } catch (error) {
        console.error('Send verification email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email',
            error: error.message
        });
    }
};

// @desc    Verify email with token
// @route   POST /api/verification/verify/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const settings = await VerificationSettings.getSettings();

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        // Verify token
        const verification = await EmailVerification.verifyToken(token);

        // Try to find user in both models
        let user = await User.findById(verification.userId);
        let isAdmin = false;

        if (!user) {
            user = await AdminUser.findById(verification.userId);
            isAdmin = true;
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user's email verification status
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    emailVerifiedAt: user.emailVerifiedAt
                }
            }
        });

    } catch (error) {
        console.error('Verify email error:', error);

        if (error.message.includes('expired')) {
            return res.status(400).json({
                success: false,
                message: 'Verification token has expired',
                error: 'TOKEN_EXPIRED'
            });
        }

        if (error.message.includes('already verified')) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified',
                error: 'ALREADY_VERIFIED'
            });
        }

        res.status(400).json({
            success: false,
            message: error.message || 'Invalid verification token',
            error: 'INVALID_TOKEN'
        });
    }
};

// @desc    Resend verification email
// @route   POST /api/verification/resend
// @access  Private
exports.resendVerificationEmail = async (req, res) => {
    try {
        const userId = req.user._id;

        // Reuse sendVerificationEmail logic
        req.user = { _id: userId };
        await exports.sendVerificationEmail(req, res);

    } catch (error) {
        console.error('Resend verification email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend verification email',
            error: error.message
        });
    }
};

// @desc    Get verification status
// @route   GET /api/verification/status
// @access  Private
exports.getVerificationStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const isAdmin = req.tokenPayload?.adminLevel || req.user.adminLevel;

        let user;

        // Check if admin or regular user
        if (isAdmin) {
            user = await AdminUser.findById(userId).select('email emailVerified emailVerifiedAt firstName lastName');
        } else {
            user = await User.findById(userId).select('email emailVerified emailVerifiedAt firstName lastName');
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get pending verification if exists
        const pendingVerification = await EmailVerification.findOne({
            userId,
            verifiedAt: null,
            expiresAt: { $gt: new Date() }
        }).select('email expiresAt attempts createdAt');

        res.status(200).json({
            success: true,
            data: {
                email: user.email,
                verified: user.emailVerified || false,
                verifiedAt: user.emailVerifiedAt || null,
                pendingVerification: pendingVerification ? {
                    email: pendingVerification.email,
                    expiresAt: pendingVerification.expiresAt,
                    attempts: pendingVerification.attempts,
                    sentAt: pendingVerification.createdAt
                } : null
            }
        });

    } catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get verification status',
            error: error.message
        });
    }
};

// @desc    Get verification settings
// @route   GET /api/verification/settings
// @access  Private (Admin only)
exports.getVerificationSettings = async (req, res) => {
    try {
        const settings = await VerificationSettings.getSettings();

        res.status(200).json({
            success: true,
            data: settings
        });

    } catch (error) {
        console.error('Get verification settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get verification settings',
            error: error.message
        });
    }
};

// @desc    Update verification settings
// @route   PUT /api/verification/settings
// @access  Private (Admin only)
exports.updateVerificationSettings = async (req, res) => {
    try {
        const updates = req.body;
        const userId = req.user._id;

        const settings = await VerificationSettings.updateSettings(updates, userId);

        res.status(200).json({
            success: true,
            message: 'Verification settings updated successfully',
            data: settings
        });

    } catch (error) {
        console.error('Update verification settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update verification settings',
            error: error.message
        });
    }
};

// @desc    Get recent verification attempts (Admin)
// @route   GET /api/verification/attempts
// @access  Private (Admin only)
exports.getRecentAttempts = async (req, res) => {
    try {
        const { limit = 50, status = 'all' } = req.query;

        const query = {};
        if (status === 'verified') {
            query.verifiedAt = { $ne: null };
        } else if (status === 'pending') {
            query.verifiedAt = null;
            query.expiresAt = { $gt: new Date() };
        } else if (status === 'expired') {
            query.verifiedAt = null;
            query.expiresAt = { $lte: new Date() };
        }

        const attempts = await EmailVerification.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: attempts.length,
            data: attempts
        });

    } catch (error) {
        console.error('Get recent attempts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recent attempts',
            error: error.message
        });
    }
};
