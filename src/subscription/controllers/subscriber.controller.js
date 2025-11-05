const subscriberService = require('../services/subscriber.service');
const { validationResult } = require('express-validator');

/**
 * Consolidated Subscriber Management Controller
 * Handles all subscriber operations using the subscriber service layer
 */
class SubscriberController {

  /**
   * Get subscribers with advanced filtering and search
   * @route GET /v1/subscribers
   */
  async getSubscribers(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const filters = {
        q: req.query.q,
        status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : [],
        plan_id: req.query.plan_id ? (Array.isArray(req.query.plan_id) ? req.query.plan_id : [req.query.plan_id]) : [],
        mrr_min: req.query.mrr_min ? parseFloat(req.query.mrr_min) : undefined,
        mrr_max: req.query.mrr_max ? parseFloat(req.query.mrr_max) : undefined,
        churn_risk: req.query.churn_risk,
        country_code: req.query.country_code,
        created_after: req.query.created_after,
        created_before: req.query.created_before,
        subscription_status: req.query.subscription_status ?
          (Array.isArray(req.query.subscription_status) ? req.query.subscription_status : [req.query.subscription_status]) : []
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        sort: req.query.sort || '-createdAt'
      };

      const result = await subscriberService.getSubscribers(filters, pagination);

      res.status(200).json({
        success: true,
        message: 'Subscribers retrieved successfully',
        data: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('Error in getSubscribers controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscribers',
        error: error.message
      });
    }
  }

  /**
   * Get detailed subscriber profile
   * @route GET /v1/subscribers/:id
   */
  async getSubscriberById(req, res) {
    try {
      const { id } = req.params;

      const profile = await subscriberService.getSubscriberProfile(id);

      res.status(200).json({
        success: true,
        message: 'Subscriber profile retrieved successfully',
        data: profile
      });

    } catch (error) {
      console.error('Error in getSubscriberProfile controller:', error);
      const statusCode = error.message === 'Subscriber not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to fetch subscriber profile',
        error: error.message
      });
    }
  }

  /**
   * Create new subscriber
   * @route POST /v1/subscribers
   */
  async createSubscriber(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const subscriber = await subscriberService.createSubscriber(req.body);

      res.status(201).json({
        success: true,
        message: 'Subscriber created successfully',
        data: subscriber
      });

    } catch (error) {
      console.error('Error in createSubscriber controller:', error);
      const statusCode = error.message.includes('already exists') ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to create subscriber',
        error: error.message
      });
    }
  }

  /**
   * Update subscriber
   * @route PATCH /v1/subscribers/:id
   */
  async updateSubscriber(req, res) {
    try {
      const { id } = req.params;

      const subscriber = await subscriberService.updateSubscriber(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Subscriber updated successfully',
        data: subscriber
      });

    } catch (error) {
      console.error('Error in updateSubscriber controller:', error);
      const statusCode = error.message === 'Subscriber not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to update subscriber',
        error: error.message
      });
    }
  }

  /**
   * Delete subscriber
   * @route DELETE /v1/subscribers/:id
   */
  async deleteSubscriber(req, res) {
    try {
      const { id } = req.params;

      const result = await subscriberService.deleteSubscriber(id);

      res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error in deleteSubscriber controller:', error);
      const statusCode = error.message === 'Subscriber not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to delete subscriber',
        error: error.message
      });
    }
  }

  /**
   * Create new subscription for subscriber
   * @route POST /v1/subscribers/:id/subscriptions
   */
  async createSubscription(req, res) {
    try {
      const { id } = req.params;
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const subscription = await subscriberService.createSubscription(id, req.body);

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: subscription
      });

    } catch (error) {
      console.error('Error in createSubscription controller:', error);
      const statusCode = error.message.includes('not found') ? 404 :
        error.message.includes('already has') ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to create subscription',
        error: error.message
      });
    }
  }

  /**
   * Export subscribers data
   * @route GET /v1/subscribers/export
   */
  async exportSubscribers(req, res) {
    try {
      const format = req.query.format || 'csv';
      const filters = {
        status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : [],
        plan_id: req.query.plan_id ? (Array.isArray(req.query.plan_id) ? req.query.plan_id : [req.query.plan_id]) : [],
        churn_risk: req.query.churn_risk,
        country_code: req.query.country_code
      };

      const exportResult = await subscriberService.exportSubscribers(format, filters);

      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.status(200).send(exportResult.content);

    } catch (error) {
      console.error('Error in exportSubscribers controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export subscribers',
        error: error.message
      });
    }
  }

  /**
   * Get subscriber statistics
   * @route GET /v1/subscribers/stats
   */
  async getSubscriberStats(req, res) {
    try {
      const dateRange = {
        startDate: req.query.start_date,
        endDate: req.query.end_date
      };

      const stats = await subscriberService.getSubscriptionStats(dateRange);

      res.status(200).json({
        success: true,
        message: 'Subscriber statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      console.error('Error in getSubscriberStats controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch subscriber statistics',
        error: error.message
      });
    }
  }

  /**
   * Get subscriber activity timeline and events
   * @route GET /v1/subscribers/:id/timeline
   */
  async getSubscriberTimeline(req, res) {
    try {
      const { id } = req.params;
      const { eventTypes, dateFrom, dateTo, limit = 50, includeSensitive = false } = req.query;

      // This would be implemented in the service layer
      res.status(200).json({
        success: true,
        message: 'Timeline feature coming soon',
        data: {
          subscriberId: id,
          timeline: [],
          summary: {
            totalEvents: 0,
            eventTypes: {},
            dateRange: { from: dateFrom, to: dateTo }
          }
        }
      });

    } catch (error) {
      console.error('Error in getSubscriberTimeline controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscriber timeline',
        error: error.message
      });
    }
  }

  /**
   * Get subscriber payment method information
   * @route GET /v1/subscribers/:id/payment-method
   */
  async getPaymentMethod(req, res) {
    try {
      const { id } = req.params;
      const { includeSensitive = false } = req.query;

      // This would be implemented in the service layer
      res.status(200).json({
        success: true,
        message: 'Payment method retrieved successfully',
        data: {
          subscriberId: id,
          paymentMethods: [],
          defaultPaymentMethod: null,
          hasValidPaymentMethod: false
        }
      });

    } catch (error) {
      console.error('Error in getPaymentMethod controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payment method',
        error: error.message
      });
    }
  }

  /**
   * Get account sharing detection signals
   * @route GET /v1/account-sharing/signals
   */
  async getAccountSharingSignals(req, res) {
    try {
      const { subscriberId, riskLevel, dateFrom, dateTo, limit = 50, includeDetails = false } = req.query;

      // This would be implemented as an advanced security feature
      res.status(200).json({
        success: true,
        message: 'Account sharing detection coming soon',
        data: {
          signals: [],
          summary: {
            totalSignals: 0,
            riskDistribution: {},
            recentAlerts: 0
          }
        }
      });

    } catch (error) {
      console.error('Error in getAccountSharingSignals controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve account sharing signals',
        error: error.message
      });
    }
  }
}

module.exports = new SubscriberController();