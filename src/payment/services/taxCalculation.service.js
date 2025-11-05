const { TaxRate, Invoice } = require('../models/billing.model');
const axios = require('axios');

/**
 * Provider-Agnostic Tax Calculation Service
 * Supports Stripe Tax, TaxJar, Avalara, and manual calculation
 */
class TaxCalculationService {
  constructor() {
    this.providers = {
      STRIPE_TAX: new StripeTaxProvider(),
      TAXJAR: new TaxJarProvider(),
      AVALARA: new AvalaraProvider(),
      MANUAL: new ManualTaxProvider()
    };
    
    this.defaultProvider = process.env.DEFAULT_TAX_PROVIDER || 'MANUAL';
  }

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(transactionData, options = {}) {
    try {
      const provider = options.provider || this.defaultProvider;
      const taxProvider = this.providers[provider];
      
      if (!taxProvider) {
        throw new Error(`Tax provider ${provider} not supported`);
      }

      // Validate required data
      this.validateTransactionData(transactionData);

      // Calculate tax using selected provider
      const taxCalculation = await taxProvider.calculateTax(transactionData, options);

      // Apply business rules and validations
      const validatedCalculation = await this.validateAndEnhanceTaxCalculation(
        taxCalculation, 
        transactionData
      );

      return validatedCalculation;
    } catch (error) {
      console.error('Tax calculation error:', error);
      throw new Error(`Tax calculation failed: ${error.message}`);
    }
  }

  /**
   * Get applicable tax rates for a location and transaction type
   */
  async getApplicableTaxRates(location, customerType, productType, amount) {
    try {
      const taxRates = await TaxRate.find({
        active: true,
        effectiveFrom: { $lte: new Date() },
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: { $gte: new Date() } }
        ]
      });

      const applicableRates = taxRates.filter(rate => 
        rate.isApplicable(location, customerType, productType, amount)
      );

      return applicableRates.sort((a, b) => {
        // Sort by specificity: city > state > country
        const aSpecificity = (a.city ? 4 : 0) + (a.state ? 2 : 0) + 1;
        const bSpecificity = (b.city ? 4 : 0) + (b.state ? 2 : 0) + 1;
        return bSpecificity - aSpecificity;
      });
    } catch (error) {
      console.error('Error getting applicable tax rates:', error);
      throw error;
    }
  }

  /**
   * Validate transaction data
   */
  validateTransactionData(data) {
    const required = ['customerId', 'lineItems', 'billingAddress', 'currency'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!data.lineItems || data.lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }

    // Validate billing address
    const addressRequired = ['country', 'city', 'postalCode'];
    const addressMissing = addressRequired.filter(field => !data.billingAddress[field]);
    
    if (addressMissing.length > 0) {
      throw new Error(`Missing required address fields: ${addressMissing.join(', ')}`);
    }
  }

  /**
   * Validate and enhance tax calculation results
   */
  async validateAndEnhanceTaxCalculation(calculation, transactionData) {
    // Ensure minimum required fields
    const enhanced = {
      provider: calculation.provider || this.defaultProvider,
      calculatedAt: new Date(),
      taxLines: calculation.taxLines || [],
      exemptions: calculation.exemptions || [],
      reverseCharge: calculation.reverseCharge || { applicable: false },
      totalTaxAmount: 0,
      confidence: calculation.confidence || 'HIGH'
    };

    // Calculate total tax amount
    enhanced.totalTaxAmount = enhanced.taxLines.reduce(
      (sum, line) => sum + (line.taxAmount || 0), 
      0
    );

    // Validate tax amounts don't exceed transaction amount
    const transactionTotal = transactionData.lineItems.reduce(
      (sum, item) => sum + item.amount, 
      0
    );

    if (enhanced.totalTaxAmount > transactionTotal) {
      console.warn('Tax amount exceeds transaction total - applying cap');
      enhanced.totalTaxAmount = Math.min(enhanced.totalTaxAmount, transactionTotal * 0.5);
      enhanced.confidence = 'LOW';
    }

    return enhanced;
  }

  /**
   * Handle tax exemptions
   */
  async applyTaxExemptions(calculation, exemptionCertificates) {
    if (!exemptionCertificates || exemptionCertificates.length === 0) {
      return calculation;
    }

    for (const cert of exemptionCertificates) {
      if (this.isValidExemptionCertificate(cert)) {
        // Apply exemption to applicable tax lines
        calculation.taxLines = calculation.taxLines.map(line => {
          if (this.exemptionApplies(cert, line)) {
            const exemptAmount = line.taxAmount;
            line.taxAmount = 0;
            line.exemptAmount = (line.exemptAmount || 0) + exemptAmount;
            
            calculation.exemptions.push({
              reason: cert.reason,
              amount: exemptAmount,
              certificateNumber: cert.certificateNumber
            });
          }
          return line;
        });
      }
    }

    // Recalculate total
    calculation.totalTaxAmount = calculation.taxLines.reduce(
      (sum, line) => sum + line.taxAmount, 
      0
    );

    return calculation;
  }

  /**
   * Check if exemption certificate is valid
   */
  isValidExemptionCertificate(certificate) {
    return certificate && 
           certificate.certificateNumber && 
           certificate.validFrom && 
           certificate.validTo &&
           new Date() >= new Date(certificate.validFrom) &&
           new Date() <= new Date(certificate.validTo);
  }

  /**
   * Check if exemption applies to a tax line
   */
  exemptionApplies(certificate, taxLine) {
    // Check jurisdiction match
    if (certificate.jurisdiction && 
        certificate.jurisdiction !== taxLine.jurisdiction) {
      return false;
    }

    // Check tax type match
    if (certificate.applicableTaxTypes && 
        certificate.applicableTaxTypes.length > 0 &&
        !certificate.applicableTaxTypes.includes(taxLine.taxType)) {
      return false;
    }

    return true;
  }
}

