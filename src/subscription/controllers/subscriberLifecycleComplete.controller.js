const { validationResult } = require('express-validator');
const User = require('../../models/user.model');
const AdminUser = require('../../admin/models/adminUser.model');
const Subscription = require('../models/subscription.model');
const MembershipPlan = require('../models/membershipPlan.model');
const AuditLog = require('../../admin/models/auditLog.model');
const Payment = require('../../payment/models/payment.model');
const Invoice = require('../../payment/models/invoice.model');
const { DiscountCode, DiscountRedemption } = require('../../payment/models/discount.model');
// Note: Dashboard models will be implemented when support module is available
// const { SupportTicket, SupportNote } = require('../../dashboard/models/supportTicket.model');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Complete Subscriber Lifecycle Controller
 * Handles all subscriber lifecycle operations including cancellation, refunds, payment updates, dunning
 */
class CompleteSubscriberLifecycleController {

  /**
   * Cancel subscriber subscription with retention handling
   * @route POST /v1/subscribers/:id/cancel
   */
  async cancelSubscriber(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        reason,
        reasonCategory = 'other',
        effectiveDate,
        scheduleEndOfPeriod = true,
        retentionOffered = false,
        retentionOffers = [],
        saveOffers = [],
        refundRequest = false,
        refundAmount,
        refundReason,
        surveyResponses = {},
        sendConfirmation = true,
        allowReactivation = true,
        dataRetentionPeriod = 365, // days
        notes
      } = req.body;

      // Check permissions
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT' && req.user._id.toString() !== id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Find active subscription
      const subscription = await Subscription.findOne({
        userId: id,
        status: { $in: ['active', 'trial', 'paused'] }
      }).sort({ createdAt: -1 });

