const IntegrationConfig = require('../models/integrationConfig.model');
const { logger } = require('../utils/logger');

/**
 * Base Tax Provider
 */
class BaseTaxProvider {
  constructor(config) {
    this.config = config;
    this.provider = config.provider;
    this.credentials = config.getDecryptedCredentials();
    this.settings = config.settings;
  }

  // Abstract methods - must be implemented by subclasses
  async calculateTax(taxCalculationData) {
    throw new Error('calculateTax method must be implemented');
  }

  async validateTaxNumber(taxNumber, country) {
    throw new Error('validateTaxNumber method must be implemented');
  }

  async getTaxRates(location) {
    throw new Error('getTaxRates method must be implemented');
  }

  async createTransaction(transactionData) {
    throw new Error('createTransaction method must be implemented');
  }

  async voidTransaction(transactionId) {
    throw new Error('voidTransaction method must be implemented');
  }

  async getComplianceReport(reportParams) {
    throw new Error('getComplianceReport method must be implemented');
  }

  // Common helper methods
  validateAddress(address) {
    const required = ['line1', 'city', 'country'];
    return required.every(field => address[field]);
  }

  normalizeCountryCode(country) {
    return country.toUpperCase();
  }

  async logTaxCalculation(calculationData) {
    logger.info(`Tax calculation logged for ${this.provider}:`, calculationData);
  }
}

/**
 * Stripe Tax Provider
 */
class StripeTaxProvider extends BaseTaxProvider {
  constructor(config) {
    super(config);
    this.stripe = require('stripe')(this.credentials.secretKey);
  }

  async calculateTax(taxCalculationData) {
    try {
      const {
        currency,
        lineItems,
        customerDetails,
        shippingCost = null,
        taxBehavior = 'exclusive'
      } = taxCalculationData;

      // Prepare line items for Stripe
      const stripeLineItems = lineItems.map(item => ({
        amount: item.amount,
        reference: item.reference || item.id,
        tax_behavior: taxBehavior,
        tax_code: item.taxCode || 'txcd_99999999' // General products
      }));

      // Add shipping if provided
      if (shippingCost) {
        stripeLineItems.push({
          amount: shippingCost.amount,
          reference: 'shipping',
          tax_behavior: taxBehavior,
          tax_code: 'txcd_92010001' // Shipping
        });
      }

      const calculation = await this.stripe.tax.calculations.create({
        currency: currency.toLowerCase(),
        line_items: stripeLineItems,
        customer_details: {
          address: {
            line1: customerDetails.address.line1,
            line2: customerDetails.address.line2 || null,
            city: customerDetails.address.city,
            state: customerDetails.address.state || null,
            postal_code: customerDetails.address.postalCode || null,
            country: customerDetails.address.country
          },
          address_source: 'shipping'
        },
        expand: ['line_items']
      });

      await this.config.updateHealth('healthy');
      
      return {
        provider: 'stripe',
        calculationId: calculation.id,
        totalTax: calculation.tax_amount_exclusive,
        currency: calculation.currency,
        taxBreakdown: calculation.tax_breakdown.map(breakdown => ({
          jurisdiction: breakdown.jurisdiction.display_name,
          rate: breakdown.tax_rate_details.percentage_decimal,
          amount: breakdown.tax_amount,
          type: breakdown.tax_rate_details.tax_type
        })),
        lineItems: calculation.line_items.data.map(item => ({
          reference: item.reference,
          amount: item.amount,
          taxAmount: item.amount_tax
        }))
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe tax calculation failed: ${error.message}`);
    }
  }

  async validateTaxNumber(taxNumber, country) {
    try {
      // Stripe doesn't have a dedicated tax number validation API
      // This would typically be done through their Tax ID collection
      const validation = await this.stripe.tax.registrations.list({
        status: 'active'
      });

      // For demonstration, we'll return a basic validation
      return {
        isValid: true,
        taxNumber: taxNumber,
        country: country,
        provider: 'stripe',
        validationType: 'format' // Stripe handles this internally
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe tax number validation failed: ${error.message}`);
    }
  }

