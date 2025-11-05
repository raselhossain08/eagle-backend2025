const EmailResendLog = require('../models/emailResend.model');
const User = require('../models/user.model');
const AdminUser = require('../models/adminUser.model');
const AuditLog = require('../../audit/models/auditLog.model');
const crypto = require('crypto');

class EmailResendService {
  
  constructor() {
    this.rateLimits = {
      receipt: { daily: 5, weekly: 15, monthly: 30 },
      verification: { daily: 3, weekly: 10, monthly: 20 },
      contract_link: { daily: 3, weekly: 10, monthly: 25 },
      payment_confirmation: { daily: 5, weekly: 15, monthly: 30 },
      invoice: { daily: 5, weekly: 20, monthly: 50 },
      password_reset: { daily: 3, weekly: 10, monthly: 15 },
      account_activation: { daily: 2, weekly: 5, monthly: 10 },
      subscription_confirmation: { daily: 3, weekly: 10, monthly: 20 },
      renewal_notice: { daily: 2, weekly: 8, monthly: 20 },
      cancellation_confirmation: { daily: 2, weekly: 8, monthly: 15 },
      refund_confirmation: { daily: 3, weekly: 10, monthly: 20 },
      dispute_notification: { daily: 2, weekly: 5, monthly: 10 },
      security_alert: { daily: 5, weekly: 15, monthly: 30 }
    };
    
    this.templateCache = new Map();
    this.deliveryProviders = ['sendgrid', 'mailgun', 'ses'];
  }
  
  // =====================================
  // EMAIL RESEND OPERATIONS
  // =====================================
  
