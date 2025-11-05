/**
 * Eagle Avalara Provider
 * Handles tax calculations through Avalara AvaTax API
 */

const BaseTaxProvider = require('./BaseTaxProvider');

class AvalaraProvider extends BaseTaxProvider {
  constructor(config) {
    super({ ...config, provider: 'avalara' });
    this.accountId = config.accountId;
    this.licenseKey = config.licenseKey;
    this.environment = config.environment || 'production';
    this.companyCode = config.companyCode || 'DEFAULT';
    this.client = null;
    
    this.validateConfig();
    this.initializeClient();
  }

  getRequiredConfigFields() {
    return ['accountId', 'licenseKey'];
  }

  initializeClient() {
    try {
      // In a real implementation, you would import avatax
      // const AvaTax = require('avatax');
      // this.client = new AvaTax({
      //   appName: 'Eagle Platform',
      //   appVersion: '1.0.0',
      //   environment: this.environment,
      //   machineName: 'eagle-backend'
      // }).withSecurity(this.accountId, this.licenseKey);
      
      this.client = {
        createTransaction: async (params) => {
          // Mock implementation for demonstration
          console.log(`[Avalara] Mock transaction creation for ${params.code}`);
          
          const totalAmount = params.lines.reduce((sum, line) => sum + line.amount, 0);
          const taxAmount = totalAmount * 0.08; // 8% mock tax
          
          return {
            code: params.code,
            date: params.date,
            status: 'Committed',
            type: params.type,
            customerCode: params.customerCode,
            companyCode: params.companyCode,
            totalAmount: totalAmount,
            totalDiscount: 0,
            totalExemption: 0,
            totalTax: taxAmount,
            totalTaxable: totalAmount,
            totalTaxCalculated: taxAmount,
            adjustmentReason: 'NotAdjusted',
            locked: false,
            version: 1,
            exchangeRateEffectiveDate: params.date,
            exchangeRate: 1,
            modifiedDate: new Date().toISOString(),
            taxDate: params.date,
            lines: params.lines.map((line, index) => ({
              number: index + 1,
              description: line.description,
              discountAmount: line.discountAmount || 0,
              exemptAmount: 0,
              lineAmount: line.amount,
              quantity: line.quantity || 1,
              ref1: line.ref1 || '',
              ref2: line.ref2 || '',
              reportingDate: params.date,
              tax: line.amount * 0.08,
              taxableAmount: line.amount,
              taxCalculated: line.amount * 0.08,
              taxCode: line.taxCode || '',
              taxCodeId: null,
              taxDate: params.date,
              taxEngine: 'AvaTax',
              taxIncluded: false,
              details: [
                {
                  id: Date.now() + index,
                  transactionLineId: Date.now() + index,
                  transactionId: Date.now(),
                  country: 'US',
                  region: 'CA',
                  exemptAmount: 0,
                  jurisCode: '06',
                  jurisName: 'CALIFORNIA',
                  jurisType: 'STA',
                  nonTaxableAmount: 0,
                  rate: 0.08,
                  tax: line.amount * 0.08,
                  taxableAmount: line.amount,
                  taxType: 'Sales',
                  taxName: 'CA STATE TAX',
                  taxAuthorityTypeId: 45,
                  taxRegionId: 2127017,
                  taxCalculated: line.amount * 0.08,
                  taxOverride: {
                    type: 'None'
                  }
                }
              ]
            })),
            addresses: params.addresses,
            locationTypes: [],
            summary: [
              {
                country: 'US',
                region: 'CA',
                jurisType: 'State',
                jurisCode: '06',
                jurisName: 'CALIFORNIA',
                taxAuthorityType: 45,
                stateAssignedNo: '',
                taxType: 'Sales',
                taxName: 'CA STATE TAX',
                taxGroup: 'SalesAndUse',
                rateType: 'General',
                taxable: totalAmount,
                rate: 0.08,
                tax: taxAmount,
                taxCalculated: taxAmount,
                nonTaxable: 0,
                exemption: 0
              }
            ]
          };
        },

        voidTransaction: async (companyCode, code, model) => {
          console.log(`[Avalara] Mock transaction void for ${code}`);
          
          return {
            code: code,
            companyCode: companyCode,
            status: 'Cancelled',
            type: 'SalesInvoice'
          };
        },

        adjustTransaction: async (companyCode, code, model) => {
          console.log(`[Avalara] Mock transaction adjustment for ${code}`);
          
          return {
            code: code,
            companyCode: companyCode,
            status: 'Committed',
            type: 'SalesInvoice',
            adjustmentReason: model.adjustmentReason || 'PriceAdjusted'
          };
        },

        taxRatesByAddress: async (params) => {
          console.log(`[Avalara] Mock tax rates lookup for ${params.city}, ${params.region}`);
          
          return {
            totalRate: 0.08,
            rates: [
              {
                rate: 0.0725,
                name: 'CA STATE TAX',
                type: 'State'
              },
              {
                rate: 0.0075,
                name: 'CA COUNTY TAX',
                type: 'County'
              }
            ]
          };
        },

        resolveAddress: async (params) => {
          console.log(`[Avalara] Mock address resolution`);
          
          return {
            address: {
              textCase: 'Mixed',
              line1: params.line1,
              line2: params.line2 || '',
              line3: '',
              city: params.city,
              region: params.region,
              country: params.country,
              postalCode: params.postalCode
            },
            coordinates: {
              latitude: 34.0522,
              longitude: -118.2437
            },
            resolutionQuality: 'Intersection',
            taxAuthorities: [
              {
                avalaraId: '1',
                jurisdictionName: 'CALIFORNIA',
                jurisdictionType: 'State',
                signatureCode: 'AGAM'
              }
            ]
          };
        },

        listTaxCodes: async (params = {}) => {
          return {
            '@recordsetCount': 4,
            value: [
              {
                taxCode: 'P0000000',
                description: 'Tangible personal property',
                taxCodeTypeId: 'P',
                isPhysical: true
              },
              {
                taxCode: 'D0000000',
                description: 'Digital goods',
                taxCodeTypeId: 'D',
                isPhysical: false
              },
              {
                taxCode: 'S0000000',
                description: 'Services',
                taxCodeTypeId: 'S',
                isPhysical: false
              },
              {
                taxCode: 'FR020100',
                description: 'Shipping and handling',
                taxCodeTypeId: 'F',
                isPhysical: false
              }
            ]
          };
        },

        ping: async () => {
          return {
            version: '22.12.0',
            authenticated: true,
            authenticationType: 'UsernamePassword',
            authenticatedUserName: this.accountId
          };
        }
      };
    } catch (error) {
      throw new Error(`Failed to initialize Avalara client: ${error.message}`);
    }
  }