  async getTaxRates(location) {
    try {
      // Stripe doesn't expose tax rates directly, but we can get them through calculation
      const testCalculation = await this.stripe.tax.calculations.create({
        currency: 'usd',
        line_items: [{
          amount: 1000, // $10.00 test amount
          reference: 'test',
          tax_behavior: 'exclusive'
        }],
        customer_details: {
          address: {
            line1: location.line1 || '123 Test St',
            city: location.city,
            state: location.state || null,
            postal_code: location.postalCode || null,
            country: location.country
          },
          address_source: 'shipping'
        }
      });

      const rates = testCalculation.tax_breakdown.map(breakdown => ({
        jurisdiction: breakdown.jurisdiction.display_name,
        rate: breakdown.tax_rate_details.percentage_decimal,
        type: breakdown.tax_rate_details.tax_type,
        level: breakdown.jurisdiction.level
      }));

      return {
        provider: 'stripe',
        location: location,
        rates: rates
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe tax rates lookup failed: ${error.message}`);
    }
  }

  async createTransaction(transactionData) {
    try {
      const transaction = await this.stripe.tax.transactions.create({
        currency: transactionData.currency,
        line_items: transactionData.lineItems.map(item => ({
          amount: item.amount,
          amount_tax: item.taxAmount,
          reference: item.reference,
          tax_behavior: 'exclusive'
        })),
        customer_details: {
          address: transactionData.customerDetails.address,
          address_source: 'shipping'
        },
        reference: transactionData.reference,
        metadata: transactionData.metadata || {}
      });

      return {
        provider: 'stripe',
        transactionId: transaction.id,
        reference: transaction.reference,
        status: 'created'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe transaction creation failed: ${error.message}`);
    }
  }

  async voidTransaction(transactionId) {
    try {
      const transaction = await this.stripe.tax.transactions.retrieve(transactionId);
      
      // Create reversal transaction
      const reversal = await this.stripe.tax.transactions.create({
        currency: transaction.currency,
        line_items: transaction.line_items.map(item => ({
          amount: -item.amount,
          amount_tax: -item.amount_tax,
          reference: item.reference,
          tax_behavior: 'exclusive'
        })),
        reference: `reversal-${transaction.reference}`,
        original_transaction: transactionId
      });

      return {
        provider: 'stripe',
        transactionId: transactionId,
        reversalId: reversal.id,
        status: 'voided'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe transaction void failed: ${error.message}`);
    }
  }

  async getComplianceReport(reportParams) {
    try {
      const { startDate, endDate, country = null } = reportParams;

      // Stripe doesn't have a direct compliance report API
      // This would typically be handled through their dashboard or custom implementation
      return {
        provider: 'stripe',
        reportType: 'compliance',
        period: { startDate, endDate },
        country: country,
        message: 'Compliance reports are available through Stripe Dashboard'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Stripe compliance report failed: ${error.message}`);
    }
  }
}

/**
 * TaxJar Provider
 */
class TaxJarProvider extends BaseTaxProvider {
  constructor(config) {
    super(config);
    this.Taxjar = require('taxjar');
    this.client = new this.Taxjar({
      apiKey: this.credentials.apiKey,
      apiUrl: this.credentials.environment === 'production' 
        ? 'https://api.taxjar.com'
        : 'https://api.sandbox.taxjar.com'
    });
  }

  async calculateTax(taxCalculationData) {
    try {
      const {
        fromAddress,
        toAddress,
        amount,
        shipping = 0,
        lineItems = []
      } = taxCalculationData;

      const taxParams = {
        from_country: fromAddress.country,
        from_zip: fromAddress.postalCode,
        from_state: fromAddress.state,
        from_city: fromAddress.city,
        from_street: fromAddress.line1,
        to_country: toAddress.country,
        to_zip: toAddress.postalCode,
        to_state: toAddress.state,
        to_city: toAddress.city,
        to_street: toAddress.line1,
        amount: amount,
        shipping: shipping,
        line_items: lineItems.map(item => ({
          id: item.id,
          quantity: item.quantity || 1,
          product_tax_code: item.taxCode,
          unit_price: item.unitPrice,
          discount: item.discount || 0
        }))
      };

      const taxCalculation = await this.client.taxForOrder(taxParams);

      await this.config.updateHealth('healthy');

      return {
        provider: 'taxjar',
        totalTax: taxCalculation.tax.amount_to_collect,
        rate: taxCalculation.tax.rate,
        hasNexus: taxCalculation.tax.has_nexus,
        freightTaxable: taxCalculation.tax.freight_taxable,
        taxSource: taxCalculation.tax.tax_source,
        jurisdictions: taxCalculation.tax.jurisdictions,
        breakdown: taxCalculation.tax.breakdown
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`TaxJar tax calculation failed: ${error.message}`);
    }
  }

