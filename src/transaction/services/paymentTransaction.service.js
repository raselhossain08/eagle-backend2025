const Transaction = require('../models/transaction.model');
const transactionService = require('./transaction.service');
const TransactionTaxService = require('./transactionTax.service');
const transactionTaxService = new TransactionTaxService();

/**
 * Payment Transaction Integration Service
 * 
 */
class PaymentTransactionService {

    /**
     * 
     * @param {Object} paymentData - Payment details
     * @param {Object} subscriptionData - Subscription details  
     * @param {Object} userdata - User details
     */
    async createSubscriptionTransaction(paymentData, subscriptionData, userData) {
        try {
            console.log('🔄 Creating subscription transaction...', {
                paymentProvider: paymentData.provider,
                amount: paymentData.amount,
                userId: userData._id
            });

            //
            let taxData = null;
            if (!paymentData.tax || paymentData.tax === 0) {
                try {
                    console.log('🧮 Calculating tax for subscription transaction...');
                    taxData = await transactionTaxService.calculateSubscriptionTax(
                        { amount: paymentData.amount, currency: paymentData.currency },
                        userData,
                        subscriptionData
                    );
                    console.log('✅ Tax calculated:', taxData);
                } catch (taxError) {
                    console.warn('⚠️ Tax calculation failed, proceeding without tax:', taxError.message);
                    taxData = { taxAmount: 0, success: false };
                }
            }

            const finalTaxAmount = paymentData.tax || taxData?.taxAmount || 0;
            const grossAmount = paymentData.amount || 0;
            const feeAmount = paymentData.fee || 0;
            const discountAmount = paymentData.discount || 0;

            const transactionData = {
                userId: userData._id,
                subscriptionId: subscriptionData._id,
                type: 'charge',
                status: this.mapPaymentStatusToTransaction(paymentData.status),
                amount: {
                    gross: grossAmount,
                    fee: feeAmount,
                    net: grossAmount - feeAmount - finalTaxAmount + discountAmount,
                    tax: finalTaxAmount,
                    discount: discountAmount
                },
                currency: paymentData.currency || 'USD',
                psp: {
                    provider: this.normalizeProvider(paymentData.provider),
                    reference: this.buildPspReference(paymentData),
                    response: {
                        raw: paymentData.pspResponse,
                        statusCode: paymentData.responseCode,
                        message: paymentData.responseMessage
                    }
                },
                paymentMethod: this.buildPaymentMethod(paymentData),
                billing: this.buildBillingData(userData, paymentData),
                customer: this.buildCustomerContext(paymentData),
                description: `Subscription payment for ${subscriptionData.planName || 'plan'}`,
                metadata: new Map([
                    ['subscriptionId', subscriptionData._id.toString()],
                    ['planId', subscriptionData.planId],
                    ['billingCycle', subscriptionData.billingCycle],
                    ['paymentProvider', paymentData.provider],
                    ...(taxData?.success ? [
                        ['taxProvider', taxData.provider],
                        ['taxRate', taxData.rate],
                        ['taxJurisdiction', taxData.jurisdiction],
                        ['taxCalculatedAt', new Date().toISOString()]
                    ] : [])
                ])
            };

            const result = await transactionService.createTransaction(transactionData);

            if (taxData?.success && result.success) {
                try {
                    await transactionTaxService.updateTransactionWithTax(
                        result.transaction.transactionId,
                        taxData
                    );
                    console.log('💰 Tax metadata added to transaction');
                } catch (error) {
                    console.warn('⚠️ Failed to add tax metadata:', error.message);
                }
            }

            console.log('✅ Subscription transaction created successfully:', {
                transactionId: result.transaction.transactionId,
                amount: result.transaction.amount.gross,
                status: result.transaction.status
            });

            return result;
        } catch (error) {
            console.error('❌ Failed to create subscription transaction:', error);
            throw new Error(`Transaction creation failed: ${error.message}`);
        }
    }