/**
 * Stripe Tax Provider Implementation
 */
class StripeTaxProvider {
  constructor() {
    this.apiKey = process.env.STRIPE_SECRET_KEY;
    this.baseUrl = 'https://api.stripe.com/v1';
  }

  async calculateTax(transactionData, options = {}) {
    try {
      const stripe = require('stripe')(this.apiKey);
      
      // Prepare line items for Stripe
      const lineItems = transactionData.lineItems.map(item => ({
        amount: Math.round(item.amount * 100), // Convert to cents
        reference: item.id,
        tax_behavior: 'exclusive',
        tax_code: this.getStripeTaxCode(item.productType)
      }));

      // Create tax calculation
      const calculation = await stripe.tax.calculations.create({
        currency: transactionData.currency.toLowerCase(),
        line_items: lineItems,
        customer_details: {
          address: {
            country: transactionData.billingAddress.country,
            state: transactionData.billingAddress.state,
            city: transactionData.billingAddress.city,
            postal_code: transactionData.billingAddress.postalCode,
            line1: transactionData.billingAddress.line1,
            line2: transactionData.billingAddress.line2
          },
          address_source: 'billing'
        },
        expand: ['line_items.data.tax_breakdown']
      });

      // Convert Stripe response to our format
      return this.convertStripeResponse(calculation);
    } catch (error) {
      console.error('Stripe Tax calculation error:', error);
      throw new Error(`Stripe Tax calculation failed: ${error.message}`);
    }
  }

  getStripeTaxCode(productType) {
    const taxCodes = {
      'DIGITAL_SERVICES': 'txcd_10103001', // Digital services
      'SUBSCRIPTIONS': 'txcd_10103001',    // SaaS subscriptions
      'PHYSICAL_GOODS': 'txcd_99999999',   // General goods
      'LICENSES': 'txcd_10103001'          // Software licenses
    };
    
    return taxCodes[productType] || 'txcd_99999999';
  }

  convertStripeResponse(stripeCalculation) {
    const taxLines = [];
    
    stripeCalculation.line_items.data.forEach(lineItem => {
      if (lineItem.tax_breakdown) {
        lineItem.tax_breakdown.forEach(breakdown => {
          taxLines.push({
            jurisdiction: breakdown.jurisdiction.display_name,
            taxType: breakdown.tax_rate_details.display_name,
            rate: breakdown.tax_rate_details.percentage_decimal * 100,
            taxableAmount: breakdown.taxable_amount / 100,
            taxAmount: breakdown.tax_amount / 100,
            exemptAmount: 0
          });
        });
      }
    });

    return {
      provider: 'STRIPE_TAX',
      taxLines,
      exemptions: [],
      reverseCharge: { applicable: false },
      confidence: 'HIGH',
      externalId: stripeCalculation.id
    };
  }
}

/**
 * TaxJar Provider Implementation
 */
class TaxJarProvider {
  constructor() {
    this.apiKey = process.env.TAXJAR_API_KEY;
    this.baseUrl = 'https://api.taxjar.com/v2';
  }

  async calculateTax(transactionData, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('TaxJar API key not configured');
      }