  async validateTaxNumber(taxNumber, country = 'US') {
    try {
      const validation = await this.client.validateAddress({
        country: country,
        state: '', // TaxJar validation focuses on addresses
        zip: taxNumber, // Using as postal code for demo
        city: '',
        street: ''
      });

      return {
        isValid: validation.addresses[0] ? true : false,
        taxNumber: taxNumber,
        country: country,
        provider: 'taxjar',
        validationType: 'address'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`TaxJar validation failed: ${error.message}`);
    }
  }

  async getTaxRates(location) {
    try {
      const rateParams = {
        zip: location.postalCode,
        city: location.city,
        state: location.state,
        country: location.country
      };

      const rates = await this.client.ratesForLocation(location.postalCode, rateParams);

      return {
        provider: 'taxjar',
        location: location,
        combinedRate: rates.rate.combined_rate,
        stateRate: rates.rate.state_rate,
        countyRate: rates.rate.county_rate,
        cityRate: rates.rate.city_rate,
        specialRate: rates.rate.special_rate,
        freight: rates.rate.freight_taxable
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`TaxJar rates lookup failed: ${error.message}`);
    }
  }

  async createTransaction(transactionData) {
    try {
      const {
        transactionId,
        transactionDate,
        fromAddress,
        toAddress,
        amount,
        shipping = 0,
        salesTax,
        lineItems = []
      } = transactionData;

      const orderParams = {
        transaction_id: transactionId,
        transaction_date: transactionDate,
        from_country: fromAddress.country,
        from_zip: fromAddress.postalCode,
        from_state: fromAddress.state,
        from_city: fromAddress.city,
        from_street: fromAddress.line1,
        to_country: toAddress.country,
        to_zip: toAddress.postalCode,
        to_state: toAddress.state,
        to_city: toAddress.city,
        to_street: toAddress.line1,
        amount: amount,
        shipping: shipping,
        sales_tax: salesTax,
        line_items: lineItems.map(item => ({
          id: item.id,
          quantity: item.quantity || 1,
          product_identifier: item.productId,
          description: item.description,
          product_tax_code: item.taxCode,
          unit_price: item.unitPrice,
          discount: item.discount || 0,
          sales_tax: item.salesTax || 0
        }))
      };

      const order = await this.client.createOrder(orderParams);

      return {
        provider: 'taxjar',
        transactionId: order.order.transaction_id,
        status: 'created'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`TaxJar transaction creation failed: ${error.message}`);
    }
  }

  async voidTransaction(transactionId) {
    try {
      await this.client.deleteOrder(transactionId);

      return {
        provider: 'taxjar',
        transactionId: transactionId,
        status: 'voided'
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`TaxJar transaction void failed: ${error.message}`);
    }
  }

  async getComplianceReport(reportParams) {
    try {
      const { startDate, endDate, region = 'US' } = reportParams;

      const reports = await this.client.listOrders({
        from_transaction_date: startDate,
        to_transaction_date: endDate
      });

      return {
        provider: 'taxjar',
        reportType: 'compliance',
        period: { startDate, endDate },
        region: region,
        transactionCount: reports.orders.length,
        orders: reports.orders
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`TaxJar compliance report failed: ${error.message}`);
    }
  }
}

/**
 * Avalara Provider
 */
