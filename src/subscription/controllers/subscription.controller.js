const subscriberService = require('../services/subscriber.service');
const { validationResult } = require('express-validator');

class SubscriptionController {

  /**
   * PATCH /api/v1/subscriptions/:id
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(req, res) {
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

      const subscription = await subscriberService.updateSubscription(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data: subscription
      });

    } catch (error) {
      console.error('Error in updateSubscription controller:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to update subscription',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/pause
   * Pause subscription
   */
  async pauseSubscription(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const subscription = await subscriberService.pauseSubscription(id, reason);

      res.status(200).json({
        success: true,
        message: 'Subscription paused successfully',
        data: subscription
      });

    } catch (error) {
      console.error('Error in pauseSubscription controller:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to pause subscription',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/resume
   * Resume subscription
   */
  async resumeSubscription(req, res) {
    try {
      const { id } = req.params;

      const subscription = await subscriberService.resumeSubscription(id);

      res.status(200).json({
        success: true,
        message: 'Subscription resumed successfully',
        data: subscription
      });

    } catch (error) {
      console.error('Error in resumeSubscription controller:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to resume subscription',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/cancel
   * Cancel subscription
   */
  async cancelSubscription(req, res) {
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

      const subscription = await subscriberService.cancelSubscription(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Subscription canceled successfully',
        data: subscription
      });

    } catch (error) {
      console.error('Error in cancelSubscription controller:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: 'Failed to cancel subscription',
        error: error.message
      });
    }
  }
}

module.exports = new SubscriptionController();





