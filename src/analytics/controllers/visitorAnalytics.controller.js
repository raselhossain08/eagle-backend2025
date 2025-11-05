const AnalyticsDataCaptureService = require('../services/analyticsCapture.service');
const AnalyticsDashboardService = require('../services/analyticsDashboard.service');
const PrivacyConsentService = require('../services/privacyConsent.service');
const AnalyticsIntegrationService = require('../services/analyticsIntegration.service');

class VisitorAnalyticsController {
  
  constructor() {
    this.captureService = new AnalyticsDataCaptureService();
    this.dashboardService = new AnalyticsDashboardService();
    this.privacyService = new PrivacyConsentService();
    this.integrationService = new AnalyticsIntegrationService();
  }
  
  // =====================================
  // EVENT TRACKING ENDPOINTS
  // =====================================
  
  /**
   * Initialize visitor session
   */
  initializeSession = async (req, res) => {
    try {
      const { visitorId, userId, pageTitle, customData } = req.body;
      
      const sessionData = {
        visitorId,
        userId,
        pageTitle,
        ...customData
      };
      
      const session = await this.captureService.initializeSession(req, sessionData);
      
      res.status(201).json({
        success: true,
        data: {
          sessionId: session.sessionId,
          visitorId: session.visitorId,
          consentRequired: !session.privacy.consentGiven,
          cookielessMode: session.privacy.cookielessMode
        }
      });
      
    } catch (error) {
      console.error('Error initializing session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize session',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Track page view
   */
  trackPageView = async (req, res) => {
    try {
      const {
        sessionId,
        visitorId,
        userId,
        page,
        timeOnPage,
        scrollDepth,
        technical,
        properties
      } = req.body;
      
      const pageData = {
        sessionId,
        visitorId,
        userId,
        page,
        timeOnPage,
        scrollDepth,
        technical,
        properties
      };
      
      const event = await this.captureService.trackPageView(req, pageData);
      
      res.status(201).json({
        success: true,
        data: {
          eventId: event?.eventId,
          tracked: !!event
        }
      });
      
    } catch (error) {
      console.error('Error tracking page view:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track page view',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Track custom event
   */
  trackEvent = async (req, res) => {
    try {
      const eventData = req.body;
      
      const event = await this.captureService.trackEvent(req, eventData);
      
      res.status(201).json({
        success: true,
        data: {
          eventId: event?.eventId,
          tracked: !!event
        }
      });
      
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track event',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Track conversion
   */
  trackConversion = async (req, res) => {
    try {
      const conversionData = req.body;
      
      const event = await this.captureService.trackConversion(req, conversionData);
      
      res.status(201).json({
        success: true,
        data: {
          eventId: event?.eventId,
          tracked: !!event
        }
      });
      
    } catch (error) {
      console.error('Error tracking conversion:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track conversion',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Track user interaction
   */
  trackInteraction = async (req, res) => {
    try {
      const interactionData = req.body;
      
      const event = await this.captureService.trackInteraction(req, interactionData);
      
      res.status(201).json({
        success: true,
        data: {
          eventId: event?.eventId,
          tracked: !!event
        }
      });
      
    } catch (error) {
      console.error('Error tracking interaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track interaction',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Batch track events
   */
  batchTrackEvents = async (req, res) => {
    try {
      const { events } = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          message: 'Events must be an array'
        });
      }
      
      const results = await this.captureService.batchTrackEvents(req, events);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      res.status(201).json({
        success: true,
        data: {
          total: events.length,
          successful,
          failed,
          results
        }
      });
      
    } catch (error) {
      console.error('Error batch tracking events:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to batch track events',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * End session
   */
  endSession = async (req, res) => {
    try {
      const { sessionId, exitPage } = req.body;
      
      const session = await this.captureService.endSession(sessionId, { exitPage });
      
      res.status(200).json({
        success: true,
        data: {
          sessionId: session.sessionId,
          duration: session.duration,
          pageViews: session.metrics.pageViews,
          events: session.metrics.events,
          bounced: session.metrics.bounced,
          converted: session.metrics.converted
        }
      });
      
    } catch (error) {
      console.error('Error ending session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to end session',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  // =====================================
  // PRIVACY & CONSENT ENDPOINTS
  // =====================================
  
  /**
   * Get consent banner configuration
   */
  getConsentBannerConfig = async (req, res) => {
    try {
      const options = {
        jurisdiction: req.query.jurisdiction,
        language: req.query.language || 'en',
        policyUrl: req.query.policyUrl,
        termsUrl: req.query.termsUrl,
        cookieUrl: req.query.cookieUrl
      };
      
      const config = await this.privacyService.getConsentBannerConfig(req, options);
      
      res.status(200).json({
        success: true,
        data: config
      });
      
    } catch (error) {
      console.error('Error getting consent banner config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get consent configuration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Initialize consent
   */
  initializeConsent = async (req, res) => {
    try {
      const consentData = req.body;
      
      const consent = await this.privacyService.initializeConsent(req, consentData);
      
      res.status(201).json({
        success: true,
        data: {
          consentId: consent.consentId,
          preferences: consent.preferences,
          jurisdiction: consent.compliance.jurisdiction
        }
      });
      
    } catch (error) {
      console.error('Error initializing consent:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize consent',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Update consent preferences
   */
  updateConsentPreferences = async (req, res) => {
    try {
      const updateData = req.body;
      
      const consent = await this.privacyService.updateConsentPreferences(req, updateData);
      
      res.status(200).json({
        success: true,
        data: {
          consentId: consent.consentId,
          preferences: consent.preferences,
          updatedAt: consent.updatedAt
        }
      });
      
    } catch (error) {
      console.error('Error updating consent preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update consent preferences',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Withdraw consent
   */
  withdrawConsent = async (req, res) => {
    try {
      const withdrawalData = req.body;
      
      const consent = await this.privacyService.withdrawConsent(req, withdrawalData);
      
      res.status(200).json({
        success: true,
        data: {
          consentId: consent.consentId,
          status: consent.status,
          withdrawnAt: consent.withdrawnAt
        }
      });
      
    } catch (error) {
      console.error('Error withdrawing consent:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to withdraw consent',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Check tracking permission
   */
  checkTrackingPermission = async (req, res) => {
    try {
      const { visitorId, userId, category } = req.query;
      
      const permission = await this.privacyService.isTrackingAllowed(
        visitorId, 
        userId, 
        category
      );
      
      res.status(200).json({
        success: true,
        data: permission
      });
      
    } catch (error) {
      console.error('Error checking tracking permission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check tracking permission',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Enable cookieless mode
   */
  enableCookielessMode = async (req, res) => {
    try {
      const { visitorId, sessionId } = req.body;
      
      const consent = await this.privacyService.enableCookielessMode(visitorId, sessionId);
      
      res.status(200).json({
        success: true,
        data: {
          consentId: consent.consentId,
          cookielessMode: consent.privacySettings.cookielessMode
        }
      });
      
    } catch (error) {
      console.error('Error enabling cookieless mode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enable cookieless mode',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  // =====================================
  // DASHBOARD ENDPOINTS
  // =====================================
  
  /**
   * Get overview dashboard
   */
  getOverviewDashboard = async (req, res) => {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        filters = {}
      } = req.query;
      
      const dashboard = await this.dashboardService.getOverviewDashboard(
        startDate, 
        endDate, 
        filters
      );
      
      res.status(200).json({
        success: true,
        data: dashboard
      });
      
    } catch (error) {
      console.error('Error getting overview dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get overview dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Get conversion funnel
   */
  getConversionFunnel = async (req, res) => {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        funnelSteps,
        filters = {}
      } = req.query;
      
      const funnel = await this.dashboardService.getConversionFunnel(
        startDate,
        endDate,
        funnelSteps ? funnelSteps.split(',') : null,
        filters
      );
      
      res.status(200).json({
        success: true,
        data: funnel
      });
      
    } catch (error) {
      console.error('Error getting conversion funnel:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get conversion funnel',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Get growth analytics
   */
  getGrowthAnalytics = async (req, res) => {
    try {
      const {
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        filters = {}
      } = req.query;
      
      const growth = await this.dashboardService.getGrowthAnalytics(
        startDate,
        endDate,
        filters
      );
      
      res.status(200).json({
        success: true,
        data: growth
      });
      
    } catch (error) {
      console.error('Error getting growth analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get growth analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Get real-time dashboard
   */
  getRealTimeDashboard = async (req, res) => {
    try {
      const dashboard = await this.dashboardService.getRealTimeDashboard();
      
      res.status(200).json({
        success: true,
        data: dashboard
      });
      
    } catch (error) {
      console.error('Error getting real-time dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get real-time dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Get event explorer
   */
  getEventExplorer = async (req, res) => {
    try {
      const {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        filters = {}
      } = req.query;
      
      const explorer = await this.dashboardService.getEventExplorer(
        startDate,
        endDate,
        filters
      );
      
      res.status(200).json({
        success: true,
        data: explorer
      });
      
    } catch (error) {
      console.error('Error getting event explorer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get event explorer',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  // =====================================
  // INTEGRATION ENDPOINTS
  // =====================================
  
  /**
   * Send event to third-party providers
   */
  sendToProviders = async (req, res) => {
    try {
      const { eventData, providers, config } = req.body;
      
      const results = await this.integrationService.sendEvent(
        eventData,
        providers,
        config
      );
      
      res.status(200).json({
        success: true,
        data: results
      });
      
    } catch (error) {
      console.error('Error sending to providers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send to providers',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Get integration status
   */
  getIntegrationStatus = async (req, res) => {
    try {
      const providers = req.query.providers ? req.query.providers.split(',') : [];
      
      const status = await this.integrationService.getIntegrationStatus(providers);
      
      res.status(200).json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('Error getting integration status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get integration status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Export analytics data
   */
  exportAnalyticsData = async (req, res) => {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        format = 'json',
        dataTypes = ['sessions', 'events']
      } = req.query;
      
      const exportData = await this.dashboardService.exportAnalyticsData(
        startDate,
        endDate,
        format,
        Array.isArray(dataTypes) ? dataTypes : dataTypes.split(',')
      );
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.zip');
        // In production, create actual ZIP file
        res.status(200).json(exportData);
      } else {
        res.status(200).json({
          success: true,
          data: exportData
        });
      }
      
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export analytics data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Create data stream
   */
  createDataStream = async (req, res) => {
    try {
      const streamConfig = req.body;
      
      const stream = await this.integrationService.createDataStream(streamConfig);
      
      res.status(201).json({
        success: true,
        data: stream
      });
      
    } catch (error) {
      console.error('Error creating data stream:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create data stream',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  // =====================================
  // COMPLIANCE & ANALYTICS
  // =====================================
  
  /**
   * Get consent analytics
   */
  getConsentAnalytics = async (req, res) => {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = req.query;
      
      const analytics = await this.privacyService.getConsentAnalytics(startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      console.error('Error getting consent analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get consent analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Anonymize user data
   */
  anonymizeUserData = async (req, res) => {
    try {
      const { visitorId, userId, options } = req.body;
      
      const result = await this.privacyService.anonymizeHistoricalData(
        visitorId,
        userId,
        options
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Error anonymizing user data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to anonymize user data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  
  /**
   * Delete user data (GDPR Right to be forgotten)
   */
  deleteUserData = async (req, res) => {
    try {
      const { visitorId, userId, options } = req.body;
      
      const result = await this.privacyService.deleteUserData(
        visitorId,
        userId,
        options
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Error deleting user data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}

module.exports = new VisitorAnalyticsController();





