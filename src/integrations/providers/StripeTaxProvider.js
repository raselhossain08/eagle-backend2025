/**
 * Eagle Stripe Tax Provider
 * Handles tax calculations through Stripe Tax API
 */

const BaseTaxProvider = require('./BaseTaxProvider');

class StripeTaxProvider extends BaseTaxProvider {
  constructor(config) {
    super({ ...config, provider: 'stripe_tax' });
    this.apiKey = config.apiKey;
    this.client = null;
    
    this.validateConfig();
    this.initializeClient();
  }

  getRequiredConfigFields() {
    return ['apiKey'];
  }

  initializeClient() {
    try {
      // In a real implementation, you would import stripe
      // const stripe = require('stripe')(this.apiKey);
      // this.client = stripe;
      
      this.client = {
        tax: {
          calculations: {
            create: async (params) => {
              // Mock implementation for demonstration
              console.log(`[Stripe Tax] Mock tax calculation for ${params.currency} ${params.line_items[0]?.amount}`);
              
              const totalAmount = params.line_items.reduce((sum, item) => sum + item.amount, 0);
              const taxAmount = Math.round(totalAmount * 0.08); // 8% mock tax
              
              return {
                id: `taxcalc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                object: 'tax.calculation',
                currency: params.currency,
                customer_details: params.customer_details,
                line_items: {
                  object: 'list',
                  data: params.line_items.map((item, index) => ({
                    id: `li_${index}`,
                    object: 'tax.calculation_line_item',
                    amount: item.amount,
                    amount_tax: Math.round(item.amount * 0.08),
                    livemode: false,
                    product: item.reference,
                    quantity: 1,
                    tax_breakdown: [
                      {
                        amount: Math.round(item.amount * 0.08),
                        inclusive: false,
                        tax_rate_details: {
                          country: 'US',
                          percentage_decimal: '8.0',
                          state: 'CA',
                          tax_type: 'sales_tax'
                        }
                      }
                    ],
                    taxability_reason: 'standard_rated',
                    taxable_amount: item.amount
                  }))
                },
                shipping_cost: null,
                tax_amount_exclusive: taxAmount,
                tax_amount_inclusive: 0,
                tax_date: Math.floor(Date.now() / 1000)
              };
            }
          },
          transactions: {
            create: async (params) => {
              console.log(`[Stripe Tax] Mock transaction creation`);
              
              return {
                id: `tax_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                object: 'tax.transaction',
                created: Math.floor(Date.now() / 1000),
                currency: params.currency,
                customer_details: params.customer_details,
                line_items: params.line_items,
                livemode: false,
                metadata: params.metadata || {},
                reference: params.reference,
                reversal: null,
                shipping_cost: null,
                tax_date: Math.floor(Date.now() / 1000),
                type: 'transaction'
              };
            },
            
            createReversal: async (transactionId, params) => {
              console.log(`[Stripe Tax] Mock transaction reversal for ${transactionId}`);
              
              return {
                id: `tax_txn_rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                object: 'tax.transaction',
                created: Math.floor(Date.now() / 1000),
                currency: params.currency,
                livemode: false,
                metadata: params.metadata || {},
                reference: params.reference,
                reversal: {
                  original_transaction: transactionId
                },
                type: 'reversal'
              };
            }
          },
          settings: {
            retrieve: async () => {
              return {
                object: 'tax.settings',
                status: 'active',
                status_details: {
                  active: {
                    defaults: {
                      tax_behavior: 'exclusive',
                      tax_code: 'txcd_99999999'
                    }
                  }
                }
              };
            }
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to initialize Stripe Tax client: ${error.message}`);
    }
  }

  async calculateTax(taxData) {
    const {
      amount,
      currency = 'USD',
      fromAddress,
      toAddress,
      lineItems,
      customerDetails,
      shipping
    } = taxData;

    return this.executeWithErrorHandling('calculate_tax', async () => {
      this.validateTaxCalculationInput(taxData);

      // Prepare customer details
      const customer = {
        address: this.normalizeStripeAddress(toAddress),
        taxability_override: customerDetails?.taxExempt ? 'exempt' : 'taxable'
      };

      // Prepare line items
      const items = lineItems || [{
        amount: Math.round(amount * 100), // Convert to cents
        reference: 'default_item',
        tax_behavior: 'exclusive'
      }];

      const calculationParams = {
        currency: currency.toLowerCase(),
        customer_details: customer,
        line_items: items.map(item => ({
          amount: Math.round(item.amount * 100),
          reference: item.reference || item.id || 'item',
          tax_behavior: item.taxBehavior || 'exclusive',
          tax_code: item.taxCode || null
        }))
      };

      // Add shipping if provided
      if (shipping && shipping.amount > 0) {
        calculationParams.shipping_cost = {
          amount: Math.round(shipping.amount * 100),
          tax_behavior: shipping.taxBehavior || 'exclusive',
          tax_code: shipping.taxCode || 'txcd_92010001'
        };
      }

      const calculation = await this.client.tax.calculations.create(calculationParams);

      return {
        calculationId: calculation.id,
        totalTax: calculation.tax_amount_exclusive / 100,
        currency: calculation.currency.toUpperCase(),
        taxBreakdown: this.formatStripeLineItems(calculation.line_items.data),
        shippingTax: calculation.shipping_cost?.amount_tax ? 
          calculation.shipping_cost.amount_tax / 100 : 0,
        provider: 'stripe_tax',
        calculation: calculation
      };
    });
  }

  async createTransaction(transactionData) {
    const {
      reference,
      currency = 'USD',
      lineItems,
      customerDetails,
      metadata = {}
    } = transactionData;

    return this.executeWithErrorHandling('create_transaction', async () => {
      if (!reference) {
        throw new Error('Transaction reference is required');
      }

      const transactionParams = {
        currency: currency.toLowerCase(),
        reference: reference,
        customer_details: {
          address: this.normalizeStripeAddress(customerDetails.address),
          taxability_override: customerDetails?.taxExempt ? 'exempt' : 'taxable'
        },
        line_items: lineItems.map(item => ({
          amount: Math.round(item.amount * 100),
          reference: item.reference || item.id,
          quantity: item.quantity || 1,
          tax_behavior: item.taxBehavior || 'exclusive',
          tax_code: item.taxCode || null
        })),
        metadata: metadata
      };

      const transaction = await this.client.tax.transactions.create(transactionParams);

      return {
        transactionId: transaction.id,
        reference: transaction.reference,
        currency: transaction.currency.toUpperCase(),
        created: new Date(transaction.created * 1000).toISOString(),
        provider: 'stripe_tax'
      };
    });
  }

  async commitTransaction(transactionId) {
    return this.executeWithErrorHandling('commit_transaction', async () => {
      // Stripe Tax transactions are automatically committed upon creation
      // This is for compatibility with other providers
      
      return {
        transactionId: transactionId,
        status: 'committed',
        provider: 'stripe_tax',
        message: 'Stripe Tax transactions are automatically committed'
      };
    });
  }

  async voidTransaction(transactionId, reason = 'cancelled') {
    return this.executeWithErrorHandling('void_transaction', async () => {
      const reversal = await this.client.tax.transactions.createReversal(transactionId, {
        currency: 'usd', // This would normally come from the original transaction
        reference: `reversal_${transactionId}`,
        metadata: { reason: reason }
      });

      return {
        transactionId: transactionId,
        reversalId: reversal.id,
        status: 'voided',
        reason: reason,
        provider: 'stripe_tax'
      };
    });
  }

  async validateAddress(address) {
    return this.executeWithErrorHandling('validate_address', async () => {
      this.validateAddressInput(address);
      
      const normalized = this.normalizeAddress(address);
      
      // Stripe Tax doesn't have a dedicated address validation API
      // but we can perform basic validation
      const isValid = !!(normalized.city && normalized.postalCode && normalized.country);
      
      return {
        valid: isValid,
        address: normalized,
        provider: 'stripe_tax',
        message: isValid ? 'Address appears valid' : 'Address validation failed'
      };
    });
  }

  async getTaxRates(location) {
    return this.executeWithErrorHandling('get_tax_rates', async () => {
      const { city, state, postalCode, country = 'US' } = location;
      
      // Stripe Tax doesn't expose tax rates directly
      // This is a mock implementation
      const mockRates = [
        {
          type: 'sales_tax',
          rate: 8.0,
          jurisdiction: `${state}, ${country}`,
          description: `${state} Sales Tax`
        }
      ];
      
      if (city === 'San Francisco' && state === 'CA') {
        mockRates.push({
          type: 'local_tax',
          rate: 0.25,
          jurisdiction: `${city}, ${state}`,
          description: `${city} Local Tax`
        });
      }
      
      return {
        location: { city, state, postalCode, country },
        rates: mockRates,
        totalRate: mockRates.reduce((sum, rate) => sum + rate.rate, 0),
        provider: 'stripe_tax'
      };
    });
  }

  async getSettings() {
    return this.executeWithErrorHandling('get_settings', async () => {
      const settings = await this.client.tax.settings.retrieve();
      
      return {
        status: settings.status,
        defaults: settings.status_details?.active?.defaults || {},
        provider: 'stripe_tax'
      };
    });
  }

  normalizeStripeAddress(address) {
    const normalized = this.normalizeAddress(address);
    
    return {
      line1: normalized.line1,
      line2: normalized.line2 || null,
      city: normalized.city,
      state: normalized.state,
      postal_code: normalized.postalCode,
      country: normalized.country
    };
  }

  formatStripeLineItems(lineItems) {
    return lineItems.map(item => ({
      reference: item.product,
      amount: item.amount / 100,
      taxAmount: item.amount_tax / 100,
      taxableAmount: item.taxable_amount / 100,
      taxBreakdown: item.tax_breakdown.map(tax => ({
        type: tax.tax_rate_details.tax_type,
        rate: parseFloat(tax.tax_rate_details.percentage_decimal),
        amount: tax.amount / 100,
        jurisdiction: `${tax.tax_rate_details.state || ''}, ${tax.tax_rate_details.country}`.trim(),
        inclusive: tax.inclusive
      }))
    }));
  }

  getSupportedCountries() {
    return [
      'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE',
      'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'GR', 'PL'
    ];
  }

  getSupportedTaxTypes() {
    return ['sales_tax', 'use_tax', 'vat', 'gst', 'excise_tax'];
  }

  getCertifications() {
    return [
      'SOC 2 Type II',
      'PCI DSS Level 1',
      'SSAE 18 SOC 1 Type II',
      'ISO 27001'
    ];
  }

  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      const settings = await this.client.tax.settings.retrieve();
      
      return {
        status: 'healthy',
        provider: 'stripe_tax',
        type: 'TAX',
        apiKey: this.apiKey ? 'configured' : 'missing',
        taxSettings: settings.status,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = StripeTaxProvider;