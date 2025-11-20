const express = require('express');
const router = express.Router();

// Import individual route modules
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const userRoleRoutes = require('./userRole.routes');
const auditRoutes = require('./audit.routes');
const adminUserRoutes = require('./adminUser.routes');
const paymentGatewayRoutes = require('./paymentGateway.routes');
const systemSettingsRoutes = require('./systemSettings.routes');
const profileRoutes = require('./profile.routes');
const settingsRoutes = require('./settings.routes');
const stripeSubscriptionRoutes = require('./stripeSubscription.routes');

// Mount route modules
router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/user-roles', userRoleRoutes);
router.use('/audit', auditRoutes);
router.use('/users', adminUserRoutes);
router.use('/payment-gateways', paymentGatewayRoutes);
router.use('/system-settings', systemSettingsRoutes);
router.use('/profile', profileRoutes);
router.use('/settings', settingsRoutes);
router.use('/stripe', stripeSubscriptionRoutes);

// Health check endpoint for RBAC system
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RBAC API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;