      if (!subscription) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription found to cancel'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Subscriber not found'
        });
      }

      // Calculate effective cancellation date
      let cancellationDate;
      if (effectiveDate) {
        cancellationDate = new Date(effectiveDate);
      } else if (scheduleEndOfPeriod) {
        cancellationDate = subscription.nextBillingDate;
      } else {
        cancellationDate = new Date();
      }

      const isImmediate = cancellationDate <= new Date();

      // Handle retention offers if provided
      if (retentionOffered && retentionOffers.length > 0) {
        subscription.retentionHistory = subscription.retentionHistory || [];
        subscription.retentionHistory.push({
          offeredAt: new Date(),
          offers: retentionOffers,
          acceptedOffer: null,
          declinedAt: new Date(),
          offeredBy: req.user._id
        });
      }

      // Handle save offers
      if (saveOffers.length > 0) {
        subscription.saveOffers = saveOffers.map(offer => ({
          ...offer,
          offeredAt: new Date(),
          expiresAt: new Date(Date.now() + (offer.validDays || 30) * 24 * 60 * 60 * 1000),
          status: 'active'
        }));
      }

      // Update subscription status
      if (isImmediate) {
        subscription.status = 'cancelled';
        subscription.cancelledAt = cancellationDate;
        subscription.endedAt = cancellationDate;

        // Update user access immediately
        user.subscriptionStatus = 'cancelled';
        user.accessLevel = 'limited';
      } else {
        subscription.status = 'cancelling';
        subscription.scheduledCancellation = {
          date: cancellationDate,
          reason,
          reasonCategory,
          scheduledBy: req.user._id,
          scheduledAt: new Date()
        };
      }

      // Store cancellation details
      subscription.cancellationReason = reason;
      subscription.cancellationCategory = reasonCategory;
      subscription.cancelledBy = req.user._id;
      subscription.surveyResponses = surveyResponses;
      subscription.allowReactivation = allowReactivation;
      subscription.dataRetentionUntil = new Date(Date.now() + dataRetentionPeriod * 24 * 60 * 60 * 1000);

      await subscription.save();

      // Add support note about cancellation
      if (notes) {
        const supportNote = new SupportNote({
          userId: id,
          author: req.user._id,
          content: `Cancellation processed: ${reason}. ${notes}`,
          type: 'general',
          visibility: 'team',
          priority: 'normal',
          metadata: {
            cancellationDate,
            reasonCategory,
            isImmediate
          }
        });
        await supportNote.save();
      }

      // Process refund if requested
      let refundData = null;
      if (refundRequest && refundAmount > 0) {
        try {
          refundData = await this.processRefund({
            userId: id,
            subscriptionId: subscription._id,
            amount: refundAmount,
            reason: refundReason || 'Cancellation refund',
            processedBy: req.user._id
          });
        } catch (refundError) {
          console.error('Refund processing failed:', refundError);
          // Continue with cancellation even if refund fails
        }
      }

      // Update user profile
      user.cancellationHistory = user.cancellationHistory || [];
      user.cancellationHistory.push({
        subscriptionId: subscription._id,
        cancelledAt: new Date(),
        reason,
        reasonCategory,
        surveyResponses,
        refundIssued: !!refundData
      });

      await user.save();

      // Log the cancellation
      await AuditLog.create({
        userId: req.user._id,
        action: isImmediate ? 'SUBSCRIPTION_CANCELLED' : 'SUBSCRIPTION_CANCELLATION_SCHEDULED',
        targetUserId: id,
        details: {
          subscriptionId: subscription._id,
          reason,
          reasonCategory,
          cancellationDate,
          isImmediate,
          retentionOffered,
          saveOffersProvided: saveOffers.length,
          refundIssued: !!refundData,
          refundAmount: refundData?.amount,
          ipAddress: req.ip
        }
      });

      // Send confirmation email if requested
      if (sendConfirmation) {
        console.log(`Cancellation confirmation queued for ${user.email}`);
      }

      // Prepare response
      const responseData = {
        subscription: {
          id: subscription._id,
          status: subscription.status,
          cancelledAt: subscription.cancelledAt,
          endedAt: subscription.endedAt,
          scheduledCancellation: subscription.scheduledCancellation
        },
        cancellation: {
          isImmediate,
          effectiveDate: cancellationDate,
          reason,
          reasonCategory,
          retentionOffered,
          saveOffersAvailable: saveOffers.length > 0,
          allowReactivation
        },
        refund: refundData
      };

      res.status(200).json({
        success: true,
        message: isImmediate ? 'Subscription cancelled successfully' : 'Subscription scheduled for cancellation',
        data: responseData
      });

    } catch (error) {
      console.error('Error in cancelSubscriber:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Process subscriber refund
   * @route POST /v1/subscribers/:id/refunds
   */
  async processRefund(req, res) {
    try {
      // Handle both direct calls and internal refund processing
      const refundData = typeof req === 'object' && req.userId ? req : req.body;
      const isInternalCall = !res;

      if (!isInternalCall) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
          });
        }
      }

      const {
        userId,
        subscriptionId,
        paymentId,
        amount,
        reason = 'Customer request',
        refundType = 'full', // full, partial, credit
        issueCredit = false,
        creditExpirationDays = 365,
        processedBy,
        notes,
        notifyCustomer = true
      } = refundData;

      const targetUserId = userId || req.params?.id;

      // Validate permissions for external calls
      if (!isInternalCall) {
        if (!['ADMIN', 'FINANCE', 'SUPPORT'].includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions for refund processing'
          });
        }
      }

      // Find the payment to refund
      let paymentToRefund;
      if (paymentId) {
        paymentToRefund = await Payment.findById(paymentId);
      } else if (subscriptionId) {
        // Find the most recent successful payment for this subscription
        paymentToRefund = await Payment.findOne({
          subscriptionId,
          status: 'completed'
        }).sort({ createdAt: -1 });
      } else {
        // Find the most recent payment for the user
        paymentToRefund = await Payment.findOne({
          userId: targetUserId,
          status: 'completed'
        }).sort({ createdAt: -1 });
      }

      if (!paymentToRefund) {
        const error = 'No eligible payment found for refund';
        if (isInternalCall) throw new Error(error);
        return res.status(400).json({ success: false, message: error });
      }

      // Validate refund amount
      const maxRefundAmount = paymentToRefund.amount - (paymentToRefund.refundedAmount || 0);
      const refundAmount = Math.min(amount || maxRefundAmount, maxRefundAmount);

      if (refundAmount <= 0) {
        const error = 'No refundable amount available';
        if (isInternalCall) throw new Error(error);
        return res.status(400).json({ success: false, message: error });
      }

      // Create refund record
      const refund = new Payment({
        userId: targetUserId,
        subscriptionId: paymentToRefund.subscriptionId,
        originalPaymentId: paymentToRefund._id,
        amount: refundAmount,
        currency: paymentToRefund.currency,
        status: issueCredit ? 'credit_issued' : 'refunded',
        paymentMethod: paymentToRefund.paymentMethod,
        type: 'refund',
        description: `Refund: ${reason}`,
        metadata: {
          refundType,
          originalAmount: paymentToRefund.amount,
          refundReason: reason,
          processedBy: processedBy || req.user?._id,
          issueCredit,
          notes
        }
      });

      await refund.save();

      // Update original payment
      paymentToRefund.refundedAmount = (paymentToRefund.refundedAmount || 0) + refundAmount;
      paymentToRefund.refunds = paymentToRefund.refunds || [];
      paymentToRefund.refunds.push({
        refundId: refund._id,
        amount: refundAmount,
        reason,
        processedAt: new Date(),
        processedBy: processedBy || req.user?._id
      });

      if (paymentToRefund.refundedAmount >= paymentToRefund.amount) {
        paymentToRefund.status = 'refunded';
      } else {
        paymentToRefund.status = 'partially_refunded';
      }

      await paymentToRefund.save();

      // Handle credit issuance
      let creditBalance = null;
      if (issueCredit) {
        const user = await User.findById(targetUserId);
        user.billing.creditBalance = (user.billing.creditBalance || 0) + refundAmount;
        user.billing.credits = user.billing.credits || [];
        user.billing.credits.push({
          amount: refundAmount,
          reason: `Refund credit: ${reason}`,
          issuedAt: new Date(),
          expiresAt: creditExpirationDays ?
            new Date(Date.now() + creditExpirationDays * 24 * 60 * 60 * 1000) : null,
          issuedBy: processedBy || req.user?._id
        });
        await user.save();
        creditBalance = user.billing.creditBalance;
      }

      // Log the refund
      await AuditLog.create({
        userId: processedBy || req.user?._id,
        action: 'REFUND_PROCESSED',
        targetUserId,
        details: {
          refundId: refund._id,
          originalPaymentId: paymentToRefund._id,
          amount: refundAmount,
          refundType,
          reason,
          issueCredit,
          creditBalance,
          ipAddress: req?.ip
        }
      });

      // Send notification to customer
      if (notifyCustomer && !isInternalCall) {
        console.log(`Refund notification queued for user ${targetUserId}`);
      }

      const refundResult = {
        refund: {
          id: refund._id,
          amount: refundAmount,
          currency: refund.currency,
          status: refund.status,
          type: refundType,
          reason,
          processedAt: refund.createdAt
        },
        originalPayment: {
          id: paymentToRefund._id,
          amount: paymentToRefund.amount,
          refundedAmount: paymentToRefund.refundedAmount,
          status: paymentToRefund.status
        },
        creditBalance: creditBalance
      };

      if (isInternalCall) {
        return refundResult;
      }

      res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: refundResult
      });

    } catch (error) {
      console.error('Error in processRefund:', error);
      if (typeof req === 'object' && req.userId) {
        // Internal call - throw error
        throw error;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Generate payment method update link
   * @route POST /v1/subscribers/:id/payment-method/update-link
   */
  async generatePaymentUpdateLink(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        expirationHours = 24,
        returnUrl,
        requireCurrentMethod = false,
        allowedMethods = ['card'],
        sendEmail = true,
        customMessage
      } = req.body;

      // Check permissions
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT' && req.user._id.toString() !== id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Subscriber not found'
        });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      // Store the payment update session
      const updateSession = {
        token,
        userId: id,
        expiresAt,
        requireCurrentMethod,
        allowedMethods,
        returnUrl: returnUrl || `${process.env.FRONTEND_URL}/account/payment-methods`,
        createdBy: req.user._id,
        used: false,
        metadata: {
          customMessage,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };

      // In a real implementation, this would be stored in a dedicated session store
      // For now, we'll store it in the user's billing data
      user.billing.paymentUpdateSessions = user.billing.paymentUpdateSessions || [];
      user.billing.paymentUpdateSessions.push(updateSession);

      // Clean up expired sessions
      user.billing.paymentUpdateSessions = user.billing.paymentUpdateSessions.filter(
        session => session.expiresAt > new Date() && !session.used
      );

      await user.save();

      // Generate the secure link
      const updateLink = `${process.env.FRONTEND_URL}/payment-update/${token}`;

      // Log the link generation
      await AuditLog.create({
        userId: req.user._id,
        action: 'PAYMENT_UPDATE_LINK_GENERATED',
        targetUserId: id,
        details: {
          token: token.substring(0, 8) + '...', // Log partial token for security
          expiresAt,
          allowedMethods,
          sendEmail,
          ipAddress: req.ip
        }
      });

      // Send email if requested
      if (sendEmail) {
        console.log(`Payment update email with link queued for ${user.email}`);
      }

      res.status(200).json({
        success: true,
        message: 'Payment update link generated successfully',
        data: {
          updateLink,
          token,
          expiresAt,
          allowedMethods,
          emailSent: sendEmail
        }
      });

    } catch (error) {
      console.error('Error in generatePaymentUpdateLink:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate payment update link',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * View payment method token status (for security)
   * @route GET /v1/subscribers/:id/payment-method/status
   */
  async getPaymentMethodStatus(req, res) {
    try {
      const { id } = req.params;

      // Check permissions
      if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPPORT' && req.user._id.toString() !== id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Subscriber not found'
        });
      }

      const paymentMethods = user.billing?.paymentMethods || [];
      const defaultMethod = user.billing?.defaultPaymentMethod;

      // Sanitize payment method data for security
      const sanitizedMethods = paymentMethods.map(method => ({
        id: method.id,
        type: method.type,
        last4: method.last4,
        brand: method.brand,
        expiryMonth: method.expiryMonth,
        expiryYear: method.expiryYear,
        isDefault: method.id === defaultMethod,
        isExpired: new Date() > new Date(method.expiryYear, method.expiryMonth - 1),
        status: method.status || 'active',
        createdAt: method.createdAt,
        lastValidated: method.lastValidated,
        failureCount: method.failureCount || 0
      }));

      // Check for any pending payment update sessions
      const pendingSessions = (user.billing?.paymentUpdateSessions || [])
        .filter(session => session.expiresAt > new Date() && !session.used)
        .map(session => ({
          token: session.token.substring(0, 8) + '...',
          expiresAt: session.expiresAt,
          createdBy: session.createdBy
        }));

      res.status(200).json({
        success: true,
        data: {
          paymentMethods: sanitizedMethods,
          defaultPaymentMethod: defaultMethod,
          hasValidMethod: sanitizedMethods.some(method =>
            method.id === defaultMethod && !method.isExpired && method.status === 'active'
          ),
          pendingUpdateSessions: pendingSessions,
          billingAddress: user.billing?.address || null
        }
      });

    } catch (error) {
      console.error('Error in getPaymentMethodStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment method status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Issue trial subscription
   * @route POST /v1/subscribers/:id/trial
   */
  async issueTrial(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        planId,
        trialDays = 14,
        billingCycle = 'monthly',
        requirePaymentMethod = false,
        autoConvert = true,
        customPricing,
        addons = [],
        reason = 'Trial subscription',
        sendWelcomeEmail = true
      } = req.body;

      // Check permissions
      if (!['ADMIN', 'SALES', 'SUPPORT'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Subscriber not found'
        });
      }

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        userId: id,
        status: { $in: ['active', 'trial', 'paused'] }
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: 'User already has an active subscription'
        });
      }

      // Validate plan
      const plan = await MembershipPlan.findOne({ name: planId, active: true });
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive plan'
        });
      }

      // Check payment method requirement
      if (requirePaymentMethod && !user.billing?.defaultPaymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Payment method required for trial subscription'
        });
      }

      // Calculate trial end date
      const trialStartDate = new Date();
      const trialEndDate = new Date(trialStartDate.getTime() + trialDays * 24 * 60 * 60 * 1000);

      // Create trial subscription
      const subscription = new Subscription({
        userId: id,
        plan: plan.name,
        status: 'trial',
        billingCycle,
        mrr: 0, // No MRR during trial
        pricing: customPricing || {
          amount: plan.price,
          currency: 'USD'
        },
        trialStartsAt: trialStartDate,
        trialEndsAt: trialEndDate,
        nextBillingDate: autoConvert ? trialEndDate : null,
        features: plan.features,
        limits: plan.limits,
        addons: addons.map(addon => ({
          ...addon,
          addedAt: new Date()
        })),
        autoConvert,
        metadata: {
          issuedBy: req.user._id,
          reason,
          requirePaymentMethod
        }
      });

      await subscription.save();

      // Update user
      user.subscriptions = user.subscriptions || [];
      user.subscriptions.push(subscription._id);
      user.currentPlan = plan.name;
      user.subscriptionStatus = 'trial';
      user.accessLevel = 'full';

      await user.save();

      // Log the trial issuance
      await AuditLog.create({
        userId: req.user._id,
        action: 'TRIAL_ISSUED',
        targetUserId: id,
        details: {
          subscriptionId: subscription._id,
          plan: plan.name,
          trialDays,
          billingCycle,
          autoConvert,
          requirePaymentMethod,
          reason,
          ipAddress: req.ip
        }
      });

      // Send welcome email if requested
      if (sendWelcomeEmail) {
        console.log(`Trial welcome email queued for ${user.email}`);
      }

      res.status(201).json({
        success: true,
        message: 'Trial subscription issued successfully',
        data: {
          subscription: {
            id: subscription._id,
            plan: subscription.plan,
            status: subscription.status,
            trialStartsAt: subscription.trialStartsAt,
            trialEndsAt: subscription.trialEndsAt,
            autoConvert,
            daysRemaining: trialDays
          },
          user: {
            id: user._id,
            subscriptionStatus: user.subscriptionStatus,
            accessLevel: user.accessLevel
          }
        }
      });

    } catch (error) {
      console.error('Error in issueTrial:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to issue trial subscription',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Schedule subscription changes at period end
   * @route POST /v1/subscribers/:id/schedule-change
   */
  async scheduleChange(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        changeType, // plan_change, cancellation, pause, addon_change
        targetPlan,
        effectiveDate,
        addons,
        removeAddons = [],
        customPricing,
        reason,
        notifyCustomer = true
      } = req.body;

      // Check permissions
      if (!['ADMIN', 'SALES', 'SUPPORT'].includes(req.user.role) && req.user._id.toString() !== id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Find active subscription
      const subscription = await Subscription.findOne({
        userId: id,
        status: { $in: ['active', 'trial'] }
      }).sort({ createdAt: -1 });

      if (!subscription) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      // Calculate effective date (default to next billing date)
      const changeDate = effectiveDate ?
        new Date(effectiveDate) :
        subscription.nextBillingDate;

      // Validate change type
      const validChangeTypes = ['plan_change', 'cancellation', 'pause', 'addon_change'];
      if (!validChangeTypes.includes(changeType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid change type'
        });
      }

      // Store scheduled change
      subscription.scheduledChanges = subscription.scheduledChanges || [];

      const scheduledChange = {
        id: crypto.randomUUID(),
        type: changeType,
        effectiveDate: changeDate,
        scheduledAt: new Date(),
        scheduledBy: req.user._id,
        reason,
        status: 'scheduled',
        details: {
          targetPlan,
          addons,
          removeAddons,
          customPricing
        }
      };

      subscription.scheduledChanges.push(scheduledChange);
      await subscription.save();

      // Log the scheduled change
      await AuditLog.create({
        userId: req.user._id,
        action: 'SUBSCRIPTION_CHANGE_SCHEDULED',
        targetUserId: id,
        details: {
          subscriptionId: subscription._id,
          changeType,
          effectiveDate: changeDate,
          targetPlan,
          reason,
          changeId: scheduledChange.id,
          ipAddress: req.ip
        }
      });

      // Send notification if requested
      if (notifyCustomer) {
        console.log(`Scheduled change notification queued for user ${id}`);
      }

      res.status(200).json({
        success: true,
        message: 'Subscription change scheduled successfully',
        data: {
          scheduledChange: {
            id: scheduledChange.id,
            type: changeType,
            effectiveDate: changeDate,
            status: 'scheduled',
            daysUntilChange: Math.ceil((changeDate - new Date()) / (24 * 60 * 60 * 1000))
          },
          subscription: {
            id: subscription._id,
            currentPlan: subscription.plan,
            nextBillingDate: subscription.nextBillingDate
          }
        }
      });

    } catch (error) {
      console.error('Error in scheduleChange:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule subscription change',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get dunning dashboard for failed payments
   * @route GET /v1/subscribers/dunning/dashboard
   */
  async getDunningDashboard(req, res) {
    try {
      const {
        status = 'all', // failed, retry, grace_period, cancelled
        days = 30,
        sortBy = 'failedAt',
        sortOrder = 'desc',
        page = 1,
        limit = 25
      } = req.query;

      // Check permissions
      if (!['ADMIN', 'FINANCE', 'SUPPORT'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Build query for failed payments
      const paymentFilter = {
        status: 'failed',
        createdAt: { $gte: startDate }
      };

      // Add status filtering for dunning process
      if (status !== 'all') {
        paymentFilter['dunning.status'] = status;
      }

      // Aggregation pipeline for dunning data
      const pipeline = [
        { $match: paymentFilter },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  'billing.defaultPaymentMethod': 1,
                  subscriptionStatus: 1
                }
              }
            ]
          }
        },
        {
          $lookup: {
            from: 'subscriptions',
            localField: 'subscriptionId',
            foreignField: '_id',
            as: 'subscription',
            pipeline: [
              {
                $project: {
                  plan: 1,
                  status: 1,
                  mrr: 1,
                  nextBillingDate: 1,
                  'dunning.retryCount': 1,
                  'dunning.lastRetryAt': 1,
                  'dunning.nextRetryAt': 1
                }
              }
            ]
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ['$user', 0] },
            subscription: { $arrayElemAt: ['$subscription', 0] }
          }
        },
        {
          $project: {
            amount: 1,
            currency: 1,
            failureReason: 1,
            createdAt: 1,
            'dunning.status': 1,
            'dunning.retryCount': 1,
            'dunning.lastRetryAt': 1,
            'dunning.nextRetryAt': 1,
            'dunning.gracePeriodEnds': 1,
            user: 1,
            subscription: 1
          }
        }
      ];

      // Add sorting
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      pipeline.push({ $sort: sortOptions });

      // Add pagination
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

      // Execute aggregation
      const [failedPayments, totalCount, summary] = await Promise.all([
        Payment.aggregate(pipeline),
        Payment.aggregate([
          ...pipeline.slice(0, -2),
          { $count: "total" }
        ]),
        Payment.aggregate([
          { $match: paymentFilter },
          {
            $group: {
              _id: '$dunning.status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
              avgAmount: { $avg: '$amount' }
            }
          }
        ])
      ]);

      const total = totalCount[0]?.total || 0;

      // Calculate recovery metrics
      const recoveryStats = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            'metadata.isRetryPayment': true,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            recoveredCount: { $sum: 1 },
            recoveredAmount: { $sum: '$amount' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          failedPayments,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          },
          summary: {
            statusBreakdown: summary,
            recovery: recoveryStats[0] || { recoveredCount: 0, recoveredAmount: 0 }
          },
          filters: {
            status,
            days,
            dateRange: { from: startDate, to: new Date() }
          }
        }
      });

    } catch (error) {
      console.error('Error in getDunningDashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dunning dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Retry failed payment manually
   * @route POST /v1/subscribers/:id/retry-payment
   */
  async retryPayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        paymentId,
        useNewPaymentMethod = false,
        paymentMethodId,
        sendNotification = true,
        notes
      } = req.body;

      // Check permissions
      if (!['ADMIN', 'FINANCE', 'SUPPORT'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Find the failed payment
      const failedPayment = paymentId ?
        await Payment.findById(paymentId) :
        await Payment.findOne({
          userId: id,
          status: 'failed'
        }).sort({ createdAt: -1 });

      if (!failedPayment) {
        return res.status(404).json({
          success: false,
          message: 'No failed payment found'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Subscriber not found'
        });
      }

      // Update payment method if provided
      if (useNewPaymentMethod && paymentMethodId) {
        user.billing.defaultPaymentMethod = paymentMethodId;
        await user.save();
      }

      // Simulate payment retry (in real implementation, this would call payment gateway)
      const retrySuccessful = Math.random() > 0.3; // 70% success rate simulation

      // Create new payment record for retry
      const retryPayment = new Payment({
        userId: id,
        subscriptionId: failedPayment.subscriptionId,
        originalPaymentId: failedPayment._id,
        amount: failedPayment.amount,
        currency: failedPayment.currency,
        status: retrySuccessful ? 'completed' : 'failed',
        paymentMethod: failedPayment.paymentMethod,
        paymentMethodId: paymentMethodId || user.billing.defaultPaymentMethod,
        description: `Retry payment for ${failedPayment.description}`,
        metadata: {
          isRetryPayment: true,
          originalPaymentId: failedPayment._id,
          retryReason: notes || 'Manual retry',
          retriedBy: req.user._id
        }
      });

      if (!retrySuccessful) {
        retryPayment.failureReason = 'Card declined'; // Simulated failure
      }

      await retryPayment.save();

      // Update original payment with retry information
      failedPayment.retries = failedPayment.retries || [];
      failedPayment.retries.push({
        retryId: retryPayment._id,
        retriedAt: new Date(),
        retriedBy: req.user._id,
        successful: retrySuccessful,
        notes
      });

      if (retrySuccessful) {
        failedPayment.status = 'retry_succeeded';

        // Update subscription if payment was successful
        const subscription = await Subscription.findById(failedPayment.subscriptionId);
        if (subscription) {
          subscription.status = 'active';
          subscription.paymentStatus = 'current';
          subscription.dunning = subscription.dunning || {};
          subscription.dunning.status = 'resolved';
          subscription.dunning.resolvedAt = new Date();
          await subscription.save();
        }
      } else {
        // Update dunning information
        failedPayment.dunning = failedPayment.dunning || {};
        failedPayment.dunning.retryCount = (failedPayment.dunning.retryCount || 0) + 1;
        failedPayment.dunning.lastRetryAt = new Date();
      }

      await failedPayment.save();

      // Log the retry attempt
      await AuditLog.create({
        userId: req.user._id,
        action: retrySuccessful ? 'PAYMENT_RETRY_SUCCEEDED' : 'PAYMENT_RETRY_FAILED',
        targetUserId: id,
        details: {
          originalPaymentId: failedPayment._id,
          retryPaymentId: retryPayment._id,
          amount: retryPayment.amount,
          paymentMethodChanged: useNewPaymentMethod,
          notes,
          ipAddress: req.ip
        }
      });

      // Send notification if requested and successful
      if (sendNotification && retrySuccessful) {
        console.log(`Payment success notification queued for ${user.email}`);
      }

      res.status(200).json({
        success: true,
        message: retrySuccessful ? 'Payment retry successful' : 'Payment retry failed',
        data: {
          retryPayment: {
            id: retryPayment._id,
            status: retryPayment.status,
            amount: retryPayment.amount,
            currency: retryPayment.currency
          },
          originalPayment: {
            id: failedPayment._id,
            retryCount: failedPayment.retries?.length || 0,
            status: failedPayment.status
          },
          successful: retrySuccessful
        }
      });

    } catch (error) {
      console.error('Error in retryPayment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retry payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new CompleteSubscriberLifecycleController();





