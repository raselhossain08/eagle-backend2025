const TaxService = require('../../payment/services/tax.service');
const TaxCalculationService = require('../../payment/services/taxCalculation.service');
const TaxRate = require('../../payment/models/taxRate.model');
const Transaction = require('../models/transaction.model');
const mongoose = require('mongoose');

/**
 * Transaction Tax Integration Service
 * Transaction  automatic tax calculation  integration
 */
class TransactionTaxService {

    constructor() {
        this.taxService = new TaxService();
        this.taxCalculationService = new TaxCalculationService();
    }

    /**
     * Transaction   tax calculate 
     * @param {Object} transactionData - Transaction data
     * @param {Object} userLocation - User billing address/location
     * @param {Object} businessLocation - Business address
     */
    async calculateTransactionTax(transactionData, userLocation, businessLocation) {
        try {
            console.log('🧮 Calculating tax for transaction...', {
                amount: transactionData.amount?.gross,
                userCountry: userLocation?.country,
                userState: userLocation?.state
            });

            
            const taxCalculationInput = {
                customerId: userLocation._id || new mongoose.Types.ObjectId(),
                amount: transactionData.amount?.gross || transactionData.amount || 0,
                currency: transactionData.currency || 'USD',
                billingAddress: {
                    country: userLocation.country || 'US',
                    state: userLocation.state || '',
                    city: userLocation.city || '',
                    postal_code: userLocation.postalCode || '',
                    address: userLocation.address || ''
                },
                lineItems: [{
                    id: '1',
                    amount: transactionData.amount?.gross || transactionData.amount || 0,
                    description: transactionData.description || 'Service charge',
                    product_type: this.getProductType(transactionData),
                    quantity: 1,
                    tax_code: 'TAXABLE_GOODS'
                }],
                transaction_type: transactionData.type || 'sale'
            };

            // Try tax calculation service first
            try {
                const taxResult = await this.taxCalculationService.calculateTax(taxCalculationInput);
                console.log('✅ Tax calculated successfully:', {
                    totalTax: taxResult.totalTax,
                    rate: taxResult.rate,
                    provider: taxResult.provider
                });
                return this.formatTaxResult(taxResult, transactionData);
            } catch (taxError) {
                console.log('Tax calculation error:', taxError.message);
                console.log('⚠️ Applying default tax rates...');

                // Fallback to manual calculation
                const defaultTaxResult = await this.calculateDefaultTax(
                    transactionData.amount?.gross || transactionData.amount || 0,
                    userLocation.country,
                    userLocation.state
                );

                console.log('📋 Default tax applied:', defaultTaxResult);
                return defaultTaxResult;
            }

        } catch (error) {
            console.error('❌ Tax calculation failed:', error);
            throw new Error(`Tax calculation failed: ${error.message}`);
        }
    }

    /**
     * Subscription payment   tax calculate 
     */
    async calculateSubscriptionTax(subscriptionData, userData, planData) {
        try {
            const userLocation = this.extractUserLocation(userData);
            const businessLocation = this.getBusinessLocation();

            const transactionData = {
                amount: {
                    gross: subscriptionData.amount || planData.price
                },
                currency: subscriptionData.currency || 'USD',
                type: 'subscription',
                description: `Subscription for ${planData.name || 'plan'}`,
                subscriptionId: subscriptionData._id,
                planId: planData._id
            };

            const taxResult = await this.calculateTransactionTax(
                transactionData,
                userLocation,
                businessLocation
            );

            console.log('💰 Subscription tax calculated:', {
                planName: planData.name,
                originalAmount: transactionData.amount.gross,
                taxAmount: taxResult.taxAmount,
                totalAmount: taxResult.totalAmount
            });

            return taxResult;

        } catch (error) {
            console.error('❌ Subscription tax calculation failed:', error);
            return this.applyDefaultTax(subscriptionData, userData);
        }
    }