  /**
   * Resend email to user
   */
  async resendEmail(resendRequest) {
    try {
      const {
        userId,
        emailType,
        originalEmailId,
        resendReason,
        adminId,
        ticketReference,
        notes,
        priority = 'normal',
        customTemplate = null,
        requestContext = {}
      } = resendRequest;
      
      // Validate admin permissions
      const adminValidation = await this.validateAdminPermissions(adminId, emailType);
      if (!adminValidation.success) {
        return adminValidation;
      }
      
      // Validate user and email request
      const userValidation = await this.validateEmailRequest(userId, emailType, originalEmailId);
      if (!userValidation.success) {
        return userValidation;
      }
      
      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(userId, emailType);
      if (!rateLimitCheck.success) {
        return rateLimitCheck;
      }
      
      // Get original email data
      const originalEmailData = await this.getOriginalEmailData(originalEmailId, emailType);
      if (!originalEmailData) {
        return {
          success: false,
          error: 'Original email data not found',
          data: null
        };
      }
      
      // Prepare email content
      const emailContent = await this.prepareEmailContent(
        originalEmailData,
        userValidation.user,
        customTemplate
      );
      
      // Create resend log
      const resendLogData = {
        emailDetails: {
          originalEmailId,
          emailType,
          templateId: emailContent.templateId,
          templateVersion: emailContent.templateVersion,
          subject: emailContent.subject,
          originalSentAt: originalEmailData.sentAt,
          resendReason
        },
        recipient: {
          userId: userValidation.user._id,
          email: userValidation.user.email,
          name: userValidation.user.name,
          language: userValidation.user.language || 'en',
          timezone: userValidation.user.timezone
        },
        requestDetails: {
          requestedBy: {
            adminId: adminValidation.admin._id,
            adminName: adminValidation.admin.name,
            adminEmail: adminValidation.admin.email,
            department: adminValidation.admin.department
          },
          ticketReference,
          customerRequest: resendReason === 'customer_request',
          priority,
          notes
        },
        emailContent: {
          personalizedData: emailContent.personalizedData,
          dynamicContent: emailContent.dynamicContent,
          attachments: emailContent.attachments
        },
        security: {
          ipAddress: requestContext.ipAddress,
          userAgent: requestContext.userAgent,
          requestValidated: true,
          permissionChecked: true,
          approved: true,
          approvedBy: adminId,
          approvedAt: new Date()
        }
      };
      
      const resendLog = await EmailResendLog.createResendLog(resendLogData);
      
      // Queue email for delivery
      const deliveryResult = await this.queueEmailDelivery(resendLog, emailContent);
      
      // Update delivery status
      if (deliveryResult.success) {
        await resendLog.updateDeliveryStatus('queued', deliveryResult.data);
      } else {
        await resendLog.updateDeliveryStatus('failed', { reason: deliveryResult.error });
      }
      
      // Log the resend action
      await this.logResendAction(resendLog, adminId);
      
      // Send notifications if needed
      await this.sendResendNotifications(resendLog);
      
      return {
        success: true,
        data: {
          resendId: resendLog.resendId,
          emailType,
          recipient: userValidation.user.email,
          status: resendLog.delivery.status,
          estimatedDelivery: this.calculateEstimatedDelivery(priority),
          trackingInfo: {
            resendId: resendLog.resendId,
            canTrackDelivery: true,
            canTrackOpens: resendLog.emailContent.trackingPixelEnabled,
            canTrackClicks: resendLog.emailContent.linkTracking
          }
        },
        message: 'Email queued for resend successfully'
      };
      
    } catch (error) {
      console.error('Error resending email:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Bulk resend emails
   */
  async bulkResendEmails(bulkRequest) {
    try {
      const {
        emailRequests, // Array of resend requests
        adminId,
        batchSize = 10,
        delayBetweenBatches = 5000 // 5 seconds
      } = bulkRequest;
      
      const results = {
        total: emailRequests.length,
        successful: 0,
        failed: 0,
        errors: [],
        resendIds: []
      };
      
      // Process in batches
      for (let i = 0; i < emailRequests.length; i += batchSize) {
        const batch = emailRequests.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (request) => {
          try {
            const result = await this.resendEmail({ ...request, adminId });
            if (result.success) {
              results.successful++;
              results.resendIds.push(result.data.resendId);
            } else {
              results.failed++;
              results.errors.push({
                request,
                error: result.error
              });
            }
            return result;
          } catch (error) {
            results.failed++;
            results.errors.push({
              request,
              error: error.message
            });
            return { success: false, error: error.message };
          }
        });
        
        await Promise.all(batchPromises);
        
        // Delay between batches to avoid overwhelming the system
        if (i + batchSize < emailRequests.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
      
      return {
        success: true,
        data: results,
        message: `Bulk resend completed: ${results.successful} successful, ${results.failed} failed`
      };
      
    } catch (error) {
      console.error('Error in bulk resend:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  // =====================================
  // EMAIL TRACKING
  // =====================================
  
  /**
   * Track email delivery status
   */
  async trackDeliveryStatus(resendId) {
    try {
      const resendLog = await EmailResendLog.findOne({ resendId });
      
      if (!resendLog) {
        return {
          success: false,
          error: 'Resend record not found',
          data: null
        };
      }
      
      // Get updated status from delivery provider
      const providerStatus = await this.getProviderDeliveryStatus(
        resendLog.delivery.provider,
        resendLog.delivery.providerId
      );
      
      // Update status if changed
      if (providerStatus && providerStatus.status !== resendLog.delivery.status) {
        await resendLog.updateDeliveryStatus(providerStatus.status, providerStatus.details);
      }
      
      return {
        success: true,
        data: {
          resendId,
          emailType: resendLog.emailDetails.emailType,
          recipient: resendLog.recipient.email,
          status: resendLog.delivery.status,
          sentAt: resendLog.delivery.sentAt,
          deliveredAt: resendLog.delivery.deliveredAt,
          openedAt: resendLog.delivery.openedAt,
          clickedAt: resendLog.delivery.clickedAt,
          attempts: resendLog.delivery.attempts,
          processingTime: resendLog.processingTime,
          analytics: {
            openRate: resendLog.analytics.openRate,
            clickRate: resendLog.analytics.clickRate,
            links: resendLog.analytics.links
          }
        },
        message: 'Delivery status retrieved successfully'
      };
      
    } catch (error) {
      console.error('Error tracking delivery status:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Track email open
   */
  async trackEmailOpen(resendId, requestContext = {}) {
    try {
      const resendLog = await EmailResendLog.findOne({ resendId });
      
      if (resendLog) {
        await resendLog.trackOpen();
        
        // Log the open event
        await this.logEmailInteraction(resendId, 'open', requestContext);
      }
      
      // Return a 1x1 pixel image
      return {
        success: true,
        data: {
          contentType: 'image/png',
          content: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            'base64'
          )
        }
      };
      
    } catch (error) {
      console.error('Error tracking email open:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Track email click
   */
  async trackEmailClick(resendId, url, requestContext = {}) {
    try {
      const resendLog = await EmailResendLog.findOne({ resendId });
      
      if (resendLog) {
        await resendLog.trackClick(url);
        
        // Log the click event
        await this.logEmailInteraction(resendId, 'click', { ...requestContext, url });
      }
      
      return {
        success: true,
        data: { redirectUrl: url },
        message: 'Click tracked successfully'
      };
      
    } catch (error) {
      console.error('Error tracking email click:', error);
      return {
        success: false,
        error: error.message,
        data: { redirectUrl: url }
      };
    }
  }
  
  // =====================================
  // VALIDATION & RATE LIMITING
  // =====================================
  
  /**
   * Validate admin permissions
   */
  async validateAdminPermissions(adminId, emailType) {
    try {
      const admin = await AdminUser.findById(adminId).select('+permissions');
      
      if (!admin || !admin.isActive) {
        return {
          success: false,
          error: 'Admin user not found or inactive'
        };
      }
      
      // Check general email resend permission
      if (!admin.permissions.includes('email_resend')) {
        return {
          success: false,
          error: 'Insufficient permissions for email resend'
        };
      }
      
      // Check email type specific permissions
      const typePermissions = this.getEmailTypePermissions(emailType);
      const hasTypePermissions = typePermissions.every(perm => 
        admin.permissions.includes(perm)
      );
      
      if (!hasTypePermissions) {
        return {
          success: false,
          error: `Insufficient permissions for ${emailType} emails`,
          data: { requiredPermissions: typePermissions }
        };
      }
      
      return {
        success: true,
        admin
      };
      
    } catch (error) {
      console.error('Error validating admin permissions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Validate email request
   */
  async validateEmailRequest(userId, emailType, originalEmailId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Check if user has opted out of emails
      if (user.emailPreferences?.optedOut) {
        return {
          success: false,
          error: 'User has opted out of email communications'
        };
      }
      
      // Check email type specific opt-outs
      const emailTypeOptOut = user.emailPreferences?.optOuts?.[emailType];
      if (emailTypeOptOut) {
        return {
          success: false,
          error: `User has opted out of ${emailType} emails`
        };
      }
      
      // Validate email address
      if (!user.email || !this.isValidEmail(user.email)) {
        return {
          success: false,
          error: 'Invalid or missing email address'
        };
      }
      
      // Check for bounced emails
      if (user.emailStatus?.bounced) {
        return {
          success: false,
          error: 'Email address has bounced previously',
          data: { bounceReason: user.emailStatus.bounceReason }
        };
      }
      
      return {
        success: true,
        user
      };
      
    } catch (error) {
      console.error('Error validating email request:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check rate limits
   */
  async checkRateLimits(userId, emailType) {
    try {
      const limits = this.rateLimits[emailType];
      if (!limits) {
        return { success: true }; // No limits defined
      }
      
      // Check daily limit
      const dailyCount = await EmailResendLog.checkRateLimit(userId, emailType, 'daily');
      if (dailyCount >= limits.daily) {
        return {
          success: false,
          error: 'Daily rate limit exceeded',
          data: {
            period: 'daily',
            limit: limits.daily,
            current: dailyCount,
            resetTime: this.getNextResetTime('daily')
          }
        };
      }
      
      // Check weekly limit
      const weeklyCount = await EmailResendLog.checkRateLimit(userId, emailType, 'weekly');
      if (weeklyCount >= limits.weekly) {
        return {
          success: false,
          error: 'Weekly rate limit exceeded',
          data: {
            period: 'weekly',
            limit: limits.weekly,
            current: weeklyCount,
            resetTime: this.getNextResetTime('weekly')
          }
        };
      }
      
      // Check monthly limit
      const monthlyCount = await EmailResendLog.checkRateLimit(userId, emailType, 'monthly');
      if (monthlyCount >= limits.monthly) {
        return {
          success: false,
          error: 'Monthly rate limit exceeded',
          data: {
            period: 'monthly',
            limit: limits.monthly,
            current: monthlyCount,
            resetTime: this.getNextResetTime('monthly')
          }
        };
      }
      
      return {
        success: true,
        data: {
          dailyRemaining: limits.daily - dailyCount,
          weeklyRemaining: limits.weekly - weeklyCount,
          monthlyRemaining: limits.monthly - monthlyCount
        }
      };
      
    } catch (error) {
      console.error('Error checking rate limits:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // =====================================
  // HELPER METHODS
  // =====================================
  
  /**
   * Get original email data
   */
  async getOriginalEmailData(originalEmailId, emailType) {
    try {
      // This would typically query your email logs/database
      // For now, return a mock structure
      return {
        emailId: originalEmailId,
        emailType,
        templateId: `template_${emailType}`,
        templateVersion: '1.0',
        subject: this.getDefaultSubject(emailType),
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        personalizedData: {},
        dynamicContent: {},
        attachments: []
      };
      
    } catch (error) {
      console.error('Error getting original email data:', error);
      return null;
    }
  }
  
  /**
   * Prepare email content
   */
  async prepareEmailContent(originalEmailData, user, customTemplate = null) {
    try {
      const templateId = customTemplate || originalEmailData.templateId;
      const template = await this.getEmailTemplate(templateId);
      
      const personalizedData = {
        userName: user.name,
        userEmail: user.email,
        accountType: user.accountType,
        language: user.language || 'en',
        timezone: user.timezone,
        ...originalEmailData.personalizedData
      };
      
      const subject = this.personalizeSubject(template.subject, personalizedData);
      
      return {
        templateId,
        templateVersion: template.version,
        subject,
        personalizedData,
        dynamicContent: template.dynamicContent,
        attachments: originalEmailData.attachments || []
      };
      
    } catch (error) {
      console.error('Error preparing email content:', error);
      throw error;
    }
  }
  
  /**
   * Additional helper methods would be implemented here...
   */
  
}

module.exports = EmailResendService;





