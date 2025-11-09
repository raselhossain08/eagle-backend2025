const AuditLog = require('../models/auditLog.model');

class AuditController {

  /**
   * Get audit logs
   */
  static async getAuditLogs(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        userId, 
        action, 
        resource, 
        success,
        startDate,
        endDate
      } = req.query;

      const query = {};
      
      if (userId) query.userId = userId;
      if (action) query.action = action;
      if (resource) query.resource = { $regex: resource, $options: 'i' };
      if (success !== undefined) query.success = success === 'true';
      
      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const auditLogs = await AuditLog.find(query)
        .populate('userId', 'firstName lastName email')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await AuditLog.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          auditLogs,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get Audit Logs Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get audit statistics
   */
  static async getAuditStatistics(req, res) {
    try {
      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await AuditLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              action: '$action',
              success: '$success'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.action',
            total: { $sum: '$count' },
            successful: {
              $sum: {
                $cond: { if: '$_id.success', then: '$count', else: 0 }
              }
            },
            failed: {
              $sum: {
                $cond: { if: '$_id.success', then: 0, else: '$count' }
              }
            }
          }
        },
        {
          $sort: { total: -1 }
        }
      ]);

      // Get top users by activity
      const topUsers = await AuditLog.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$userId',
            activityCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $project: {
            userId: '$_id',
            activityCount: 1,
            user: {
              firstName: '$user.firstName',
              lastName: '$user.lastName',
              email: '$user.email'
            }
          }
        },
        {
          $sort: { activityCount: -1 }
        },
        {
          $limit: 10
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          period: `${days} days`,
          actionStatistics: stats,
          topUsers,
          summary: {
            totalLogs: stats.reduce((sum, stat) => sum + stat.total, 0),
            successfulActions: stats.reduce((sum, stat) => sum + stat.successful, 0),
            failedActions: stats.reduce((sum, stat) => sum + stat.failed, 0)
          }
        }
      });
    } catch (error) {
      console.error('Get Audit Statistics Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get user activity log
   */
  static async getUserActivity(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, action, days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = {
        userId,
        createdAt: { $gte: startDate }
      };

      if (action) {
        query.action = action;
      }

      const activities = await AuditLog.find(query)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })
        .select('-userAgent'); // Exclude user agent for cleaner response

      const total = await AuditLog.countDocuments(query);

      // Get summary statistics for this user
      const userStats = await AuditLog.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          userId,
          activities,
          statistics: userStats,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get User Activity Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user activity',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get security events (failed logins, access denied, etc.)
   */
  static async getSecurityEvents(req, res) {
    try {
      const { page = 1, limit = 20, days = 7 } = req.query;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const securityActions = [
        'access_denied',
        'security_violation',
        'login_attempt'
      ];

      const query = {
        action: { $in: securityActions },
        createdAt: { $gte: startDate }
      };

      const events = await AuditLog.find(query)
        .populate('userId', 'firstName lastName email')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

      const total = await AuditLog.countDocuments(query);

      // Get security statistics
      const securityStats = await AuditLog.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: {
              action: '$action',
              success: '$success'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          events,
          statistics: securityStats,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get Security Events Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch security events',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = AuditController;