/**
 * Subscription Routes Index
 * Central routing configuration for all subscription-related endpoints
 */

const express = require('express');
const router = express.Router();

// Import all subscription route modules
const subscriptionRoutes = require('./subscription.routes');
const membershipPlanRoutes = require('./membershipPlan.routes');
const subscriptionLifecycleRoutes = require('./subscriptionLifecycle.routes');

// Mount subscription lifecycle management routes
router.use('/lifecycle', subscriptionLifecycleRoutes);

// Mount main subscription CRUD routes  
router.use('/', subscriptionRoutes);

// Mount membership plan routes
router.use('/plans', membershipPlanRoutes);

// Health check for entire subscription module
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Subscription module is operational',
        timestamp: new Date().toISOString(),
        modules: {
            subscriptions: '✅ Active',
            membershipPlans: '✅ Active',
            subscriptionLifecycle: '✅ Active'
        },
        endpoints: {
            '/subscriptions/': 'Main subscription CRUD operations',
            '/subscriptions/plans/': 'Membership plan management',
            '/subscriptions/lifecycle/': 'Subscription lifecycle operations'
        }
    });
});

module.exports = router;