    /**
     * One-time payment   tax calculate 
     */
    async calculateOneTimeTax(paymentData, userData, orderData = null) {
        try {
            const userLocation = this.extractUserLocation(userData);
            const businessLocation = this.getBusinessLocation();

            const transactionData = {
                amount: {
                    gross: paymentData.amount
                },
                currency: paymentData.currency || 'USD',
                type: 'one_time',
                description: orderData?.description || 'One-time payment',
                orderId: orderData?._id
            };

            const taxResult = await this.calculateTransactionTax(
                transactionData,
                userLocation,
                businessLocation
            );

            console.log('🛒 One-time payment tax calculated:', {
                amount: paymentData.amount,
                taxAmount: taxResult.taxAmount,
                totalAmount: taxResult.totalAmount
            });

            return taxResult;

        } catch (error) {
            console.error('❌ One-time payment tax calculation failed:', error);
            return this.applyDefaultTax(paymentData, userData);
        }
    }

    /**
     * Transaction update  tax information  
     */
    async updateTransactionWithTax(transactionId, taxData) {
        try {
            const transaction = await Transaction.findOne({ transactionId });
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            
            transaction.amount.tax = taxData.taxAmount;
            transaction.amount.net = transaction.amount.gross - transaction.amount.fee - taxData.taxAmount + (transaction.amount.discount || 0);

            
            transaction.metadata.set('taxCalculation', {
                provider: taxData.provider,
                rate: taxData.rate,
                jurisdiction: taxData.jurisdiction,
                calculatedAt: new Date(),
                taxableAmount: taxData.taxableAmount,
                exemptAmount: taxData.exemptAmount || 0
            });

            
            transaction.audit.changes.push({
                field: 'tax_calculated',
                newValue: taxData.taxAmount,
                changedAt: new Date(),
                changedBy: new mongoose.Types.ObjectId() // System ObjectId
            });

            await transaction.save();

            console.log('✅ Transaction updated with tax:', {
                transactionId,
                taxAmount: taxData.taxAmount,
                newNetAmount: transaction.amount.net
            });

            return transaction;

        } catch (error) {
            console.error('❌ Failed to update transaction with tax:', error);
            throw error;
        }
    }