  async calculateTax(taxData) {
    const {
      amount,
      fromAddress,
      toAddress,
      lineItems = [],
      customerCode,
      transactionCode,
      date = new Date().toISOString().split('T')[0],
      type = 'SalesOrder'
    } = taxData;

    return this.executeWithErrorHandling('calculate_tax', async () => {
      this.validateTaxCalculationInput(taxData);

      const fromAddr = this.normalizeAddress(fromAddress);
      const toAddr = this.normalizeAddress(toAddress);

      // Prepare addresses
      const addresses = {
        shipFrom: {
          line1: fromAddr.line1,
          line2: fromAddr.line2 || undefined,
          city: fromAddr.city,
          region: fromAddr.state,
          country: fromAddr.country,
          postalCode: fromAddr.postalCode
        },
        shipTo: {
          line1: toAddr.line1,
          line2: toAddr.line2 || undefined,
          city: toAddr.city,
          region: toAddr.state,
          country: toAddr.country,
          postalCode: toAddr.postalCode
        }
      };

      // Prepare lines
      const lines = lineItems.length > 0 ? lineItems.map((item, index) => ({
        number: index + 1,
        description: item.description || `Item ${index + 1}`,
        amount: item.amount || item.unitPrice * item.quantity,
        quantity: item.quantity || 1,
        taxCode: item.taxCode || 'P0000000',
        customerUsageType: item.customerUsageType || undefined,
        discountAmount: item.discount || 0,
        ref1: item.ref1 || '',
        ref2: item.ref2 || ''
      })) : [{
        number: 1,
        description: 'Default Item',
        amount: amount,
        quantity: 1,
        taxCode: 'P0000000'
      }];

      const transactionParams = {
        companyCode: this.companyCode,
        type: type,
        code: transactionCode || this.generateTransactionId(),
        date: date,
        customerCode: customerCode || 'DEFAULT',
        addresses: addresses,
        lines: lines
      };

      const response = await this.client.createTransaction(transactionParams);

      return {
        transactionCode: response.code,
        totalTax: response.totalTax,
        totalTaxable: response.totalTaxable,
        status: response.status,
        taxDate: response.taxDate,
        breakdown: this.formatAvalaraBreakdown(response.summary),
        lineDetails: response.lines.map(line => ({
          number: line.number,
          description: line.description,
          amount: line.lineAmount,
          tax: line.tax,
          taxableAmount: line.taxableAmount,
          taxDetails: line.details
        })),
        addresses: response.addresses,
        provider: 'avalara'
      };
    });
  }