      // Prepare TaxJar request
      const taxjarRequest = {
        from_country: 'US', // Your business location
        from_zip: process.env.BUSINESS_POSTAL_CODE || '10001',
        from_state: process.env.BUSINESS_STATE || 'NY',
        from_city: process.env.BUSINESS_CITY || 'New York',
        to_country: transactionData.billingAddress.country,
        to_zip: transactionData.billingAddress.postalCode,
        to_state: transactionData.billingAddress.state,
        to_city: transactionData.billingAddress.city,
        amount: transactionData.lineItems.reduce((sum, item) => sum + item.amount, 0),
        shipping: 0,
        line_items: transactionData.lineItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          product_tax_code: this.getTaxJarProductCode(item.productType),
          unit_price: item.unitPrice,
          discount: item.discountAmount || 0
        }))
      };

      const response = await axios.post(
        `${this.baseUrl}/taxes`,
        taxjarRequest,
        {
          headers: {
            'Authorization': `Token token="${this.apiKey}"`,
            'Content-Type': 'application/json'
          }
        }
      );

      return this.convertTaxJarResponse(response.data.tax);
    } catch (error) {
      console.error('TaxJar calculation error:', error);
      throw new Error(`TaxJar calculation failed: ${error.message}`);
    }
  }

  getTaxJarProductCode(productType) {
    const productCodes = {
      'DIGITAL_SERVICES': '31000', // Digital goods
      'SUBSCRIPTIONS': '31000',    // SaaS
      'PHYSICAL_GOODS': '00000',   // General goods
      'LICENSES': '31000'          // Software
    };
    
    return productCodes[productType] || '00000';
  }

  convertTaxJarResponse(taxjarTax) {
    const taxLines = [];
    
    if (taxjarTax.breakdown) {
      // State tax
      if (taxjarTax.breakdown.state_taxable_amount > 0) {
        taxLines.push({
          jurisdiction: `${taxjarTax.breakdown.state_tax_rate || 0} - State`,
          taxType: 'STATE_TAX',
          rate: (taxjarTax.breakdown.state_tax_rate || 0) * 100,
          taxableAmount: taxjarTax.breakdown.state_taxable_amount,
          taxAmount: taxjarTax.breakdown.state_tax_collectable || 0,
          exemptAmount: 0
        });
      }

      // County tax
      if (taxjarTax.breakdown.county_taxable_amount > 0) {
        taxLines.push({
          jurisdiction: `${taxjarTax.breakdown.county_tax_rate || 0} - County`,
          taxType: 'COUNTY_TAX',
          rate: (taxjarTax.breakdown.county_tax_rate || 0) * 100,
          taxableAmount: taxjarTax.breakdown.county_taxable_amount,
          taxAmount: taxjarTax.breakdown.county_tax_collectable || 0,
          exemptAmount: 0
        });
      }

      // City tax
      if (taxjarTax.breakdown.city_taxable_amount > 0) {
        taxLines.push({
          jurisdiction: `${taxjarTax.breakdown.city_tax_rate || 0} - City`,
          taxType: 'CITY_TAX',
          rate: (taxjarTax.breakdown.city_tax_rate || 0) * 100,
          taxableAmount: taxjarTax.breakdown.city_taxable_amount,
          taxAmount: taxjarTax.breakdown.city_tax_collectable || 0,
          exemptAmount: 0
        });
      }
    }

    return {
      provider: 'TAXJAR',
      taxLines,
      exemptions: [],
      reverseCharge: { applicable: false },
      confidence: 'HIGH'
    };
  }
}

/**
 * Avalara Provider Implementation
 */
class AvalaraProvider {
  constructor() {
    this.username = process.env.AVALARA_USERNAME;
    this.password = process.env.AVALARA_PASSWORD;
    this.baseUrl = process.env.AVALARA_ENVIRONMENT === 'production' 
      ? 'https://rest.avatax.com' 
      : 'https://sandbox-rest.avatax.com';
  }