class AvalaraProvider extends BaseTaxProvider {
  constructor(config) {
    super(config);
    this.axios = require('axios');
    this.baseURL = this.credentials.environment === 'production'
      ? 'https://rest.avatax.com'
      : 'https://sandbox-rest.avatax.com';
    
    this.auth = Buffer.from(`${this.credentials.accountId}:${this.credentials.licenseKey}`).toString('base64');
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const response = await this.axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json'
        },
        data
      });

      return response.data;
    } catch (error) {
      throw new Error(`Avalara API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async calculateTax(taxCalculationData) {
    try {
      const {
        customerCode,
        date = new Date().toISOString().split('T')[0],
        type = 'SalesInvoice',
        companyCode,
        addresses,
        lines
      } = taxCalculationData;

      const transactionData = {
        companyCode: companyCode || this.credentials.companyCode,
        type: type,
        customerCode: customerCode,
        date: date,
        lines: lines.map((line, index) => ({
          number: (index + 1).toString(),
          quantity: line.quantity || 1,
          amount: line.amount,
          taxCode: line.taxCode,
          customerUsageType: line.customerUsageType,
          description: line.description,
          addresses: line.addresses || addresses
        })),
        addresses: addresses
      };

      const result = await this.makeRequest('POST', '/api/v2/transactions/create', transactionData);

      await this.config.updateHealth('healthy');

      return {
        provider: 'avalara',
        transactionId: result.id,
        code: result.code,
        totalAmount: result.totalAmount,
        totalTax: result.totalTax,
        totalTaxable: result.totalTaxable,
        lines: result.lines.map(line => ({
          lineNumber: line.lineNumber,
          taxableAmount: line.taxableAmount,
          tax: line.tax,
          rate: line.rate,
          details: line.details
        })),
        summary: result.summary
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Avalara tax calculation failed: ${error.message}`);
    }
  }

  async validateTaxNumber(taxNumber, country) {
    try {
      const result = await this.makeRequest('GET', `/api/v2/definitions/taxauthorities`, {
        params: {
          filter: `country eq '${country}'`
        }
      });

      // Basic validation - in practice, you'd use Avalara's address validation
      return {
        isValid: true,
        taxNumber: taxNumber,
        country: country,
        provider: 'avalara',
        validationType: 'basic',
        authorities: result.value
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Avalara validation failed: ${error.message}`);
    }
  }

  async getTaxRates(location) {
    try {
      const addressData = {
        line1: location.line1,
        city: location.city,
        region: location.state,
        country: location.country,
        postalCode: location.postalCode
      };

      const rates = await this.makeRequest('POST', '/api/v2/taxrates/byaddress', addressData);

      return {
        provider: 'avalara',
        location: location,
        totalRate: rates.totalRate,
        rates: rates.rates.map(rate => ({
          rate: rate.rate,
          name: rate.name,
          type: rate.type,
          country: rate.country,
          region: rate.region,
          jurisType: rate.jurisType,
          jurisName: rate.jurisName
        }))
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Avalara rates lookup failed: ${error.message}`);
    }
  }

  async createTransaction(transactionData) {
    try {
      const result = await this.makeRequest('POST', '/api/v2/transactions/create', {
        ...transactionData,
        commit: true
      });

      return {
        provider: 'avalara',
        transactionId: result.id,
        code: result.code,
        status: result.status
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Avalara transaction creation failed: ${error.message}`);
    }
  }

  async voidTransaction(transactionCode, reason = 'DocVoided') {
    try {
      const result = await this.makeRequest('POST', 
        `/api/v2/companies/${this.credentials.companyCode}/transactions/${transactionCode}/void`,
        { code: reason }
      );

      return {
        provider: 'avalara',
        transactionCode: transactionCode,
        status: result.status
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Avalara transaction void failed: ${error.message}`);
    }
  }

  async getComplianceReport(reportParams) {
    try {
      const { startDate, endDate, region } = reportParams;

      const reports = await this.makeRequest('GET', 
        `/api/v2/companies/${this.credentials.companyCode}/reports`, {
        params: {
          startDate,
          endDate,
          region
        }
      });

      return {
        provider: 'avalara',
        reportType: 'compliance',
        period: { startDate, endDate },
        region: region,
        reports: reports.value
      };
    } catch (error) {
      await this.config.updateHealth('degraded', null, true);
      throw new Error(`Avalara compliance report failed: ${error.message}`);
    }
  }
}

/**
 * Tax Provider Factory
 */
class TaxProviderFactory {
  static async create(providerName) {
    const config = await IntegrationConfig.getProviderByName('tax', providerName);
    if (!config || !config.isEnabled) {
      throw new Error(`Tax provider ${providerName} not found or not enabled`);
    }

    switch (providerName) {
      case 'stripe_tax':
        return new StripeTaxProvider(config);
      case 'taxjar':
        return new TaxJarProvider(config);
      case 'avalara':
        return new AvalaraProvider(config);
      default:
        throw new Error(`Unsupported tax provider: ${providerName}`);
    }
  }

  static async getPrimaryProvider() {
    const config = await IntegrationConfig.getPrimaryProvider('tax');
    if (!config) {
      throw new Error('No primary tax provider configured');
    }

    return await this.create(config.provider);
  }

  static getSupportedProviders() {
    return ['stripe_tax', 'taxjar', 'avalara'];
  }
}

module.exports = {
  BaseTaxProvider,
  StripeTaxProvider,
  TaxJarProvider,
  AvalaraProvider,
  TaxProviderFactory
};





