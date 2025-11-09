const paymentTransactionService = require('../transaction/services/paymentTransaction.service');

/**
 * Payment Webhook Handlers
 * Payment providers থেকে আসা webhook গুলো handle করার জন্য
 */

/**
 * Stripe Webhook Handler
 */
exports.handleStripeWebhook = async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('⚠️ Stripe webhook signature verification failed:', err.message);
            return res.status(400).json({
                success: false,
                message: 'Webhook signature verification failed'
            });
        }

        console.log('🎯 Stripe webhook received:', event.type);

        // Transaction related events handle করি
        const transactionEvents = [
            'charge.succeeded',
            'charge.failed',
            'charge.dispute.created',
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
            'invoice.payment_succeeded',
            'invoice.payment_failed'
        ];

        if (transactionEvents.includes(event.type)) {
            const webhookData = {
                id: event.id,
                provider: 'stripe',
                eventType: event.type,
                data: event.data,
                created: event.created
            };

            try {
                const result = await paymentTransactionService.updateTransactionFromWebhook(webhookData);
                console.log('✅ Transaction updated from Stripe webhook:', result);
            } catch (error) {
                console.error('❌ Failed to update transaction from Stripe webhook:', error);
                // Log error but don't fail the webhook
            }
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
 * PayPal Webhook Handler  
 */
exports.handlePayPalWebhook = async (req, res) => {
    try {
        const webhookEvent = req.body;

        console.log('🎯 PayPal webhook received:', webhookEvent.event_type);

        // Transaction related events
        const transactionEvents = [
            'PAYMENT.CAPTURE.COMPLETED',
            'PAYMENT.CAPTURE.DECLINED',
            'PAYMENT.CAPTURE.REFUNDED',
            'CHECKOUT.ORDER.APPROVED',
            'CHECKOUT.ORDER.COMPLETED'
        ];

        if (transactionEvents.includes(webhookEvent.event_type)) {
            const webhookData = {
                id: webhookEvent.id,
                provider: 'paypal',
                eventType: webhookEvent.event_type,
                data: webhookEvent,
                created: new Date(webhookEvent.create_time)
            };

            try {
                const result = await paymentTransactionService.updateTransactionFromWebhook(webhookData);
                console.log('✅ Transaction updated from PayPal webhook:', result);
            } catch (error) {
                console.error('❌ Failed to update transaction from PayPal webhook:', error);
            }
        }

        res.status(200).json({
            success: true,
            message: 'PayPal webhook processed'
        });

    } catch (error) {
        console.error('❌ PayPal webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'PayPal webhook processing failed'
        });
    }
};

/**
 * Manual Transaction Creation (Admin)
 */
exports.createManualTransaction = async (req, res) => {
    try {
        const {
            userId,
            amount,
            currency = 'USD',
            type = 'charge',
            description,
            paymentMethod = 'manual',
            metadata
        } = req.body;

        // Validation
        if (!userId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'User ID and amount are required'
            });
        }

        // Mock payment data for manual transaction
        const paymentData = {
            provider: 'manual',
            amount: parseFloat(amount),
            currency,
            status: 'succeeded',
            paymentMethod: { type: paymentMethod },
            transactionId: `MANUAL_${Date.now()}`,
            responseMessage: 'Manual transaction created by admin'
        };

        // User data fetch করি
        const User = require('../user/models/user.model');
        const userData = await User.findById(userId);

        if (!userData) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const result = await paymentTransactionService.createOneTimeTransaction(
            paymentData,
            userData,
            null // No order data for manual transactions
        );

        // Add admin audit info
        result.transaction.audit = {
            createdBy: req.user._id,
            changes: [{
                field: 'created_manually',
                newValue: true,
                changedAt: new Date(),
                changedBy: req.user._id
            }]
        };

        if (metadata) {
            result.transaction.metadata.set('manualEntry', true);
            result.transaction.metadata.set('createdBy', req.user.email);
            Object.entries(metadata).forEach(([key, value]) => {
                result.transaction.metadata.set(key, value);
            });
        }

        await result.transaction.save();

        console.log('✅ Manual transaction created by admin:', {
            transactionId: result.transaction.transactionId,
            amount: result.transaction.amount.gross,
            createdBy: req.user.email
        });

        res.status(201).json({
            success: true,
            message: 'Manual transaction created successfully',
            transaction: result.transaction
        });

    } catch (error) {
        console.error('❌ Manual transaction creation failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create manual transaction',
            error: error.message
        });
    }
};

/**
 * Subscription Payment Success Handler
 * Subscription service থেকে call করার জন্য
 */
exports.handleSubscriptionPayment = async (paymentData, subscriptionData, userData) => {
    try {
        console.log('🔄 Processing subscription payment transaction...');

        const result = await paymentTransactionService.createSubscriptionTransaction(
            paymentData,
            subscriptionData,
            userData
        );

        return result;
    } catch (error) {
        console.error('❌ Subscription payment transaction failed:', error);
        throw error;
    }
};

/**
 * One-time Payment Success Handler
 */
exports.handleOneTimePayment = async (paymentData, userData, orderData = null) => {
    try {
        console.log('🔄 Processing one-time payment transaction...');

        const result = await paymentTransactionService.createOneTimeTransaction(
            paymentData,
            userData,
            orderData
        );

        return result;
    } catch (error) {
        console.error('❌ One-time payment transaction failed:', error);
        throw error;
    }
};