  async calculateTax(transactionData, options = {}) {
    try {
      if (!this.username || !this.password) {
        throw new Error('Avalara credentials not configured');
      }

      const avalaraRequest = {
        companyCode: process.env.AVALARA_COMPANY_CODE || 'DEFAULT',
        type: 'SalesInvoice',
        customerCode: transactionData.customerId,
        date: new Date().toISOString().split('T')[0],
        lines: transactionData.lineItems.map((item, index) => ({
          number: (index + 1).toString(),
          quantity: item.quantity,
          amount: item.amount,
          taxCode: this.getAvalaraTaxCode(item.productType),
          itemCode: item.id,
          description: item.description
        })),
        addresses: {
          shipFrom: {
            line1: process.env.BUSINESS_ADDRESS_LINE1 || '123 Business St',
            city: process.env.BUSINESS_CITY || 'New York',
            region: process.env.BUSINESS_STATE || 'NY',
            country: process.env.BUSINESS_COUNTRY || 'US',
            postalCode: process.env.BUSINESS_POSTAL_CODE || '10001'
          },
          shipTo: {
            line1: transactionData.billingAddress.line1,
            line2: transactionData.billingAddress.line2,
            city: transactionData.billingAddress.city,
            region: transactionData.billingAddress.state,
            country: transactionData.billingAddress.country,
            postalCode: transactionData.billingAddress.postalCode
          }
        },
        commit: false,
        currencyCode: transactionData.currency
      };

      const response = await axios.post(
        `${this.baseUrl}/api/v2/transactions/create`,
        avalaraRequest,
        {
          auth: {
            username: this.username,
            password: this.password
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return this.convertAvalaraResponse(response.data);
    } catch (error) {
      console.error('Avalara calculation error:', error);
      throw new Error(`Avalara calculation failed: ${error.message}`);
    }
  }

  getAvalaraTaxCode(productType) {
    const taxCodes = {
      'DIGITAL_SERVICES': 'D0000000', // Digital services
      'SUBSCRIPTIONS': 'D0000000',    // SaaS
      'PHYSICAL_GOODS': 'P0000000',   // Physical goods
      'LICENSES': 'D0000000'          // Software licenses
    };
    
    return taxCodes[productType] || 'P0000000';
  }

  convertAvalaraResponse(avalaraTransaction) {
    const taxLines = [];
    
    if (avalaraTransaction.lines) {
      avalaraTransaction.lines.forEach(line => {
        if (line.details) {
          line.details.forEach(detail => {
            taxLines.push({
              jurisdiction: detail.jurisName,
              taxType: detail.taxName,
              rate: detail.rate * 100,
              taxableAmount: detail.taxableAmount,
              taxAmount: detail.tax,
              exemptAmount: detail.exemptAmount || 0
            });
          });
        }
      });
    }

    return {
      provider: 'AVALARA',
      taxLines,
      exemptions: [],
      reverseCharge: { applicable: false },
      confidence: 'HIGH',
      externalId: avalaraTransaction.code
    };
  }
}

/**
 * Manual Tax Provider Implementation
 * Uses local tax rate database
 */
class ManualTaxProvider {
  async calculateTax(transactionData, options = {}) {
    try {
      // Get applicable tax rates from database
      const location = {
        country: transactionData.billingAddress.country,
        state: transactionData.billingAddress.state,
        city: transactionData.billingAddress.city,
        postalCode: transactionData.billingAddress.postalCode
      };

      const taxLines = [];
      let compoundedAmount = 0;

      for (const lineItem of transactionData.lineItems) {
        const applicableRates = await this.getApplicableTaxRates(
          location,
          transactionData.customerType || 'INDIVIDUAL',
          lineItem.productType,
          lineItem.amount
        );

        for (const rate of applicableRates) {
          const taxAmount = rate.calculateTax(lineItem.amount, compoundedAmount);
          
          if (taxAmount > 0) {
            taxLines.push({
              taxRateId: rate._id,
              jurisdiction: this.formatJurisdiction(rate),
              taxType: rate.taxType,
              rate: rate.rate,
              taxableAmount: lineItem.amount,
              taxAmount: taxAmount,
              exemptAmount: 0
            });

            if (rate.compoundTax) {
              compoundedAmount += taxAmount;
            }
          }
        }
      }

      return {
        provider: 'MANUAL',
        taxLines,
        exemptions: [],
        reverseCharge: this.checkReverseCharge(transactionData),
        confidence: 'MEDIUM'
      };
    } catch (error) {
      console.error('Manual tax calculation error:', error);
      throw error;
    }
  }

  async getApplicableTaxRates(location, customerType, productType, amount) {
    const taxCalculationService = new TaxCalculationService();
    return await taxCalculationService.getApplicableTaxRates(
      location, 
      customerType, 
      productType, 
      amount
    );
  }

  formatJurisdiction(taxRate) {
    const parts = [taxRate.country];
    if (taxRate.state) parts.push(taxRate.state);
    if (taxRate.city) parts.push(taxRate.city);
    return parts.join(', ');
  }

  checkReverseCharge(transactionData) {
    // EU reverse charge logic
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];

    const businessCountry = process.env.BUSINESS_COUNTRY || 'US';
    const customerCountry = transactionData.billingAddress.country;
    const customerVatNumber = transactionData.billingAddress.vatNumber;

    // B2B transactions within EU with valid VAT numbers
    if (euCountries.includes(businessCountry) && 
        euCountries.includes(customerCountry) && 
        businessCountry !== customerCountry &&
        customerVatNumber) {
      return {
        applicable: true,
        reason: 'EU B2B reverse charge mechanism',
        customerVatNumber: customerVatNumber
      };
    }

    return { applicable: false };
  }
}

module.exports = TaxCalculationService;





