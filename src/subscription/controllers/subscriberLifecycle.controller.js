const subscriberService = require('../services/subscriber.service');
const { validationResult } = require('express-validator');

/**
 * Subscriber Lifecycle Controller
 * Handles subscriber lifecycle operations - cancellation, pausing, reactivation, etc.
 */
class SubscriberLifecycleController {

    /**
     * Pause subscriber subscription
     * @route POST /v1/subscribers/:id/pause
     */
    async pauseSubscriber(req, res) {
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
            const { pauseDuration, reason = 'User request' } = req.body;

            const result = await subscriberService.pauseSubscription(id, {
                pauseDuration,
                reason,
                pausedBy: req.user._id
            });

            res.status(200).json({
                success: true,
                message: 'Subscription paused successfully',
                data: result
            });

        } catch (error) {
            console.error('Error in pauseSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to pause subscription',
                error: error.message
            });
        }
    }

    /**
     * Resume paused subscriber subscription
     * @route POST /v1/subscribers/:id/resume
     */
    async resumeSubscriber(req, res) {
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
            const { reason = 'User request', updateBilling = true } = req.body;

            const result = await subscriberService.resumeSubscription(id, {
                reason,
                resumedBy: req.user._id,
                updateBilling
            });

            res.status(200).json({
                success: true,
                message: 'Subscription resumed successfully',
                data: result
            });

        } catch (error) {
            console.error('Error in resumeSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to resume subscription',
                error: error.message
            });
        }
    }

    /**
     * Cancel subscriber subscription
     * @route POST /v1/subscribers/:id/cancel
     */
    async cancelSubscriber(req, res) {
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
                reason,
                cancelAtPeriodEnd = true,
                effectiveDate,
                refundRequested = false,
                surveyResponses = {}
            } = req.body;

            const result = await subscriberService.cancelSubscription(id, {
                reason,
                cancelAtPeriodEnd,
                effectiveDate,
                refundRequested,
                surveyResponses,
                cancelledBy: req.user._id
            });

            res.status(200).json({
                success: true,
                message: result.immediate ? 'Subscription cancelled successfully' : 'Subscription scheduled for cancellation',
                data: result
            });

        } catch (error) {
            console.error('Error in cancelSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel subscription',
                error: error.message
            });
        }
    }

    /**
     * Reactivate cancelled subscriber
     * @route POST /v1/subscribers/:id/reactivate
     */
    async reactivateSubscriber(req, res) {
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
                plan,
                billingCycle,
                prorateBilling = true,
                reason = 'User reactivation'
            } = req.body;

            const result = await subscriberService.reactivateSubscription(id, {
                plan,
                billingCycle,
                prorateBilling,
                reason,
                reactivatedBy: req.user._id
            });

            res.status(200).json({
                success: true,
                message: 'Subscription reactivated successfully',
                data: result
            });

        } catch (error) {
            console.error('Error in reactivateSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reactivate subscription',
                error: error.message
            });
        }
    }

    /**
     * Change subscriber plan
     * @route POST /v1/subscribers/:id/change-plan
     */
    async changeSubscriberPlan(req, res) {
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
                newPlan,
                billingCycle,
                effectiveDate,
                prorateBilling = true,
                reason = 'Plan change'
            } = req.body;

            const result = await subscriberService.changePlan(id, {
                newPlan,
                billingCycle,
                effectiveDate,
                prorateBilling,
                reason,
                changedBy: req.user._id
            });

            res.status(200).json({
                success: true,
                message: 'Plan changed successfully',
                data: result
            });

        } catch (error) {
            console.error('Error in changeSubscriberPlan controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to change plan',
                error: error.message
            });
        }
    }

    /**
     * Get subscriber lifecycle history
     * @route GET /v1/subscribers/:id/lifecycle
     */
    async getLifecycleHistory(req, res) {
        try {
            const { id } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const history = await subscriberService.getLifecycleHistory(id, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.status(200).json({
                success: true,
                message: 'Lifecycle history retrieved successfully',
                data: history
            });

        } catch (error) {
            console.error('Error in getLifecycleHistory controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve lifecycle history',
                error: error.message
            });
        }
    }

    /**
     * Get subscription renewal information
     * @route GET /v1/subscribers/:id/renewal
     */
    async getRenewalInfo(req, res) {
        try {
            const { id } = req.params;

            const renewalInfo = await subscriberService.getRenewalInfo(id);

            res.status(200).json({
                success: true,
                message: 'Renewal information retrieved successfully',
                data: renewalInfo
            });

        } catch (error) {
            console.error('Error in getRenewalInfo controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve renewal information',
                error: error.message
            });
        }
    }

    /**
     * Process subscription upgrade/downgrade
     * @route POST /v1/subscribers/:id/upgrade-downgrade
     */
    async processUpgradeDowngrade(req, res) {
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
                targetPlan,
                changeType, // upgrade, downgrade
                effectiveDate,
                prorateBilling = true,
                reason
            } = req.body;

            const result = await subscriberService.processUpgradeDowngrade(id, {
                targetPlan,
                changeType,
                effectiveDate,
                prorateBilling,
                reason,
                processedBy: req.user._id
            });

            res.status(200).json({
                success: true,
                message: `Subscription ${changeType} processed successfully`,
                data: result
            });

        } catch (error) {
            console.error('Error in processUpgradeDowngrade controller:', error);
            res.status(500).json({
                success: false,
                message: `Failed to process subscription ${req.body.changeType || 'change'}`,
                error: error.message
            });
        }
    }

    /**
     * Create new subscriber (placeholder for advanced creation)
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

            // This would use subscriberService.createSubscriber with enhanced features
            res.status(501).json({
                success: false,
                message: 'Enhanced subscriber creation coming soon. Use basic create subscriber endpoint.'
            });

        } catch (error) {
            console.error('Error in createSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create subscriber',
                error: error.message
            });
        }
    }

    /**
     * Assign or change subscriber plan
     * @route POST /v1/subscribers/:id/plans
     */
    async assignPlan(req, res) {
        try {
            const { id } = req.params;
            const { planId, billingCycle, effectiveDate } = req.body;

            // This would be implemented in the service layer
            res.status(501).json({
                success: false,
                message: 'Plan assignment feature coming soon'
            });

        } catch (error) {
            console.error('Error in assignPlan controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to assign plan',
                error: error.message
            });
        }
    }

    /**
     * Upgrade subscriber to higher plan
     * @route POST /v1/subscribers/:id/upgrade
     */
    async upgradeSubscriber(req, res) {
        try {
            const { id } = req.params;
            const { targetPlan } = req.body;

            // Delegate to processUpgradeDowngrade with upgrade type
            req.body.changeType = 'upgrade';
            return this.processUpgradeDowngrade(req, res);

        } catch (error) {
            console.error('Error in upgradeSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upgrade subscription',
                error: error.message
            });
        }
    }

    /**
     * Downgrade subscriber to lower plan
     * @route POST /v1/subscribers/:id/downgrade
     */
    async downgradeSubscriber(req, res) {
        try {
            const { id } = req.params;
            const { targetPlan } = req.body;

            // Delegate to processUpgradeDowngrade with downgrade type
            req.body.changeType = 'downgrade';
            return this.processUpgradeDowngrade(req, res);

        } catch (error) {
            console.error('Error in downgradeSubscriber controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to downgrade subscription',
                error: error.message
            });
        }
    }

    /**
     * Process subscriber refund
     * @route POST /v1/subscribers/:id/refunds
     */
    async processRefund(req, res) {
        try {
            const { id } = req.params;
            const { amount, reason, refundType } = req.body;

            // This would be implemented in the service layer with payment gateway integration
            res.status(501).json({
                success: false,
                message: 'Refund processing feature coming soon'
            });

        } catch (error) {
            console.error('Error in processRefund controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process refund',
                error: error.message
            });
        }
    }

    /**
     * Generate payment method update link for subscriber
     * @route POST /v1/subscribers/:id/payment-method/update-link
     */
    async generatePaymentUpdateLink(req, res) {
        try {
            const { id } = req.params;
            const { redirectUrl, expiresIn = 3600 } = req.body;

            // This would be implemented with payment gateway integration
            res.status(501).json({
                success: false,
                message: 'Payment update link generation coming soon'
            });

        } catch (error) {
            console.error('Error in generatePaymentUpdateLink controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate payment update link',
                error: error.message
            });
        }
    }

    /**
     * Manage subscriber seats (for team plans)
     * @route POST /v1/subscribers/:id/seats
     */
    async manageSeats(req, res) {
        try {
            const { id } = req.params;
            const { action, seatCount } = req.body;

            // This would be implemented for team plan features
            res.status(501).json({
                success: false,
                message: 'Seat management feature coming soon'
            });

        } catch (error) {
            console.error('Error in manageSeats controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to manage seats',
                error: error.message
            });
        }
    }

    /**
     * Create gift subscription
     * @route POST /v1/gifts
     */
    async createGiftSubscription(req, res) {
        try {
            const { recipientEmail, giftPlan, duration } = req.body;

            // This would be implemented as a gift/promotional feature
            res.status(501).json({
                success: false,
                message: 'Gift subscription feature coming soon'
            });

        } catch (error) {
            console.error('Error in createGiftSubscription controller:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create gift subscription',
                error: error.message
            });
        }
    }
}

module.exports = new SubscriberLifecycleController();