    /**
     * One-time payment থেকে transaction তৈরি করা
     */
    async createOneTimeTransaction(paymentData, userData, orderData = null) {
        try {
            console.log('🔄 Creating one-time transaction...', {
                paymentProvider: paymentData.provider,
                amount: paymentData.amount
            });

            // Tax calculation করি if not already calculated
            let taxData = null;
            if (!paymentData.tax || paymentData.tax === 0) {
                try {
                    console.log('🧮 Calculating tax for one-time transaction...');
                    taxData = await transactionTaxService.calculateOneTimeTax(
                        paymentData,
                        userData,
                        orderData
                    );
                    console.log('✅ Tax calculated:', taxData);
                } catch (taxError) {
                    console.warn('⚠️ Tax calculation failed, proceeding without tax:', taxError.message);
                    taxData = { taxAmount: 0, success: false };
                }
            }

            const finalTaxAmount = paymentData.tax || taxData?.taxAmount || 0;
            const grossAmount = paymentData.amount || 0;
            const feeAmount = paymentData.fee || 0;
            const discountAmount = paymentData.discount || 0;

            const transactionData = {
                userId: userData._id,
                orderId: orderData?._id || paymentData.orderId,
                type: 'charge',
                status: this.mapPaymentStatusToTransaction(paymentData.status),
                amount: {
                    gross: grossAmount,
                    fee: feeAmount,
                    net: grossAmount - feeAmount - finalTaxAmount + discountAmount,
                    tax: finalTaxAmount,
                    discount: discountAmount
                },
                currency: paymentData.currency || 'USD',
                psp: {
                    provider: this.normalizeProvider(paymentData.provider),
                    reference: this.buildPspReference(paymentData),
                    response: {
                        raw: paymentData.pspResponse,
                        statusCode: paymentData.responseCode,
                        message: paymentData.responseMessage
                    }
                },
                paymentMethod: this.buildPaymentMethod(paymentData),
                billing: this.buildBillingData(userData, paymentData),
                customer: this.buildCustomerContext(paymentData),
                description: orderData ? `Payment for order ${orderData.orderNumber}` : 'One-time payment',
                metadata: new Map([
                    ['paymentProvider', paymentData.provider],
                    ['orderType', 'one-time'],
                    ...(orderData ? [['orderId', orderData._id.toString()]] : [])
                ])
            };

            const result = await transactionService.createTransaction(transactionData);

            console.log('✅ One-time transaction created successfully:', {
                transactionId: result.transaction.transactionId
            });

            return result;
        } catch (error) {
            console.error('❌ Failed to create one-time transaction:', error);
            throw error;
        }
    }

    /**
     * Refund transaction তৈরি করা
     */
    async createRefundTransaction(originalTransactionId, refundData, adminUser) {
        try {
            console.log('🔄 Creating refund transaction...', {
                originalTransaction: originalTransactionId,
                refundAmount: refundData.amount
            });

            const originalTxn = await Transaction.findById(originalTransactionId);
            if (!originalTxn) {
                throw new Error('Original transaction not found');
            }

            const refundTransaction = await Transaction.createRefund(originalTransactionId, {
                amount: refundData.amount,
                reason: refundData.reason,
                psp: {
                    provider: originalTxn.psp.provider,
                    reference: {
                        refundId: refundData.pspRefundId,
                        parentChargeId: originalTxn.psp.reference.chargeId
                    },
                    response: {
                        raw: refundData.pspResponse,
                        message: refundData.reason
                    }
                },
                audit: {
                    createdBy: adminUser._id
                },
                metadata: new Map([
                    ['refundReason', refundData.reason],
                    ['refundedBy', adminUser.email],
                    ['originalTransactionId', originalTransactionId]
                ])
            });

            // Original transaction এ refund add করা
            await originalTxn.addRefund({
                amount: refundData.amount,
                reason: refundData.reason,
                refundedBy: adminUser._id,
                pspRefundId: refundData.pspRefundId
            });

            console.log('✅ Refund transaction created successfully');

            return {
                success: true,
                refundTransaction,
                originalTransaction: originalTxn
            };
        } catch (error) {
            console.error('❌ Failed to create refund transaction:', error);
            throw error;
        }
    }

    /**
     * Webhook থেকে transaction update করা
     */
    async updateTransactionFromWebhook(webhookData) {
        try {
            console.log('🔄 Updating transaction from webhook...', {
                provider: webhookData.provider,
                eventType: webhookData.eventType
            });

            // PSP reference দিয়ে transaction খুঁজি
            const transaction = await this.findTransactionByWebhookData(webhookData);

            if (!transaction) {
                console.log('⚠️ No matching transaction found for webhook');
                return { success: false, message: 'Transaction not found' };
            }

            // Webhook event add করি
            await transaction.addWebhookEvent({
                id: webhookData.id,
                type: webhookData.eventType,
                provider: webhookData.provider,
                data: webhookData.data
            });

            // Status update করি webhook event অনুযায়ী
            await this.updateTransactionStatus(transaction, webhookData);

            console.log('✅ Transaction updated from webhook successfully');

            return { success: true, transaction };
        } catch (error) {
            console.error('❌ Failed to update transaction from webhook:', error);
            throw error;
        }
    }