    /**
     * Tax reporting   data collect 
     */
    async generateTaxReport(startDate, endDate, filters = {}) {
        try {
            const matchQuery = {
                'timeline.initiatedAt': {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                'amount.tax': { $gt: 0 } // Only transactions with tax
            };

            if (filters.country) {
                matchQuery['customer.location.country'] = filters.country;
            }

            if (filters.state) {
                matchQuery['customer.location.region'] = filters.state;
            }

            const taxReport = await Transaction.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: {
                            country: '$customer.location.country',
                            state: '$customer.location.region',
                            taxRate: '$metadata.taxCalculation.rate'
                        },
                        totalTransactions: { $sum: 1 },
                        totalGross: { $sum: '$amount.gross' },
                        totalTax: { $sum: '$amount.tax' },
                        totalNet: { $sum: '$amount.net' },
                        avgTaxRate: { $avg: '$metadata.taxCalculation.rate' }
                    }
                },
                {
                    $sort: {
                        '_id.country': 1,
                        '_id.state': 1
                    }
                }
            ]);

            console.log('📊 Tax report generated:', {
                period: `${startDate} to ${endDate}`,
                jurisdictions: taxReport.length,
                totalTransactions: taxReport.reduce((sum, item) => sum + item.totalTransactions, 0),
                totalTax: taxReport.reduce((sum, item) => sum + item.totalTax, 0)
            });

            return {
                period: { startDate, endDate },
                summary: {
                    totalJurisdictions: taxReport.length,
                    totalTransactions: taxReport.reduce((sum, item) => sum + item.totalTransactions, 0),
                    totalGross: taxReport.reduce((sum, item) => sum + item.totalGross, 0),
                    totalTax: taxReport.reduce((sum, item) => sum + item.totalTax, 0),
                    totalNet: taxReport.reduce((sum, item) => sum + item.totalNet, 0)
                },
                byJurisdiction: taxReport
            };

        } catch (error) {
            console.error('❌ Tax report generation failed:', error);
            throw error;
        }
    }

    // Helper Methods

    extractUserLocation(userData) {
        return {
            country: userData.country || userData.address?.country || 'US',
            state: userData.state || userData.address?.state || 'CA',
            city: userData.city || userData.address?.city || '',
            postalCode: userData.postalCode || userData.address?.postalCode || '',
            address: userData.address?.line1 || ''
        };
    }

    getBusinessLocation() {
        return {
            country: process.env.BUSINESS_COUNTRY || 'US',
            state: process.env.BUSINESS_STATE || 'CA',
            city: process.env.BUSINESS_CITY || 'San Francisco',
            postalCode: process.env.BUSINESS_POSTAL_CODE || '94102'
        };
    }

    getProductType(transactionData) {
        if (transactionData.subscriptionId) return 'subscription_service';
        if (transactionData.orderId) return 'digital_product';
        return 'service';
    }

    formatTaxResult(taxResult, transactionData) {
        const originalAmount = transactionData.amount?.gross || 0;
        const taxAmount = Math.round(taxResult.totalTax || 0);

        return {
            success: true,
            provider: taxResult.provider || 'internal',
            originalAmount,
            taxAmount,
            totalAmount: originalAmount + taxAmount,
            rate: taxResult.rate || 0,
            jurisdiction: taxResult.jurisdiction || 'Unknown',
            taxableAmount: taxResult.taxableAmount || originalAmount,
            exemptAmount: taxResult.exemptAmount || 0,
            breakdown: taxResult.breakdown || []
        };
    }

    async applyDefaultTax(transactionData, userData) {
        try {
            console.log('⚠️ Applying default tax rates...');

            const userCountry = userData.country || userData.address?.country || 'US';
            const userState = userData.state || userData.address?.state || 'CA';

            
            let taxRate = await TaxRate.findOne({
                country: userCountry,
                status: 'active'
            });

            
            if (!taxRate) {
                taxRate = {
                    rate: this.getDefaultTaxRate(userCountry, userState),
                    type: 'Sales Tax',
                    country: userCountry
                };
            }

            const originalAmount = transactionData.amount?.gross || transactionData.amount || 0;
            const taxAmount = Math.round(originalAmount * (taxRate.rate / 100));

            console.log('📋 Default tax applied:', {
                country: userCountry,
                rate: taxRate.rate,
                taxAmount
            });

            return {
                success: true,
                provider: 'default',
                originalAmount,
                taxAmount,
                totalAmount: originalAmount + taxAmount,
                rate: taxRate.rate,
                jurisdiction: `${userCountry}-${userState}`,
                taxableAmount: originalAmount,
                exemptAmount: 0,
                isDefault: true
            };

        } catch (error) {
            console.error('❌ Default tax application failed:', error);
            return {
                success: false,
                originalAmount: transactionData.amount?.gross || 0,
                taxAmount: 0,
                totalAmount: transactionData.amount?.gross || 0,
                rate: 0,
                error: error.message
            };
        }
    }

    getDefaultTaxRate(country, state) {
        const defaultRates = {
            'US': {
                'CA': 8.25,
                'NY': 8.0,
                'TX': 6.25,
                'FL': 6.0,
                'default': 7.0
            },
            'CA': 13.0, // Canada GST+PST average
            'GB': 20.0, // UK VAT
            'AU': 10.0, // Australia GST
            'DE': 19.0, // Germany VAT
            'FR': 20.0, // France VAT
            'default': 0.0
        };

        if (defaultRates[country]) {
            if (typeof defaultRates[country] === 'object') {
                return defaultRates[country][state] || defaultRates[country].default;
            }
            return defaultRates[country];
        }

        return defaultRates.default;
    }
}

module.exports = TransactionTaxService;
