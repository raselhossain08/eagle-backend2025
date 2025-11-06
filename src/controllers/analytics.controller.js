const AnalyticsEvent = require("../models/analyticsEvent.model"); // Use simpler model
const crypto = require('crypto'); // For generating IDs
// const User = require("../models/user.model"); // Temporarily commented to avoid potential circular dependency

// Simple UUID generator function with timestamp for uniqueness
function generateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${randomStr}`;
}

/**
 * Batch Events Controller
 * Handles multiple analytics events in a single request
 */
exports.batchEvents = async (req, res) => {
  try {
    // Log request body for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📥 Batch Events Request Body:', JSON.stringify(req.body, null, 2));
    }

    const { events } = req.body;

    // Check if events exist
    if (!events) {
      return res.status(400).json({
        success: false,
        message: "Missing 'events' array in request body",
        receivedBody: process.env.NODE_ENV === 'development' ? req.body : undefined,
        example: {
          events: [
            {
              type: "page_view",
              properties: { page: "/home" }
            }
          ]
        }
      });
    }

    // Check if events is an array
    if (!Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: "'events' must be an array",
        receivedType: typeof events,
        example: {
          events: [
            {
              type: "page_view",
              properties: { page: "/home" }
            }
          ]
        }
      });
    }

    // Check if events array is not empty
    if (events.length === 0) {
      return res.status(400).json({
        success: false,
        message: "'events' array cannot be empty",
        example: {
          events: [
            {
              type: "page_view",
              properties: { page: "/home" }
            }
          ]
        }
      });
    }

    // Valid event types
    const validTypes = [
      'page_view', 'user_action', 'signup_started', 'signup_completed',
      'login', 'logout', 'subscription_viewed', 'payment_started',
      'payment_completed', 'feature_usage', 'error_occurred', 'download',
      'video_play', 'video_pause', 'form_submit', 'search', 'share', 'custom'
    ];

    // Validate each event
    const validatedEvents = [];
    const errors = [];
    const warnings = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Log each event for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Validating Event ${i}:`, JSON.stringify(event, null, 2));
      }

      // Check if event is an object
      if (!event || typeof event !== 'object') {
        errors.push(`Event ${i}: must be an object, received ${typeof event}`);
        continue;
      }

      // Basic validation - type is required
      if (!event.type) {
        errors.push(`Event ${i}: 'type' field is required. Received keys: [${Object.keys(event).join(', ')}]`);
        continue;
      }

      // Check if type is valid, if not default to 'custom'
      let eventType = event.type;
      let eventCategory = 'custom';

      if (!validTypes.includes(event.type)) {
        warnings.push(`Event ${i}: type '${event.type}' not recognized, using 'custom' instead. Valid types: ${validTypes.join(', ')}`);
        eventType = 'custom';
      }

      // Map event type to category for analytics model
      const typeToCategory = {
        'page_view': 'page_view',
        'signup_started': 'conversion',
        'signup_completed': 'conversion',
        'login': 'user_interaction',
        'logout': 'user_interaction',
        'subscription_viewed': 'engagement',
        'payment_started': 'conversion',
        'payment_completed': 'conversion',
        'feature_usage': 'engagement',
        'error_occurred': 'error',
        'user_action': 'user_interaction',
        'custom': 'custom'
      };

      eventCategory = typeToCategory[eventType] || 'custom';

      // Generate required IDs  
      const sessionId = event.sessionId || generateId();

      // Get page information
      const pageUrl = event.properties?.url || event.properties?.page || req.headers.referer || 'unknown';
      const pagePath = event.properties?.path || event.properties?.page || '/';

      const validatedEvent = {
        // Simple model fields
        type: eventType,
        userId: event.userId || null,
        sessionId,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        properties: event.properties || {},
        metadata: {
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.connection.remoteAddress || 'Unknown',
          referer: req.headers.referer || null,
          device: event.device?.type || 'unknown',
          browser: event.browser?.name || 'unknown',
          os: event.os?.name || 'unknown',
          ...event.metadata
        }
      };

      validatedEvents.push(validatedEvent);
    }    // If there are critical errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors - please fix the following issues",
        errors,
        validEventTypes: validTypes,
        example: {
          events: [
            {
              type: "page_view",
              userId: "optional_user_id",
              sessionId: "optional_session_id",
              properties: {
                page: "/dashboard",
                referrer: "https://google.com"
              }
            }
          ]
        }
      });
    }

    // If no valid events after validation
    if (validatedEvents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid events to process",
        validEventTypes: validTypes
      });
    }

    // Save events to database
    const savedEvents = await AnalyticsEvent.insertMany(validatedEvents);

    res.status(200).json({
      success: true,
      message: `Successfully processed ${savedEvents.length} event(s)`,
      data: {
        processed: savedEvents.length,
        eventIds: savedEvents.map(event => event._id)
      },
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error) {
    console.error("Batch events error:", error);

    // Better error handling for mongoose validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Database validation failed",
        errors: Object.values(error.errors).map(e => e.message),
        error: process.env.NODE_ENV === 'development' ? error.message : 'Validation error'
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to process batch events",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Single Event Controller
 * Handles single analytics event
 */
exports.singleEvent = async (req, res) => {
  try {
    const { type, userId, sessionId, properties, metadata } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Event type is required"
      });
    }

    const analyticsEvent = new AnalyticsEvent({
      type,
      userId: userId || null,
      sessionId: sessionId || null,
      timestamp: new Date(),
      properties: properties || {},
      metadata: {
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.connection.remoteAddress || 'Unknown',
        referer: req.headers.referer || null,
        ...metadata
      }
    });

    const savedEvent = await analyticsEvent.save();

    res.status(200).json({
      success: true,
      message: "Event recorded successfully",
      data: {
        eventId: savedEvent._id,
        type: savedEvent.type,
        timestamp: savedEvent.timestamp
      }
    });

  } catch (error) {
    console.error("Single event error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record event",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get Events Controller
 * Retrieves analytics events with filtering and pagination
 */
exports.getEvents = async (req, res) => {
  try {
    const {
      type,
      userId,
      sessionId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    const query = {};

    if (type) query.type = type;
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const events = await AnalyticsEvent.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'email firstName lastName');

    const total = await AnalyticsEvent.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve events",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Dashboard Stats Controller
 * Provides analytics dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Aggregate analytics data
    const [
      totalEvents,
      uniqueUsers,
      topEvents,
      hourlyDistribution
    ] = await Promise.all([
      // Total events count
      AnalyticsEvent.countDocuments({
        timestamp: { $gte: startDate }
      }),

      // Unique users count
      AnalyticsEvent.distinct('userId', {
        timestamp: { $gte: startDate },
        userId: { $ne: null }
      }),

      // Top event types
      AnalyticsEvent.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Hourly distribution
      AnalyticsEvent.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: { $hour: '$timestamp' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalEvents,
          uniqueUsers: uniqueUsers.length,
          timeRange
        },
        topEvents,
        hourlyDistribution,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate dashboard stats",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * User Activity Controller
 * Tracks user activity patterns
 */
exports.getUserActivity = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const dateFilter = {
      userId,
      timestamp: {}
    };

    if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
    if (endDate) dateFilter.timestamp.$lte = new Date(endDate);

    if (!startDate && !endDate) {
      // Default to last 30 days
      dateFilter.timestamp.$gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const userActivity = await AnalyticsEvent.find(dateFilter)
      .sort({ timestamp: -1 })
      .limit(1000);

    const activitySummary = await AnalyticsEvent.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            type: "$type"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        userId,
        recentActivity: userActivity,
        summary: activitySummary
      }
    });

  } catch (error) {
    console.error("User activity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve user activity",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Popular Content Controller
 * Analyzes popular content and features
 */
exports.getPopularContent = async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;

    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const popularContent = await AnalyticsEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          type: { $in: ['page_view', 'content_view', 'feature_usage'] }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            content: '$properties.page'
          },
          views: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          type: '$_id.type',
          content: '$_id.content',
          views: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      { $sort: { views: -1 } },
      { $limit: 20 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        timeRange,
        popularContent
      }
    });

  } catch (error) {
    console.error("Popular content error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve popular content",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Conversion Funnel Controller
 * Analyzes user conversion funnel
 */
exports.getConversionFunnel = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Define funnel steps
    const funnelSteps = [
      'page_view',
      'signup_started',
      'signup_completed',
      'subscription_viewed',
      'payment_started',
      'payment_completed'
    ];

    const funnelData = await Promise.all(
      funnelSteps.map(async (step) => {
        const users = await AnalyticsEvent.distinct('userId', {
          type: step,
          timestamp: { $gte: startDate },
          userId: { $ne: null }
        });

        return {
          step,
          users: users.length
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        timeRange,
        funnelSteps: funnelData
      }
    });

  } catch (error) {
    console.error("Conversion funnel error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve conversion funnel",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Export Events Controller
 * Exports analytics events as CSV
 */
exports.exportEvents = async (req, res) => {
  try {
    const { format = 'json', startDate, endDate, type } = req.query;

    const query = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (type) query.type = type;

    const events = await AnalyticsEvent.find(query)
      .populate('userId', 'email firstName lastName')
      .sort({ timestamp: -1 })
      .limit(10000); // Limit exports to prevent memory issues

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics-events.csv"');

      // Convert to CSV
      const csvHeader = 'ID,Type,User ID,User Email,Session ID,Timestamp,Properties\n';
      const csvData = events.map(event => {
        return [
          event._id,
          event.type,
          event.userId ? event.userId._id : '',
          event.userId ? event.userId.email : '',
          event.sessionId || '',
          event.timestamp.toISOString(),
          JSON.stringify(event.properties)
        ].join(',');
      }).join('\n');

      res.send(csvHeader + csvData);
    } else {
      res.status(200).json({
        success: true,
        data: {
          events,
          total: events.length,
          exportedAt: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error("Export events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export events",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Export Report Controller
 * Exports comprehensive analytics report
 */
exports.exportReport = async (req, res) => {
  try {
    const { timeRange = '30d', format = 'json' } = req.query;

    // Get dashboard stats for the report
    req.query.timeRange = timeRange;

    // Reuse dashboard stats logic
    const statsResponse = await this.getDashboardStats(req, {
      status: () => ({ json: (data) => data }),
      json: (data) => data
    });

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange,
      ...statsResponse.data
    };

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics-report.csv"');

      // Simple CSV format for report
      const csvData = [
        'Metric,Value',
        `Total Events,${report.summary.totalEvents}`,
        `Unique Users,${report.summary.uniqueUsers}`,
        `Time Range,${report.timeRange}`,
        `Generated At,${report.generatedAt}`
      ].join('\n');

      res.send(csvData);
    } else {
      res.status(200).json({
        success: true,
        data: report
      });
    }

  } catch (error) {
    console.error("Export report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export report",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get Config Controller
 * Retrieves analytics configuration
 */
exports.getConfig = async (req, res) => {
  try {
    // Return default configuration
    const config = {
      enabledEvents: [
        'page_view',
        'user_action',
        'signup_started',
        'signup_completed',
        'login',
        'logout',
        'subscription_viewed',
        'payment_started',
        'payment_completed',
        'feature_usage',
        'error_occurred'
      ],
      retentionPeriod: '90d', // Keep data for 90 days
      batchSize: 100,
      enableRealTimeAnalytics: true,
      enableUserTracking: true,
      enableSessionTracking: true
    };

    res.status(200).json({
      success: true,
      data: { config }
    });

  } catch (error) {
    console.error("Get config error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve configuration",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Update Config Controller
 * Updates analytics configuration
 */
exports.updateConfig = async (req, res) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Configuration data is required"
      });
    }

    // In a real implementation, you'd save this to database
    // For now, just validate and return

    res.status(200).json({
      success: true,
      message: "Configuration updated successfully",
      data: { config }
    });

  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update configuration",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};