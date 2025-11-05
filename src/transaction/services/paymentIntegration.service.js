const Transaction = require('../models/transaction.model');

/**
 * Payment Integration Service
 * Helper functions to create transactions from payment processor responses
 */

class PaymentIntegrationService {
    /**
     * Create transaction from Stripe charge
     */
    async createTransactionFromStripeCharge(chargeData, additionalData = {}) {
        try {
            const transactionData = {
                userId: additionalData.userId,
                subscriptionId: additionalData.subscriptionId,
                invoiceId: additionalData.invoiceId,
                type: 'charge',
                status: this.mapStripeStatus(chargeData.status),

                amount: {
                    gross: chargeData.amount / 100, // Convert from cents
                    fee: chargeData.balance_transaction?.fee
                        ? chargeData.balance_transaction.fee / 100
                        : (chargeData.amount / 100) * 0.029 + 0.30,
                    net: 0, // Will be calculated
                    tax: additionalData.taxAmount || 0,
                    discount: additionalData.discountAmount || 0,
                },

                currency: (chargeData.currency || 'USD').toUpperCase(),

                psp: {
                    provider: 'stripe',
                    reference: {
                        chargeId: chargeData.id,
                        paymentIntentId: chargeData.payment_intent,
                        balanceTransactionId: chargeData.balance_transaction?.id,
                        customerId: chargeData.customer,
                    },
                    response: {
                        raw: chargeData,
                        statusCode: 200,
                        message: chargeData.outcome?.seller_message || 'Charge successful',
                    },
                },

                paymentMethod: {
                    type: chargeData.payment_method_details?.type === 'card' ? 'card' : 'other',
                    card: chargeData.payment_method_details?.card ? {
                        last4: chargeData.payment_method_details.card.last4,
                        brand: chargeData.payment_method_details.card.brand,
                        expMonth: chargeData.payment_method_details.card.exp_month,
                        expYear: chargeData.payment_method_details.card.exp_year,
                        fingerprint: chargeData.payment_method_details.card.fingerprint,
                        funding: chargeData.payment_method_details.card.funding,
                        country: chargeData.payment_method_details.card.country,
                    } : undefined,
                },

                billing: {
                    name: chargeData.billing_details?.name,
                    email: chargeData.billing_details?.email,
                    phone: chargeData.billing_details?.phone,
                    address: chargeData.billing_details?.address ? {
                        line1: chargeData.billing_details.address.line1,
                        line2: chargeData.billing_details.address.line2,
                        city: chargeData.billing_details.address.city,
                        state: chargeData.billing_details.address.state,
                        postalCode: chargeData.billing_details.address.postal_code,
                        country: chargeData.billing_details.address.country,
                    } : undefined,
                },

                timeline: {
                    initiatedAt: new Date(chargeData.created * 1000),
                    capturedAt: chargeData.captured ? new Date(chargeData.created * 1000) : undefined,
                },

                risk: chargeData.outcome ? {
                    level: chargeData.outcome.risk_level === 'elevated' ? 'high' : 'low',
                    score: chargeData.outcome.risk_score,
                } : undefined,

                customer: {
                    ipAddress: additionalData.ipAddress,
                    userAgent: additionalData.userAgent,
                },

                description: chargeData.description,

                metadata: additionalData.metadata || {},
            };

            const transaction = await Transaction.createCharge(transactionData);

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error creating transaction from Stripe charge:', error);
            throw error;
        }
    }

    /**
     * Create transaction from PayPal payment
     */
    async createTransactionFromPayPal(paypalData, additionalData = {}) {
        try {
            const transaction = paypalData.transactions?.[0];
            const amount = parseFloat(transaction?.amount?.total || 0);

            const transactionData = {
                userId: additionalData.userId,
                subscriptionId: additionalData.subscriptionId,
                invoiceId: additionalData.invoiceId,
                type: 'charge',
                status: this.mapPayPalStatus(paypalData.state),

                amount: {
                    gross: amount,
                    fee: 0, // Will be updated from capture
                    net: amount,
                    tax: additionalData.taxAmount || 0,
                    discount: additionalData.discountAmount || 0,
                },

                currency: transaction?.amount?.currency || 'USD',

                psp: {
                    provider: 'paypal',
                    reference: {
                        transactionId: paypalData.id,
                        orderId: paypalData.id,
                    },
                    response: {
                        raw: paypalData,
                        statusCode: 200,
                        message: `PayPal payment ${paypalData.state}`,
                    },
                },

                paymentMethod: {
                    type: 'paypal',
                    digital: {
                        email: paypalData.payer?.payer_info?.email,
                        accountId: paypalData.payer?.payer_info?.payer_id,
                    },
                },

                billing: {
                    name: paypalData.payer?.payer_info?.first_name
                        ? `${paypalData.payer.payer_info.first_name} ${paypalData.payer.payer_info.last_name}`
                        : undefined,
                    email: paypalData.payer?.payer_info?.email,
                },

                timeline: {
                    initiatedAt: new Date(paypalData.create_time),
                    capturedAt: paypalData.state === 'approved' ? new Date() : undefined,
                },

                customer: {
                    ipAddress: additionalData.ipAddress,
                    userAgent: additionalData.userAgent,
                },

                description: transaction?.description,

                metadata: additionalData.metadata || {},
            };

            const txn = await Transaction.createCharge(transactionData);

            return {
                success: true,
                transaction: txn,
            };
        } catch (error) {
            console.error('Error creating transaction from PayPal payment:', error);
            throw error;
        }
    }

