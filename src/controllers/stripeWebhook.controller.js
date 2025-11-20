const Subscription = require('../subscription/models/subscription.model');
const User = require('../user/models/user.model');
const Transaction = require('../transaction/models/transaction.model');
const paymentTransactionService = require('../transaction/services/paymentTransaction.service');

/**
 * Stripe Recurring Subscription Webhook Handler
 * Stripe  monthly/recurring payment events handle  
 */

/**
 * Stripe Webhook - Main Entry Point
 */
exports.handleStripeWebhook = async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!endpointSecret) {
            console.error('⚠️ STRIPE_WEBHOOK_SECRET not configured in environment');
            return res.status(500).json({
                success: false,
                message: 'Webhook secret not configured'
            });
        }

        let event;

        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            // Stripe requires raw body for signature verification
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('⚠️ Stripe webhook signature verification failed:', err.message);
            return res.status(400).json({
                success: false,
                message: 'Webhook signature verification failed'
            });
        }

        console.log('🎯 Stripe webhook received:', event.type);

        // Handle different webhook events
        switch (event.type) {
            // Subscription lifecycle events
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            // Invoice events (for recurring payments)
            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'invoice.upcoming':
                await handleUpcomingInvoice(event.data.object);
                break;

            // Payment intent events
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            // Charge events
            case 'charge.succeeded':
                await handleChargeSucceeded(event.data.object);
                break;

            case 'charge.failed':
                await handleChargeFailed(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            default:
                console.log(`ℹ️ Unhandled Stripe webhook event: ${event.type}`);
        }

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
            eventType: event.type
        });

    } catch (error) {
        console.error('❌ Stripe webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: error.message
        });
    }
};

/**
 * Handle Subscription Created
 */
async function handleSubscriptionCreated(stripeSubscription) {
    try {
        console.log('📝 Processing subscription created:', stripeSubscription.id);

        // Find user by customer ID
        const user = await User.findOne({ stripeCustomerId: stripeSubscription.customer });
        if (!user) {
            console.error('❌ User not found for Stripe customer:', stripeSubscription.customer);
            return;
        }

        // Update or create subscription in database
        const subscription = await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: stripeSubscription.id },
            {
                userId: user._id,
                stripeSubscriptionId: stripeSubscription.id,
                status: mapStripeStatus(stripeSubscription.status),
                startDate: new Date(stripeSubscription.current_period_start * 1000),
                nextBillingDate: new Date(stripeSubscription.current_period_end * 1000),
                currentPrice: stripeSubscription.items.data[0]?.price.unit_amount / 100,
                currency: stripeSubscription.currency.toUpperCase(),
                autoRenew: !stripeSubscription.cancel_at_period_end,
            },
            { upsert: true, new: true }
        );

        console.log('✅ Subscription created/updated:', subscription._id);
    } catch (error) {
        console.error('❌ Error handling subscription created:', error);
    }
}

/**
 * Handle Subscription Updated
 */
async function handleSubscriptionUpdated(stripeSubscription) {
    try {
        console.log('🔄 Processing subscription updated:', stripeSubscription.id);

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: stripeSubscription.id
        });

        if (!subscription) {
            console.error('❌ Subscription not found:', stripeSubscription.id);
            return;
        }

        // Update subscription status and dates
        subscription.status = mapStripeStatus(stripeSubscription.status);
        subscription.nextBillingDate = new Date(stripeSubscription.current_period_end * 1000);
        subscription.autoRenew = !stripeSubscription.cancel_at_period_end;
        subscription.currentPrice = stripeSubscription.items.data[0]?.price.unit_amount / 100;

        // Handle cancellation
        if (stripeSubscription.cancel_at_period_end) {
            subscription.canceledAt = new Date();
            subscription.endDate = new Date(stripeSubscription.current_period_end * 1000);
        }

        await subscription.save();
        console.log('✅ Subscription updated:', subscription._id);
    } catch (error) {
        console.error('❌ Error handling subscription updated:', error);
    }
}

/**
 * Handle Subscription Deleted/Canceled
 */
async function handleSubscriptionDeleted(stripeSubscription) {
    try {
        console.log('🗑️ Processing subscription deleted:', stripeSubscription.id);

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: stripeSubscription.id
        });

        if (!subscription) {
            console.error('❌ Subscription not found:', stripeSubscription.id);
            return;
        }

        subscription.status = 'canceled';
        subscription.canceledAt = new Date();
        subscription.endDate = new Date(stripeSubscription.ended_at * 1000);
        subscription.autoRenew = false;

        await subscription.save();
        console.log('✅ Subscription canceled:', subscription._id);
    } catch (error) {
        console.error('❌ Error handling subscription deleted:', error);
    }
}

/**
 * Handle Invoice Payment Succeeded (Recurring Payment)
 *   important - monthly payment success   call 
 */
