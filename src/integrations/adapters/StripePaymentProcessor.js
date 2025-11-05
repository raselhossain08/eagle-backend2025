/**
 * Eagle Stripe Payment Processor Adapter
 * Handles Stripe payments with webhooks and idempotency
 */

const Stripe = require('stripe');
const BasePaymentProcessor = require('./BasePaymentProcessor');
const crypto = require('crypto');

class StripePaymentProcessor extends BasePaymentProcessor {
  constructor(config) {
    super(config);
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2023-10-16',
      typescript: false
    });
    this.webhookSecret = config.webhookSecret;
    this.validateConfig();
  }

  getRequiredConfigFields() {
    return ['secretKey', 'publishableKey'];
  }

  async createCustomer(customerData) {
    return this.executeWithErrorHandling('create_customer', async () => {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        metadata: customerData.metadata || {}
      }, {
        idempotencyKey: this.generateIdempotencyKey(`customer_${customerData.email}`)
      });

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        created: customer.created,
        metadata: customer.metadata
      };
    });
  }

  async createPaymentMethod(customerId, paymentMethodData) {
    return this.executeWithErrorHandling('create_payment_method', async () => {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: paymentMethodData.type || 'card',
        card: paymentMethodData.card,
        billing_details: paymentMethodData.billingDetails
      });

      // Attach to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customerId
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card,
        created: paymentMethod.created
      };
    });
  }

  async createPayment(paymentData) {
    return this.executeWithErrorHandling('create_payment', async () => {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100), // Convert to cents
        currency: paymentData.currency || 'usd',
        customer: paymentData.customerId,
        payment_method: paymentData.paymentMethodId,
        confirmation_method: 'manual',
        confirm: paymentData.confirm || false,
        description: paymentData.description,
        metadata: {
          ...paymentData.metadata,
          orderId: paymentData.orderId,
          userId: paymentData.userId
        },
        receipt_email: paymentData.receiptEmail,
        statement_descriptor: 'EAGLE INVESTORS'
      }, {
        idempotencyKey: this.generateIdempotencyKey(`payment_${paymentData.orderId || Date.now()}`)
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        nextAction: paymentIntent.next_action
      };
    });
  }

  async createSubscription(subscriptionData) {
    return this.executeWithErrorHandling('create_subscription', async () => {
      // Create or retrieve price
      let priceId = subscriptionData.priceId;
      
      if (!priceId && subscriptionData.amount) {
        const price = await this.stripe.prices.create({
          currency: subscriptionData.currency || 'usd',
          unit_amount: Math.round(subscriptionData.amount * 100),
          recurring: {
            interval: subscriptionData.interval || 'month',
            interval_count: subscriptionData.intervalCount || 1
          },
          product_data: {
            name: subscriptionData.productName || 'Eagle Investors Subscription'
          }
        });
        priceId = price.id;
      }

      const subscription = await this.stripe.subscriptions.create({
        customer: subscriptionData.customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        trial_period_days: subscriptionData.trialDays,
        metadata: subscriptionData.metadata || {}
      });

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
        invoice: subscription.latest_invoice
      };
    });
  }

  async cancelSubscription(subscriptionId, reason) {
    return this.executeWithErrorHandling('cancel_subscription', async () => {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
        cancellation_details: {
          comment: reason
        }
      });

      return {
        id: subscription.id,
        status: subscription.status,
        canceledAt: subscription.canceled_at,
        cancellationDetails: subscription.cancellation_details
      };
    });
  }

  async processRefund(paymentId, amount, reason) {
    return this.executeWithErrorHandling('process_refund', async () => {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Full refund if amount not specified
        reason: reason || 'requested_by_customer',
        metadata: {
          reason: reason || 'Customer requested refund'
        }
      }, {
        idempotencyKey: this.generateIdempotencyKey(`refund_${paymentId}_${Date.now()}`)
      });

      return {
        id: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        created: refund.created
      };
    });
  }

  async verifyWebhookSignature(payload, signature, secret) {
    try {
      const webhookSecret = secret || this.webhookSecret;
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      // Stripe expects raw body, not parsed JSON
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      return { valid: true, event };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  async processWebhook(payload, signature) {
    return this.executeWithErrorHandling('process_webhook', async () => {
      const verification = await this.verifyWebhookSignature(payload, signature);
      
      if (!verification.valid) {
        throw new Error(`Webhook verification failed: ${verification.error}`);
      }

      const event = verification.event;
      
      // Process different event types
      const result = await this.handleWebhookEvent(event);
      
      return {
        eventId: event.id,
        eventType: event.type,
        processed: true,
        result
      };
    });
  }

  async handleWebhookEvent(event) {
    const { type, data } = event;
    const object = data.object;

    switch (type) {
      case 'payment_intent.succeeded':
        return await this.handlePaymentSucceeded(object);
        
      case 'payment_intent.payment_failed':
        return await this.handlePaymentFailed(object);
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return await this.handleSubscriptionUpdated(object);
        
      case 'customer.subscription.deleted':
        return await this.handleSubscriptionCanceled(object);
        
      case 'invoice.payment_succeeded':
        return await this.handleInvoicePaymentSucceeded(object);
        
      case 'invoice.payment_failed':
        return await this.handleInvoicePaymentFailed(object);
        
      default:
        return { message: `Unhandled event type: ${type}` };
    }
  }

  async handlePaymentSucceeded(paymentIntent) {
    // Emit webhook event for internal processing
    return {
      type: 'payment.succeeded',
      paymentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      customerId: paymentIntent.customer,
      metadata: paymentIntent.metadata
    };
  }

  async handlePaymentFailed(paymentIntent) {
    return {
      type: 'payment.failed',
      paymentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      customerId: paymentIntent.customer,
      error: paymentIntent.last_payment_error,
      metadata: paymentIntent.metadata
    };
  }

  async handleSubscriptionUpdated(subscription) {
    return {
      type: 'subscription.updated',
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      metadata: subscription.metadata
    };
  }

  async handleSubscriptionCanceled(subscription) {
    return {
      type: 'subscription.canceled',
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      canceledAt: subscription.canceled_at,
      cancellationDetails: subscription.cancellation_details
    };
  }

  async handleInvoicePaymentSucceeded(invoice) {
    return {
      type: 'invoice.paid',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
      amountPaid: invoice.amount_paid / 100,
      currency: invoice.currency
    };
  }

  async handleInvoicePaymentFailed(invoice) {
    return {
      type: 'invoice.payment_failed',
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
      amountDue: invoice.amount_due / 100,
      currency: invoice.currency,
      attemptCount: invoice.attempt_count
    };
  }

  // Override health check
  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      // Test API connectivity
      const balance = await this.stripe.balance.retrieve();
      
      return {
        status: 'healthy',
        provider: 'stripe',
        apiVersion: this.stripe.getApiField('version'),
        balanceAvailable: balance.available,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = StripePaymentProcessor;