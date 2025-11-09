const TwoFactorService = require('../services/twoFactor.service');
const AuditLog = require('../../admin/models/auditLog.model');

class TwoFactorController {
  /**
   * Initiate 2FA setup - generate QR code
   */
  static async initiateTwoFactorSetup(req, res) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;

      const setupData = await TwoFactorService.generateSecret(userId, userEmail);

      res.status(200).json({
        success: true,
        message: '2FA setup initiated successfully',
        data: {
          qrCode: setupData.qrCode,
          secret: setupData.secret, // For manual entry
          backupCodes: setupData.backupCodes,
          instructions: [
            '1. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
            '2. Enter the 6-digit verification code from your app',
            '3. Save the backup codes in a secure location',
            '4. Click "Enable 2FA" to complete setup'
          ]
        }
      });
    } catch (error) {
      console.error('2FA Setup Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate 2FA setup',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Enable 2FA after verification
   */
  static async enableTwoFactor(req, res) {
    try {
      const { token } = req.body;
      const userId = req.user.id;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const result = await TwoFactorService.enableTwoFactor(userId, token);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          twoFactorEnabled: true,
          enabledAt: new Date()
        }
      });
    } catch (error) {
      console.error('Enable 2FA Error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to enable 2FA',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Invalid verification code'
      });
    }
  }

  /**
   * Disable 2FA
   */
  static async disableTwoFactor(req, res) {
    try {
      const { password, token } = req.body;
      const userId = req.user.id;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to disable 2FA'
        });
      }

      if (!token) {
        return res.status(400).json({
          success: false,
          message: '2FA token is required'
        });
      }

      const result = await TwoFactorService.disableTwoFactor(userId, password, token);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          twoFactorEnabled: false,
          disabledAt: new Date()
        }
      });
    } catch (error) {
      console.error('Disable 2FA Error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to disable 2FA',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Invalid credentials'
      });
    }
  }

  /**
   * Verify 2FA token
   */
  static async verifyTwoFactorToken(req, res) {
    try {
      const { token, operation } = req.body;
      const userId = req.user.id;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      // Check if operation requires 2FA
      if (operation) {
        const requirement = await TwoFactorService.requireTwoFactorForOperation(userId, operation);
        if (!requirement.requiresTwoFactor) {
          return res.status(200).json({
            success: true,
            message: 'Operation does not require 2FA',
            data: { verified: true, required: false }
          });
        }
      }

      const result = await TwoFactorService.verifyToken(userId, token);

      if (result.valid) {
        // Generate temporary verification token for the session
        const verificationToken = require('crypto').randomBytes(32).toString('hex');
        
        // Store verification in session or cache (simplified for demo)
        req.session = req.session || {};
        req.session.twoFactorVerified = {
          userId,
          verifiedAt: new Date(),
          token: verificationToken,
          operation: operation || 'general'
        };

        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            verified: true,
            verificationToken,
            expiresIn: '15 minutes'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          data: { verified: false }
        });
      }
    } catch (error) {
      console.error('Verify 2FA Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify 2FA token',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get 2FA status
   */
  static async getTwoFactorStatus(req, res) {
    try {
      const userId = req.user.id;
      const status = await TwoFactorService.getTwoFactorStatus(userId);

      res.status(200).json({
        success: true,
        data: {
          ...status,
          userId,
          supportedMethods: ['TOTP', 'Backup Codes'],
          recommendedApps: [
            'Google Authenticator',
            'Microsoft Authenticator', 
            'Authy',
            '1Password'
          ]
        }
      });
    } catch (error) {
      console.error('Get 2FA Status Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get 2FA status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Generate new backup codes
   */
  static async generateBackupCodes(req, res) {
    try {
      const userId = req.user.id;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: '2FA token required to generate backup codes'
        });
      }

      // Verify 2FA token first
      const verification = await TwoFactorService.verifyToken(userId, token);
      if (!verification.valid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid 2FA token'
        });
      }

      const backupCodes = TwoFactorService.generateBackupCodes();

      // Log the action
      await AuditLog.logAction({
        userId,
        action: 'backup_codes_generated',
        resource: 'user_security',
        description: 'New backup codes generated',
        success: true
      });

      res.status(200).json({
        success: true,
        message: 'New backup codes generated successfully',
        data: {
          backupCodes,
          generatedAt: new Date(),
          instructions: [
            'Save these codes in a secure location',
            'Each code can only be used once',
            'These codes can be used if you lose access to your authenticator app'
          ]
        }
      });
    } catch (error) {
      console.error('Generate Backup Codes Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate backup codes',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Generate emergency access code (admin only)
   */
  static async generateEmergencyAccess(req, res) {
    try {
      const { targetUserId } = req.body;
      const adminUserId = req.user.id;

      // Check if user is admin (simplified - implement proper role check)
      if (!req.user.roles?.includes('admin') && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required'
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'Target user ID is required'
        });
      }

      const emergencyAccess = await TwoFactorService.generateEmergencyAccess(targetUserId, adminUserId);

      res.status(200).json({
        success: true,
        message: 'Emergency access code generated successfully',
        data: emergencyAccess
      });
    } catch (error) {
      console.error('Generate Emergency Access Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate emergency access',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = TwoFactorController;