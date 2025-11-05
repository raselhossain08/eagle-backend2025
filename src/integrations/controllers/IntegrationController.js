/**
 * Eagle Integration Controller
 * Handles HTTP requests for integration management
 */

const IntegrationSettings = require('../models/integrationSettings.model');
const CommunicationManager = require('../managers/CommunicationManager');

class IntegrationController {
  /**
   * Configure a new integration provider
   */
  static async configureProvider(req, res) {
    try {
      const {
        provider,
        category,
        credentials,
        configuration,
        isPrimary = false,
        isActive = true,
        priority = 1
      } = req.body;

      // Validate required fields
      if (!provider || !category || !credentials || !configuration) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: provider, category, credentials, configuration'
        });
      }

      // Validate category
      const validCategories = ['PAYMENT', 'EMAIL', 'SMS', 'TAX', 'ANALYTICS'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        });
      }

      // Check if provider already exists
      const existingProvider = await IntegrationSettings.findOne({
        provider: provider.toLowerCase(),
        category
      });

      if (existingProvider) {
        return res.status(409).json({
          success: false,
          error: `Provider ${provider} already configured for category ${category}`
        });
      }

      // If setting as primary, unset other primaries in the same category
      if (isPrimary) {
        await IntegrationSettings.updateMany(
          { category, isPrimary: true },
          { $set: { isPrimary: false } }
        );
      }

      // Create new integration setting
      const integrationSetting = new IntegrationSettings({
        provider: provider.toLowerCase(),
        category,
        credentials,
        configuration,
        isPrimary,
        isActive,
        priority,
        createdBy: req.user.id
      });

      await integrationSetting.save();

      // Reload communication manager if it's a communication provider
      if (['EMAIL', 'SMS'].includes(category)) {
        try {
          await CommunicationManager.reload();
        } catch (error) {
          console.error('Failed to reload communication manager:', error);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Integration provider configured successfully',
        data: {
          id: integrationSetting._id,
          provider: integrationSetting.provider,
          category: integrationSetting.category,
          isActive: integrationSetting.isActive,
          isPrimary: integrationSetting.isPrimary
        }
      });
    } catch (error) {
      console.error('Configure provider error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get list of configured integrations
   */
  static async listIntegrations(req, res) {
    try {
      const { category, provider, isActive } = req.query;

      const filter = {};
      if (category) filter.category = category;
      if (provider) filter.provider = provider.toLowerCase();
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const integrations = await IntegrationSettings.find(filter)
        .select('-credentials') // Exclude sensitive credentials
        .sort({ category: 1, isPrimary: -1, priority: 1 });

      res.status(200).json({
        success: true,
        data: integrations
      });
    } catch (error) {
      console.error('List integrations error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get specific integration configuration
   */
  static async getIntegration(req, res) {
    try {
      const { id } = req.params;

      const integration = await IntegrationSettings.findById(id)
        .select('-credentials'); // Exclude sensitive credentials

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      res.status(200).json({
        success: true,
        data: integration
      });
    } catch (error) {
      console.error('Get integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Update integration configuration
   */
  static async updateIntegration(req, res) {
    try {
      const { id } = req.params;
      const {
        credentials,
        configuration,
        isPrimary,
        isActive,
        priority
      } = req.body;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      // If setting as primary, unset other primaries in the same category
      if (isPrimary && !integration.isPrimary) {
        await IntegrationSettings.updateMany(
          { category: integration.category, isPrimary: true, _id: { $ne: id } },
          { $set: { isPrimary: false } }
        );
      }

      // Update fields
      const updateData = {};
      if (credentials) updateData.credentials = credentials;
      if (configuration) updateData.configuration = configuration;
      if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (priority !== undefined) updateData.priority = priority;
      updateData.updatedAt = new Date();

      const updatedIntegration = await IntegrationSettings.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).select('-credentials');

      // Reload communication manager if it's a communication provider
      if (['EMAIL', 'SMS'].includes(integration.category)) {
        try {
          await CommunicationManager.reload();
        } catch (error) {
          console.error('Failed to reload communication manager:', error);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Integration updated successfully',
        data: updatedIntegration
      });
    } catch (error) {
      console.error('Update integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Delete integration configuration
   */
  static async deleteIntegration(req, res) {
    try {
      const { id } = req.params;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      await IntegrationSettings.findByIdAndDelete(id);

      // Reload communication manager if it's a communication provider
      if (['EMAIL', 'SMS'].includes(integration.category)) {
        try {
          await CommunicationManager.reload();
        } catch (error) {
          console.error('Failed to reload communication manager:', error);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Integration deleted successfully'
      });
    } catch (error) {
      console.error('Delete integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Test integration configuration
   */
  static async testIntegration(req, res) {
    try {
      const { id } = req.params;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      let testResult;

      // Test based on category
      switch (integration.category) {
        case 'EMAIL':
          // Test email provider
          if (req.body.testEmail) {
            testResult = await CommunicationManager.sendEmail({
              to: req.body.testEmail,
              subject: 'Test Email from Eagle Platform',
              html: '<h1>Test Email</h1><p>This is a test email to verify your configuration.</p>',
              text: 'Test Email - This is a test email to verify your configuration.'
            }, {
              preferredProvider: integration.provider,
              enableFailover: false
            });
          } else {
            return res.status(400).json({
              success: false,
              error: 'testEmail is required for email provider test'
            });
          }
          break;

        case 'SMS':
          // Test SMS provider
          if (req.body.testPhone) {
            testResult = await CommunicationManager.sendSMS({
              to: req.body.testPhone,
              message: 'Test SMS from Eagle Platform - Your configuration is working correctly!'
            }, {
              preferredProvider: integration.provider,
              enableFailover: false
            });
          } else {
            return res.status(400).json({
              success: false,
              error: 'testPhone is required for SMS provider test'
            });
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            error: `Testing not implemented for category: ${integration.category}`
          });
      }

      res.status(200).json({
        success: true,
        message: 'Integration test completed',
        data: testResult
      });
    } catch (error) {
      console.error('Test integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Integration test failed',
        details: error.message
      });
    }
  }

  /**
   * Toggle integration active status
   */
  static async toggleIntegration(req, res) {
    try {
      const { id } = req.params;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      integration.isActive = !integration.isActive;
      integration.updatedAt = new Date();
      await integration.save();

      // Reload communication manager if it's a communication provider
      if (['EMAIL', 'SMS'].includes(integration.category)) {
        try {
          await CommunicationManager.reload();
        } catch (error) {
          console.error('Failed to reload communication manager:', error);
        }
      }

      res.status(200).json({
        success: true,
        message: `Integration ${integration.isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          id: integration._id,
          isActive: integration.isActive
        }
      });
    } catch (error) {
      console.error('Toggle integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Set integration as primary for its category
   */
  static async setPrimary(req, res) {
    try {
      const { id } = req.params;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      // Unset other primaries in the same category
      await IntegrationSettings.updateMany(
        { category: integration.category, isPrimary: true },
        { $set: { isPrimary: false } }
      );

      // Set this integration as primary
      integration.isPrimary = true;
      integration.updatedAt = new Date();
      await integration.save();

      // Reload communication manager if it's a communication provider
      if (['EMAIL', 'SMS'].includes(integration.category)) {
        try {
          await CommunicationManager.reload();
        } catch (error) {
          console.error('Failed to reload communication manager:', error);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Integration set as primary successfully',
        data: {
          id: integration._id,
          isPrimary: integration.isPrimary
        }
      });
    } catch (error) {
      console.error('Set primary integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get integration usage statistics
   */
  static async getUsageStats(req, res) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      const stats = {
        provider: integration.provider,
        category: integration.category,
        totalRequests: integration.usage.totalRequests,
        successfulRequests: integration.usage.successfulRequests,
        failedRequests: integration.usage.failedRequests,
        lastUsed: integration.usage.lastUsed,
        successRate: integration.usage.totalRequests > 0 
          ? ((integration.usage.successfulRequests / integration.usage.totalRequests) * 100).toFixed(2)
          : 0
      };

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get usage stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get integration health status
   */
  static async getHealthStatus(req, res) {
    try {
      const { id } = req.params;

      const integration = await IntegrationSettings.findById(id);
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integration not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          provider: integration.provider,
          category: integration.category,
          healthStatus: integration.healthStatus
        }
      });
    } catch (error) {
      console.error('Get health status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Configure multiple integrations at once
   */
  static async bulkConfigure(req, res) {
    try {
      const { integrations } = req.body;

      if (!integrations || !Array.isArray(integrations)) {
        return res.status(400).json({
          success: false,
          error: 'integrations array is required'
        });
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < integrations.length; i++) {
        try {
          const config = integrations[i];
          
          // Validate required fields
          if (!config.provider || !config.category || !config.credentials || !config.configuration) {
            errors.push({
              index: i,
              error: 'Missing required fields: provider, category, credentials, configuration'
            });
            continue;
          }

          // Check if provider already exists
          const existingProvider = await IntegrationSettings.findOne({
            provider: config.provider.toLowerCase(),
            category: config.category
          });

          if (existingProvider) {
            errors.push({
              index: i,
              error: `Provider ${config.provider} already configured for category ${config.category}`
            });
            continue;
          }

          // Create new integration setting
          const integrationSetting = new IntegrationSettings({
            provider: config.provider.toLowerCase(),
            category: config.category,
            credentials: config.credentials,
            configuration: config.configuration,
            isPrimary: config.isPrimary || false,
            isActive: config.isActive !== undefined ? config.isActive : true,
            priority: config.priority || 1,
            createdBy: req.user.id
          });

          await integrationSetting.save();

          results.push({
            id: integrationSetting._id,
            provider: integrationSetting.provider,
            category: integrationSetting.category,
            success: true
          });
        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }

      // Reload communication manager if any communication providers were added
      const communicationProviders = results.filter(r => ['EMAIL', 'SMS'].includes(r.category));
      if (communicationProviders.length > 0) {
        try {
          await CommunicationManager.reload();
        } catch (error) {
          console.error('Failed to reload communication manager:', error);
        }
      }

      res.status(200).json({
        success: true,
        message: `Bulk configuration completed. ${results.length} successful, ${errors.length} failed.`,
        data: {
          successful: results,
          failed: errors
        }
      });
    } catch (error) {
      console.error('Bulk configure error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get available integration categories
   */
  static async getCategories(req, res) {
    try {
      const categories = [
        {
          name: 'PAYMENT',
          description: 'Payment processing providers',
          providers: ['stripe', 'braintree', 'paddle']
        },
        {
          name: 'EMAIL',
          description: 'Email service providers',
          providers: ['sendgrid', 'postmark']
        },
        {
          name: 'SMS',
          description: 'SMS service providers',
          providers: ['twilio']
        },
        {
          name: 'TAX',
          description: 'Tax calculation providers',
          providers: ['stripe_tax', 'taxjar', 'avalara']
        },
        {
          name: 'ANALYTICS',
          description: 'Analytics and tracking providers',
          providers: ['google_analytics', 'posthog', 'plausible']
        }
      ];

      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  /**
   * Get available providers by category
   */
  static async getProviders(req, res) {
    try {
      const { category } = req.query;

      const providersByCategory = {
        PAYMENT: [
          { name: 'stripe', displayName: 'Stripe', description: 'Online payment processing' },
          { name: 'braintree', displayName: 'Braintree', description: 'PayPal payment solution' },
          { name: 'paddle', displayName: 'Paddle', description: 'Merchant of record platform' }
        ],
        EMAIL: [
          { name: 'sendgrid', displayName: 'SendGrid', description: 'Email delivery service' },
          { name: 'postmark', displayName: 'Postmark', description: 'Transactional email service' }
        ],
        SMS: [
          { name: 'twilio', displayName: 'Twilio', description: 'Programmable SMS service' }
        ],
        TAX: [
          { name: 'stripe_tax', displayName: 'Stripe Tax', description: 'Automated tax calculation' },
          { name: 'taxjar', displayName: 'TaxJar', description: 'Sales tax automation' },
          { name: 'avalara', displayName: 'Avalara', description: 'Tax compliance software' }
        ],
        ANALYTICS: [
          { name: 'google_analytics', displayName: 'Google Analytics 4', description: 'Web analytics' },
          { name: 'posthog', displayName: 'PostHog', description: 'Product analytics' },
          { name: 'plausible', displayName: 'Plausible', description: 'Privacy-focused analytics' }
        ]
      };

      if (category) {
        const providers = providersByCategory[category] || [];
        res.status(200).json({
          success: true,
          data: providers
        });
      } else {
        res.status(200).json({
          success: true,
          data: providersByCategory
        });
      }
    } catch (error) {
      console.error('Get providers error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }
}

module.exports = IntegrationController;