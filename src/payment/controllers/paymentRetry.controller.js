const { validationResult } = require('express-validator');
const FailedPayment = require('../models/failedPayment.model');
const Payment = require('../models/payment.model');
const EnhancedUser = require('../models/enhancedUser.model');
const Subscription = require('../models/subscription.model');
const AuditLog = require('../../audit/models/auditLog.model');
const mongoose = require('mongoose');

/**
 * Payment Retry Controller
 * Handles manual and bulk payment retry operations
 */
class PaymentRetryController {

  /**
   * Manually retry failed payment
   * @route POST /v1/dunning/failed-payments/:id/retry
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
        paymentMethodId,
        amount,
        reason,
        skipDunning = false,
        sendNotification = true,
        updatePaymentMethod = false
      } = req.body;

      // Find failed payment
      const failedPayment = await FailedPayment.findById(id)
        .populate('userId', 'email firstName lastName billing')
        .populate('subscriptionId');

      if (!failedPayment) {
        return res.status(404).json({
          success: false,
          message: 'Failed payment not found'
        });
      }

      if (failedPayment.status === 'recovered') {
        return res.status(400).json({
          success: false,
          message: 'Payment has already been recovered'
        });
      }

      if (failedPayment.status === 'abandoned') {
        return res.status(400).json({
          success: false,
          message: 'Payment has been abandoned and cannot be retried'
        });
      }

      const subscriber = failedPayment.userId;
      const subscription = failedPayment.subscriptionId;

      // Determine payment method to use
      let paymentMethodToUse = paymentMethodId;
      if (!paymentMethodToUse) {
        paymentMethodToUse = subscriber.billing?.defaultPaymentMethod;
        if (!paymentMethodToUse) {
          return res.status(400).json({
            success: false,
            message: 'No payment method available for retry'
          });
        }
      }

      // Determine amount to charge
      const retryAmount = amount || failedPayment.amount;

      // Simulate payment processing (in real implementation, integrate with Stripe/PayPal)
      const paymentResult = await this.processPaymentRetry({
        userId: subscriber._id,
        subscriptionId: subscription?._id,
        amount: retryAmount,
        currency: failedPayment.currency || 'USD',
        paymentMethodId: paymentMethodToUse,
        description: `Retry payment for failed payment ${failedPayment._id}`,
        metadata: {
          originalFailedPaymentId: failedPayment._id,
          retryAttempt: failedPayment.retryAttempts + 1,
          manualRetry: true,
          retriedBy: req.user._id,
          reason
        }
      });

      // Update failed payment record based on result
      const retryRecord = {
        attemptedAt: new Date(),
        amount: retryAmount,
        paymentMethodId: paymentMethodToUse,
        success: paymentResult.success,
        failureReason: paymentResult.failureReason,
        errorCode: paymentResult.errorCode,
        paymentId: paymentResult.paymentId,
        campaignStep: null, // Manual retry
        retriedBy: req.user._id,
        reason
      };

      failedPayment.retryHistory.push(retryRecord);
      failedPayment.retryAttempts += 1;
      failedPayment.lastRetryAt = new Date();

      if (paymentResult.success) {
        // Payment succeeded
        failedPayment.status = 'recovered';
        failedPayment.recoveredAt = new Date();
        failedPayment.recoveredPaymentId = paymentResult.paymentId;
        failedPayment.recoveryMethod = 'manual_retry';
        failedPayment.recoveredBy = req.user._id;

        // Update subscription if needed
        if (subscription) {
          subscription.paymentStatus = 'current';
          subscription.lastPaymentDate = new Date();
          if (subscription.status === 'past_due') {
            subscription.status = 'active';
          }
          await subscription.save();
        }

        // Update user billing status
        if (subscriber.subscriptionStatus === 'past_due') {
          subscriber.subscriptionStatus = 'active';
          await subscriber.save();
        }

        // Update payment method if requested
        if (updatePaymentMethod && paymentMethodId) {
          subscriber.billing.defaultPaymentMethod = paymentMethodId;
          await subscriber.save();
        }

      } else {
        // Payment failed again
        failedPayment.nextRetryAt = this.calculateNextRetryDate(failedPayment.retryAttempts);
        
        // Check if we should abandon after too many retries
        if (failedPayment.retryAttempts >= 10) {
          failedPayment.status = 'abandoned';
          failedPayment.abandonedAt = new Date();
          failedPayment.abandonmentReason = 'Maximum retry attempts exceeded';
          failedPayment.abandonedBy = 'system';
        }
      }

      await failedPayment.save();

      // Log the retry attempt
      await AuditLog.create({
        userId: req.user._id,
        action: paymentResult.success ? 'PAYMENT_RETRY_SUCCESS' : 'PAYMENT_RETRY_FAILED',
        targetUserId: subscriber._id.toString(),
        details: {
          failedPaymentId: failedPayment._id,
          paymentId: paymentResult.paymentId,
          amount: retryAmount,
          paymentMethodId: paymentMethodToUse,
          retryAttempt: failedPayment.retryAttempts,
          success: paymentResult.success,
          failureReason: paymentResult.failureReason,
          reason,
          ipAddress: req.ip
        }
      });

      // Send notification if requested
      if (sendNotification && paymentResult.success) {
        console.log(`Payment recovery success notification queued for ${subscriber.email}`);
      } else if (sendNotification && !paymentResult.success) {
        console.log(`Payment retry failed notification queued for ${subscriber.email}`);
      }

      const responseData = {
        success: paymentResult.success,
        failedPayment: {
          id: failedPayment._id,
          status: failedPayment.status,
          retryAttempts: failedPayment.retryAttempts,
          lastRetryAt: failedPayment.lastRetryAt,
          nextRetryAt: failedPayment.nextRetryAt,
          recoveredAt: failedPayment.recoveredAt,
          recoveredPaymentId: failedPayment.recoveredPaymentId
        },
        payment: paymentResult.success ? {
          id: paymentResult.paymentId,
          amount: retryAmount,
          status: 'completed',
          processedAt: new Date()
        } : null,
        retryResult: {
          success: paymentResult.success,
          failureReason: paymentResult.failureReason,
          errorCode: paymentResult.errorCode,
          attempt: failedPayment.retryAttempts
        }
      };

      res.status(200).json({
        success: true,
        message: paymentResult.success ? 
          'Payment retry successful - payment recovered' : 
          'Payment retry failed - will retry later',
        data: responseData
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

  /**
   * Mark failed payment as abandoned
   * @route POST /v1/dunning/failed-payments/:id/abandon
   */
  async abandonPayment(req, res) {
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
        refundPartial = false,
        cancelSubscription = false,
        sendNotification = true,
        internalNotes
      } = req.body;