  async createTransaction(transactionData) {
    const {
      transactionCode,
      type = 'SalesInvoice',
      customerCode,
      date = new Date().toISOString().split('T')[0],
      fromAddress,
      toAddress,
      lineItems,
      commit = true
    } = transactionData;

    return this.executeWithErrorHandling('create_transaction', async () => {
      if (!transactionCode) {
        throw new Error('Transaction code is required');
      }

      const fromAddr = this.normalizeAddress(fromAddress);
      const toAddr = this.normalizeAddress(toAddress);

      const addresses = {
        shipFrom: {
          line1: fromAddr.line1,
          line2: fromAddr.line2 || undefined,
          city: fromAddr.city,
          region: fromAddr.state,
          country: fromAddr.country,
          postalCode: fromAddr.postalCode
        },
        shipTo: {
          line1: toAddr.line1,
          line2: toAddr.line2 || undefined,
          city: toAddr.city,
          region: toAddr.state,
          country: toAddr.country,
          postalCode: toAddr.postalCode
        }
      };

      const lines = lineItems.map((item, index) => ({
        number: index + 1,
        description: item.description || `Item ${index + 1}`,
        amount: item.amount || item.unitPrice * item.quantity,
        quantity: item.quantity || 1,
        taxCode: item.taxCode || 'P0000000',
        discountAmount: item.discount || 0
      }));

      const transactionParams = {
        companyCode: this.companyCode,
        type: type,
        code: transactionCode,
        date: date,
        customerCode: customerCode || 'DEFAULT',
        commit: commit,
        addresses: addresses,
        lines: lines
      };

      const response = await this.client.createTransaction(transactionParams);

      return {
        transactionId: response.code,
        companyCode: response.companyCode,
        status: response.status,
        type: response.type,
        totalTax: response.totalTax,
        provider: 'avalara'
      };
    });
  }

  async commitTransaction(transactionCode) {
    return this.executeWithErrorHandling('commit_transaction', async () => {
      // Avalara transactions can be committed by adjusting them
      const adjustmentModel = {
        adjustmentReason: 'SaleToCustomer',
        adjustmentDescription: 'Committing transaction'
      };

      const response = await this.client.adjustTransaction(
        this.companyCode, 
        transactionCode, 
        adjustmentModel
      );

      return {
        transactionCode: response.code,
        status: response.status,
        provider: 'avalara'
      };
    });
  }

  async voidTransaction(transactionCode, reason = 'DocVoided') {
    return this.executeWithErrorHandling('void_transaction', async () => {
      const voidModel = {
        code: reason
      };

      const response = await this.client.voidTransaction(
        this.companyCode,
        transactionCode,
        voidModel
      );

      return {
        transactionCode: response.code,
        status: response.status,
        provider: 'avalara'
      };
    });
  }