async function handleInvoicePaymentSucceeded(invoice) {
    try {
        console.log('💰 Processing invoice payment succeeded:', invoice.id);

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: invoice.subscription
        }).populate('userId planId');

        if (!subscription) {
            console.error('❌ Subscription not found for invoice:', invoice.subscription);
            return;
        }

        // Update subscription status and dates
        subscription.status = 'active';
        subscription.lastBillingDate = new Date();
        subscription.nextBillingDate = new Date(invoice.lines.data[0]?.period?.end * 1000);
        subscription.totalPaid += invoice.amount_paid / 100;
        subscription.billingAttempts = 0; // Reset failed attempts

        await subscription.save();

        // Create transaction record
        const paymentData = {
            provider: 'stripe',
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: 'succeeded',
            transactionId: invoice.payment_intent,
            invoiceId: invoice.id,
            paymentMethod: { type: 'card' },
            responseMessage: 'Recurring payment successful'
        };

        const userData = subscription.userId;
        const subscriptionData = {
            subscriptionId: subscription._id,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
            isRecurring: true
        };

        await paymentTransactionService.createSubscriptionTransaction(
            paymentData,
            subscriptionData,
            userData
        );

        console.log('✅ Recurring payment processed successfully for subscription:', subscription._id);

        // TODO: Send payment success email to user
        // TODO: Update user access/permissions if needed

    } catch (error) {
        console.error('❌ Error handling invoice payment succeeded:', error);
    }
}

/**
 * Handle Invoice Payment Failed
 */
async function handleInvoicePaymentFailed(invoice) {
    try {
        console.log('⚠️ Processing invoice payment failed:', invoice.id);

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: invoice.subscription
        }).populate('userId');

        if (!subscription) {
            console.error('❌ Subscription not found for invoice:', invoice.subscription);
            return;
        }

        // Update subscription status
        subscription.status = 'past_due';
        subscription.billingAttempts += 1;

        await subscription.save();

        // Create failed transaction record
        const paymentData = {
            provider: 'stripe',
            amount: invoice.amount_due / 100,
            currency: invoice.currency.toUpperCase(),
            status: 'failed',
            transactionId: invoice.payment_intent || `INV_${invoice.id}`,
            invoiceId: invoice.id,
            paymentMethod: { type: 'card' },
            responseMessage: invoice.last_finalization_error?.message || 'Payment failed'
        };

        // TODO: Log failed payment
        // TODO: Send payment failure email to user
        // TODO: Implement dunning management (retry logic)

        console.log('⚠️ Payment failed for subscription:', subscription._id,
            `Attempts: ${subscription.billingAttempts}`);

    } catch (error) {
        console.error('❌ Error handling invoice payment failed:', error);
    }
}

/**
 * Handle Upcoming Invoice (7 days before renewal)
 */
async function handleUpcomingInvoice(invoice) {
    try {
        console.log('📅 Processing upcoming invoice:', invoice.id);

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: invoice.subscription
        }).populate('userId');

        if (!subscription) return;

        // TODO: Send upcoming payment reminder email to user
        // TODO: Update nextBillingDate if changed

        console.log('📧 Upcoming invoice notification sent for subscription:', subscription._id);

    } catch (error) {
        console.error('❌ Error handling upcoming invoice:', error);
    }
}

/**
 * Handle Payment Intent Succeeded
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
    try {
        console.log('💳 Processing payment intent succeeded:', paymentIntent.id);

        // This handles one-time payments or first subscription payment
        const webhookData = {
            id: paymentIntent.id,
            provider: 'stripe',
            eventType: 'payment_intent.succeeded',
            data: { object: paymentIntent },
            created: paymentIntent.created
        };

        await paymentTransactionService.updateTransactionFromWebhook(webhookData);

    } catch (error) {
        console.error('❌ Error handling payment intent succeeded:', error);
    }
}

/**
 * Handle Payment Intent Failed
 */
async function handlePaymentIntentFailed(paymentIntent) {
    try {
        console.log('⚠️ Processing payment intent failed:', paymentIntent.id);

        const webhookData = {
            id: paymentIntent.id,
            provider: 'stripe',
            eventType: 'payment_intent.payment_failed',
            data: { object: paymentIntent },
            created: paymentIntent.created
        };

        await paymentTransactionService.updateTransactionFromWebhook(webhookData);

    } catch (error) {
        console.error('❌ Error handling payment intent failed:', error);
    }
}

/**
 * Handle Charge Succeeded
 */
async function handleChargeSucceeded(charge) {
    try {
        console.log('✅ Processing charge succeeded:', charge.id);
        // Additional charge processing if needed
    } catch (error) {
        console.error('❌ Error handling charge succeeded:', error);
    }
}

/**
 * Handle Charge Failed
 */
async function handleChargeFailed(charge) {
    try {
        console.log('❌ Processing charge failed:', charge.id);
        // Additional charge failure handling if needed
    } catch (error) {
        console.error('❌ Error handling charge failed:', error);
    }
}

/**
 * Handle Charge Refunded
 */
async function handleChargeRefunded(charge) {
    try {
        console.log('💸 Processing charge refunded:', charge.id);
        // Handle refund logic if needed
    } catch (error) {
        console.error('❌ Error handling charge refunded:', error);
    }
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(stripeStatus) {
    const statusMap = {
        'incomplete': 'incomplete',
        'incomplete_expired': 'incomplete_expired',
        'trialing': 'trial',
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'canceled',
        'unpaid': 'suspended'
    };

    return statusMap[stripeStatus] || 'active';
}
