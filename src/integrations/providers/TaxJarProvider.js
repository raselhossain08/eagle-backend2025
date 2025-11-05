/**
 * Eagle TaxJar Provider
 * Handles tax calculations through TaxJar API
 */

const BaseTaxProvider = require('./BaseTaxProvider');

class TaxJarProvider extends BaseTaxProvider {
  constructor(config) {
    super({ ...config, provider: 'taxjar' });
    this.apiKey = config.apiKey;
    this.environment = config.environment || 'production';
    this.client = null;
    
    this.validateConfig();
    this.initializeClient();
  }

  getRequiredConfigFields() {
    return ['apiKey'];
  }

  initializeClient() {
    try {
      // In a real implementation, you would import taxjar
      // const Taxjar = require('taxjar');
      // this.client = new Taxjar({
      //   apiKey: this.apiKey,
      //   apiUrl: this.environment === 'sandbox' ? Taxjar.SANDBOX_API_URL : Taxjar.DEFAULT_API_URL
      // });
      
      this.client = {
        taxForOrder: async (params) => {
          // Mock implementation for demonstration
          console.log(`[TaxJar] Mock tax calculation for order ${params.amount}`);
          
          const taxAmount = params.amount * 0.08; // 8% mock tax
          
          return {
            tax: {
              order_total_amount: params.amount,
              shipping: params.shipping || 0,
              taxable_amount: params.amount,
              amount_to_collect: taxAmount,
              rate: 0.08,
              has_nexus: true,
              freight_taxable: false,
              tax_source: 'destination',
              jurisdictions: {
                country: 'US',
                state: params.to_state || 'CA',
                county: 'LOS ANGELES',
                city: params.to_city || 'LOS ANGELES'
              },
              breakdown: {
                taxable_amount: params.amount,
                tax_collectable: taxAmount,
                combined_tax_rate: 0.08,
                state_taxable_amount: params.amount,
                state_tax_rate: 0.0725,
                state_tax_collectable: params.amount * 0.0725,
                county_taxable_amount: params.amount,
                county_tax_rate: 0.0075,
                county_tax_collectable: params.amount * 0.0075,
                city_taxable_amount: 0,
                city_tax_rate: 0,
                city_tax_collectable: 0,
                special_district_taxable_amount: 0,
                special_tax_rate: 0,
                special_district_tax_collectable: 0,
                line_items: params.line_items ? params.line_items.map((item, index) => ({
                  id: item.id || index.toString(),
                  taxable_amount: item.unit_price * item.quantity,
                  tax_collectable: (item.unit_price * item.quantity) * 0.08,
                  combined_tax_rate: 0.08,
                  state_taxable_amount: item.unit_price * item.quantity,
                  state_sales_tax_rate: 0.0725,
                  state_amount: (item.unit_price * item.quantity) * 0.0725,
                  county_taxable_amount: item.unit_price * item.quantity,
                  county_tax_rate: 0.0075,
                  county_amount: (item.unit_price * item.quantity) * 0.0075
                })) : []
              }
            }
          };
        },

        createOrder: async (params) => {
          console.log(`[TaxJar] Mock order creation for transaction ${params.transaction_id}`);
          
          return {
            order: {
              transaction_id: params.transaction_id,
              user_id: params.user_id,
              transaction_date: params.transaction_date,
              provider: 'api',
              from_country: params.from_country,
              from_zip: params.from_zip,
              from_state: params.from_state,
              from_city: params.from_city,
              from_street: params.from_street,
              to_country: params.to_country,
              to_zip: params.to_zip,
              to_state: params.to_state,
              to_city: params.to_city,
              to_street: params.to_street,
              amount: params.amount,
              shipping: params.shipping,
              sales_tax: params.sales_tax,
              line_items: params.line_items
            }
          };
        },

        updateOrder: async (transactionId, params) => {
          console.log(`[TaxJar] Mock order update for transaction ${transactionId}`);
          
          return {
            order: {
              transaction_id: transactionId,
              ...params
            }
          };
        },

        deleteOrder: async (transactionId) => {
          console.log(`[TaxJar] Mock order deletion for transaction ${transactionId}`);
          
          return {
            order: {
              transaction_id: transactionId,
              status: 'deleted'
            }
          };
        },

        createRefund: async (params) => {
          console.log(`[TaxJar] Mock refund creation for transaction ${params.transaction_id}`);
          
          return {
            refund: {
              transaction_id: params.transaction_id,
              user_id: params.user_id,
              provider: 'api',
              transaction_reference_id: params.transaction_reference_id,
              transaction_date: params.transaction_date,
              amount: params.amount,
              shipping: params.shipping,
              sales_tax: params.sales_tax
            }
          };
        },

        ratesForLocation: async (zip, params = {}) => {
          console.log(`[TaxJar] Mock rates lookup for ${zip}`);
          
          return {
            rate: {
              zip: zip,
              country: params.country || 'US',
              country_rate: '0.0',
              state: params.state || 'CA',
              state_rate: '0.0725',
              county: 'LOS ANGELES',
              county_rate: '0.0075',
              city: params.city || 'LOS ANGELES',
              city_rate: '0.0',
              combined_district_rate: '0.0',
              combined_rate: '0.08',
              freight_taxable: false
            }
          };
        },

        validateAddress: async (params) => {
          console.log(`[TaxJar] Mock address validation`);
          
          return {
            addresses: [{
              country: params.country,
              state: params.state,
              zip: params.zip,
              city: params.city,
              street: params.street
            }]
          };
        },

        categories: async () => {
          return {
            categories: [
              { name: 'Digital Goods', product_tax_code: '31000', description: 'Digital products' },
              { name: 'Clothing', product_tax_code: '20010', description: 'Clothing items' },
              { name: 'Food & Groceries', product_tax_code: '40030', description: 'Food items' },
              { name: 'Software', product_tax_code: '30070', description: 'Software products' }
            ]
          };
        },

        nexusRegions: async () => {
          return {
            regions: [
              { country_code: 'US', country: 'United States', region_code: 'CA', region: 'California' },
              { country_code: 'US', country: 'United States', region_code: 'NY', region: 'New York' },
              { country_code: 'US', country: 'United States', region_code: 'TX', region: 'Texas' }
            ]
          };
        }
      };
    } catch (error) {
      throw new Error(`Failed to initialize TaxJar client: ${error.message}`);
    }
  }