    /**
     * Update transaction from webhook event
     */
    async updateTransactionFromWebhook(provider, eventData) {
        try {
            let transaction;

            if (provider === 'stripe') {
                // Find transaction by Stripe charge ID or payment intent
                const chargeId = eventData.data?.object?.id;
                transaction = await Transaction.findOne({
                    'psp.provider': 'stripe',
                    $or: [
                        { 'psp.reference.chargeId': chargeId },
                        { 'psp.reference.paymentIntentId': chargeId },
                    ],
                });
            } else if (provider === 'paypal') {
                // Find transaction by PayPal transaction ID
                const transactionId = eventData.resource?.id || eventData.id;
                transaction = await Transaction.findOne({
                    'psp.provider': 'paypal',
                    'psp.reference.transactionId': transactionId,
                });
            }

            if (!transaction) {
                console.log('Transaction not found for webhook event:', eventData);
                return {
                    success: false,
                    message: 'Transaction not found',
                };
            }

            // Add webhook event
            await transaction.addWebhookEvent({
                id: eventData.id,
                type: eventData.type,
                provider,
                data: eventData,
            });

            // Update transaction based on event type
            if (provider === 'stripe') {
                await this.handleStripeWebhook(transaction, eventData);
            } else if (provider === 'paypal') {
                await this.handlePayPalWebhook(transaction, eventData);
            }

            return {
                success: true,
                transaction,
            };
        } catch (error) {
            console.error('Error updating transaction from webhook:', error);
            throw error;
        }
    }

    /**
     * Handle Stripe webhook events
     */
    async handleStripeWebhook(transaction, eventData) {
        const eventType = eventData.type;
        const chargeData = eventData.data.object;

        switch (eventType) {
            case 'charge.succeeded':
                await transaction.markAsSucceeded({
                    chargeId: chargeData.id,
                    balanceTransactionId: chargeData.balance_transaction,
                    fee: chargeData.balance_transaction?.fee / 100,
                });
                break;

            case 'charge.failed':
                await transaction.markAsFailed({
                    code: chargeData.failure_code,
                    message: chargeData.failure_message,
                    declineCode: chargeData.outcome?.reason,
                });
                break;

            case 'charge.refunded':
                const refundAmount = chargeData.amount_refunded / 100;
                const refundData = chargeData.refunds?.data?.[0];

                if (refundData) {
                    await transaction.addRefund({
                        amount: refundAmount,
                        reason: refundData.reason || 'Refund',
                        pspRefundId: refundData.id,
                    });
                }
                break;

            case 'charge.dispute.created':
                await transaction.addDispute({
                    id: chargeData.dispute,
                    amount: chargeData.amount / 100,
                    reason: 'Dispute created',
                    status: 'needs_response',
                });
                break;
        }
    }

    /**
     * Handle PayPal webhook events
     */
    async handlePayPalWebhook(transaction, eventData) {
        const eventType = eventData.event_type;
        const resource = eventData.resource;

        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                await transaction.markAsSucceeded({
                    transactionId: resource.id,
                    fee: parseFloat(resource.seller_receivable_breakdown?.paypal_fee?.value || 0),
                });
                break;

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.DECLINED':
                await transaction.markAsFailed({
                    message: 'Payment declined by PayPal',
                });
                break;

            case 'PAYMENT.CAPTURE.REFUNDED':
                await transaction.addRefund({
                    amount: parseFloat(resource.amount?.value || 0),
                    reason: 'PayPal refund',
                    pspRefundId: resource.id,
                });
                break;
        }
    }

    /**
     * Map Stripe status to transaction status
     */
    mapStripeStatus(stripeStatus) {
        const statusMap = {
            'succeeded': 'succeeded',
            'pending': 'pending',
            'failed': 'failed',
        };
        return statusMap[stripeStatus] || 'pending';
    }

    /**
     * Map PayPal status to transaction status
     */
    mapPayPalStatus(paypalStatus) {
        const statusMap = {
            'approved': 'succeeded',
            'created': 'pending',
            'failed': 'failed',
            'canceled': 'canceled',
        };
        return statusMap[paypalStatus] || 'pending';
    }
}

module.exports = new PaymentIntegrationService();
