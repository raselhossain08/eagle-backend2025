const express = require('express');
const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Visitor Analytics
 *     description: Visitor Analytics API endpoints
 */
const visitorAnalyticsController = require('../controllers/visitorAnalytics.controller');
const { protect: authenticateUser } = require('../../../middlewares/auth.middleware');
const rbac = require('../../../middlewares/rbac.middleware');

// =====================================
// PUBLIC ENDPOINTS (No Auth Required)
// =====================================

/**
 * @route   POST /api/analytics/session/init
 * @desc    Initialize visitor session
 * @access  Public
 */
router.post('/session/init', visitorAnalyticsController.initializeSession);

/**
 * @route   POST /api/analytics/track/page
 * @desc    Track page view
 * @access  Public
 */
router.post('/track/page', visitorAnalyticsController.trackPageView);

/**
 * @route   POST /api/analytics/track/event
 * @desc    Track custom event
 * @access  Public
 */
router.post('/track/event', visitorAnalyticsController.trackEvent);

/**
 * @route   POST /api/analytics/track/conversion
 * @desc    Track conversion event
 * @access  Public
 */
router.post('/track/conversion', visitorAnalyticsController.trackConversion);

/**
 * @route   POST /api/analytics/track/interaction
 * @desc    Track user interaction
 * @access  Public
 */
router.post('/track/interaction', visitorAnalyticsController.trackInteraction);

/**
 * @route   POST /api/analytics/track/batch
 * @desc    Batch track multiple events
 * @access  Public
 */
router.post('/track/batch', visitorAnalyticsController.batchTrackEvents);

/**
 * @route   POST /api/analytics/session/end
 * @desc    End visitor session
 * @access  Public
 */
router.post('/session/end', visitorAnalyticsController.endSession);

// =====================================
// PRIVACY & CONSENT ENDPOINTS (Public)
// =====================================

/**
 * @route   GET /api/analytics/consent/banner-config
 * @desc    Get consent banner configuration
 * @access  Public
 */
router.get('/consent/banner-config', visitorAnalyticsController.getConsentBannerConfig);

/**
 * @route   POST /api/analytics/consent/init
 * @desc    Initialize consent
 * @access  Public
 */
router.post('/consent/init', visitorAnalyticsController.initializeConsent);

/**
 * @route   PUT /api/analytics/consent/preferences
 * @desc    Update consent preferences
 * @access  Public
 */
router.put('/consent/preferences', visitorAnalyticsController.updateConsentPreferences);

/**
 * @route   POST /api/analytics/consent/withdraw
 * @desc    Withdraw consent
 * @access  Public
 */
router.post('/consent/withdraw', visitorAnalyticsController.withdrawConsent);

/**
 * @route   GET /api/analytics/consent/permission
 * @desc    Check tracking permission
 * @access  Public
 */
router.get('/consent/permission', visitorAnalyticsController.checkTrackingPermission);

/**
 * @route   POST /api/analytics/consent/cookieless
 * @desc    Enable cookieless mode
 * @access  Public
 */
router.post('/consent/cookieless', visitorAnalyticsController.enableCookielessMode);

// =====================================
// AUTHENTICATED DASHBOARD ENDPOINTS
// =====================================

// Apply authentication and RBAC for all dashboard routes
router.use('/dashboard', authenticateUser);
router.use('/dashboard', rbac.requireRole(['analytics:read', 'dashboard:read']));

/**
 * @route   GET /api/analytics/dashboard/overview
 * @desc    Get overview dashboard
 * @access  Private - Analytics Read
 */
router.get('/dashboard/overview', visitorAnalyticsController.getOverviewDashboard);

/**
 * @route   GET /api/analytics/dashboard/funnel
 * @desc    Get conversion funnel
 * @access  Private - Analytics Read
 */
router.get('/dashboard/funnel', visitorAnalyticsController.getConversionFunnel);

/**
 * @route   GET /api/analytics/dashboard/growth
 * @desc    Get growth analytics
 * @access  Private - Analytics Read
 */
router.get('/dashboard/growth', visitorAnalyticsController.getGrowthAnalytics);

