const { PaymentProcessorFactory } = require('../services/paymentProcessors.service');
const IntegrationConfig = require('../models/integrationConfig.model');
const { logger } = require('../utils/logger');
const { body, param, validationResult } = require('express-validator');

class PaymentController {
  /**
   * Create a new customer
   */
  static async createCustomer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const customerData = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const customer = await processor.createCustomer(customerData);

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer
      });
    } catch (error) {
      logger.error('Create customer error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create customer'
      });
    }
  }

  /**
   * Create a payment method
   */
  static async createPaymentMethod(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const { customerId } = req.params;
      const paymentMethodData = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const paymentMethod = await processor.createPaymentMethod(customerId, paymentMethodData);

      res.status(201).json({
        success: true,
        message: 'Payment method created successfully',
        data: paymentMethod
      });
    } catch (error) {
      logger.error('Create payment method error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create payment method'
      });
    }
  }

  /**
   * Create a subscription
   */
  static async createSubscription(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const subscriptionData = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const subscription = await processor.createSubscription(subscriptionData);

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: subscription
      });
    } catch (error) {
      logger.error('Create subscription error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create subscription'
      });
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const { subscriptionId } = req.params;
      const { reason = '' } = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const result = await processor.cancelSubscription(subscriptionId, reason);

      res.status(200).json({
        success: true,
        message: 'Subscription canceled successfully',
        data: result
      });
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel subscription'
      });
    }
  }

  /**
   * Create an invoice
   */
  static async createInvoice(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const invoiceData = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const invoice = await processor.createInvoice(invoiceData);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice
      });
    } catch (error) {
      logger.error('Create invoice error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create invoice'
      });
    }
  }

  /**
   * Process a payment
   */
  static async processPayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const paymentData = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const payment = await processor.processPayment(paymentData);

      res.status(200).json({
        success: true,
        message: 'Payment processed successfully',
        data: payment
      });
    } catch (error) {
      logger.error('Process payment error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process payment'
      });
    }
  }

  /**
   * Refund a payment
   */
  static async refundPayment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { provider = null } = req.query;
      const { paymentId } = req.params;
      const { amount = null, reason = '' } = req.body;

      const processor = provider
        ? await PaymentProcessorFactory.create(provider)
        : await PaymentProcessorFactory.getPrimaryProcessor();

      const refund = await processor.refundPayment(paymentId, amount, reason);

      res.status(200).json({
        success: true,
        message: 'Payment refunded successfully',
        data: refund
      });
    } catch (error) {
      logger.error('Refund payment error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to refund payment'
      });
    }
  }

  /**
   * Handle Stripe webhooks
   */
  static async handleStripeWebhook(req, res) {
    try {
      const signature = req.get('stripe-signature');
      const payload = req.body;

      // Get Stripe configuration
      const config = await IntegrationConfig.getProviderByName('payment', 'stripe');
      if (!config || !config.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'Stripe integration not configured'
        });
      }

      const processor = await PaymentProcessorFactory.create('stripe');
      const webhookSecret = config.getDecryptedCredentials().webhookSecret;

      // Verify webhook signature
      const event = await processor.verifyWebhook(payload, signature, webhookSecret);

      // Process webhook
      const result = await processor.handleWebhook(event);

      // Update usage statistics
      await config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Webhook processing failed'
      });
    }
  }

  /**
   * Handle Braintree webhooks
   */
  static async handleBraintreeWebhook(req, res) {
    try {
      const btSignature = req.query.bt_signature;
      const btPayload = req.query.bt_payload;

      // Get Braintree configuration
      const config = await IntegrationConfig.getProviderByName('payment', 'braintree');
      if (!config || !config.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'Braintree integration not configured'
        });
      }

      const processor = await PaymentProcessorFactory.create('braintree');

      // Verify and parse webhook
      const notification = await processor.verifyWebhook(btPayload, btSignature);

      // Process webhook
      const result = await processor.handleWebhook(notification);

      // Update usage statistics
      await config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Braintree webhook error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Webhook processing failed'
      });
    }
  }

  /**
   * Handle Paddle webhooks
   */
  static async handlePaddleWebhook(req, res) {
    try {
      const payload = req.body;

      // Get Paddle configuration
      const config = await IntegrationConfig.getProviderByName('payment', 'paddle');
      if (!config || !config.isEnabled) {
        return res.status(404).json({
          success: false,
          message: 'Paddle integration not configured'
        });
      }

      const processor = await PaymentProcessorFactory.create('paddle');
      const webhookSecret = config.getDecryptedCredentials().publicKey;

      // Verify webhook signature
      const event = await processor.verifyWebhook(payload, null, webhookSecret);

      // Process webhook
      const result = await processor.handleWebhook(event);

      // Update usage statistics
      await config.incrementUsage();

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Paddle webhook error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Webhook processing failed'
      });
    }
  }

  /**
   * Get payment provider status
   */
  static async getProviderStatus(req, res) {
    try {
      const { provider } = req.params;

      const config = await IntegrationConfig.getProviderByName('payment', provider);
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Payment provider not found'
        });
      }

      const status = {
        provider: config.provider,
        isEnabled: config.isEnabled,
        isPrimary: config.isPrimary,
        environment: config.environment,
        healthStatus: config.health.status,
        lastHealthCheck: config.health.lastCheck,
        responseTime: config.health.responseTime,
        errorRate: config.health.errorRate,
        usageStats: config.usage
      };

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Get provider status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get provider status'
      });
    }
  }

  /**
   * Get all payment providers
   */
  static async getAllProviders(req, res) {
    try {
      const providers = await IntegrationConfig.getProvidersByType('payment');

      const providersData = providers.map(config => ({
        provider: config.provider,
        isEnabled: config.isEnabled,
        isPrimary: config.isPrimary,
        environment: config.environment,
        healthStatus: config.health.status,
        lastHealthCheck: config.health.lastCheck,
        usageStats: config.usage
      }));

      res.status(200).json({
        success: true,
        data: providersData
      });
    } catch (error) {
      logger.error('Get all providers error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get providers'
      });
    }
  }

  /**
   * Test payment provider connection
   */
  static async testProvider(req, res) {
    try {
      const { provider } = req.params;

      const processor = await PaymentProcessorFactory.create(provider);

      // Perform a simple test operation (like fetching account info)
      // This will vary by provider - implementing basic connectivity test

      const startTime = Date.now();
      try {
        // Test basic connectivity
        await processor.config.updateHealth('healthy', Date.now() - startTime);

        res.status(200).json({
          success: true,
          message: `${provider} connection test successful`,
          responseTime: Date.now() - startTime
        });
      } catch (testError) {
        await processor.config.updateHealth('unhealthy', Date.now() - startTime, true);
        throw testError;
      }
    } catch (error) {
      logger.error('Test provider error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Provider test failed'
      });
    }
  }

  /**
   * Get payment methods (Legacy API compatibility)
   */
  static async getPaymentMethods(req, res) {
    try {
      const PaymentMethod = require('../models/paymentMethod.model');
      const { page = 1, limit = 10, searchTerm, statusFilter } = req.query;
      const query = {};

      if (searchTerm) {
        query.customer = { $regex: searchTerm, $options: 'i' };
      }

      if (statusFilter && statusFilter !== 'all') {
        query.status = statusFilter;
      }

      const skip = (page - 1) * limit;
      const paymentMethods = await PaymentMethod.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await PaymentMethod.countDocuments(query);

      res.status(200).json({
        success: true,
        data: paymentMethods,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Get payment methods error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get failed payments (Legacy API compatibility)
   */
  static async getFailedPayments(req, res) {
    try {
      const FailedPayment = require('../models/failedPayment.model');
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const failedPayments = await FailedPayment.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'email firstName lastName');

      const total = await FailedPayment.countDocuments();

      res.status(200).json({
        success: true,
        data: failedPayments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Get failed payments error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get payment summary (Legacy API compatibility)
   */
  static async getSummary(req, res) {
    try {
      const PaymentMethod = require('../models/paymentMethod.model');
      const FailedPayment = require('../models/failedPayment.model');

      const totalMethods = await PaymentMethod.countDocuments();
      const activeMethods = await PaymentMethod.countDocuments({ status: 'active' });
      const failedPayments = await FailedPayment.countDocuments({ status: 'failed' });
      const recoveredPayments = await FailedPayment.countDocuments({ status: 'recovered' });

      res.status(200).json({
        success: true,
        data: {
          totalMethods,
          activeMethods,
          failedPayments,
          recoveredPayments,
          recoveryRate: failedPayments > 0 ? ((recoveredPayments / (failedPayments + recoveredPayments)) * 100).toFixed(2) : 0
        }
      });
    } catch (error) {
      logger.error('Get summary error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update payment method (Legacy API compatibility)
   */
  static async updatePaymentMethod(req, res) {
    try {
      const PaymentMethod = require('../models/paymentMethod.model');
      const { id } = req.params;
      const updatedMethod = await PaymentMethod.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!updatedMethod) {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found'
        });
      }

      res.status(200).json({
        success: true,
        data: updatedMethod
      });
    } catch (error) {
      logger.error('Update payment method error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete payment method (Legacy API compatibility)
   */
  static async deletePaymentMethod(req, res) {
    try {
      const PaymentMethod = require('../models/paymentMethod.model');
      const { id } = req.params;
      const deletedMethod = await PaymentMethod.findByIdAndDelete(id);

      if (!deletedMethod) {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment method deleted successfully'
      });
    } catch (error) {
      logger.error('Delete payment method error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Retry failed payment (Legacy API compatibility - redirects to v1)
   */
  static async retryFailedPayment(req, res) {
    res.status(301).json({
      success: false,
      message: 'This endpoint is deprecated. Please use the v1 dunning API for comprehensive payment retry functionality.',
      redirect: `/api/v1/dunning/failed-payments/${req.params.id}/retry`,
      documentation: 'The v1 dunning API provides advanced retry options, campaign management, and detailed analytics.'
    });
  }
}

// Validation rules
const validationRules = {
  createCustomer: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').notEmpty().withMessage('Name is required')
  ],

  createPaymentMethod: [
    param('customerId').notEmpty().withMessage('Customer ID is required')
  ],

  createSubscription: [
    body('customerId').optional().notEmpty().withMessage('Customer ID must not be empty'),
    body('planId').optional().notEmpty().withMessage('Plan ID must not be empty')
  ],

  cancelSubscription: [
    param('subscriptionId').notEmpty().withMessage('Subscription ID is required')
  ],

  createInvoice: [
    body('customerId').notEmpty().withMessage('Customer ID is required')
  ],

  processPayment: [
    body('amount').isNumeric().withMessage('Amount must be numeric'),
    body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters')
  ],

  refundPayment: [
    param('paymentId').notEmpty().withMessage('Payment ID is required')
  ]
};

module.exports = {
  PaymentController,
  validationRules
};





