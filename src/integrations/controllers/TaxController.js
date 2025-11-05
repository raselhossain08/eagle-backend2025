/**
 * Eagle Tax Controller
 * Handles HTTP requests for tax calculations and operations
 */

const TaxManager = require('../managers/TaxManager');

class TaxController {
  /**
   * Calculate tax for a transaction
   */
  static async calculateTax(req, res) {
    try {
      const {
        amount,
        currency = 'USD',
        fromAddress,
        toAddress,
        lineItems,
        customerDetails,
        shipping,
        preferredProvider,
        enableFailover = true
      } = req.body;

      // Basic validation
      if (!amount || !fromAddress || !toAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: amount, fromAddress, toAddress'
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than 0'
        });
      }

      const result = await TaxManager.calculateTax({
        amount,
        currency,
        fromAddress,
        toAddress,
        lineItems,
        customerDetails,
        shipping
      }, {
        preferredProvider,
        enableFailover
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Tax calculated successfully',
          data: {
            provider: result.provider,
            calculation: result.data
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to calculate tax',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Calculate tax error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Batch calculate tax for multiple transactions
   */
  static async batchCalculateTax(req, res) {
    try {
      const {
        transactions,
        batchSize = 10,
        delayMs = 100,
        preferredProvider,
        enableFailover = true
      } = req.body;

      // Basic validation
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Transactions array is required and must not be empty'
        });
      }

      // Validate each transaction
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        if (!tx.amount || !tx.fromAddress || !tx.toAddress) {
          return res.status(400).json({
            success: false,
            error: `Transaction ${i}: Missing required fields (amount, fromAddress, toAddress)`
          });
        }
      }

      const result = await TaxManager.batchCalculateTax(transactions, {
        batchSize,
        delayMs,
        preferredProvider,
        enableFailover
      });

      res.status(200).json({
        success: true,
        message: 'Batch tax calculation completed',
        data: result
      });
    } catch (error) {
      console.error('Batch calculate tax error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Create a tax transaction
   */
  static async createTransaction(req, res) {
    try {
      const {
        transactionId,
        transactionCode,
        type = 'SalesInvoice',
        customerCode,
        date,
        fromAddress,
        toAddress,
        lineItems,
        commit = false,
        preferredProvider,
        enableFailover = true
      } = req.body;

      // Basic validation
      if (!transactionId && !transactionCode) {
        return res.status(400).json({
          success: false,
          error: 'Either transactionId or transactionCode is required'
        });
      }

      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Line items are required'
        });
      }

      const result = await TaxManager.createTransaction({
        transactionId: transactionId || transactionCode,
        transactionCode: transactionCode || transactionId,
        type,
        customerCode,
        date,
        fromAddress,
        toAddress,
        lineItems,
        commit
      }, {
        preferredProvider,
        enableFailover
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Tax transaction created successfully',
          data: {
            provider: result.provider,
            transaction: result.data
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create tax transaction',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Create tax transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Commit a tax transaction
   */
  static async commitTransaction(req, res) {
    try {
      const { transactionId, provider } = req.params;

      if (!transactionId || !provider) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID and provider are required'
        });
      }

      const result = await TaxManager.commitTransaction(transactionId, provider);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Transaction committed successfully',
          data: result.data || result
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to commit transaction',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Commit transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Void a tax transaction
   */
  static async voidTransaction(req, res) {
    try {
      const { transactionId, provider } = req.params;
      const { reason = 'cancelled' } = req.body;

      if (!transactionId || !provider) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID and provider are required'
        });
      }

      const result = await TaxManager.voidTransaction(transactionId, provider, reason);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Transaction voided successfully',
          data: result.data || result
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to void transaction',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Void transaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Validate an address
   */
  static async validateAddress(req, res) {
    try {
      const { provider } = req.query;
      const address = req.body;

      if (!address || !address.city && !address.postalCode) {
        return res.status(400).json({
          success: false,
          error: 'Address with city or postal code is required'
        });
      }

      const result = await TaxManager.validateAddress(address, provider);

      res.status(200).json({
        success: true,
        data: result.data || result
      });
    } catch (error) {
      console.error('Validate address error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get tax rates for a location
   */
  static async getTaxRates(req, res) {
    try {
      const { provider } = req.query;
      const location = req.query;

      if (!location.city && !location.postalCode) {
        return res.status(400).json({
          success: false,
          error: 'City or postal code is required'
        });
      }

      const result = await TaxManager.getTaxRates(location, provider);

      res.status(200).json({
        success: true,
        data: result.data || result
      });
    } catch (error) {
      console.error('Get tax rates error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get tax codes
   */
  static async getTaxCodes(req, res) {
    try {
      const { provider } = req.query;

      const result = await TaxManager.getTaxCodes(provider);

      res.status(200).json({
        success: true,
        data: result.data || result
      });
    } catch (error) {
      console.error('Get tax codes error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get compliance information
   */
  static async getComplianceInfo(req, res) {
    try {
      const { provider } = req.query;

      const result = await TaxManager.getComplianceInfo(provider);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get compliance info error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Health check for all tax providers
   */
  static async healthCheck(req, res) {
    try {
      const result = await TaxManager.healthCheckAll();

      const statusCode = result.overall === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: result.overall === 'healthy',
        data: result
      });
    } catch (error) {
      console.error('Tax health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get available tax providers
   */
  static async getAvailableProviders(req, res) {
    try {
      const providers = TaxManager.getAvailableProviders();

      res.status(200).json({
        success: true,
        data: {
          providers,
          count: providers.length
        }
      });
    } catch (error) {
      console.error('Get available providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get provider statistics
   */
  static async getProviderStats(req, res) {
    try {
      const stats = await TaxManager.getProviderStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get provider stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Reload tax providers
   */
  static async reloadProviders(req, res) {
    try {
      await TaxManager.reload();

      res.status(200).json({
        success: true,
        message: 'Tax providers reloaded successfully'
      });
    } catch (error) {
      console.error('Reload providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Test tax calculation with sample data
   */
  static async testCalculation(req, res) {
    try {
      const { provider } = req.body;

      // Sample tax calculation data
      const sampleData = {
        amount: 100.00,
        currency: 'USD',
        fromAddress: {
          line1: '123 Business St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US'
        },
        toAddress: {
          line1: '456 Customer Ave',
          city: 'Los Angeles', 
          state: 'CA',
          postalCode: '90210',
          country: 'US'
        },
        lineItems: [{
          description: 'Test Product',
          amount: 100.00,
          quantity: 1,
          taxCode: 'P0000000'
        }]
      };

      const result = await TaxManager.calculateTax(sampleData, {
        preferredProvider: provider,
        enableFailover: false
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Test calculation completed successfully',
          data: {
            provider: result.provider,
            calculation: result.data,
            sampleData
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Test calculation failed',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Test calculation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }
}

module.exports = TaxController;