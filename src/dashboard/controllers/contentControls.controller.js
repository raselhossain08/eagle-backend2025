const ContentControlsService = require('../services/contentControls.service');
const { logger } = require('../utils/logger');

class ContentControlsController {
  // ================================
  // ANNOUNCEMENTS & BANNERS
  // ================================

  /**
   * Get active announcements for current user/page
   */
  async getActiveAnnouncements(req, res) {
    try {
      const { page, limit = 10 } = req.query;
      const user = req.user;

      const announcements = await ContentControlsService.getActiveAnnouncements(
        user, 
        page, 
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: announcements
      });
    } catch (error) {
      logger.error('Error fetching active announcements:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch announcements'
      });
    }
  }

  /**
   * Create new announcement
   */
  async createAnnouncement(req, res) {
    try {
      const announcementData = req.body;
      const createdBy = req.user.id;

      const announcement = await ContentControlsService.createAnnouncement(
        announcementData, 
        createdBy
      );

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: announcement
      });
    } catch (error) {
      logger.error('Error creating announcement:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create announcement'
      });
    }
  }

  /**
   * Update announcement
   */
  async updateAnnouncement(req, res) {
    try {
      const { announcementId } = req.params;
      const updates = req.body;
      const updatedBy = req.user.id;

      const announcement = await ContentControlsService.updateAnnouncement(
        announcementId,
        updates,
        updatedBy
      );

      res.status(200).json({
        success: true,
        message: 'Announcement updated successfully',
        data: announcement
      });
    } catch (error) {
      logger.error('Error updating announcement:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update announcement'
      });
    }
  }

  /**
   * Track announcement interaction
   */
  async trackAnnouncementInteraction(req, res) {
    try {
      const { announcementId } = req.params;
      const { interactionType } = req.body;
      const userId = req.user?.id;

      await ContentControlsService.trackAnnouncementInteraction(
        announcementId,
        interactionType,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Interaction tracked successfully'
      });
    } catch (error) {
      logger.error('Error tracking announcement interaction:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to track interaction'
      });
    }
  }

  /**
   * Get announcement analytics
   */
  async getAnnouncementAnalytics(req, res) {
    try {
      const { announcementId } = req.params;

      const analytics = await ContentControlsService.getAnnouncementAnalytics(
        announcementId
      );

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error fetching announcement analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch analytics'
      });
    }
  }

  // ================================
  // FEATURE FLAGS
  // ================================

  /**
   * Evaluate feature flag
   */
  async evaluateFeatureFlag(req, res) {
    try {
      const { flagName } = req.params;
      const context = {
        userId: req.user?.id,
        userSegment: req.user?.segment,
        sessionId: req.sessionID,
        ...req.body.context
      };

      const result = await ContentControlsService.evaluateFeatureFlag(flagName, context);

      res.status(200).json({
        success: true,
        data: {
          flagName,
          enabled: result,
          context
        }
      });
    } catch (error) {
      logger.error('Error evaluating feature flag:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to evaluate feature flag'
      });
    }
  }

  /**
   * Evaluate multiple feature flags
   */
  async evaluateFeatureFlags(req, res) {
    try {
      const { flagNames } = req.body;
      const context = {
        userId: req.user?.id,
        userSegment: req.user?.segment,
        sessionId: req.sessionID,
        ...req.body.context
      };

      const results = await ContentControlsService.evaluateFeatureFlags(flagNames, context);

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error evaluating feature flags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to evaluate feature flags'
      });
    }
  }

  /**
   * Get user feature flags
   */
  async getUserFeatureFlags(req, res) {
    try {
      const { category } = req.query;
      const userId = req.user.id;

      const flags = await ContentControlsService.getUserFeatureFlags(userId, category);

      res.status(200).json({
        success: true,
        data: flags
      });
    } catch (error) {
      logger.error('Error fetching user feature flags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch feature flags'
      });
    }
  }

  /**
   * Create feature flag (Admin only)
   */
  async createFeatureFlag(req, res) {
    try {
      const flagData = req.body;
      const owner = req.user.id;

      const flag = await ContentControlsService.createFeatureFlag(flagData, owner);

      res.status(201).json({
        success: true,
        message: 'Feature flag created successfully',
        data: flag
      });
    } catch (error) {
      logger.error('Error creating feature flag:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create feature flag'
      });
    }
  }

  /**
   * Update feature flag (Admin only)
   */
  async updateFeatureFlag(req, res) {
    try {
      const { flagId } = req.params;
      const updates = req.body;
      const { reason = '' } = req.body;
      const updatedBy = req.user.id;

      const flag = await ContentControlsService.updateFeatureFlag(
        flagId,
        updates,
        updatedBy,
        reason
      );

      res.status(200).json({
        success: true,
        message: 'Feature flag updated successfully',
        data: flag
      });
    } catch (error) {
      logger.error('Error updating feature flag:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update feature flag'
      });
    }
  }

  /**
   * Toggle feature flag (Admin only)
   */
  async toggleFeatureFlag(req, res) {
    try {
      const { flagId } = req.params;
      const { enabled, reason = '' } = req.body;
      const updatedBy = req.user.id;

      const flag = await ContentControlsService.toggleFeatureFlag(
        flagId,
        enabled,
        updatedBy,
        reason
      );

      res.status(200).json({
        success: true,
        message: `Feature flag ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: flag
      });
    } catch (error) {
      logger.error('Error toggling feature flag:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle feature flag'
      });
    }
  }

  /**
   * Get feature flag metrics
   */
  async getFeatureFlagMetrics(req, res) {
    try {
      const { flagName } = req.params;

      const metrics = await ContentControlsService.getFeatureFlagMetrics(flagName);

      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error fetching feature flag metrics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch metrics'
      });
    }
  }

  // ================================
  // LEGAL DOCUMENTS
  // ================================

  /**
   * Get current legal document
   */
  async getLegalDocument(req, res) {
    try {
      const { documentType } = req.params;
      const { locale = 'en', format = 'html' } = req.query;

      const document = await ContentControlsService.getLegalDocumentContent(
        documentType,
        locale,
        format
      );

      res.status(200).json({
        success: true,
        data: document
      });
    } catch (error) {
      logger.error('Error fetching legal document:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch legal document'
      });
    }
  }

  /**
   * Record user agreement to legal document
   */
  async recordUserAgreement(req, res) {
    try {
      const { documentType } = req.params;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const agreement = await ContentControlsService.recordUserAgreement(
        documentType,
        userId,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'User agreement recorded successfully',
        data: agreement
      });
    } catch (error) {
      logger.error('Error recording user agreement:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record agreement'
      });
    }
  }

  /**
   * Create legal document (Admin only)
   */
  async createLegalDocument(req, res) {
    try {
      const documentData = req.body;
      const authorId = req.user.id;

      const document = await ContentControlsService.createLegalDocument(
        documentData,
        authorId
      );

      res.status(201).json({
        success: true,
        message: 'Legal document created successfully',
        data: document
      });
    } catch (error) {
      logger.error('Error creating legal document:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create legal document'
      });
    }
  }

  /**
   * Update legal document (Admin only)
   */
  async updateLegalDocument(req, res) {
    try {
      const { documentId } = req.params;
      const { changes = [], reason = '', ...updates } = req.body;
      const updatedBy = req.user.id;

      const document = await ContentControlsService.updateLegalDocument(
        documentId,
        updates,
        updatedBy,
        changes,
        reason
      );

      res.status(200).json({
        success: true,
        message: 'Legal document updated successfully',
        data: document
      });
    } catch (error) {
      logger.error('Error updating legal document:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update legal document'
      });
    }
  }

  /**
   * Get legal document version history
   */
  async getLegalDocumentHistory(req, res) {
    try {
      const { documentType } = req.params;
      const { limit = 10 } = req.query;

      const history = await ContentControlsService.getLegalDocumentHistory(
        documentType,
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error fetching legal document history:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch document history'
      });
    }
  }

  /**
   * Get legal document analytics
   */
  async getLegalDocumentAnalytics(req, res) {
    try {
      const { documentType } = req.params;
      const { timeframe = 30 } = req.query;

      const analytics = await ContentControlsService.getLegalDocumentAnalytics(
        documentType,
        parseInt(timeframe)
      );

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error fetching legal document analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch analytics'
      });
    }
  }

  // ================================
  // UNIFIED DASHBOARD & MANAGEMENT
  // ================================

  /**
   * Get content controls dashboard
   */
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;

      const dashboard = await ContentControlsService.getDashboard(userId);

      res.status(200).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      logger.error('Error fetching content controls dashboard:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch dashboard'
      });
    }
  }

  /**
   * Search across all content types
   */
  async searchContent(req, res) {
    try {
      const { query, types, limit = 20 } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const contentTypes = types ? types.split(',') : undefined;
      const results = await ContentControlsService.searchContent(
        query,
        contentTypes,
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error searching content:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search content'
      });
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(req, res) {
    try {
      const { limit = 20 } = req.query;

      const activities = await ContentControlsService.getRecentActivity(parseInt(limit));

      res.status(200).json({
        success: true,
        data: activities
      });
    } catch (error) {
      logger.error('Error fetching recent activity:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch recent activity'
      });
    }
  }

  /**
   * Bulk update announcements (Admin only)
   */
  async bulkUpdateAnnouncements(req, res) {
    try {
      const { announcementIds, updates } = req.body;
      const updatedBy = req.user.id;

      if (!Array.isArray(announcementIds) || announcementIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Announcement IDs array is required'
        });
      }

      const result = await ContentControlsService.bulkUpdateAnnouncements(
        announcementIds,
        updates,
        updatedBy
      );

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} announcements updated successfully`,
        data: result
      });
    } catch (error) {
      logger.error('Error in bulk update announcements:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to bulk update announcements'
      });
    }
  }

  // ================================
  // PUBLIC API ENDPOINTS
  // ================================

  /**
   * Public endpoint for getting user-specific content controls
   */
  async getPublicContentControls(req, res) {
    try {
      const { page, locale = 'en' } = req.query;
      const user = req.user || { id: null, segment: 'anonymous' };

      // Get active announcements
      const announcements = await ContentControlsService.getActiveAnnouncements(user, page, 5);

      // Get user feature flags (limited to public flags)
      const featureFlags = user.id ? 
        await ContentControlsService.getUserFeatureFlags(user.id, 'ui') : {};

      // Get current legal documents
      const [termsOfService, privacyPolicy] = await Promise.all([
        ContentControlsService.getCurrentLegalDocument('terms_of_service', locale),
        ContentControlsService.getCurrentLegalDocument('privacy_policy', locale)
      ]);

      res.status(200).json({
        success: true,
        data: {
          announcements,
          featureFlags,
          legalDocuments: {
            termsOfService: termsOfService ? {
              id: termsOfService._id,
              version: termsOfService.version,
              effectiveDate: termsOfService.effectiveDate,
              lastModified: termsOfService.lastModified
            } : null,
            privacyPolicy: privacyPolicy ? {
              id: privacyPolicy._id,
              version: privacyPolicy.version,
              effectiveDate: privacyPolicy.effectiveDate,
              lastModified: privacyPolicy.lastModified
            } : null
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching public content controls:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch content controls'
      });
    }
  }
}

module.exports = new ContentControlsController();





