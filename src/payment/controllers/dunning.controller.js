const { validationResult } = require('express-validator');
const DunningCampaign = require('../models/dunningCampaign.model');
const FailedPayment = require('../models/failedPayment.model');
const Payment = require('../models/payment.model');
const User = require('../../user/models/user.model');
const Subscription = require('../../subscription/models/subscription.model');
const AuditLog = require('../../admin/models/auditLog.model');
const mongoose = require('mongoose');

/**
 * Dunning Management Controller
 * Handles automated payment recovery campaigns and failed payment management
 */
class DunningController {

  /**
   * Get dunning campaigns with filtering
   * @route GET /v1/dunning/campaigns
   */
  async getCampaigns(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 25,
        status = 'all',
        type = 'all',
        createdBy,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeMetrics = false
      } = req.query;

      // Build filters
      const filters = {};

      if (status !== 'all') {
        filters.status = status;
      }

      if (type !== 'all') {
        filters.type = type;
      }

      if (createdBy) {
        filters.createdBy = new mongoose.Types.ObjectId(createdBy);
      }

      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Aggregation pipeline
      const pipeline = [
        { $match: filters }
      ];

      // Add metrics if requested
      if (includeMetrics) {
        pipeline.push(
          {
            $lookup: {
              from: 'failedpayments',
              localField: '_id',
              foreignField: 'dunningCampaign',
              as: 'failedPayments'
            }
          },
          {
            $addFields: {
              metrics: {
                totalExecutions: { $size: '$executions' },
                totalFailedPayments: { $size: '$failedPayments' },
                recoveredPayments: {
                  $size: {
                    $filter: {
                      input: '$failedPayments',
                      cond: { $eq: ['$$this.status', 'recovered'] }
                    }
                  }
                },
                recoveredAmount: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$failedPayments',
                          cond: { $eq: ['$$this.status', 'recovered'] }
                        }
                      },
                      as: 'payment',
                      in: '$$payment.amount'
                    }
                  }
                },
                successRate: {
                  $cond: [
                    { $gt: [{ $size: '$failedPayments' }, 0] },
                    {
                      $multiply: [
                        {
                          $divide: [
                            {
                              $size: {
                                $filter: {
                                  input: '$failedPayments',
                                  cond: { $eq: ['$$this.status', 'recovered'] }
                                }
                              }
                            },
                            { $size: '$failedPayments' }
                          ]
                        },
                        100
                      ]
                    },
                    0
                  ]
                }
              }
            }
          }
        );
      }

      // Sorting
      const sortOptions = {};
      if (sortBy === 'successRate' && includeMetrics) {
        sortOptions['metrics.successRate'] = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'recoveredAmount' && includeMetrics) {
        sortOptions['metrics.recoveredAmount'] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      }
      pipeline.push({ $sort: sortOptions });

      // Pagination
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

      // Execute aggregation
      const [campaigns, totalCount] = await Promise.all([
        DunningCampaign.aggregate(pipeline),
        DunningCampaign.countDocuments(filters)
      ]);

      // Populate created by user
      await DunningCampaign.populate(campaigns, {
        path: 'createdBy',
        select: 'firstName lastName email'
      });

      // Calculate summary
      const summary = {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      };

      // Add aggregate metrics if requested
      if (includeMetrics) {
        const aggregateMetrics = campaigns.reduce((acc, campaign) => {
          if (campaign.metrics) {
            acc.totalExecutions += campaign.metrics.totalExecutions || 0;
            acc.totalFailedPayments += campaign.metrics.totalFailedPayments || 0;
            acc.totalRecoveredPayments += campaign.metrics.recoveredPayments || 0;
            acc.totalRecoveredAmount += campaign.metrics.recoveredAmount || 0;
          }
          return acc;
        }, {
          totalExecutions: 0,
          totalFailedPayments: 0,
          totalRecoveredPayments: 0,
          totalRecoveredAmount: 0
        });

        aggregateMetrics.overallSuccessRate = aggregateMetrics.totalFailedPayments > 0 ?
          (aggregateMetrics.totalRecoveredPayments / aggregateMetrics.totalFailedPayments) * 100 : 0;

        summary.aggregateMetrics = aggregateMetrics;
      }

      res.status(200).json({
        success: true,
        data: {
          campaigns,
          pagination: summary,
          appliedFilters: {
            status,
            type,
            createdBy,
            search,
            includeMetrics
          }
        }
      });

    } catch (error) {
      console.error('Error in getCampaigns:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve campaigns',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create new dunning campaign
   * @route POST /v1/dunning/campaigns
   */
  async createCampaign(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        name,
        description,
        type,
        triggerConditions,
        retrySchedule,
        emailTemplate,
        smsTemplate,
        webhookConfig,
        active = false,
        priority = 5,
        tags = [],
        metadata = {}
      } = req.body;

      // Validate retry schedule structure
      for (const step of retrySchedule) {
        if (!step.delayDays && step.delayDays !== 0) {
          return res.status(400).json({
            success: false,
            message: 'Each retry step must have delayDays specified'
          });
        }
        if (!step.action) {
          return res.status(400).json({
            success: false,
            message: 'Each retry step must have an action specified'
          });
        }
      }

      // Check for duplicate campaign names
      const existingCampaign = await DunningCampaign.findOne({
        name: name.trim(),
        status: { $ne: 'deleted' }
      });

      if (existingCampaign) {
        return res.status(409).json({
          success: false,
          message: 'Campaign with this name already exists'
        });
      }

      // Create campaign data
      const campaignData = {
        name: name.trim(),
        description: description?.trim(),
        type,
        triggerConditions: {
          failedPaymentCount: triggerConditions.failedPaymentCount,
          daysSinceFailure: triggerConditions.daysSinceFailure,
          amountThreshold: triggerConditions.amountThreshold || 0,
          excludeTrialUsers: triggerConditions.excludeTrialUsers || false,
          planTypes: triggerConditions.planTypes || [],
          subscriberSegments: triggerConditions.subscriberSegments || []
        },
        retrySchedule: retrySchedule.map((step, index) => ({
          stepNumber: index + 1,
          delayDays: step.delayDays,
          action: step.action,
          escalationLevel: step.escalationLevel || 'medium',
          conditions: step.conditions || {},
          metadata: step.metadata || {}
        })),
        templates: {},
        status: active ? 'active' : 'draft',
        priority,
        tags,
        metadata: {
          ...metadata,
          version: '1.0',
          createdFrom: 'api'
        },
        createdBy: req.user._id,
        configuration: {
          maxRetryAttempts: retrySchedule.length,
          stopOnSuccess: true,
          allowManualOverride: true,
          trackingEnabled: true
        },
        executions: [],
        metrics: {
          totalExecutions: 0,
          successfulRecoveries: 0,
          failedRecoveries: 0,
          totalRecoveredAmount: 0,
          averageRecoveryTime: 0,
          lastExecutionAt: null
        }
      };

      // Add templates based on campaign type
      if (type === 'email' || type === 'multi') {
        if (!emailTemplate) {
          return res.status(400).json({
            success: false,
            message: 'Email template is required for email campaigns'
          });
        }
        campaignData.templates.email = {
          subject: emailTemplate.subject,
          htmlBody: emailTemplate.htmlBody,
          textBody: emailTemplate.textBody,
          variables: emailTemplate.variables || [],
          personalizations: emailTemplate.personalizations || {}
        };
      }

      if (type === 'sms' || type === 'multi') {
        if (!smsTemplate) {
          return res.status(400).json({
            success: false,
            message: 'SMS template is required for SMS campaigns'
          });
        }
        campaignData.templates.sms = {
          message: smsTemplate.message,
          variables: smsTemplate.variables || [],
          maxLength: smsTemplate.maxLength || 160
        };
      }

      if (type === 'webhook' || type === 'multi') {
        if (!webhookConfig) {
          return res.status(400).json({
            success: false,
            message: 'Webhook configuration is required for webhook campaigns'
          });
        }
        campaignData.webhookConfig = {
          url: webhookConfig.url,
          method: webhookConfig.method || 'POST',
          headers: webhookConfig.headers || {},
          payload: webhookConfig.payload || {},
          authentication: webhookConfig.authentication || {},
          retryPolicy: webhookConfig.retryPolicy || {
            maxRetries: 3,
            backoffMultiplier: 2,
            maxBackoffSeconds: 300
          }
        };
      }

      // Create campaign
      const campaign = new DunningCampaign(campaignData);
      await campaign.save();

      // Log campaign creation
      await AuditLog.create({
        userId: req.user._id,
        action: 'DUNNING_CAMPAIGN_CREATED',
        details: {
          campaignId: campaign._id,
          campaignName: campaign.name,
          type: campaign.type,
          retrySteps: campaign.retrySchedule.length,
          active: campaign.status === 'active',
          ipAddress: req.ip
        }
      });

      // Populate created by user for response
      await campaign.populate('createdBy', 'firstName lastName email');

      res.status(201).json({
        success: true,
        message: 'Dunning campaign created successfully',
        data: {
          campaign: {
            id: campaign._id,
            name: campaign.name,
            type: campaign.type,
            status: campaign.status,
            triggerConditions: campaign.triggerConditions,
            retrySchedule: campaign.retrySchedule,
            createdBy: campaign.createdBy,
            createdAt: campaign.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Error in createCampaign:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create campaign',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get campaign details by ID
   * @route GET /v1/dunning/campaigns/:id
   */
  async getCampaignById(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        includeMetrics = false,
        includeExecutions = false,
        executionLimit = 50
      } = req.query;

      const campaign = await DunningCampaign.findById(id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email');

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      let responseData = {
        campaign
      };

      // Add metrics if requested
      if (includeMetrics) {
        const metrics = await this.calculateCampaignMetrics(id);
        responseData.metrics = metrics;
      }

      // Add recent executions if requested
      if (includeExecutions) {
        const executions = campaign.executions
          .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
          .slice(0, parseInt(executionLimit));
        responseData.recentExecutions = executions;
      }

      // Add related data
      const relatedData = await Promise.all([
        FailedPayment.countDocuments({ dunningCampaign: id }),
        FailedPayment.countDocuments({ dunningCampaign: id, status: 'recovered' }),
        FailedPayment.countDocuments({ dunningCampaign: id, status: 'abandoned' })
      ]);

      responseData.relatedCounts = {
        totalFailedPayments: relatedData[0],
        recoveredPayments: relatedData[1],
        abandonedPayments: relatedData[2]
      };

      res.status(200).json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('Error in getCampaignById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve campaign',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get failed payments with recovery status
   * @route GET /v1/dunning/failed-payments
   */
  async getFailedPayments(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        page = 1,
        limit = 25,
        status = 'all',
        failureReason = 'all',
        amount,
        amountMin,
        amountMax,
        subscriberId,
        campaignId,
        dateFrom,
        dateTo,
        retryAttempts,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeRecoveryData = false,
        includeCampaignData = false
      } = req.query;

      // Build filters
      const filters = {};

      if (status !== 'all') {
        filters.status = status;
      }

      if (failureReason !== 'all') {
        filters.failureReason = failureReason;
      }

      if (amount) {
        filters.amount = parseFloat(amount);
      }

      if (amountMin || amountMax) {
        filters.amount = {};
        if (amountMin) filters.amount.$gte = parseFloat(amountMin);
        if (amountMax) filters.amount.$lte = parseFloat(amountMax);
      }

      if (subscriberId) {
        filters.userId = new mongoose.Types.ObjectId(subscriberId);
      }

      if (campaignId) {
        filters.dunningCampaign = new mongoose.Types.ObjectId(campaignId);
      }

      if (dateFrom || dateTo) {
        filters.createdAt = {};
        if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filters.createdAt.$lte = new Date(dateTo);
      }

      if (retryAttempts !== undefined) {
        filters.retryAttempts = parseInt(retryAttempts);
      }

      // Aggregation pipeline
      const pipeline = [
        { $match: filters },
        {
          $lookup: {
            from: 'enhancedusers',
            localField: 'userId',
            foreignField: '_id',
            as: 'subscriber',
            pipeline: [
              {
                $project: {
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  currentPlan: 1
                }
              }
            ]
          }
        }
      ];

      // Add campaign data if requested
      if (includeCampaignData) {
        pipeline.push({
          $lookup: {
            from: 'dunningcampaigns',
            localField: 'dunningCampaign',
            foreignField: '_id',
            as: 'campaign',
            pipeline: [
              {
                $project: {
                  name: 1,
                  type: 1,
                  status: 1
                }
              }
            ]
          }
        });
      }

      // Add recovery data if requested
      if (includeRecoveryData) {
        pipeline.push(
          {
            $lookup: {
              from: 'payments',
              localField: 'recoveredPaymentId',
              foreignField: '_id',
              as: 'recoveredPayment'
            }
          },
          {
            $addFields: {
              recoveryTimeline: '$retryHistory',
              timeToRecover: {
                $cond: [
                  { $eq: ['$status', 'recovered'] },
                  {
                    $divide: [
                      { $subtract: ['$recoveredAt', '$createdAt'] },
                      86400000 // Convert to days
                    ]
                  },
                  null
                ]
              }
            }
          }
        );
      }

      // Sorting
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      pipeline.push({ $sort: sortOptions });

      // Pagination
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

      // Execute aggregation
      const [failedPayments, totalCount] = await Promise.all([
        FailedPayment.aggregate(pipeline),
        FailedPayment.countDocuments(filters)
      ]);

      // Calculate summary metrics
      const summaryPipeline = [
        { $match: filters },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalRecovered: {
              $sum: {
                $cond: [{ $eq: ['$status', 'recovered'] }, '$amount', 0]
              }
            },
            averageAmount: { $avg: '$amount' },
            averageRetryAttempts: { $avg: '$retryAttempts' },
            statusDistribution: {
              $push: '$status'
            }
          }
        }
      ];

      const [summaryResult] = await FailedPayment.aggregate(summaryPipeline);

      const summary = {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
        metrics: summaryResult ? {
          totalAmount: summaryResult.totalAmount || 0,
          totalRecovered: summaryResult.totalRecovered || 0,
          recoveryRate: summaryResult.totalAmount > 0 ?
            (summaryResult.totalRecovered / summaryResult.totalAmount) * 100 : 0,
          averageAmount: summaryResult.averageAmount || 0,
          averageRetryAttempts: summaryResult.averageRetryAttempts || 0,
          statusDistribution: this.calculateStatusDistribution(summaryResult.statusDistribution || [])
        } : null
      };

      res.status(200).json({
        success: true,
        data: {
          failedPayments,
          pagination: summary,
          appliedFilters: {
            status,
            failureReason,
            amount: { exact: amount, min: amountMin, max: amountMax },
            subscriberId,
            campaignId,
            dateRange: { from: dateFrom, to: dateTo },
            retryAttempts,
            includeRecoveryData,
            includeCampaignData
          }
        }
      });

    } catch (error) {
      console.error('Error in getFailedPayments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve failed payments',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get failed payment details with recovery timeline
   * @route GET /v1/dunning/failed-payments/:id
   */
  async getFailedPaymentById(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const {
        includeTimeline = true,
        includeSubscriberData = true,
        includePaymentMethod = false
      } = req.query;

      const pipeline = [
        { $match: { _id: new mongoose.Types.ObjectId(id) } }
      ];

      // Add subscriber data if requested
      if (includeSubscriberData) {
        pipeline.push({
          $lookup: {
            from: 'enhancedusers',
            localField: 'userId',
            foreignField: '_id',
            as: 'subscriber'
          }
        });
      }

      // Add campaign data
      pipeline.push({
        $lookup: {
          from: 'dunningcampaigns',
          localField: 'dunningCampaign',
          foreignField: '_id',
          as: 'campaign'
        }
      });

      // Add related subscription data
      pipeline.push({
        $lookup: {
          from: 'subscriptions',
          localField: 'subscriptionId',
          foreignField: '_id',
          as: 'subscription'
        }
      });

      const [failedPayment] = await FailedPayment.aggregate(pipeline);

      if (!failedPayment) {
        return res.status(404).json({
          success: false,
          message: 'Failed payment not found'
        });
      }

      let responseData = {
        failedPayment
      };

      // Add timeline if requested
      if (includeTimeline) {
        responseData.timeline = this.buildRecoveryTimeline(failedPayment);
      }

      // Add payment method info if requested and user has permission
      if (includePaymentMethod && ['ADMIN', 'FINANCE'].includes(req.user.role)) {
        const subscriber = failedPayment.subscriber?.[0];
        if (subscriber?.billing?.paymentMethods) {
          responseData.paymentMethods = subscriber.billing.paymentMethods.map(method => ({
            id: method.id,
            type: method.type,
            last4: method.last4,
            brand: method.brand,
            expiryMonth: method.expiryMonth,
            expiryYear: method.expiryYear,
            isDefault: method.id === subscriber.billing.defaultPaymentMethod,
            isExpired: new Date() > new Date(method.expiryYear, method.expiryMonth - 1)
          }));
        }
      }

      res.status(200).json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('Error in getFailedPaymentById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve failed payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Helper Methods

  /**
   * Calculate campaign metrics
   */
  async calculateCampaignMetrics(campaignId) {
    const pipeline = [
      {
        $match: {
          dunningCampaign: new mongoose.Types.ObjectId(campaignId)
        }
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          recoveredPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, 1, 0] }
          },
          recoveredAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, '$amount', 0] }
          },
          abandonedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] }
          },
          averageRetryAttempts: { $avg: '$retryAttempts' },
          recoveryTimes: {
            $push: {
              $cond: [
                { $eq: ['$status', 'recovered'] },
                {
                  $divide: [
                    { $subtract: ['$recoveredAt', '$createdAt'] },
                    86400000 // Convert to days
                  ]
                },
                null
              ]
            }
          }
        }
      }
    ];

    const [result] = await FailedPayment.aggregate(pipeline);

    if (!result) {
      return {
        totalPayments: 0,
        totalAmount: 0,
        recoveredPayments: 0,
        recoveredAmount: 0,
        abandonedPayments: 0,
        successRate: 0,
        recoveryRate: 0,
        averageRetryAttempts: 0,
        averageRecoveryTime: 0
      };
    }

    const recoveryTimes = result.recoveryTimes.filter(time => time !== null);
    const averageRecoveryTime = recoveryTimes.length > 0 ?
      recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length : 0;

    return {
      totalPayments: result.totalPayments,
      totalAmount: result.totalAmount,
      recoveredPayments: result.recoveredPayments,
      recoveredAmount: result.recoveredAmount,
      abandonedPayments: result.abandonedPayments,
      successRate: result.totalPayments > 0 ?
        (result.recoveredPayments / result.totalPayments) * 100 : 0,
      recoveryRate: result.totalAmount > 0 ?
        (result.recoveredAmount / result.totalAmount) * 100 : 0,
      averageRetryAttempts: result.averageRetryAttempts || 0,
      averageRecoveryTime: Math.round(averageRecoveryTime * 100) / 100
    };
  }

  /**
   * Calculate status distribution
   */
  calculateStatusDistribution(statuses) {
    const distribution = {};
    statuses.forEach(status => {
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Build recovery timeline for a failed payment
   */
  buildRecoveryTimeline(failedPayment) {
    const timeline = [];

    // Add initial failure
    timeline.push({
      timestamp: failedPayment.createdAt,
      event: 'payment_failed',
      description: `Payment failed: ${failedPayment.failureReason}`,
      amount: failedPayment.amount,
      details: {
        reason: failedPayment.failureReason,
        errorCode: failedPayment.errorCode,
        originalPaymentId: failedPayment.originalPaymentId
      }
    });

    // Add retry history
    if (failedPayment.retryHistory) {
      failedPayment.retryHistory.forEach((retry, index) => {
        timeline.push({
          timestamp: retry.attemptedAt,
          event: retry.success ? 'retry_success' : 'retry_failed',
          description: retry.success ?
            'Payment retry successful' :
            `Retry attempt ${index + 1} failed: ${retry.failureReason}`,
          amount: retry.amount,
          details: {
            attempt: index + 1,
            success: retry.success,
            failureReason: retry.failureReason,
            paymentMethodId: retry.paymentMethodId,
            campaignStep: retry.campaignStep
          }
        });
      });
    }

    // Add recovery or abandonment
    if (failedPayment.status === 'recovered' && failedPayment.recoveredAt) {
      timeline.push({
        timestamp: failedPayment.recoveredAt,
        event: 'payment_recovered',
        description: 'Payment successfully recovered',
        amount: failedPayment.amount,
        details: {
          recoveredPaymentId: failedPayment.recoveredPaymentId,
          totalAttempts: failedPayment.retryAttempts,
          recoveryMethod: failedPayment.recoveryMethod
        }
      });
    } else if (failedPayment.status === 'abandoned' && failedPayment.abandonedAt) {
      timeline.push({
        timestamp: failedPayment.abandonedAt,
        event: 'payment_abandoned',
        description: 'Payment recovery abandoned',
        details: {
          reason: failedPayment.abandonmentReason,
          totalAttempts: failedPayment.retryAttempts,
          abandonedBy: failedPayment.abandonedBy
        }
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Update campaign
   * @route PUT /v1/dunning/campaigns/:id
   */
  async updateCampaign(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updates = req.body;

      const campaign = await DunningCampaign.findById(id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found'
        });
      }

      // Track changes for audit
      const changes = {};
      Object.keys(updates).forEach(key => {
        if (JSON.stringify(campaign[key]) !== JSON.stringify(updates[key])) {
          changes[key] = { from: campaign[key], to: updates[key] };
        }
      });

      // Update campaign
      Object.assign(campaign, updates);
      campaign.updatedAt = new Date();
      campaign.updatedBy = req.user._id;

      await campaign.save();

      // Log update
      await AuditLog.create({
        userId: req.user._id,
        action: 'DUNNING_CAMPAIGN_UPDATED',
        details: {
          campaignId: campaign._id,
          changes,
          ipAddress: req.ip
        }
      });

      res.status(200).json({
        success: true,
        message: 'Campaign updated successfully',
        data: { campaign }
      });

    } catch (error) {
      console.error('Error in updateCampaign:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update campaign',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Process dunning campaigns (automated execution)
   * @route POST /v1/dunning/process
   */
  async processDunning(req, res) {
    try {
      const { campaignId, dryRun = false } = req.body;

      let campaigns;
      if (campaignId) {
        campaigns = await DunningCampaign.find({ _id: campaignId, status: 'active' });
      } else {
        campaigns = await DunningCampaign.find({ status: 'active' });
      }

      const results = {
        campaignsProcessed: 0,
        paymentsProcessed: 0,
        retriesScheduled: 0,
        emailsSent: 0,
        smsSent: 0,
        subscriptionsCancelled: 0,
        errors: []
      };

      for (const campaign of campaigns) {
        try {
          const campaignResult = await this.processCampaign(campaign, dryRun);
          results.campaignsProcessed++;
          results.paymentsProcessed += campaignResult.paymentsProcessed;
          results.retriesScheduled += campaignResult.retriesScheduled;
          results.emailsSent += campaignResult.emailsSent;
          results.smsSent += campaignResult.smsSent;
          results.subscriptionsCancelled += campaignResult.subscriptionsCancelled;
        } catch (error) {
          console.error(`Error processing campaign ${campaign._id}:`, error);
          results.errors.push({
            campaignId: campaign._id,
            error: error.message
          });
        }
      }

      // Log execution
      await AuditLog.create({
        userId: req.user?._id || 'system',
        action: 'DUNNING_PROCESS_EXECUTED',
        details: {
          results,
          dryRun,
          processedAt: new Date(),
          ipAddress: req.ip
        }
      });

      res.status(200).json({
        success: true,
        message: dryRun ? 'Dunning process simulated' : 'Dunning process executed',
        data: results
      });

    } catch (error) {
      console.error('Error in processDunning:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process dunning',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Process individual campaign
   */
  async processCampaign(campaign, dryRun = false) {
    const results = {
      paymentsProcessed: 0,
      retriesScheduled: 0,
      emailsSent: 0,
      smsSent: 0,
      subscriptionsCancelled: 0
    };

    // Find eligible failed payments
    const eligiblePayments = await this.findEligiblePayments(campaign);

    for (const payment of eligiblePayments) {
      try {
        // Process payment based on campaign logic
        const processResult = await this.processFailedPayment(payment, campaign, dryRun);

        results.paymentsProcessed++;
        if (processResult.retryScheduled) results.retriesScheduled++;
        if (processResult.emailSent) results.emailsSent++;
        if (processResult.smsSent) results.smsSent++;
        if (processResult.subscriptionCancelled) results.subscriptionsCancelled++;

      } catch (error) {
        console.error(`Error processing payment ${payment._id}:`, error);
      }
    }

    return results;
  }

  /**
   * Find eligible payments for dunning
   */
  async findEligiblePayments(campaign) {
    const query = {
      status: 'pending',
      retryAttempts: { $lt: campaign.retrySchedule.length }
    };

    // Apply campaign trigger conditions
    if (campaign.triggerConditions.amountThreshold) {
      query.amount = { $gte: campaign.triggerConditions.amountThreshold };
    }

    const payments = await FailedPayment.find(query)
      .populate('userId', 'firstName lastName email currentPlan')
      .populate('subscriptionId', 'plan status mrr');

    return payments.filter(payment => {
      // Additional filtering based on campaign conditions
      if (campaign.triggerConditions.excludeTrialUsers) {
        if (payment.subscriptionId?.status === 'trial') return false;
      }

      if (campaign.triggerConditions.planTypes?.length > 0) {
        if (!campaign.triggerConditions.planTypes.includes(payment.subscriptionId?.plan)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Process individual failed payment
   */
  async processFailedPayment(payment, campaign, dryRun) {
    const result = {
      retryScheduled: false,
      emailSent: false,
      smsSent: false,
      subscriptionCancelled: false
    };

    const currentStep = campaign.retrySchedule[payment.retryAttempts];
    if (!currentStep) return result;

    // Check if enough time has passed for this retry
    const daysSinceLastAttempt = (Date.now() - payment.lastRetryAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastAttempt < currentStep.delayDays) return result;

    if (dryRun) {
      console.log(`[DRY RUN] Would execute step ${currentStep.stepNumber} for payment ${payment._id}`);
      return { ...result, retryScheduled: true };
    }

    // Execute step action
    switch (currentStep.action) {
      case 'retry_payment':
        await this.executePaymentRetry(payment);
        result.retryScheduled = true;
        break;

      case 'send_email':
        await this.sendDunningEmail(payment, campaign);
        result.emailSent = true;
        break;

      case 'send_sms':
        await this.sendDunningSms(payment, campaign);
        result.smsSent = true;
        break;

      case 'cancel_subscription':
        await this.cancelSubscriptionForFailure(payment);
        result.subscriptionCancelled = true;
        break;
    }

    // Update payment retry tracking
    payment.retryAttempts++;
    payment.lastRetryAt = new Date();
    await payment.save();

    return result;
  }

  /**
   * Execute payment retry
   */
  async executePaymentRetry(payment) {
    // Simulate payment retry
    const retrySuccessful = Math.random() > 0.4; // 60% success rate

    if (retrySuccessful) {
      // Create successful payment
      const successfulPayment = new Payment({
        userId: payment.userId,
        subscriptionId: payment.subscriptionId,
        amount: payment.amount,
        currency: payment.currency || 'USD',
        status: 'completed',
        description: `Dunning retry for failed payment`,
        metadata: {
          isDunningRetry: true,
          originalFailedPaymentId: payment._id
        }
      });
      await successfulPayment.save();

      // Update failed payment status
      payment.status = 'recovered';
      payment.recoveredAt = new Date();
      payment.recoveredPaymentId = successfulPayment._id;
      await payment.save();

      // Update subscription
      await Subscription.findByIdAndUpdate(payment.subscriptionId, {
        $set: { status: 'active', paymentStatus: 'current' }
      });
    }

    return retrySuccessful;
  }

  /**
   * Send dunning email
   */
  async sendDunningEmail(payment, campaign) {
    const template = campaign.templates?.email;
    if (!template) return false;

    console.log(`Sending dunning email to ${payment.userId.email}`);

    // In real implementation, integrate with email service
    return true;
  }

  /**
   * Send dunning SMS
   */
  async sendDunningSms(payment, campaign) {
    const template = campaign.templates?.sms;
    if (!template) return false;

    console.log(`Sending dunning SMS to user ${payment.userId._id}`);

    // In real implementation, integrate with SMS service
    return true;
  }

  /**
   * Cancel subscription for payment failure
   */
  async cancelSubscriptionForFailure(payment) {
    await Subscription.findByIdAndUpdate(payment.subscriptionId, {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'payment_failure',
        endedAt: new Date()
      }
    });

    await EnhancedUser.findByIdAndUpdate(payment.userId, {
      $set: {
        subscriptionStatus: 'cancelled',
        accessLevel: 'limited'
      }
    });

    payment.status = 'abandoned';
    payment.abandonedAt = new Date();
    payment.abandonmentReason = 'subscription_cancelled';
    await payment.save();
  }

  /**
   * Get analytics overview
   * @route GET /v1/dunning/analytics
   */
  async getAnalyticsOverview(req, res) {
    try {
      const { period = '30d' } = req.query;

      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };

      const days = periodDays[period] || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get overview metrics
      const overview = await FailedPayment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalFailedPayments: { $sum: 1 },
            totalFailedAmount: { $sum: '$amount' },
            recoveredPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, 1, 0] }
            },
            recoveredAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'recovered'] }, '$amount', 0] }
            },
            abandonedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] }
            }
          }
        }
      ]);

      const metrics = overview[0] || {
        totalFailedPayments: 0,
        totalFailedAmount: 0,
        recoveredPayments: 0,
        recoveredAmount: 0,
        abandonedPayments: 0
      };

      metrics.recoveryRate = metrics.totalFailedPayments > 0 ?
        (metrics.recoveredPayments / metrics.totalFailedPayments) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          period,
          dateRange: { from: startDate, to: new Date() },
          metrics
        }
      });

    } catch (error) {
      console.error('Error in getAnalyticsOverview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Retry failed payment manually
   * @route POST /v1/dunning/failed-payments/:id/retry
   */
  async retryFailedPayment(req, res) {
    try {
      const { id } = req.params;
      const { useNewPaymentMethod = false, paymentMethodId } = req.body;

      const failedPayment = await FailedPayment.findById(id);
      if (!failedPayment) {
        return res.status(404).json({
          success: false,
          message: 'Failed payment not found'
        });
      }

      // Execute retry
      const retrySuccessful = await this.executePaymentRetry(failedPayment);

      // Log the manual retry
      await AuditLog.create({
        userId: req.user._id,
        action: 'MANUAL_PAYMENT_RETRY',
        details: {
          failedPaymentId: failedPayment._id,
          successful: retrySuccessful,
          useNewPaymentMethod,
          paymentMethodId,
          ipAddress: req.ip
        }
      });

      res.status(200).json({
        success: true,
        message: retrySuccessful ? 'Payment retry successful' : 'Payment retry failed',
        data: {
          successful: retrySuccessful,
          paymentId: failedPayment._id,
          status: failedPayment.status
        }
      });

    } catch (error) {
      console.error('Error in retryFailedPayment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retry payment',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new DunningController();