      // Find failed payment
      const failedPayment = await FailedPayment.findById(id)
        .populate('userId', 'email firstName lastName subscriptions')
        .populate('subscriptionId');

      if (!failedPayment) {
        return res.status(404).json({
          success: false,
          message: 'Failed payment not found'
        });
      }

      if (failedPayment.status === 'recovered') {
        return res.status(400).json({
          success: false,
          message: 'Cannot abandon recovered payment'
        });
      }

      if (failedPayment.status === 'abandoned') {
        return res.status(400).json({
          success: false,
          message: 'Payment is already abandoned'
        });
      }

      const subscriber = failedPayment.userId;
      const subscription = failedPayment.subscriptionId;

      // Update failed payment status
      failedPayment.status = 'abandoned';
      failedPayment.abandonedAt = new Date();
      failedPayment.abandonmentReason = reason;
      failedPayment.abandonedBy = req.user._id;
      failedPayment.internalNotes = internalNotes;

      await failedPayment.save();

      let refundAmount = 0;
      let subscriptionCancelled = false;

      // Handle partial refund if requested
      if (refundPartial) {
        // In real implementation, process refund through payment gateway
        refundAmount = failedPayment.amount * 0.5; // Example: 50% refund
        
        const refundPayment = new Payment({
          userId: subscriber._id,
          subscriptionId: subscription?._id,
          amount: -refundAmount, // Negative amount for refund
          currency: failedPayment.currency || 'USD',
          status: 'completed',
          paymentMethod: 'refund',
          description: `Partial refund for abandoned payment ${failedPayment._id}`,
          metadata: {
            originalFailedPaymentId: failedPayment._id,
            refundType: 'partial_abandonment',
            refundPercentage: 50,
            processedBy: req.user._id
          }
        });
        
        await refundPayment.save();
      }