  async calculateTax(taxData) {
    const {
      amount,
      fromAddress,
      toAddress,
      shipping = 0,
      lineItems = [],
      customerExempt = false
    } = taxData;

    return this.executeWithErrorHandling('calculate_tax', async () => {
      this.validateTaxCalculationInput(taxData);

      const fromAddr = this.normalizeAddress(fromAddress);
      const toAddr = this.normalizeAddress(toAddress);

      const taxParams = {
        from_country: fromAddr.country,
        from_zip: fromAddr.postalCode,
        from_state: fromAddr.state,
        from_city: fromAddr.city,
        from_street: fromAddr.line1,
        to_country: toAddr.country,
        to_zip: toAddr.postalCode,
        to_state: toAddr.state,
        to_city: toAddr.city,
        to_street: toAddr.line1,
        amount: amount,
        shipping: shipping,
        customer_id: customerExempt ? 'exempt_customer' : undefined
      };

      // Add line items if provided
      if (lineItems.length > 0) {
        taxParams.line_items = lineItems.map((item, index) => ({
          id: item.id || index.toString(),
          quantity: item.quantity || 1,
          product_tax_code: item.taxCode || undefined,
          unit_price: item.unitPrice || item.amount,
          discount: item.discount || 0
        }));
      }

      const response = await this.client.taxForOrder(taxParams);
      const tax = response.tax;

      return {
        totalTax: tax.amount_to_collect,
        taxableAmount: tax.taxable_amount,
        rate: tax.rate,
        hasNexus: tax.has_nexus,
        taxSource: tax.tax_source,
        jurisdictions: tax.jurisdictions,
        breakdown: this.formatTaxJarBreakdown(tax.breakdown),
        provider: 'taxjar'
      };
    });
  }

