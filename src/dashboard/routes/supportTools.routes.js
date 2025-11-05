const express = require('express');
const router = express.Router();
const SupportToolsController = require('../controllers/supportTools.controller');
const { protect } = require('../../../middlewares/auth.middleware');
const rbac = require('../../../middlewares/rbac.middleware');

// ================================
// MIDDLEWARE SETUP
// ================================

// All support tools routes require authentication
router.use(protect);

// Support permission check middleware
const requireSupportAccess = rbac.requirePermission('support_tools');
const requireAdvancedSupport = rbac.requirePermission('advanced_support');

// ================================
// USER IMPERSONATION ROUTES
// ================================

// Start impersonation session
router.post('/impersonation/start', 
  requireAdvancedSupport,
  SupportToolsController.startImpersonation
);

// End impersonation session
router.post('/impersonation/:sessionId/end', 
  requireAdvancedSupport,
  SupportToolsController.endImpersonation
);

// Get active sessions
router.get('/impersonation/sessions', 
  requireAdvancedSupport,
  SupportToolsController.getActiveSessions
);

// Log impersonation action
router.post('/impersonation/:sessionId/action', 
  requireAdvancedSupport,
  SupportToolsController.logImpersonationAction
);

// ================================
// EMAIL RESEND ROUTES
// ================================

// Resend verification email
router.post('/email/resend/verification', 
  requireSupportAccess,
  SupportToolsController.resendVerificationEmail
);

// Resend payment receipt
router.post('/email/resend/receipt', 
  requireSupportAccess,
  SupportToolsController.resendPaymentReceipt
);

// Resend contract link
router.post('/email/resend/contract', 
  requireSupportAccess,
  SupportToolsController.resendContractLink
);

// Get email resend history
router.get('/email/resend/history', 
  requireSupportAccess,
  SupportToolsController.getEmailResendHistory
);

// ================================
// ACCOUNT MANAGEMENT ROUTES
// ================================

// Add account note
router.post('/accounts/notes', 
  requireSupportAccess,
  SupportToolsController.addAccountNote
);

// Get account notes
router.get('/accounts/:userId/notes', 
  requireSupportAccess,
  SupportToolsController.getAccountNotes
);

// Add account flag
router.post('/accounts/flags', 
  requireSupportAccess,
  SupportToolsController.addAccountFlag
);

// Get account flags
router.get('/accounts/:userId/flags', 
  requireSupportAccess,
  SupportToolsController.getAccountFlags
);

// Remove account flag
router.delete('/accounts/flags/:flagId', 
  requireSupportAccess,
  SupportToolsController.removeAccountFlag
);

// ================================
// SAVED REPLIES ROUTES
// ================================

// Get saved replies
router.get('/replies', 
  requireSupportAccess,
  SupportToolsController.getSavedReplies
);

// Create saved reply
router.post('/replies', 
  requireSupportAccess,
  SupportToolsController.createSavedReply
);

// Use saved reply
router.post('/replies/:replyId/use', 
  requireSupportAccess,
  SupportToolsController.useSavedReply
);

// Search saved replies
router.get('/replies/search', 
  requireSupportAccess,
  SupportToolsController.searchSavedReplies
);

// Get popular replies
router.get('/replies/popular', 
  requireSupportAccess,
  SupportToolsController.getPopularReplies
);

// Get saved reply statistics
router.get('/replies/stats', 
  requireSupportAccess,
  SupportToolsController.getSavedReplyStats
);

// ================================
// DASHBOARD ROUTES
// ================================

// Get dashboard overview
router.get('/dashboard', 
  requireSupportAccess,
  SupportToolsController.getDashboardOverview
);

// ================================
// LEGACY ROUTE COMPATIBILITY
// ================================

// For backward compatibility with existing saved reply routes
router.get('/saved-replies', requireSupportAccess, SupportToolsController.getSavedReplies);
router.post('/saved-replies', requireSupportAccess, SupportToolsController.createSavedReply);
router.post('/saved-replies/:replyId/use', requireSupportAccess, SupportToolsController.useSavedReply);

module.exports = router;





