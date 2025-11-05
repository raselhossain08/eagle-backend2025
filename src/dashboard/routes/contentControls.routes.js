const express = require('express');
const router = express.Router();
const ContentControlsController = require('../controllers/contentControls.controller');
const { protect } = require('../../../middlewares/auth.middleware');
const rbac = require('../../../middlewares/rbac.middleware');

// ================================
// MIDDLEWARE SETUP
// ================================

// Content management permission check
const requireContentAccess = rbac.requirePermission('content_management');
const requireAdminAccess = rbac.requirePermission('admin_access');

// ================================
// PUBLIC ENDPOINTS (No auth required)
// ================================

// Get public content controls (announcements, feature flags, legal docs info)
router.get('/public', ContentControlsController.getPublicContentControls);

// Get current legal document (public access)
router.get('/legal/:documentType', ContentControlsController.getLegalDocument);

// Track announcement interaction (can be anonymous)
router.post('/announcements/:announcementId/track', ContentControlsController.trackAnnouncementInteraction);

// ================================
// AUTHENTICATED USER ENDPOINTS
// ================================

router.use(protect); // All routes below require authentication

// Get active announcements for user
router.get('/announcements/active', ContentControlsController.getActiveAnnouncements);

// Evaluate feature flag
router.get('/feature-flags/:flagName/evaluate', ContentControlsController.evaluateFeatureFlag);

// Evaluate multiple feature flags
router.post('/feature-flags/evaluate', ContentControlsController.evaluateFeatureFlags);

// Get user's feature flags
router.get('/feature-flags/user', ContentControlsController.getUserFeatureFlags);

// Record user agreement to legal document
router.post('/legal/:documentType/agree', ContentControlsController.recordUserAgreement);

// Get legal document version history
router.get('/legal/:documentType/history', ContentControlsController.getLegalDocumentHistory);

// ================================
// CONTENT MANAGEMENT ENDPOINTS
// ================================

router.use(requireContentAccess); // Routes below require content management permissions

// Dashboard
router.get('/dashboard', ContentControlsController.getDashboard);

// Admin dashboard (comprehensive)
router.get('/admin/dashboard', async (req, res) => {
  try {
    const AdminDashboardService = require('../services/adminDashboard.service');
    const dashboard = await AdminDashboardService.getAdminDashboard();
    
    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch admin dashboard'
    });
  }
});

// Search across all content
router.get('/search', ContentControlsController.searchContent);

// Get recent activity
router.get('/activity/recent', ContentControlsController.getRecentActivity);

// ================================
// ANNOUNCEMENTS MANAGEMENT
// ================================

// Create announcement
router.post('/announcements', ContentControlsController.createAnnouncement);

// Update announcement
router.put('/announcements/:announcementId', ContentControlsController.updateAnnouncement);

// Get announcement analytics
router.get('/announcements/:announcementId/analytics', ContentControlsController.getAnnouncementAnalytics);

// Get all announcement analytics
router.get('/announcements/analytics', ContentControlsController.getAnnouncementAnalytics);

// Bulk update announcements
router.patch('/announcements/bulk', ContentControlsController.bulkUpdateAnnouncements);

// ================================
// FEATURE FLAGS MANAGEMENT
// ================================

// Create feature flag
router.post('/feature-flags', ContentControlsController.createFeatureFlag);

// Update feature flag
router.put('/feature-flags/:flagId', ContentControlsController.updateFeatureFlag);

// Toggle feature flag
router.patch('/feature-flags/:flagId/toggle', ContentControlsController.toggleFeatureFlag);

// Get feature flag metrics
router.get('/feature-flags/:flagName/metrics', ContentControlsController.getFeatureFlagMetrics);

// Get all feature flag metrics
router.get('/feature-flags/metrics', ContentControlsController.getFeatureFlagMetrics);

// ================================
// LEGAL DOCUMENTS MANAGEMENT
// ================================

// Create legal document
router.post('/legal', ContentControlsController.createLegalDocument);

// Update legal document
router.put('/legal/:documentId', ContentControlsController.updateLegalDocument);

// Get legal document analytics
router.get('/legal/:documentType/analytics', ContentControlsController.getLegalDocumentAnalytics);

// Get all legal document analytics
router.get('/legal/analytics', ContentControlsController.getLegalDocumentAnalytics);

// ================================
// ADMIN-ONLY ENDPOINTS
// ================================

router.use(requireAdminAccess); // Routes below require admin access

// Advanced feature flag operations
router.delete('/feature-flags/:flagId', async (req, res) => {
  try {
    const { flagId } = req.params;
    const FeatureFlag = require('../models/featureFlag.model');
    
    await FeatureFlag.findByIdAndUpdate(flagId, { 
      status: 'archived',
      isActive: false 
    });

    res.status(200).json({
      success: true,
      message: 'Feature flag archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to archive feature flag'
    });
  }
});

// Delete announcement
router.delete('/announcements/:announcementId', async (req, res) => {
  try {
    const { announcementId } = req.params;
    const Announcement = require('../models/announcement.model');
    
    await Announcement.findByIdAndUpdate(announcementId, { 
      isActive: false,
      status: 'archived'
    });

    res.status(200).json({
      success: true,
      message: 'Announcement archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to archive announcement'
    });
  }
});

// Archive legal document
router.delete('/legal/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const LegalDocument = require('../models/legalDocument.model');
    
    const document = await LegalDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Legal document not found'
      });
    }

    await document.archive();

    res.status(200).json({
      success: true,
      message: 'Legal document archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to archive legal document'
    });
  }
});

// System maintenance endpoints
router.post('/maintenance/cleanup-expired', async (req, res) => {
  try {
    const Announcement = require('../models/announcement.model');
    
    // Update expired announcements
    const result = await Announcement.updateExpiredAnnouncements();

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} expired announcements updated`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cleanup expired content'
    });
  }
});

// Export content data
router.get('/export/:contentType', async (req, res) => {
  try {
    const { contentType } = req.params;
    const { format = 'json' } = req.query;

    let Model;
    switch (contentType) {
      case 'announcements':
        Model = require('../models/announcement.model');
        break;
      case 'feature-flags':
        Model = require('../models/featureFlag.model');
        break;
      case 'legal-documents':
        Model = require('../models/legalDocument.model');
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
    }

    const data = await Model.find({}).lean();

    res.setHeader('Content-Disposition', `attachment; filename="${contentType}-export.${format}"`);
    
    if (format === 'csv') {
      // Basic CSV export (you might want to use a proper CSV library)
      const csv = data.map(item => Object.values(item).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        data,
        exportedAt: new Date(),
        count: data.length
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export data'
    });
  }
});

// ================================
// LEGACY ROUTE COMPATIBILITY
// ================================

// Legacy announcement routes
router.get('/banners', ContentControlsController.getActiveAnnouncements);
router.post('/banners', ContentControlsController.createAnnouncement);

// Legacy feature flag routes
router.get('/flags/:flagName', ContentControlsController.evaluateFeatureFlag);
router.post('/flags/evaluate', ContentControlsController.evaluateFeatureFlags);

// Legacy legal document routes
router.get('/terms', (req, res) => {
  req.params.documentType = 'terms_of_service';
  ContentControlsController.getLegalDocument(req, res);
});

router.get('/privacy', (req, res) => {
  req.params.documentType = 'privacy_policy';
  ContentControlsController.getLegalDocument(req, res);
});

module.exports = router;