  async validateAddress(address) {
    return this.executeWithErrorHandling('validate_address', async () => {
      this.validateAddressInput(address);
      
      const normalized = this.normalizeAddress(address);
      
      const addressParams = {
        line1: normalized.line1,
        line2: normalized.line2 || undefined,
        city: normalized.city,
        region: normalized.state,
        country: normalized.country,
        postalCode: normalized.postalCode
      };

      const response = await this.client.resolveAddress(addressParams);
      const resolvedAddress = response.address;

      return {
        valid: response.resolutionQuality !== 'NotCoded',
        quality: response.resolutionQuality,
        address: {
          line1: resolvedAddress.line1,
          line2: resolvedAddress.line2,
          city: resolvedAddress.city,
          state: resolvedAddress.region,
          postalCode: resolvedAddress.postalCode,
          country: resolvedAddress.country
        },
        coordinates: response.coordinates,
        taxAuthorities: response.taxAuthorities,
        provider: 'avalara'
      };
    });
  }

  async getTaxRates(location) {
    return this.executeWithErrorHandling('get_tax_rates', async () => {
      const { line1, city, state, postalCode, country = 'US' } = location;
      
      const rateParams = {
        line1: line1 || '',
        city: city || '',
        region: state || '',
        country: country,
        postalCode: postalCode || ''
      };

      const response = await this.client.taxRatesByAddress(rateParams);

      return {
        location: rateParams,
        totalRate: response.totalRate * 100,
        rates: response.rates.map(rate => ({
          type: rate.type.toLowerCase(),
          name: rate.name,
          rate: rate.rate * 100,
          jurisdiction: rate.name
        })),
        provider: 'avalara'
      };
    });
  }

  async getTaxCodes() {
    return this.executeWithErrorHandling('get_tax_codes', async () => {
      const response = await this.client.listTaxCodes();

      return {
        codes: response.value.map(code => ({
          code: code.taxCode,
          description: code.description,
          type: code.taxCodeTypeId,
          isPhysical: code.isPhysical
        })),
        provider: 'avalara'
      };
    });
  }

  formatAvalaraBreakdown(summary) {
    if (!summary || !Array.isArray(summary)) {
      return [];
    }

    return summary.map(item => ({
      type: item.taxType?.toLowerCase() || 'unknown',
      name: item.taxName,
      rate: (item.rate || 0) * 100,
      amount: item.tax || 0,
      taxableAmount: item.taxable || 0,
      jurisdiction: item.jurisName,
      country: item.country,
      region: item.region
    }));
  }

  getSupportedCountries() {
    return [
      'US', 'CA', 'MX', 'GB', 'IE', 'AU', 'NZ', 'BR', 'IN', 'ZA',
      'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO',
      'DK', 'FI', 'PT', 'GR', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR',
      'RO', 'BG', 'LT', 'LV', 'EE', 'MT', 'CY', 'LU'
    ];
  }

  getSupportedTaxTypes() {
    return [
      'sales_tax', 'use_tax', 'vat', 'gst', 'excise_tax', 
      'import_duty', 'export_duty', 'withholding_tax'
    ];
  }

  getCertifications() {
    return [
      'CSA Certified',
      'Streamlined Sales Tax (SST)',
      'SOC 2 Type II',
      'ISO 27001',
      'SSAE 18 SOC 1 Type II'
    ];
  }

  async healthCheck() {
    return this.executeWithErrorHandling('health_check', async () => {
      const response = await this.client.ping();
      
      return {
        status: response.authenticated ? 'healthy' : 'error',
        provider: 'avalara',
        type: 'TAX',
        authenticated: response.authenticated,
        version: response.version,
        environment: this.environment,
        companyCode: this.companyCode,
        timestamp: new Date().toISOString()
      };
    });
  }
}

module.exports = AvalaraProvider;