      // Handle subscription cancellation if requested
      if (cancelSubscription && subscription) {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        subscription.cancellationReason = 'Payment abandonment';
        subscription.cancelledBy = req.user._id;
        await subscription.save();

        // Update user subscription status
        subscriber.subscriptionStatus = 'cancelled';
        subscriber.currentPlan = null;
        await subscriber.save();

        subscriptionCancelled = true;
      }

      // Log the abandonment
      await AuditLog.create({
        userId: req.user._id,
        action: 'PAYMENT_ABANDONED',
        targetUserId: subscriber._id.toString(),
        details: {
          failedPaymentId: failedPayment._id,
          reason,
          refundAmount,
          subscriptionCancelled,
          totalRetryAttempts: failedPayment.retryAttempts,
          internalNotes,
          ipAddress: req.ip
        }
      });

      // Send notification if requested
      if (sendNotification) {
        console.log(`Payment abandonment notification queued for ${subscriber.email}`);
      }

      res.status(200).json({
        success: true,
        message: 'Payment marked as abandoned successfully',
        data: {
          failedPayment: {
            id: failedPayment._id,
            status: failedPayment.status,
            abandonedAt: failedPayment.abandonedAt,
            abandonmentReason: failedPayment.abandonmentReason,
            totalRetryAttempts: failedPayment.retryAttempts
          },
          actions: {
            refundProcessed: refundPartial,
            refundAmount,
            subscriptionCancelled
          }
        }
      });

    } catch (error) {
      console.error('Error in abandonPayment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to abandon payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Bulk retry multiple failed payments
   * @route POST /v1/dunning/failed-payments/bulk-retry
   */
  async bulkRetryPayments(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        paymentIds,
        campaignId,
        reason,
        skipDunning = false,
        sendNotifications = false,
        batchSize = 10,
        delayBetweenBatches = 5
      } = req.body;

      // Validate payment IDs and get failed payments
      const failedPayments = await FailedPayment.find({
        _id: { $in: paymentIds },
        status: { $in: ['failed', 'retrying'] }
      }).populate('userId', 'email firstName lastName billing');

      if (failedPayments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid failed payments found for retry'
        });
      }

      // Process in batches
      const results = {
        total: failedPayments.length,
        successful: 0,
        failed: 0,
        errors: [],
        processed: []
      };

      const batches = this.createBatches(failedPayments, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} payments`);

        // Process batch in parallel
        const batchPromises = batch.map(async (failedPayment) => {
          try {
            const retryResult = await this.processSingleRetry(failedPayment, {
              reason,
              skipDunning,
              sendNotification: sendNotifications,
              retriedBy: req.user._id,
              campaignId
            });

            results.processed.push({
              paymentId: failedPayment._id,
              success: retryResult.success,
              amount: failedPayment.amount,
              subscriber: {
                id: failedPayment.userId._id,
                email: failedPayment.userId.email
              },
              result: retryResult
            });

            if (retryResult.success) {
              results.successful++;
            } else {
              results.failed++;
            }

            return retryResult;

          } catch (error) {
            results.failed++;
            results.errors.push({
              paymentId: failedPayment._id,
              error: error.message
            });
            
            results.processed.push({
              paymentId: failedPayment._id,
              success: false,
              error: error.message,
              subscriber: {
                id: failedPayment.userId._id,
                email: failedPayment.userId.email
              }
            });

            return { success: false, error: error.message };
          }
        });

        await Promise.all(batchPromises);

        // Delay between batches to avoid overwhelming payment processor
        if (i < batches.length - 1 && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches * 1000));
        }
      }

      // Log bulk retry operation
      await AuditLog.create({
        userId: req.user._id,
        action: 'BULK_PAYMENT_RETRY',
        details: {
          totalPayments: results.total,
          successfulRetries: results.successful,
          failedRetries: results.failed,
          batchSize,
          campaignId,
          reason,
          ipAddress: req.ip
        }
      });

      const successRate = results.total > 0 ? (results.successful / results.total) * 100 : 0;

      res.status(200).json({
        success: true,
        message: `Bulk retry completed. ${results.successful}/${results.total} payments recovered.`,
        data: {
          summary: {
            total: results.total,
            successful: results.successful,
            failed: results.failed,
            successRate: Math.round(successRate * 100) / 100,
            totalRecoveredAmount: results.processed
              .filter(p => p.success)
              .reduce((sum, p) => sum + (p.amount || 0), 0)
          },
          results: results.processed,
          errors: results.errors
        }
      });

    } catch (error) {
      console.error('Error in bulkRetryPayments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk retry',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Helper Methods

  /**
   * Process payment retry (simulated)
   */
  async processPaymentRetry(paymentData) {
    // Simulate payment processing
    // In real implementation, this would integrate with Stripe, PayPal, etc.
    
    const {
      userId,
      subscriptionId,
      amount,
      currency,
      paymentMethodId,
      description,
      metadata
    } = paymentData;

    // Simulate success/failure (70% success rate for simulation)
    const success = Math.random() > 0.3;

    if (success) {
      // Create successful payment record
      const payment = new Payment({
        userId,
        subscriptionId,
        amount,
        currency,
        status: 'completed',
        paymentMethod: 'card',
        paymentMethodId,
        description,
        metadata: {
          ...metadata,
          processedAt: new Date(),
          gateway: 'stripe_simulate'
        }
      });

      await payment.save();

      return {
        success: true,
        paymentId: payment._id,
        amount,
        currency,
        processedAt: new Date()
      };
    } else {
      // Simulate failure reasons
      const failureReasons = [
        'insufficient_funds',
        'card_declined',
        'expired_card',
        'authentication_required',
        'processing_error'
      ];
      
      const failureReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
      
      return {
        success: false,
        failureReason,
        errorCode: `ERR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        amount,
        currency
      };
    }
  }

  /**
   * Process single retry for bulk operations
   */
  async processSingleRetry(failedPayment, options) {
    const {
      reason,
      skipDunning,
      sendNotification,
      retriedBy,
      campaignId
    } = options;

    // Use default payment method
    const paymentMethodId = failedPayment.userId.billing?.defaultPaymentMethod;
    if (!paymentMethodId) {
      throw new Error('No payment method available');
    }

    // Process retry
    const paymentResult = await this.processPaymentRetry({
      userId: failedPayment.userId._id,
      subscriptionId: failedPayment.subscriptionId,
      amount: failedPayment.amount,
      currency: failedPayment.currency || 'USD',
      paymentMethodId,
      description: `Bulk retry payment for failed payment ${failedPayment._id}`,
      metadata: {
        originalFailedPaymentId: failedPayment._id,
        retryAttempt: failedPayment.retryAttempts + 1,
        bulkRetry: true,
        retriedBy,
        campaignId,
        reason
      }
    });

    // Update failed payment record
    const retryRecord = {
      attemptedAt: new Date(),
      amount: failedPayment.amount,
      paymentMethodId,
      success: paymentResult.success,
      failureReason: paymentResult.failureReason,
      errorCode: paymentResult.errorCode,
      paymentId: paymentResult.paymentId,
      campaignStep: null,
      retriedBy,
      reason,
      bulkRetry: true
    };

    failedPayment.retryHistory.push(retryRecord);
    failedPayment.retryAttempts += 1;
    failedPayment.lastRetryAt = new Date();

    if (paymentResult.success) {
      failedPayment.status = 'recovered';
      failedPayment.recoveredAt = new Date();
      failedPayment.recoveredPaymentId = paymentResult.paymentId;
      failedPayment.recoveryMethod = 'bulk_retry';
      failedPayment.recoveredBy = retriedBy;
    } else {
      failedPayment.nextRetryAt = this.calculateNextRetryDate(failedPayment.retryAttempts);
    }

    await failedPayment.save();

    return paymentResult;
  }

  /**
   * Calculate next retry date based on exponential backoff
   */
  calculateNextRetryDate(retryAttempts) {
    // Exponential backoff: 1 day, 3 days, 7 days, 14 days, etc.
    const baseDays = Math.min(Math.pow(2, retryAttempts - 1), 30); // Cap at 30 days
    const jitter = Math.random() * 0.2; // Add 20% jitter
    const delayDays = baseDays * (1 + jitter);
    
    return new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

module.exports = new PaymentRetryController();





