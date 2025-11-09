const express = require('express');
const router = express.Router();
const wordpressController = require('../controllers/wordpress.controller');
const { protect } = require('../../middlewares/authMiddleware');

// All routes are protected - require authentication
router.use(protect);

// Test WordPress connection
router.post('/test-connection', wordpressController.testConnection);

// Sync specific endpoint
router.post('/sync/:endpoint', wordpressController.syncWordPressEndpoint);

// Sync all endpoints
router.post('/sync-all', wordpressController.syncAllEndpoints);

// Get data for specific endpoint
router.get('/:endpoint', wordpressController.getEndpointData);

// Get status of all endpoints
router.get('/status/all', wordpressController.getEndpointsStatus);

// Cleanup old data (admin only)
router.delete('/cleanup', wordpressController.cleanupOldData);

module.exports = router;
