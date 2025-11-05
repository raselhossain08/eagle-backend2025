const IntegrationConfig = require('../models/integrationConfig.model');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Base Payment Processor Adapter
 */
class BasePaymentProcessor {
  constructor(config) {
    this.config = config;
    this.provider = config.provider;
    this.credentials = config.getDecryptedCredentials();
    this.settings = config.settings;
  }

  // Abstract methods - must be implemented by subclasses
  async createCustomer(customerData) {
    throw new Error('createCustomer method must be implemented');
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    throw new Error('createPaymentMethod method must be implemented');
  }

  async createSubscription(subscriptionData) {
    throw new Error('createSubscription method must be implemented');
  }

  async cancelSubscription(subscriptionId, reason = '') {
    throw new Error('cancelSubscription method must be implemented');
  }

  async createInvoice(invoiceData) {
    throw new Error('createInvoice method must be implemented');
  }

  async processPayment(paymentData) {
    throw new Error('processPayment method must be implemented');
  }

  async refundPayment(paymentId, amount = null, reason = '') {
    throw new Error('refundPayment method must be implemented');
  }

  async verifyWebhook(payload, signature, secret) {
    throw new Error('verifyWebhook method must be implemented');
  }

  async handleWebhook(event) {
    throw new Error('handleWebhook method must be implemented');
  }

  // Common helper methods
  generateIdempotencyKey(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data) + Date.now().toString());
    return hash.digest('hex');
  }

  async logTransaction(transactionData) {
    logger.info(`Payment transaction logged for ${this.provider}:`, transactionData);
  }
}

/**
 * Stripe Payment Processor
 */
class StripeProcessor extends BasePaymentProcessor {
  constructor(config) {
    super(config);
    this.stripe = require('stripe')(this.credentials.secretKey);
  }

  async createCustomer(customerData) {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        metadata: customerData.metadata || {},
        idempotency_key: this.generateIdempotencyKey(customerData)
      });

      await this.config.updateHealth('healthy');
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        created: customer.created
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe customer creation failed: ${error.message}`);
    }
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: paymentMethodData.type,
        card: paymentMethodData.card,
        metadata: paymentMethodData.metadata || {}
      });

      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card,
        customerId
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe payment method creation failed: ${error.message}`);
    }
  }

  async createSubscription(subscriptionData) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: subscriptionData.customerId,
        items: subscriptionData.items,
        default_payment_method: subscriptionData.paymentMethodId,
        trial_period_days: subscriptionData.trialDays,
        metadata: subscriptionData.metadata || {},
        idempotency_key: this.generateIdempotencyKey(subscriptionData)
      });

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        customerId: subscription.customer
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe subscription creation failed: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId, reason = '') {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
        cancellation_details: {
          comment: reason
        }
      });

      return {
        id: subscription.id,
        status: subscription.status,
        canceledAt: subscription.canceled_at
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe subscription cancellation failed: ${error.message}`);
    }
  }

  async createInvoice(invoiceData) {
    try {
      const invoice = await this.stripe.invoices.create({
        customer: invoiceData.customerId,
        collection_method: invoiceData.collectionMethod || 'charge_automatically',
        auto_advance: invoiceData.autoAdvance !== false,
        metadata: invoiceData.metadata || {}
      });

      // Add line items
      if (invoiceData.items) {
        for (const item of invoiceData.items) {
          await this.stripe.invoiceItems.create({
            invoice: invoice.id,
            customer: invoiceData.customerId,
            amount: item.amount,
            currency: item.currency || 'usd',
            description: item.description
          });
        }
      }

      const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(invoice.id);

      return {
        id: finalizedInvoice.id,
        status: finalizedInvoice.status,
        total: finalizedInvoice.total,
        currency: finalizedInvoice.currency,
        hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe invoice creation failed: ${error.message}`);
    }
  }

  async processPayment(paymentData) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: paymentData.amount,
        currency: paymentData.currency || 'usd',
        customer: paymentData.customerId,
        payment_method: paymentData.paymentMethodId,
        confirm: true,
        metadata: paymentData.metadata || {},
        idempotency_key: this.generateIdempotencyKey(paymentData)
      });

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        receiptUrl: paymentIntent.charges?.data[0]?.receipt_url
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe payment processing failed: ${error.message}`);
    }
  }

  async refundPayment(paymentId, amount = null, reason = '') {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount,
        reason: reason || 'requested_by_customer'
      });

      return {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency,
        reason: refund.reason
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe refund failed: ${error.message}`);
    }
  }

  async verifyWebhook(payload, signature, secret) {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
      return event;
    } catch (error) {
      throw new Error(`Stripe webhook verification failed: ${error.message}`);
    }
  }

  async handleWebhook(event) {
    const startTime = Date.now();
    
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object);
          break;
        default:
          logger.info(`Unhandled Stripe webhook event: ${event.type}`);
      }

      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('healthy', responseTime);
      
      return { success: true, processed: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('degraded', responseTime, true);
      throw error;
    }
  }

  async handleSubscriptionUpdated(subscription) {
    // Emit internal event for subscription update
    const eventData = {
      provider: 'stripe',
      type: 'subscription.updated',
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end
    };
    
    // You can emit this to your event system
    logger.info('Subscription updated:', eventData);
  }

  async handleInvoicePaid(invoice) {
    const eventData = {
      provider: 'stripe',
      type: 'invoice.paid',
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_paid,
      currency: invoice.currency
    };
    
    logger.info('Invoice paid:', eventData);
  }

  async handleInvoicePaymentFailed(invoice) {
    const eventData = {
      provider: 'stripe',
      type: 'invoice.payment_failed',
      invoiceId: invoice.id,
      customerId: invoice.customer,
      amount: invoice.amount_due,
      currency: invoice.currency
    };
    
    logger.info('Invoice payment failed:', eventData);
  }

  async handleSubscriptionCanceled(subscription) {
    const eventData = {
      provider: 'stripe',
      type: 'subscription.canceled',
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      canceledAt: subscription.canceled_at
    };
    
    logger.info('Subscription canceled:', eventData);
  }
}