  async createTransaction(transactionData) {
    const {
      transactionId,
      userId,
      transactionDate,
      fromAddress,
      toAddress,
      amount,
      shipping = 0,
      salesTax,
      lineItems = []
    } = transactionData;

    return this.executeWithErrorHandling('create_transaction', async () => {
      if (!transactionId) {
        throw new Error('Transaction ID is required');
      }

      const fromAddr = this.normalizeAddress(fromAddress);
      const toAddr = this.normalizeAddress(toAddress);

      const orderParams = {
        transaction_id: transactionId,
        user_id: userId || transactionId,
        transaction_date: transactionDate || new Date().toISOString().split('T')[0],
        from_country: fromAddr.country,
        from_zip: fromAddr.postalCode,
        from_state: fromAddr.state,
        from_city: fromAddr.city,
        from_street: fromAddr.line1,
        to_country: toAddr.country,
        to_zip: toAddr.postalCode,
        to_state: toAddr.state,
        to_city: toAddr.city,
        to_street: toAddr.line1,
        amount: amount,
        shipping: shipping,
        sales_tax: salesTax || (amount * 0.08)
      };

      if (lineItems.length > 0) {
        orderParams.line_items = lineItems.map((item, index) => ({
          id: item.id || index.toString(),
          quantity: item.quantity || 1,
          product_identifier: item.sku || item.id,
          description: item.description || 'Product',
          product_tax_code: item.taxCode,
          unit_price: item.unitPrice || item.amount,
          discount: item.discount || 0,
          sales_tax: item.salesTax || 0
        }));
      }

      const response = await this.client.createOrder(orderParams);

      return {
        transactionId: response.order.transaction_id,
        provider: 'taxjar',
        status: 'created',
        created: new Date().toISOString()
      };
    });
  }

  async commitTransaction(transactionId) {
    return this.executeWithErrorHandling('commit_transaction', async () => {
      // TaxJar orders are automatically committed upon creation
      // This is for compatibility with other providers
      
      return {
        transactionId: transactionId,
        status: 'committed',
        provider: 'taxjar',
        message: 'TaxJar transactions are automatically committed'
      };
    });
  }

  async voidTransaction(transactionId, refundAmount = null) {
    return this.executeWithErrorHandling('void_transaction', async () => {
      // In TaxJar, we create a refund to void a transaction
      if (refundAmount !== null) {
        const refundParams = {
          transaction_id: `refund_${transactionId}`,
          transaction_reference_id: transactionId,
          transaction_date: new Date().toISOString().split('T')[0],
          amount: refundAmount,
          shipping: 0,
          sales_tax: refundAmount * 0.08
        };

        const response = await this.client.createRefund(refundParams);
        
        return {
          transactionId: transactionId,
          refundId: response.refund.transaction_id,
          status: 'refunded',
          provider: 'taxjar'
        };
      } else {
        // Delete the order
        await this.client.deleteOrder(transactionId);
        
        return {
          transactionId: transactionId,
          status: 'voided',
          provider: 'taxjar'
        };
      }
    });
  }

  async validateAddress(address) {
    return this.executeWithErrorHandling('validate_address', async () => {
      this.validateAddressInput(address);
      
      const normalized = this.normalizeAddress(address);
      
      const validationParams = {
        country: normalized.country,
        state: normalized.state,
        zip: normalized.postalCode,
        city: normalized.city,
        street: normalized.line1
      };

      const response = await this.client.validateAddress(validationParams);
      const validatedAddress = response.addresses[0];

      return {
        valid: true,
        address: {
          line1: validatedAddress.street,
          city: validatedAddress.city,
          state: validatedAddress.state,
          postalCode: validatedAddress.zip,
          country: validatedAddress.country
        },
        provider: 'taxjar'
      };
    });
  }

