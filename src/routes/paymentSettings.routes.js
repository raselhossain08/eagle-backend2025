const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Payment Settings
 *     description: Payment Settings API endpoints
 */
const paymentSettingsController = require('../controllers/paymentSettingsController');
const { protect, restrictTo, adminOnly } = require('../middlewares/auth.middleware');

// Get payment settings (admin only)
router.get(
    '/',
    protect,
    adminOnly,
    paymentSettingsController.getPaymentSettings
);

// Update payment settings (admin only)
router.put(
    '/',
    protect,
    adminOnly,
    paymentSettingsController.updatePaymentSettings
);

// Test payment connection (admin only)
router.post(
    '/test/:provider',
    protect,
    adminOnly,
    paymentSettingsController.testPaymentConnection
);

module.exports = router;