/**
 * Braintree Payment Processor
 */
class BraintreeProcessor extends BasePaymentProcessor {
  constructor(config) {
    super(config);
    this.braintree = require('braintree');
    this.gateway = new this.braintree.BraintreeGateway({
      environment: this.credentials.environment === 'production' 
        ? this.braintree.Environment.Production 
        : this.braintree.Environment.Sandbox,
      merchantId: this.credentials.merchantId,
      publicKey: this.credentials.publicKey,
      privateKey: this.credentials.privateKey
    });
  }

  async createCustomer(customerData) {
    try {
      const result = await this.gateway.customer.create({
        id: customerData.customerId || undefined,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        email: customerData.email,
        phone: customerData.phone
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      await this.config.updateHealth('healthy');
      return {
        id: result.customer.id,
        email: result.customer.email,
        firstName: result.customer.firstName,
        lastName: result.customer.lastName
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Braintree customer creation failed: ${error.message}`);
    }
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    try {
      const result = await this.gateway.paymentMethod.create({
        customerId: customerId,
        paymentMethodNonce: paymentMethodData.nonce,
        options: {
          makeDefault: paymentMethodData.makeDefault || false
        }
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        id: result.paymentMethod.token,
        type: result.paymentMethod.constructor.name.toLowerCase(),
        customerId: customerId
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Braintree payment method creation failed: ${error.message}`);
    }
  }

  async createSubscription(subscriptionData) {
    try {
      const result = await this.gateway.subscription.create({
        paymentMethodToken: subscriptionData.paymentMethodToken,
        planId: subscriptionData.planId,
        price: subscriptionData.price,
        numberOfBillingCycles: subscriptionData.billingCycles || undefined,
        trialDuration: subscriptionData.trialDuration || undefined,
        trialDurationUnit: subscriptionData.trialDurationUnit || undefined
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        id: result.subscription.id,
        status: result.subscription.status,
        price: result.subscription.price,
        nextBillingDate: result.subscription.nextBillingDate
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Braintree subscription creation failed: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId, reason = '') {
    try {
      const result = await this.gateway.subscription.cancel(subscriptionId);

      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        id: result.subscription.id,
        status: result.subscription.status
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Braintree subscription cancellation failed: ${error.message}`);
    }
  }

  async processPayment(paymentData) {
    try {
      const result = await this.gateway.transaction.sale({
        amount: paymentData.amount,
        paymentMethodNonce: paymentData.nonce || undefined,
        paymentMethodToken: paymentData.paymentMethodToken || undefined,
        customerId: paymentData.customerId || undefined,
        options: {
          submitForSettlement: true
        }
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        id: result.transaction.id,
        status: result.transaction.status,
        amount: result.transaction.amount,
        currency: result.transaction.currencyIsoCode
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Braintree payment processing failed: ${error.message}`);
    }
  }

  async refundPayment(transactionId, amount = null, reason = '') {
    try {
      const result = await this.gateway.transaction.refund(transactionId, amount);

      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        id: result.transaction.id,
        status: result.transaction.status,
        amount: result.transaction.amount,
        currency: result.transaction.currencyIsoCode
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Braintree refund failed: ${error.message}`);
    }
  }

  async verifyWebhook(payload, signature, secret) {
    try {
      const webhookNotification = this.gateway.webhookNotification.parse(
        signature,
        payload
      );
      return webhookNotification;
    } catch (error) {
      throw new Error(`Braintree webhook verification failed: ${error.message}`);
    }
  }

  async handleWebhook(notification) {
    const startTime = Date.now();
    
    try {
      switch (notification.kind) {
        case this.braintree.WebhookNotification.Kind.SubscriptionChargedSuccessfully:
          await this.handleSubscriptionCharged(notification.subscription);
          break;
        case this.braintree.WebhookNotification.Kind.SubscriptionCanceled:
          await this.handleSubscriptionCanceled(notification.subscription);
          break;
        default:
          logger.info(`Unhandled Braintree webhook: ${notification.kind}`);
      }

      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('healthy', responseTime);
      
      return { success: true, processed: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('degraded', responseTime, true);
      throw error;
    }
  }

  async handleSubscriptionCharged(subscription) {
    const eventData = {
      provider: 'braintree',
      type: 'subscription.charged',
      subscriptionId: subscription.id,
      status: subscription.status
    };
    
    logger.info('Subscription charged:', eventData);
  }

  async handleSubscriptionCanceled(subscription) {
    const eventData = {
      provider: 'braintree',
      type: 'subscription.canceled',
      subscriptionId: subscription.id,
      status: subscription.status
    };
    
    logger.info('Subscription canceled:', eventData);
  }
}

/**
 * Paddle Payment Processor
 */
class PaddleProcessor extends BasePaymentProcessor {
  constructor(config) {
    super(config);
    this.axios = require('axios');
    this.baseURL = this.credentials.environment === 'production' 
      ? 'https://vendors.paddle.com/api/2.0'
      : 'https://sandbox-vendors.paddle.com/api/2.0';
  }

  async makeRequest(endpoint, data = {}) {
    try {
      const response = await this.axios.post(`${this.baseURL}${endpoint}`, {
        vendor_id: this.credentials.vendorId,
        vendor_auth_code: this.credentials.vendorAuthCode,
        ...data
      });

      return response.data;
    } catch (error) {
      throw new Error(`Paddle API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async createCustomer(customerData) {
    // Paddle doesn't have a separate customer creation API
    // Customers are created during checkout/subscription creation
    return {
      id: `paddle_${Date.now()}`,
      email: customerData.email,
      name: customerData.name
    };
  }

  async createSubscription(subscriptionData) {
    try {
      const result = await this.makeRequest('/subscription/users', {
        plan_id: subscriptionData.planId,
        user_email: subscriptionData.userEmail,
        user_country: subscriptionData.userCountry || 'US',
        user_postcode: subscriptionData.userPostcode || '',
        trial_days: subscriptionData.trialDays || 0
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Subscription creation failed');
      }

      await this.config.updateHealth('healthy');
      return {
        id: result.response.subscription_id,
        status: result.response.state,
        nextPayment: result.response.next_payment
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Paddle subscription creation failed: ${error.message}`);
    }
  }

  async cancelSubscription(subscriptionId, reason = '') {
    try {
      const result = await this.makeRequest('/subscription/users_cancel', {
        subscription_id: subscriptionId
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Subscription cancellation failed');
      }

      return {
        id: subscriptionId,
        status: 'canceled'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Paddle subscription cancellation failed: ${error.message}`);
    }
  }

  async processPayment(paymentData) {
    // Paddle handles payments through checkout URLs
    // This method generates a checkout link
    try {
      const result = await this.makeRequest('/product/generate_pay_link', {
        product_id: paymentData.productId,
        prices: [`${paymentData.currency}:${paymentData.amount}`],
        customer_email: paymentData.customerEmail,
        customer_country: paymentData.customerCountry || 'US'
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Payment link generation failed');
      }

      return {
        checkoutUrl: result.response.url,
        productId: paymentData.productId
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Paddle payment processing failed: ${error.message}`);
    }
  }

  async refundPayment(orderId, amount = null, reason = '') {
    try {
      const result = await this.makeRequest('/payment/refund', {
        order_id: orderId,
        amount: amount,
        reason: reason
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Refund failed');
      }

      return {
        id: result.response.refund_request_id,
        status: 'pending',
        amount: amount
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Paddle refund failed: ${error.message}`);
    }
  }

  async verifyWebhook(payload, signature, secret) {
    try {
      const phpSerialize = require('php-serialize');
      const ksorted = {};
      
      // Parse and sort the payload
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      Object.keys(data).sort().forEach(key => {
        if (key !== 'p_signature') {
          ksorted[key] = data[key];
        }
      });

      // Create verification string
      const serialized = phpSerialize.serialize(ksorted);
      const hash = crypto.createHash('sha1').update(secret + serialized).digest('hex');

      if (hash !== data.p_signature) {
        throw new Error('Invalid signature');
      }

      return data;
    } catch (error) {
      throw new Error(`Paddle webhook verification failed: ${error.message}`);
    }
  }

  async handleWebhook(event) {
    const startTime = Date.now();
    
    try {
      switch (event.alert_name) {
        case 'subscription_created':
          await this.handleSubscriptionCreated(event);
          break;
        case 'subscription_updated':
          await this.handleSubscriptionUpdated(event);
          break;
        case 'subscription_cancelled':
          await this.handleSubscriptionCanceled(event);
          break;
        case 'subscription_payment_succeeded':
          await this.handleSubscriptionPaid(event);
          break;
        default:
          logger.info(`Unhandled Paddle webhook: ${event.alert_name}`);
      }

      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('healthy', responseTime);
      
      return { success: true, processed: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.config.updateHealth('degraded', responseTime, true);
      throw error;
    }
  }

  async handleSubscriptionCreated(event) {
    const eventData = {
      provider: 'paddle',
      type: 'subscription.created',
      subscriptionId: event.subscription_id,
      userEmail: event.email,
      planId: event.subscription_plan_id
    };
    
    logger.info('Subscription created:', eventData);
  }

  async handleSubscriptionUpdated(event) {
    const eventData = {
      provider: 'paddle',
      type: 'subscription.updated',
      subscriptionId: event.subscription_id,
      status: event.status
    };
    
    logger.info('Subscription updated:', eventData);
  }

  async handleSubscriptionCanceled(event) {
    const eventData = {
      provider: 'paddle',
      type: 'subscription.canceled',
      subscriptionId: event.subscription_id,
      cancelledFrom: event.cancelled_from
    };
    
    logger.info('Subscription canceled:', eventData);
  }

  async handleSubscriptionPaid(event) {
    const eventData = {
      provider: 'paddle',
      type: 'subscription.paid',
      subscriptionId: event.subscription_id,
      amount: event.sale_gross,
      currency: event.currency
    };
    
    logger.info('Subscription paid:', eventData);
  }
}

/**
 * Payment Processor Factory
 */
class PaymentProcessorFactory {
  static async create(providerName) {
    const config = await IntegrationConfig.getProviderByName('payment', providerName);
    if (!config || !config.isEnabled) {
      throw new Error(`Payment provider ${providerName} not found or not enabled`);
    }

    switch (providerName) {
      case 'stripe':
        return new StripeProcessor(config);
      case 'braintree':
        return new BraintreeProcessor(config);
      case 'paddle':
        return new PaddleProcessor(config);
      default:
        throw new Error(`Unsupported payment provider: ${providerName}`);
    }
  }

  static async getPrimaryProcessor() {
    const config = await IntegrationConfig.getPrimaryProvider('payment');
    if (!config) {
      throw new Error('No primary payment processor configured');
    }

    return await this.create(config.provider);
  }

  static getSupportedProviders() {
    return ['stripe', 'braintree', 'paddle'];
  }
}

module.exports = {
  BasePaymentProcessor,
  StripeProcessor,
  BraintreeProcessor,
  PaddleProcessor,
  PaymentProcessorFactory
};





