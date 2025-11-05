/**
 * Eagle Braintree Payment Processor Adapter
 * Handles Braintree payments with webhooks and idempotency
 */

const braintree = require('braintree');
const BasePaymentProcessor = require('./BasePaymentProcessor');
const crypto = require('crypto');

class BraintreePaymentProcessor extends BasePaymentProcessor {
  constructor(config) {
    super(config);
    
    this.gateway = new braintree.BraintreeGateway({
      environment: config.environment === 'production' 
        ? braintree.Environment.Production 
        : braintree.Environment.Sandbox,
      merchantId: config.merchantId,
      publicKey: config.publicKey,
      privateKey: config.privateKey
    });
    
    this.validateConfig();
  }

  getRequiredConfigFields() {
    return ['merchantId', 'publicKey', 'privateKey', 'environment'];
  }

  async createCustomer(customerData) {
    return this.executeWithErrorHandling('create_customer', async () => {
      const result = await this.gateway.customer.create({
        id: customerData.id || undefined, // Optional custom ID
        firstName: customerData.firstName || customerData.name?.split(' ')[0],
        lastName: customerData.lastName || customerData.name?.split(' ').slice(1).join(' '),
        email: customerData.email,
        phone: customerData.phone,
        customFields: customerData.metadata || {}
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to create customer');
      }

      return {
        id: result.customer.id,
        email: result.customer.email,
        firstName: result.customer.firstName,
        lastName: result.customer.lastName,
        created: result.customer.createdAt
      };
    });
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    return this.executeWithErrorHandling('create_payment_method', async () => {
      const result = await this.gateway.paymentMethod.create({
        customerId: customerId,
        paymentMethodNonce: paymentMethodData.nonce,
        options: {
          makeDefault: paymentMethodData.makeDefault || false,
          verifyCard: true
        }
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to create payment method');
      }

      const paymentMethod = result.paymentMethod;
      return {
        id: paymentMethod.token,
        type: paymentMethod.constructor.name.toLowerCase(),
        details: paymentMethod.maskedNumber || paymentMethod.email,
        created: paymentMethod.createdAt
      };
    });
  }

  async createPayment(paymentData) {
    return this.executeWithErrorHandling('create_payment', async () => {
      const transactionData = {
        amount: paymentData.amount.toFixed(2),
        paymentMethodNonce: paymentData.paymentMethodNonce || undefined,
        paymentMethodToken: paymentData.paymentMethodToken || undefined,
        customerId: paymentData.customerId,
        orderId: paymentData.orderId,
        customFields: paymentData.metadata || {},
        options: {
          submitForSettlement: paymentData.submitForSettlement !== false,
          storeInVaultOnSuccess: paymentData.storeInVault || false
        }
      };

      const result = await this.gateway.transaction.sale(transactionData);

      if (!result.success) {
        throw new Error(result.message || 'Transaction failed');
      }

      const transaction = result.transaction;
      return {
        id: transaction.id,
        status: transaction.status,
        amount: parseFloat(transaction.amount),
        currency: transaction.currencyIsoCode,
        created: transaction.createdAt,
        processorResponseCode: transaction.processorResponseCode,
        processorResponseText: transaction.processorResponseText
      };
    });
  }

  async createSubscription(subscriptionData) {
    return this.executeWithErrorHandling('create_subscription', async () => {
      // First create a plan if it doesn't exist
      let planId = subscriptionData.planId;
      
      if (!planId && subscriptionData.amount) {
        planId = `eagle-plan-${Date.now()}`;
        try {
          await this.gateway.plan.create({
            id: planId,
            merchantId: this.config.merchantId,
            name: subscriptionData.productName || 'Eagle Investors Subscription',
            price: subscriptionData.amount.toFixed(2),
            billingFrequency: 1,
            currencyIsoCode: subscriptionData.currency?.toUpperCase() || 'USD',
            billingCycle: subscriptionData.interval === 'year' ? 'month' : subscriptionData.interval || 'month'
          });
        } catch (error) {
          // Plan might already exist
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }

      const result = await this.gateway.subscription.create({
        paymentMethodToken: subscriptionData.paymentMethodToken,
        planId: planId,
        id: subscriptionData.id || undefined,
        price: subscriptionData.amount ? subscriptionData.amount.toFixed(2) : undefined,
        numberOfBillingCycles: subscriptionData.numberOfBillingCycles || undefined,
        neverExpires: subscriptionData.neverExpires !== false,
        trialDuration: subscriptionData.trialDays || undefined,
        trialDurationUnit: subscriptionData.trialDays ? 'day' : undefined
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to create subscription');
      }

      const subscription = result.subscription;
      return {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        price: parseFloat(subscription.price),
        nextBillingDate: subscription.nextBillingDate,
        numberOfBillingCycles: subscription.numberOfBillingCycles,
        createdAt: subscription.createdAt
      };
    });
  }

  async cancelSubscription(subscriptionId, reason) {
    return this.executeWithErrorHandling('cancel_subscription', async () => {
      const result = await this.gateway.subscription.cancel(subscriptionId);

      if (!result.success) {
        throw new Error(result.message || 'Failed to cancel subscription');
      }

      return {
        id: result.subscription.id,
        status: result.subscription.status,
        canceledAt: new Date()
      };
    });
  }

  async processRefund(paymentId, amount, reason) {
    return this.executeWithErrorHandling('process_refund', async () => {
      const refundAmount = amount ? amount.toFixed(2) : undefined;
      
      const result = await this.gateway.transaction.refund(paymentId, refundAmount);

      if (!result.success) {
        throw new Error(result.message || 'Refund failed');
      }

      const transaction = result.transaction;
      return {
        id: transaction.id,
        amount: parseFloat(transaction.amount),
        currency: transaction.currencyIsoCode,
        status: transaction.status,
        created: transaction.createdAt,
        originalTransactionId: paymentId
      };
    });
  }

  async verifyWebhookSignature(payload, signature, secret) {
    try {
      // Braintree uses a different verification method
      const webhookNotification = this.gateway.webhookNotification.parse(
        signature,
        payload
      );

      return { valid: true, notification: webhookNotification };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  async processWebhook(signature, payload) {
    return this.executeWithErrorHandling('process_webhook', async () => {
      const verification = await this.verifyWebhookSignature(payload, signature);
      
      if (!verification.valid) {
        throw new Error(`Webhook verification failed: ${verification.error}`);
      }

      const notification = verification.notification;
      
      // Process different event types
      const result = await this.handleWebhookNotification(notification);
      
      return {
        eventId: notification.timestamp,
        eventType: notification.kind,
        processed: true,
        result
      };
    });
  }

  async handleWebhookNotification(notification) {
    const { kind, subject } = notification;

    switch (kind) {
      case braintree.WebhookNotification.Kind.TransactionDisbursed:
        return await this.handleTransactionDisbursed(subject);
        
      case braintree.WebhookNotification.Kind.TransactionSettled:
        return await this.handleTransactionSettled(subject);
        
      case braintree.WebhookNotification.Kind.SubscriptionChargedSuccessfully:
        return await this.handleSubscriptionCharged(subject);
        
      case braintree.WebhookNotification.Kind.SubscriptionChargedUnsuccessfully:
        return await this.handleSubscriptionChargeFailed(subject);
        
      case braintree.WebhookNotification.Kind.SubscriptionCanceled:
        return await this.handleSubscriptionCanceled(subject);
        
      case braintree.WebhookNotification.Kind.SubscriptionExpired:
        return await this.handleSubscriptionExpired(subject);
        
      default:
        return { message: `Unhandled notification type: ${kind}` };
    }
  }

  async handleTransactionDisbursed(transaction) {
    return {
      type: 'payment.succeeded',
      paymentId: transaction.id,
      amount: parseFloat(transaction.amount),
      currency: transaction.currencyIsoCode,
      customerId: transaction.customerId
    };
  }

  async handleTransactionSettled(transaction) {
    return {
      type: 'payment.settled',
      paymentId: transaction.id,
      amount: parseFloat(transaction.amount),
      currency: transaction.currencyIsoCode,
      customerId: transaction.customerId
    };
  }

  async handleSubscriptionCharged(subscription) {
    return {
      type: 'subscription.charged',
      subscriptionId: subscription.id,
      amount: parseFloat(subscription.price),
      nextBillingDate: subscription.nextBillingDate
    };
  }

  async handleSubscriptionChargeFailed(subscription) {
    return {
      type: 'subscription.charge_failed',
      subscriptionId: subscription.id,
      amount: parseFloat(subscription.price),
      nextBillingDate: subscription.nextBillingDate
    };
  }

  async handleSubscriptionCanceled(subscription) {
    return {
      type: 'subscription.canceled',
      subscriptionId: subscription.id,
      canceledAt: new Date()
    };
  }

  async handleSubscriptionExpired(subscription) {
    return {
      type: 'subscription.expired',
      subscriptionId: subscription.id,
      expiredAt: new Date()
    };
  }

  // Override health check
  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      // Test API connectivity by searching for a non-existent customer
      try {
        await this.gateway.customer.find('test-connectivity-check');
      } catch (error) {
        // This should fail with "not found" which means API is working
        if (error.name === 'notFoundError') {
          return {
            status: 'healthy',
            provider: 'braintree',
            environment: this.config.environment,
            timestamp: new Date().toISOString()
          };
        }
        throw error;
      }
      
      // If we somehow found the test customer, that's still good
      return {
        status: 'healthy',
        provider: 'braintree',
        environment: this.config.environment,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = BraintreePaymentProcessor;