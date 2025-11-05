/**
 * Status Mapping Service
 * Comprehensive system to map WooCommerce/WordPress statuses to new model
 * with verification of counts and totals (trial, active, canceled)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class StatusMappingService {
  constructor() {
    this.mappingId = null;
    this.statusMappings = {};
    this.verificationResults = {};
    this.customMappings = {};
  }

  /**
   * Initialize status mapping service
   */
  async initialize(options = {}) {
    try {
      this.mappingId = crypto.randomUUID();
      
      // Load default status mappings
      await this.loadDefaultMappings();
      
      // Load custom mappings if provided
      if (options.customMappingsFile) {
        await this.loadCustomMappings(options.customMappingsFile);
      }

      console.log(`🗺️ Status mapping service initialized - ID: ${this.mappingId}`);
      return { success: true, mappingId: this.mappingId };
    } catch (error) {
      console.error('Status mapping initialization failed:', error.message);
      throw new Error(`Status mapping initialization failed: ${error.message}`);
    }
  }

  /**
   * Load default status mappings
   */
  async loadDefaultMappings() {
    this.statusMappings = {
      // Subscription status mappings
      subscription: {
        'wc-active': {
          newStatus: 'active',
          description: 'Active subscription with current payments',
          category: 'active',
          billable: true,
          priority: 1
        },
        'wc-cancelled': {
          newStatus: 'cancelled',
          description: 'Cancelled subscription by customer or admin',
          category: 'inactive',
          billable: false,
          priority: 3
        },
        'wc-expired': {
          newStatus: 'expired',
          description: 'Subscription ended naturally',
          category: 'inactive',
          billable: false,
          priority: 4
        },
        'wc-on-hold': {
          newStatus: 'suspended',
          description: 'Temporarily suspended subscription',
          category: 'suspended',
          billable: false,
          priority: 2
        },
        'wc-pending-cancel': {
          newStatus: 'pending_cancellation',
          description: 'Scheduled for cancellation at period end',
          category: 'active',
          billable: true,
          priority: 2
        },
        'wc-switched': {
          newStatus: 'upgraded',
          description: 'Subscription upgraded to different plan',
          category: 'active',
          billable: true,
          priority: 1
        },
        'wc-pending': {
          newStatus: 'trial',
          description: 'Trial period or pending activation',
          category: 'trial',
          billable: false,
          priority: 1
        }
      },

      // Order status mappings
      order: {
        'wc-completed': {
          newStatus: 'completed',
          description: 'Successfully completed order',
          category: 'successful',
          revenue: true,
          priority: 1
        },
        'wc-processing': {
          newStatus: 'processing',
          description: 'Payment received, processing order',
          category: 'active',
          revenue: true,
          priority: 1
        },
        'wc-on-hold': {
          newStatus: 'on_hold',
          description: 'Awaiting payment or verification',
          category: 'pending',
          revenue: false,
          priority: 2
        },
        'wc-cancelled': {
          newStatus: 'cancelled',
          description: 'Order cancelled before completion',
          category: 'cancelled',
          revenue: false,
          priority: 3
        },
        'wc-refunded': {
          newStatus: 'refunded',
          description: 'Order refunded after completion',
          category: 'refunded',
          revenue: false,
          priority: 3
        },
        'wc-failed': {
          newStatus: 'failed',
          description: 'Payment failed or processing error',
          category: 'failed',
          revenue: false,
          priority: 4
        },
        'wc-pending': {
          newStatus: 'pending',
          description: 'Awaiting payment',
          category: 'pending',
          revenue: false,
          priority: 2
        },
        'wc-checkout-draft': {
          newStatus: 'draft',
          description: 'Incomplete checkout process',
          category: 'draft',
          revenue: false,
          priority: 5
        }
      },

      // Payment status mappings
      payment: {
        'completed': {
          newStatus: 'completed',
          description: 'Payment successfully processed',
          category: 'successful',
          revenue: true,
          priority: 1
        },
        'pending': {
          newStatus: 'pending',
          description: 'Payment pending processing',
          category: 'pending',
          revenue: false,
          priority: 2
        },
        'failed': {
          newStatus: 'failed',
          description: 'Payment processing failed',
          category: 'failed',
          revenue: false,
          priority: 3
        },
        'cancelled': {
          newStatus: 'cancelled',
          description: 'Payment cancelled by user',
          category: 'cancelled',
          revenue: false,
          priority: 3
        },
        'refunded': {
          newStatus: 'refunded',
          description: 'Payment refunded to customer',
          category: 'refunded',
          revenue: false,
          priority: 3
        },
        'partially_refunded': {
          newStatus: 'partially_refunded',
          description: 'Partial refund processed',
          category: 'refunded',
          revenue: true,
          priority: 2
        }
      },

      // User status mappings
      user: {
        '0': {
          newStatus: 'active',
          description: 'Active user account',
          category: 'active',
          priority: 1
        },
        '1': {
          newStatus: 'suspended',
          description: 'Suspended user account',
          category: 'suspended',
          priority: 3
        },
        'customer': {
          newStatus: 'customer',
          description: 'Customer role',
          category: 'active',
          priority: 1
        },
        'subscriber': {
          newStatus: 'subscriber',
          description: 'Subscriber role',
          category: 'active',
          priority: 1
        }
      },

      // Coupon status mappings
      coupon: {
        'publish': {
          newStatus: 'active',
          description: 'Active and usable coupon',
          category: 'active',
          priority: 1
        },
        'draft': {
          newStatus: 'draft',
          description: 'Draft coupon not yet active',
          category: 'inactive',
          priority: 2
        },
        'private': {
          newStatus: 'restricted',
          description: 'Restricted access coupon',
          category: 'restricted',
          priority: 2
        },
        'trash': {
          newStatus: 'deleted',
          description: 'Deleted coupon',
          category: 'deleted',
          priority: 4
        }
      },

      // Product status mappings
      product: {
        'publish': {
          newStatus: 'active',
          description: 'Published and available product',
          category: 'active',
          priority: 1
        },
        'draft': {
          newStatus: 'draft',
          description: 'Draft product not yet published',
          category: 'inactive',
          priority: 2
        },
        'private': {
          newStatus: 'private',
          description: 'Private product with restricted access',
          category: 'restricted',
          priority: 2
        },
        'trash': {
          newStatus: 'deleted',
          description: 'Deleted product',
          category: 'deleted',
          priority: 4
        }
      }
    };

    console.log('✅ Default status mappings loaded');
  }

  /**
   * Load custom status mappings
   */
  async loadCustomMappings(filePath) {
    try {
      const customData = await fs.readFile(filePath, 'utf-8');
      this.customMappings = JSON.parse(customData);
      
      // Merge custom mappings with defaults
      Object.keys(this.customMappings).forEach(entityType => {
        if (this.statusMappings[entityType]) {
          this.statusMappings[entityType] = {
            ...this.statusMappings[entityType],
            ...this.customMappings[entityType]
          };
        } else {
          this.statusMappings[entityType] = this.customMappings[entityType];
        }
      });

      console.log(`✅ Custom mappings loaded from: ${filePath}`);
    } catch (error) {
      console.error('Failed to load custom mappings:', error.message);
      throw error;
    }
  }

  /**
   * Map single status
   */
  mapStatus(entityType, oldStatus, options = {}) {
    try {
      const mapping = this.statusMappings[entityType];
      if (!mapping) {
        throw new Error(`No mapping defined for entity type: ${entityType}`);
      }

      const statusMapping = mapping[oldStatus];
      if (!statusMapping) {
        // Handle unmapped status
        if (options.strict) {
          throw new Error(`No mapping found for ${entityType} status: ${oldStatus}`);
        }
        
        // Return default or create warning
        console.warn(`⚠️ No mapping for ${entityType} status '${oldStatus}', using default`);
        return {
          newStatus: 'unknown',
          description: `Unmapped status: ${oldStatus}`,
          category: 'unknown',
          priority: 99,
          warning: true,
          originalStatus: oldStatus
        };
      }

      return {
        ...statusMapping,
        originalStatus: oldStatus,
        mapped: true
      };
    } catch (error) {
      console.error(`Error mapping status for ${entityType}:`, error.message);
      throw error;
    }
  }

  /**
   * Batch map statuses from data
   */
  async batchMapStatuses(data, entityType, statusField) {
    const mappingResults = {
      total: data.length,
      mapped: 0,
      unmapped: 0,
      errors: 0,
      mappings: {},
      unmappedStatuses: new Set(),
      errorDetails: []
    };

    for (const item of data) {
      try {
        const oldStatus = item[statusField];
        if (!oldStatus) {
          mappingResults.errors++;
          mappingResults.errorDetails.push({
            item: item.id || item._id || 'unknown',
            error: `Missing ${statusField}`
          });
          continue;
        }

        const mapping = this.mapStatus(entityType, oldStatus, { strict: false });
        
        if (mapping.warning) {
          mappingResults.unmapped++;
          mappingResults.unmappedStatuses.add(oldStatus);
        } else {
          mappingResults.mapped++;
        }

        // Track mapping statistics
        if (!mappingResults.mappings[oldStatus]) {
          mappingResults.mappings[oldStatus] = {
            newStatus: mapping.newStatus,
            count: 0,
            category: mapping.category
          };
        }
        mappingResults.mappings[oldStatus].count++;

      } catch (error) {
        mappingResults.errors++;
        mappingResults.errorDetails.push({
          item: item.id || item._id || 'unknown',
          error: error.message
        });
      }
    }

    return mappingResults;
  }

  /**
   * Verify status mapping counts and totals
   */
  async verifyMappingResults(originalData, mappedData, entityType) {
    console.log(`🔍 Verifying ${entityType} status mapping results...`);

    const verification = {
      entityType,
      verificationId: crypto.randomUUID(),
      timestamp: new Date(),
      originalStats: this.calculateStatusStats(originalData, 'old'),
      mappedStats: this.calculateStatusStats(mappedData, 'new'),
      discrepancies: [],
      summary: {}
    };

    // Verify total counts
    if (originalData.length !== mappedData.length) {
      verification.discrepancies.push({
        type: 'count_mismatch',
        message: `Total count mismatch: Original ${originalData.length}, Mapped ${mappedData.length}`,
        severity: 'high'
      });
    }

    // Verify status category totals
    const originalCategories = this.categorizeStatuses(originalData, entityType, 'old');
    const mappedCategories = this.categorizeStatuses(mappedData, entityType, 'new');

    Object.keys(originalCategories).forEach(category => {
      const originalCount = originalCategories[category];
      const mappedCount = mappedCategories[category] || 0;
      
      if (originalCount !== mappedCount) {
        verification.discrepancies.push({
          type: 'category_mismatch',
          category,
          message: `${category} count mismatch: Original ${originalCount}, Mapped ${mappedCount}`,
          severity: 'medium'
        });
      }
    });

    // Special verifications for subscriptions
    if (entityType === 'subscription') {
      verification.subscriptionVerification = await this.verifySubscriptionMapping(originalData, mappedData);
    }

    // Special verifications for orders
    if (entityType === 'order') {
      verification.orderVerification = await this.verifyOrderMapping(originalData, mappedData);
    }

    // Calculate verification score
    verification.summary = {
      totalDiscrepancies: verification.discrepancies.length,
      verificationScore: this.calculateVerificationScore(verification),
      status: verification.discrepancies.length === 0 ? 'passed' : 'failed_with_issues'
    };

    console.log(`✅ Verification completed for ${entityType}: ${verification.summary.status}`);
    return verification;
  }

  /**
   * Calculate status statistics
   */
  calculateStatusStats(data, statusType) {
    const stats = {
      total: data.length,
      byStatus: {},
      byCategory: {}
    };

    data.forEach(item => {
      const status = statusType === 'old' ? item.originalStatus : item.status;
      
      if (!stats.byStatus[status]) {
        stats.byStatus[status] = 0;
      }
      stats.byStatus[status]++;
    });

    return stats;
  }

  /**
   * Categorize statuses
   */
  categorizeStatuses(data, entityType, statusType) {
    const categories = {};

    data.forEach(item => {
      let category;
      
      if (statusType === 'old') {
        const mapping = this.mapStatus(entityType, item.status || item.originalStatus, { strict: false });
        category = mapping.category;
      } else {
        // For mapped data, determine category from new status
        category = this.getCategoryFromNewStatus(entityType, item.status);
      }

      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category]++;
    });

    return categories;
  }

  /**
   * Get category from new status
   */
  getCategoryFromNewStatus(entityType, newStatus) {
    const mappings = this.statusMappings[entityType];
    
    for (const [oldStatus, mapping] of Object.entries(mappings)) {
      if (mapping.newStatus === newStatus) {
        return mapping.category;
      }
    }

    return 'unknown';
  }

  /**
   * Verify subscription mapping specifically
   */
  async verifySubscriptionMapping(originalData, mappedData) {
    const verification = {
      activeCount: {
        original: this.countByCategory(originalData, 'subscription', 'active'),
        mapped: this.countByNewStatus(mappedData, ['active', 'pending_cancellation'])
      },
      trialCount: {
        original: this.countByOriginalStatus(originalData, ['wc-pending']),
        mapped: this.countByNewStatus(mappedData, ['trial'])
      },
      cancelledCount: {
        original: this.countByOriginalStatus(originalData, ['wc-cancelled', 'wc-expired']),
        mapped: this.countByNewStatus(mappedData, ['cancelled', 'expired'])
      },
      revenueImpact: await this.calculateRevenueImpact(originalData, mappedData)
    };

    // Check for discrepancies
    verification.discrepancies = [];
    
    if (verification.activeCount.original !== verification.activeCount.mapped) {
      verification.discrepancies.push({
        type: 'active_subscription_mismatch',
        original: verification.activeCount.original,
        mapped: verification.activeCount.mapped
      });
    }

    if (verification.trialCount.original !== verification.trialCount.mapped) {
      verification.discrepancies.push({
        type: 'trial_subscription_mismatch',
        original: verification.trialCount.original,
        mapped: verification.trialCount.mapped
      });
    }

    return verification;
  }

  /**
   * Verify order mapping specifically
   */
  async verifyOrderMapping(originalData, mappedData) {
    const verification = {
      revenueOrders: {
        original: this.countRevenueOrders(originalData, 'old'),
        mapped: this.countRevenueOrders(mappedData, 'new')
      },
      completedOrders: {
        original: this.countByOriginalStatus(originalData, ['wc-completed']),
        mapped: this.countByNewStatus(mappedData, ['completed'])
      },
      failedOrders: {
        original: this.countByOriginalStatus(originalData, ['wc-failed', 'wc-cancelled']),
        mapped: this.countByNewStatus(mappedData, ['failed', 'cancelled'])
      },
      totalRevenue: await this.calculateTotalRevenue(originalData, mappedData)
    };

    // Check for discrepancies
    verification.discrepancies = [];
    
    if (verification.revenueOrders.original !== verification.revenueOrders.mapped) {
      verification.discrepancies.push({
        type: 'revenue_order_mismatch',
        original: verification.revenueOrders.original,
        mapped: verification.revenueOrders.mapped
      });
    }

    return verification;
  }

  /**
   * Count by category
   */
  countByCategory(data, entityType, category) {
    return data.filter(item => {
      const mapping = this.mapStatus(entityType, item.status || item.originalStatus, { strict: false });
      return mapping.category === category;
    }).length;
  }

  /**
   * Count by original status
   */
  countByOriginalStatus(data, statuses) {
    return data.filter(item => 
      statuses.includes(item.status || item.originalStatus)
    ).length;
  }

  /**
   * Count by new status
   */
  countByNewStatus(data, statuses) {
    return data.filter(item => 
      statuses.includes(item.status || item.newStatus)
    ).length;
  }

  /**
   * Count revenue orders
   */
  countRevenueOrders(data, statusType) {
    return data.filter(item => {
      if (statusType === 'old') {
        const mapping = this.mapStatus('order', item.status || item.originalStatus, { strict: false });
        return mapping.revenue;
      } else {
        // Check if new status generates revenue
        return this.doesStatusGenerateRevenue('order', item.status);
      }
    }).length;
  }

  /**
   * Check if status generates revenue
   */
  doesStatusGenerateRevenue(entityType, status) {
    const mappings = this.statusMappings[entityType];
    
    for (const [oldStatus, mapping] of Object.entries(mappings)) {
      if (mapping.newStatus === status) {
        return mapping.revenue || false;
      }
    }

    return false;
  }

  /**
   * Calculate revenue impact
   */
  async calculateRevenueImpact(originalData, mappedData) {
    // This would calculate the financial impact of status changes
    // Simplified for now
    return {
      potentialRevenueLoss: 0,
      potentialRevenueGain: 0,
      netImpact: 0
    };
  }

  /**
   * Calculate total revenue
   */
  async calculateTotalRevenue(originalData, mappedData) {
    const originalRevenue = originalData
      .filter(order => this.isRevenueOrder('old', order))
      .reduce((sum, order) => sum + parseFloat(order.total || 0), 0);

    const mappedRevenue = mappedData
      .filter(order => this.isRevenueOrder('new', order))
      .reduce((sum, order) => sum + parseFloat(order.total || 0), 0);

    return {
      original: originalRevenue,
      mapped: mappedRevenue,
      difference: mappedRevenue - originalRevenue
    };
  }

  /**
   * Check if order generates revenue
   */
  isRevenueOrder(statusType, order) {
    if (statusType === 'old') {
      const mapping = this.mapStatus('order', order.status || order.originalStatus, { strict: false });
      return mapping.revenue;
    } else {
      return this.doesStatusGenerateRevenue('order', order.status);
    }
  }

  /**
   * Calculate verification score
   */
  calculateVerificationScore(verification) {
    const totalDiscrepancies = verification.discrepancies.length;
    const highSeverity = verification.discrepancies.filter(d => d.severity === 'high').length;
    const mediumSeverity = verification.discrepancies.filter(d => d.severity === 'medium').length;
    
    // Calculate score (0-100)
    let score = 100;
    score -= (highSeverity * 20); // High severity: -20 points each
    score -= (mediumSeverity * 10); // Medium severity: -10 points each
    score -= ((totalDiscrepancies - highSeverity - mediumSeverity) * 5); // Low severity: -5 points each
    
    return Math.max(0, score);
  }

  /**
   * Generate mapping report
   */
  async generateMappingReport(verificationResults, options = {}) {
    const report = {
      mappingId: this.mappingId,
      generatedAt: new Date(),
      summary: {
        totalEntities: verificationResults.length,
        passedVerification: verificationResults.filter(v => v.summary.status === 'passed').length,
        failedVerification: verificationResults.filter(v => v.summary.status === 'failed_with_issues').length,
        averageScore: verificationResults.reduce((sum, v) => sum + v.summary.verificationScore, 0) / verificationResults.length
      },
      entityResults: verificationResults,
      statusMappings: this.statusMappings,
      recommendations: this.generateMappingRecommendations(verificationResults)
    };

    // Save report
    if (options.saveToFile) {
      const reportPath = path.join(process.cwd(), 'migration-data', `status-mapping-report-${this.mappingId}.json`);
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 Status mapping report saved: ${reportPath}`);
    }

    return report;
  }

  /**
   * Generate mapping recommendations
   */
  generateMappingRecommendations(verificationResults) {
    const recommendations = [];

    verificationResults.forEach(result => {
      if (result.summary.verificationScore < 90) {
        recommendations.push({
          entity: result.entityType,
          priority: 'high',
          message: `${result.entityType} mapping has verification issues (score: ${result.summary.verificationScore})`
        });
      }

      result.discrepancies.forEach(discrepancy => {
        if (discrepancy.severity === 'high') {
          recommendations.push({
            entity: result.entityType,
            priority: 'critical',
            message: discrepancy.message,
            action: 'Review and correct mapping before proceeding'
          });
        }
      });
    });

    // General recommendations
    recommendations.push({
      priority: 'medium',
      message: 'Verify financial calculations after status mapping',
      action: 'Run revenue and subscription reconciliation reports'
    });

    recommendations.push({
      priority: 'low',
      message: 'Monitor status changes post-migration',
      action: 'Set up alerts for unexpected status transitions'
    });

    return recommendations;
  }

  /**
   * Export status mappings for documentation
   */
  async exportMappingsDocumentation(filePath) {
    const documentation = {
      generatedAt: new Date(),
      version: '1.0',
      mappings: {}
    };

    Object.keys(this.statusMappings).forEach(entityType => {
      documentation.mappings[entityType] = {
        description: `Status mappings for ${entityType} entities`,
        mappings: this.statusMappings[entityType]
      };
    });

    await fs.writeFile(filePath, JSON.stringify(documentation, null, 2));
    console.log(`📄 Status mappings documentation exported: ${filePath}`);
    
    return documentation;
  }

  /**
   * Validate mapping configuration
   */
  validateMappingConfiguration() {
    const validationResults = {
      valid: true,
      errors: [],
      warnings: []
    };

    Object.keys(this.statusMappings).forEach(entityType => {
      const mappings = this.statusMappings[entityType];
      
      Object.keys(mappings).forEach(oldStatus => {
        const mapping = mappings[oldStatus];
        
        // Required fields validation
        if (!mapping.newStatus) {
          validationResults.errors.push(`${entityType}.${oldStatus}: Missing newStatus`);
          validationResults.valid = false;
        }
        
        if (!mapping.category) {
          validationResults.errors.push(`${entityType}.${oldStatus}: Missing category`);
          validationResults.valid = false;
        }
        
        if (mapping.priority === undefined) {
          validationResults.warnings.push(`${entityType}.${oldStatus}: Missing priority`);
        }
      });
    });

    if (validationResults.errors.length > 0) {
      console.error('❌ Mapping configuration validation failed:', validationResults.errors);
    } else {
      console.log('✅ Mapping configuration validation passed');
    }

    return validationResults;
  }
}

module.exports = StatusMappingService;





