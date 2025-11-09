/**
 * WordPress Subscription Migration Routes
 * Routes for migrating WooCommerce subscriptions to Eagle system
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const wpSubscriptionMigrationController = require('../controllers/wpSubscriptionMigration.controller');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

// Apply authentication - only admins can migrate subscriptions
router.use(protect);
router.use(restrictTo('admin', 'superAdmin'));

/**
 * @route   POST /api/subscription/migrate-wp-subscriptions
 * @desc    Fetch and migrate WordPress/WooCommerce subscriptions
 * @access  Admin only
 */
router.post('/migrate-wp-subscriptions',
    [
        body('wpApiUrl').notEmpty().withMessage('WordPress API URL is required'),
        body('wpApiKey').notEmpty().withMessage('WordPress API Key is required')
    ],
    wpSubscriptionMigrationController.migrateWordPressSubscriptions
);

/**
 * @route   POST /api/subscription/sync-existing-users
 * @desc    Sync WordPress subscriptions for existing users
 * @access  Admin only
 */
router.post('/sync-existing-users',
    [
        body('wpApiUrl').notEmpty().withMessage('WordPress API URL is required'),
        body('wpApiKey').notEmpty().withMessage('WordPress API Key is required')
    ],
    wpSubscriptionMigrationController.syncExistingUsers
);

/**
 * @route   GET /api/subscription/wp-migration-stats
 * @desc    Get WordPress subscription migration statistics
 * @access  Admin only
 */
router.get('/wp-migration-stats', wpSubscriptionMigrationController.getMigrationStats);

/**
 * @route   POST /api/subscription/check-wp-migration
 * @desc    Check migration status for specific user emails
 * @access  Admin only
 */
router.post('/check-wp-migration',
    [
        body('emails').isArray().withMessage('Emails must be an array')
    ],
    wpSubscriptionMigrationController.checkMigrationStatus
);

module.exports = router;