  async getTaxRates(location) {
    return this.executeWithErrorHandling('get_tax_rates', async () => {
      const { postalCode, city, state, country = 'US' } = location;
      
      if (!postalCode) {
        throw new Error('Postal code is required for tax rate lookup');
      }

      const response = await this.client.ratesForLocation(postalCode, {
        city,
        state,
        country
      });

      const rate = response.rate;

      return {
        location: {
          postalCode: rate.zip,
          city: rate.city,
          state: rate.state,
          country: rate.country
        },
        rates: [
          {
            type: 'state',
            rate: parseFloat(rate.state_rate) * 100,
            jurisdiction: rate.state
          },
          {
            type: 'county',
            rate: parseFloat(rate.county_rate) * 100,
            jurisdiction: rate.county
          },
          {
            type: 'city',
            rate: parseFloat(rate.city_rate) * 100,
            jurisdiction: rate.city
          },
          {
            type: 'special',
            rate: parseFloat(rate.combined_district_rate) * 100,
            jurisdiction: 'Special District'
          }
        ].filter(r => r.rate > 0),
        combinedRate: parseFloat(rate.combined_rate) * 100,
        freightTaxable: rate.freight_taxable,
        provider: 'taxjar'
      };
    });
  }

  async getProductCategories() {
    return this.executeWithErrorHandling('get_categories', async () => {
      const response = await this.client.categories();
      
      return {
        categories: response.categories.map(cat => ({
          name: cat.name,
          code: cat.product_tax_code,
          description: cat.description
        })),
        provider: 'taxjar'
      };
    });
  }

  async getNexusRegions() {
    return this.executeWithErrorHandling('get_nexus_regions', async () => {
      const response = await this.client.nexusRegions();
      
      return {
        regions: response.regions.map(region => ({
          country: region.country,
          countryCode: region.country_code,
          region: region.region,
          regionCode: region.region_code
        })),
        provider: 'taxjar'
      };
    });
  }

  formatTaxJarBreakdown(breakdown) {
    const taxBreakdown = [];
    
    if (breakdown.state_tax_collectable > 0) {
      taxBreakdown.push({
        type: 'state',
        rate: breakdown.state_tax_rate * 100,
        amount: breakdown.state_tax_collectable,
        taxableAmount: breakdown.state_taxable_amount,
        jurisdiction: 'State'
      });
    }
    
    if (breakdown.county_tax_collectable > 0) {
      taxBreakdown.push({
        type: 'county',
        rate: breakdown.county_tax_rate * 100,
        amount: breakdown.county_tax_collectable,
        taxableAmount: breakdown.county_taxable_amount,
        jurisdiction: 'County'
      });
    }
    
    if (breakdown.city_tax_collectable > 0) {
      taxBreakdown.push({
        type: 'city',
        rate: breakdown.city_tax_rate * 100,
        amount: breakdown.city_tax_collectable,
        taxableAmount: breakdown.city_taxable_amount,
        jurisdiction: 'City'
      });
    }
    
    if (breakdown.special_district_tax_collectable > 0) {
      taxBreakdown.push({
        type: 'special',
        rate: breakdown.special_tax_rate * 100,
        amount: breakdown.special_district_tax_collectable,
        taxableAmount: breakdown.special_district_taxable_amount,
        jurisdiction: 'Special District'
      });
    }
    
    return taxBreakdown;
  }

  getSupportedCountries() {
    return ['US', 'CA', 'AU'];
  }

  getSupportedTaxTypes() {
    return ['sales_tax', 'use_tax', 'gst'];
  }

  getCertifications() {
    return [
      'CSA Certified',
      'Streamlined Sales Tax (SST)',
      'SOC 2 Type II'
    ];
  }

  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      // Test API connection with a simple rates lookup
      await this.client.ratesForLocation('90210');
      
      return {
        status: 'healthy',
        provider: 'taxjar',
        type: 'TAX',
        apiKey: this.apiKey ? 'configured' : 'missing',
        environment: this.environment,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = TaxJarProvider;