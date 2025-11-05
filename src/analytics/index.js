/**
 * Analytics Module Index
 * Central export file for all analytics module components
 */

// Routes
const analyticsRoutes = require('./routes/analytics.routes');
const visitorAnalyticsRoutes = require('./routes/visitorAnalytics.routes');
const reportingRoutes = require('./routes/reporting.routes');
const campaignRoutes = require('./routes/campaign.routes');

// Controllers
const analyticsController = require('./controllers/analytics');
const visitorAnalyticsController = require('./controllers/visitorAnalytics.controller');
const reportingController = require('./controllers/reporting.controller');

// Services
const analyticsService = require('./services/analytics.service');
const analyticsCaptureService = require('./services/analyticsCapture.service');
const analyticsDashboardService = require('./services/analyticsDashboard.service');
const analyticsIntegrationService = require('./services/analyticsIntegration.service');
const campaignService = require('./services/campaign.service');
const campaignAttributionService = require('./services/campaignAttribution.service');
const reportingService = require('./services/reporting.service');

// Models
const Analytics = require('./models/analytics.model');
const Campaign = require('./models/campaign.model');
const VisitorAnalytics = require('./models/visitorAnalytics.model');

module.exports = {
  // Routes
  analyticsRoutes,
  visitorAnalyticsRoutes,
  reportingRoutes,
  campaignRoutes,
  
  // Controllers
  analyticsController,
  visitorAnalyticsController,
  reportingController,
  
  // Services
  analyticsService,
  analyticsCaptureService,
  analyticsDashboardService,
  analyticsIntegrationService,
  campaignService,
  campaignAttributionService,
  reportingService,
  
  // Models
  Analytics,
  Campaign,
  VisitorAnalytics
};





