const UserImpersonationService = require('../services/userImpersonation.service');
const EmailResendService = require('../services/emailResend.service');
const AccountManagementService = require('../services/accountManagement.service');
const SavedReplyService = require('../services/savedReply.service');
const { logger } = require('../utils/logger');

class SupportToolsController {
  // ================================
  // USER IMPERSONATION
  // ================================

  /**
   * Start user impersonation session
   */
  async startImpersonation(req, res) {
    try {
      const { targetUserId, reason, permissions = {} } = req.body;
      const impersonatorId = req.user.id;

      const session = await UserImpersonationService.startImpersonation({
        impersonatorId,
        targetUserId,
        reason,
        permissions
      });

      res.status(200).json({
        success: true,
        message: 'Impersonation session started successfully',
        data: session
      });
    } catch (error) {
      logger.error('Error starting impersonation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start impersonation session'
      });
    }
  }

  /**
   * End user impersonation session
   */
  async endImpersonation(req, res) {
    try {
      const { sessionId } = req.params;
      const impersonatorId = req.user.id;

      await UserImpersonationService.endImpersonation(sessionId, impersonatorId);

      res.status(200).json({
        success: true,
        message: 'Impersonation session ended successfully'
      });
    } catch (error) {
      logger.error('Error ending impersonation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to end impersonation session'
      });
    }
  }

  /**
   * Get active impersonation sessions
   */
  async getActiveSessions(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const impersonatorId = req.user.id;

      const sessions = await UserImpersonationService.getActiveSessions({
        impersonatorId,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error) {
      logger.error('Error fetching active sessions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch active sessions'
      });
    }
  }

  /**
   * Log impersonation action
   */
  async logImpersonationAction(req, res) {
    try {
      const { sessionId } = req.params;
      const { action, details } = req.body;

      await UserImpersonationService.logAction(sessionId, action, details);

      res.status(200).json({
        success: true,
        message: 'Action logged successfully'
      });
    } catch (error) {
      logger.error('Error logging impersonation action:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to log action'
      });
    }
  }

  // ================================
  // EMAIL RESEND
  // ================================

  /**
   * Resend verification email
   */
  async resendVerificationEmail(req, res) {
    try {
      const { userId } = req.body;
      const requestedBy = req.user.id;

      const result = await EmailResendService.resendVerificationEmail(userId, requestedBy);

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error resending verification email:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to resend verification email'
      });
    }
  }

  /**
   * Resend payment receipt
   */
  async resendPaymentReceipt(req, res) {
    try {
      const { paymentId } = req.body;
      const requestedBy = req.user.id;

      const result = await EmailResendService.resendPaymentReceipt(paymentId, requestedBy);

      res.status(200).json({
        success: true,
        message: 'Payment receipt sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error resending payment receipt:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to resend payment receipt'
      });
    }
  }

  /**
   * Resend contract link
   */
  async resendContractLink(req, res) {
    try {
      const { contractId } = req.body;
      const requestedBy = req.user.id;

      const result = await EmailResendService.resendContractLink(contractId, requestedBy);

      res.status(200).json({
        success: true,
        message: 'Contract link sent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error resending contract link:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to resend contract link'
      });
    }
  }

  /**
   * Get email resend history
   */
  async getEmailResendHistory(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        userId, 
        emailType,
        startDate,
        endDate 
      } = req.query;

      const filters = {};
      if (userId) filters.userId = userId;
      if (emailType) filters.emailType = emailType;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const history = await EmailResendService.getResendHistory({
        page: parseInt(page),
        limit: parseInt(limit),
        ...filters
      });

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Error fetching email resend history:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch email resend history'
      });
    }
  }

  // ================================
  // ACCOUNT MANAGEMENT
  // ================================

  /**
   * Add account note
   */
  async addAccountNote(req, res) {
    try {
      const { userId, content, category, isInternal = true } = req.body;
      const createdBy = req.user.id;

      const note = await AccountManagementService.addNote({
        userId,
        content,
        category,
        isInternal,
        createdBy
      });

      res.status(201).json({
        success: true,
        message: 'Account note added successfully',
        data: note
      });
    } catch (error) {
      logger.error('Error adding account note:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add account note'
      });
    }
  }

  /**
   * Get account notes
   */
  async getAccountNotes(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, category } = req.query;

      const notes = await AccountManagementService.getNotes({
        userId,
        page: parseInt(page),
        limit: parseInt(limit),
        category
      });

      res.status(200).json({
        success: true,
        data: notes
      });
    } catch (error) {
      logger.error('Error fetching account notes:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch account notes'
      });
    }
  }

  /**
   * Add account flag
   */
  async addAccountFlag(req, res) {
    try {
      const { userId, type, reason, severity = 'medium', metadata = {} } = req.body;
      const createdBy = req.user.id;

      const flag = await AccountManagementService.addFlag({
        userId,
        type,
        reason,
        severity,
        metadata,
        createdBy
      });

      res.status(201).json({
        success: true,
        message: 'Account flag added successfully',
        data: flag
      });
    } catch (error) {
      logger.error('Error adding account flag:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add account flag'
      });
    }
  }

  /**
   * Get account flags
   */
  async getAccountFlags(req, res) {
    try {
      const { userId } = req.params;
      const { type, isActive = true } = req.query;

      const flags = await AccountManagementService.getFlags({
        userId,
        type,
        isActive: isActive === 'true'
      });

      res.status(200).json({
        success: true,
        data: flags
      });
    } catch (error) {
      logger.error('Error fetching account flags:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch account flags'
      });
    }
  }

  /**
   * Remove account flag
   */
  async removeAccountFlag(req, res) {
    try {
      const { flagId } = req.params;
      const { reason } = req.body;
      const removedBy = req.user.id;

      await AccountManagementService.removeFlag(flagId, removedBy, reason);

      res.status(200).json({
        success: true,
        message: 'Account flag removed successfully'
      });
    } catch (error) {
      logger.error('Error removing account flag:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove account flag'
      });
    }
  }

  // ================================
  // SAVED REPLIES
  // ================================

  /**
   * Get saved replies
   */
  async getSavedReplies(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        category = '',
        isActive = true,
        sortBy = 'usageCount',
        sortOrder = 'desc'
      } = req.query;

      const replies = await SavedReplyService.getReplies({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        category,
        isActive: isActive === 'true',
        sortBy,
        sortOrder
      });

      res.status(200).json({
        success: true,
        data: replies
      });
    } catch (error) {
      logger.error('Error fetching saved replies:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch saved replies'
      });
    }
  }

  /**
   * Create saved reply
   */
  async createSavedReply(req, res) {
    try {
      const {
        title,
        content,
        category,
        tags = [],
        variables = [],
        isPublic = true,
        departmentRestricted = []
      } = req.body;
      const createdBy = req.user.id;

      const reply = await SavedReplyService.createReply({
        title,
        content,
        category,
        tags,
        variables,
        isPublic,
        departmentRestricted,
        createdBy
      });

      res.status(201).json({
        success: true,
        message: 'Saved reply created successfully',
        data: reply
      });
    } catch (error) {
      logger.error('Error creating saved reply:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create saved reply'
      });
    }
  }

  /**
   * Use saved reply
   */
  async useSavedReply(req, res) {
    try {
      const { replyId } = req.params;
      const { variableValues = {} } = req.body;

      const result = await SavedReplyService.useReply(replyId, variableValues);

      res.status(200).json({
        success: true,
        message: 'Saved reply retrieved successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error using saved reply:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to use saved reply'
      });
    }
  }

  /**
   * Search saved replies
   */
  async searchSavedReplies(req, res) {
    try {
      const { query, category } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const results = await SavedReplyService.searchReplies(query, category);

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error searching saved replies:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search saved replies'
      });
    }
  }

  /**
   * Get popular saved replies
   */
  async getPopularReplies(req, res) {
    try {
      const { limit = 10 } = req.query;

      const replies = await SavedReplyService.getPopularReplies(parseInt(limit));

      res.status(200).json({
        success: true,
        data: replies
      });
    } catch (error) {
      logger.error('Error fetching popular replies:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch popular replies'
      });
    }
  }

  /**
   * Get saved reply statistics
   */
  async getSavedReplyStats(req, res) {
    try {
      const stats = await SavedReplyService.getStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching saved reply stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch saved reply statistics'
      });
    }
  }

  // ================================
  // DASHBOARD & OVERVIEW
  // ================================

  /**
   * Get support tools dashboard overview
   */
  async getDashboardOverview(req, res) {
    try {
      const [
        activeSessions,
        recentEmailResends,
        savedReplyStats,
        recentNotes
      ] = await Promise.all([
        UserImpersonationService.getActiveSessions({ limit: 5 }),
        EmailResendService.getResendHistory({ limit: 10 }),
        SavedReplyService.getStats(),
        AccountManagementService.getRecentActivity({ limit: 10 })
      ]);

      const overview = {
        impersonation: {
          activeSessions: activeSessions.sessions?.length || 0,
          recentSessions: activeSessions.sessions || []
        },
        emailResend: {
          recentResends: recentEmailResends.resends?.length || 0,
          resendHistory: recentEmailResends.resends || []
        },
        savedReplies: {
          totalReplies: savedReplyStats.totalReplies || 0,
          totalUsage: savedReplyStats.usageStatistics?.totalUsage || 0,
          mostUsed: savedReplyStats.mostUsedReplies || []
        },
        accountManagement: {
          recentActivity: recentNotes || []
        }
      };

      res.status(200).json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Error fetching dashboard overview:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch dashboard overview'
      });
    }
  }
}

module.exports = new SupportToolsController();





