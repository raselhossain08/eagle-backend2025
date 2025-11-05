/**
 * Email Service
 * Handles email sending functionality
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text content
   * @param {string} options.html - HTML content (optional)
   * @param {string} options.from - Sender email (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async sendEmail(options) {
    try {
      const { to, subject, text, html, from } = options;
      
      const mailOptions = {
        from: from || process.env.FROM_EMAIL || 'noreply@example.com',
        to,
        subject,
        text,
        html
      };

      // In development mode, just log the email
      if (process.env.NODE_ENV === 'development') {
        console.log('Email would be sent:', mailOptions);
        return true;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}: ${subject}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send verification email
   * @param {string} to - Recipient email
   * @param {string} verificationCode - Verification code
   * @returns {Promise<boolean>} - Success status
   */
  async sendVerificationEmail(to, verificationCode) {
    const subject = 'Email Verification Code';
    const text = `Your verification code is: ${verificationCode}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 2px; margin: 20px 0;">
          <strong>${verificationCode}</strong>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
      </div>
    `;

    return await this.sendEmail({ to, subject, text, html });
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetLink - Password reset link
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordResetEmail(to, resetLink) {
    const subject = 'Password Reset Request';
    const text = `Click the following link to reset your password: ${resetLink}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You have requested to reset your password. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetLink}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
      </div>
    `;

    return await this.sendEmail({ to, subject, text, html });
  }
}

// Create and export singleton instance
const emailService = new EmailService();

module.exports = {
  sendEmail: (options) => emailService.sendEmail(options),
  sendVerificationEmail: (to, code) => emailService.sendVerificationEmail(to, code),
  sendPasswordResetEmail: (to, link) => emailService.sendPasswordResetEmail(to, link),
  emailService
};