    /**
     * Helper Methods
     */

    mapPaymentStatusToTransaction(paymentStatus) {
        const statusMap = {
            'pending': 'pending',
            'processing': 'processing',
            'succeeded': 'succeeded',
            'completed': 'succeeded',
            'failed': 'failed',
            'canceled': 'canceled',
            'cancelled': 'canceled',
            'refunded': 'refunded',
            'partially_refunded': 'partially_refunded'
        };

        return statusMap[paymentStatus] || 'pending';
    }

    normalizeProvider(provider) {
        const providerMap = {
            'stripe': 'stripe',
            'paypal': 'paypal',
            'braintree': 'braintree',
            'square': 'square',
            'manual': 'manual'
        };

        return providerMap[provider?.toLowerCase()] || 'other';
    }

    buildPspReference(paymentData) {
        const reference = {};

        if (paymentData.paymentIntentId) reference.paymentIntentId = paymentData.paymentIntentId;
        if (paymentData.chargeId) reference.chargeId = paymentData.chargeId;
        if (paymentData.transactionId) reference.transactionId = paymentData.transactionId;
        if (paymentData.balanceTransactionId) reference.balanceTransactionId = paymentData.balanceTransactionId;
        if (paymentData.customerId) reference.customerId = paymentData.customerId;
        if (paymentData.orderId) reference.orderId = paymentData.orderId;

        return reference;
    }

    buildPaymentMethod(paymentData) {
        const method = {
            type: paymentData.paymentMethod?.type || 'card'
        };

        if (paymentData.paymentMethod?.card) {
            method.card = {
                last4: paymentData.paymentMethod.card.last4,
                brand: paymentData.paymentMethod.card.brand,
                expMonth: paymentData.paymentMethod.card.exp_month,
                expYear: paymentData.paymentMethod.card.exp_year,
                fingerprint: paymentData.paymentMethod.card.fingerprint,
                funding: paymentData.paymentMethod.card.funding,
                country: paymentData.paymentMethod.card.country
            };
        }

        return method;
    }

    buildBillingData(userData, paymentData) {
        return {
            name: userData.name || `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            phone: userData.phone,
            address: paymentData.billingAddress || userData.address
        };
    }

    buildCustomerContext(paymentData) {
        return {
            ipAddress: paymentData.customerIp,
            userAgent: paymentData.userAgent,
            deviceFingerprint: paymentData.deviceFingerprint,
            location: paymentData.location
        };
    }

    async findTransactionByWebhookData(webhookData) {
        const provider = this.normalizeProvider(webhookData.provider);

        // Different providers have different reference fields
        let query = { 'psp.provider': provider };

        if (provider === 'stripe' && webhookData.data?.object) {
            const obj = webhookData.data.object;
            query.$or = [
                { 'psp.reference.chargeId': obj.id },
                { 'psp.reference.paymentIntentId': obj.payment_intent },
                { 'psp.reference.balanceTransactionId': obj.balance_transaction }
            ];
        } else if (provider === 'paypal' && webhookData.data?.resource) {
            const resource = webhookData.data.resource;
            query.$or = [
                { 'psp.reference.transactionId': resource.id },
                { 'psp.reference.orderId': resource.parent_payment }
            ];
        }

        return await Transaction.findOne(query);
    }

    async updateTransactionStatus(transaction, webhookData) {
        const eventType = webhookData.eventType;

        // Stripe events
        if (webhookData.provider === 'stripe') {
            switch (eventType) {
                case 'charge.succeeded':
                    await transaction.markAsSucceeded(webhookData.data.object);
                    break;
                case 'charge.failed':
                    await transaction.markAsFailed({
                        code: webhookData.data.object.failure_code,
                        message: webhookData.data.object.failure_message,
                        reason: webhookData.data.object.outcome?.reason
                    });
                    break;
                case 'charge.dispute.created':
                    await transaction.addDispute(webhookData.data.object);
                    break;
            }
        }

        // PayPal events
        if (webhookData.provider === 'paypal') {
            switch (eventType) {
                case 'PAYMENT.CAPTURE.COMPLETED':
                    await transaction.markAsSucceeded();
                    break;
                case 'PAYMENT.CAPTURE.DECLINED':
                    await transaction.markAsFailed({
                        message: 'Payment declined by PayPal'
                    });
                    break;
            }
        }
    }
}

module.exports = PaymentTransactionService;