/**
 * @route   GET /api/analytics/dashboard/realtime
 * @desc    Get real-time dashboard
 * @access  Private - Analytics Read
 */
router.get('/dashboard/realtime', visitorAnalyticsController.getRealTimeDashboard);

/**
 * @route   GET /api/analytics/dashboard/events
 * @desc    Get event explorer
 * @access  Private - Analytics Read
 */
router.get('/dashboard/events', visitorAnalyticsController.getEventExplorer);

// =====================================
// INTEGRATION ENDPOINTS
// =====================================

// Apply authentication and admin RBAC for integration routes
router.use('/integration', authenticateUser);
router.use('/integration', rbac.requireRole(['analytics:admin', 'integration:write']));

/**
 * @route   POST /api/analytics/integration/send
 * @desc    Send event to third-party providers
 * @access  Private - Analytics Admin
 */
router.post('/integration/send', visitorAnalyticsController.sendToProviders);

/**
 * @route   GET /api/analytics/integration/status
 * @desc    Get integration status
 * @access  Private - Analytics Admin
 */
router.get('/integration/status', visitorAnalyticsController.getIntegrationStatus);

/**
 * @route   POST /api/analytics/integration/stream
 * @desc    Create data stream
 * @access  Private - Analytics Admin
 */
router.post('/integration/stream', visitorAnalyticsController.createDataStream);

// =====================================
// EXPORT ENDPOINTS
// =====================================

// Apply authentication and export RBAC for export routes
router.use('/export', authenticateUser);
router.use('/export', rbac.requireRole(['analytics:export', 'data:export']));

/**
 * @route   GET /api/analytics/export/data
 * @desc    Export analytics data
 * @access  Private - Analytics Export
 */
router.get('/export/data', visitorAnalyticsController.exportAnalyticsData);

// =====================================
// COMPLIANCE ENDPOINTS
// =====================================

// Apply authentication and admin RBAC for compliance routes
router.use('/compliance', authenticateUser);
router.use('/compliance', rbac.requireRole(['privacy:admin', 'compliance:read']));

/**
 * @route   GET /api/analytics/compliance/consent-analytics
 * @desc    Get consent analytics
 * @access  Private - Privacy Admin
 */
router.get('/compliance/consent-analytics', visitorAnalyticsController.getConsentAnalytics);

/**
 * @route   POST /api/analytics/compliance/anonymize
 * @desc    Anonymize user data
 * @access  Private - Privacy Admin
 */
router.post('/compliance/anonymize', visitorAnalyticsController.anonymizeUserData);

/**
 * @route   DELETE /api/analytics/compliance/delete-user-data
 * @desc    Delete user data (GDPR Right to be forgotten)
 * @access  Private - Privacy Admin
 */
router.delete('/compliance/delete-user-data', visitorAnalyticsController.deleteUserData);

// =====================================
// ERROR HANDLING MIDDLEWARE
// =====================================

// Analytics-specific error handler
router.use((error, req, res, next) => {
  console.error('Analytics route error:', error);
  
  // Handle specific analytics errors
  if (error.name === 'ConsentRequiredError') {
    return res.status(402).json({
      success: false,
      message: 'Consent required for tracking',
      code: 'CONSENT_REQUIRED',
      data: {
        consentRequired: true,
        jurisdiction: error.jurisdiction
      }
    });
  }
  
  if (error.name === 'PrivacyViolationError') {
    return res.status(403).json({
      success: false,
      message: 'Privacy policy violation',
      code: 'PRIVACY_VIOLATION',
      data: {
        violation: error.violation,
        remedy: error.remedy
      }
    });
  }
  
  if (error.name === 'IntegrationError') {
    return res.status(503).json({
      success: false,
      message: 'Integration service unavailable',
      code: 'INTEGRATION_ERROR',
      data: {
        provider: error.provider,
        available: error.available
      }
    });
  }
  
  if (error.name === 'RateLimitError') {
    return res.status(429).json({
      success: false,
      message: 'Analytics rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      data: {
        limit: error.limit,
        resetTime: error.resetTime
      }
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    message: 'Analytics service error',
    code: 'ANALYTICS_ERROR',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;





