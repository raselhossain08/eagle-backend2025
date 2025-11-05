const SavedReply = require('../models/savedReply.model');
const mongoose = require('mongoose');

class SavedReplyService {
  /**
   * Get all saved replies with filtering and pagination
   */
  async getReplies({
    page = 1,
    limit = 20,
    search = '',
    category = '',
    isActive = true,
    sortBy = 'usageCount',
    sortOrder = 'desc'
  } = {}) {
    try {
      // Build filter object
      const filter = { isActive };

      // Search functionality
      if (search) {
        filter.$text = { $search: search };
      }

      // Filter by category
      if (category && category !== 'all') {
        filter.category = category;
      }

      // Calculate pagination
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (pageNumber - 1) * pageSize;

      // Sort configuration
      const sortConfig = {};
      if (search && !sortBy) {
        // Use text search score for search results
        sortConfig.score = { $meta: 'textScore' };
      } else {
        sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      // Get total count
      const total = await SavedReply.countDocuments(filter);

      // Get replies with pagination
      const projection = search ? { score: { $meta: 'textScore' } } : {};
      
      const replies = await SavedReply.find(filter, projection)
        .populate('createdBy', 'firstName lastName name email')
        .populate('updatedBy', 'firstName lastName name email')
        .sort(sortConfig)
        .skip(skip)
        .limit(pageSize)
        .lean();

      // Transform data for frontend
      const transformedReplies = replies.map(reply => ({
        id: reply._id,
        title: reply.title,
        content: reply.content,
        category: reply.category,
        tags: reply.tags,
        isActive: reply.isActive,
        isPublic: reply.isPublic,
        usageCount: reply.usageCount,
        lastUsedAt: reply.lastUsedAt,
        variables: reply.variables,
        departmentRestricted: reply.departmentRestricted,
        createdBy: reply.createdBy ? {
          id: reply.createdBy._id,
          name: reply.createdBy.name || `${reply.createdBy.firstName} ${reply.createdBy.lastName}`,
          email: reply.createdBy.email
        } : null,
        updatedBy: reply.updatedBy ? {
          id: reply.updatedBy._id,
          name: reply.updatedBy.name || `${reply.updatedBy.firstName} ${reply.updatedBy.lastName}`,
          email: reply.updatedBy.email
        } : null,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt
      }));

      return {
        replies: transformedReplies,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / pageSize),
          totalReplies: total,
          hasNext: pageNumber < Math.ceil(total / pageSize),
          hasPrev: pageNumber > 1
        }
      };
    } catch (error) {
      console.error('Error fetching saved replies:', error);
      throw error;
    }
  }

  /**
   * Get single saved reply by ID
   */
  async getReplyById(replyId) {
    try {
      const reply = await SavedReply.findById(replyId)
        .populate('createdBy', 'firstName lastName name email')
        .populate('updatedBy', 'firstName lastName name email')
        .lean();

      if (!reply) {
        throw new Error('Saved reply not found');
      }

      return {
        id: reply._id,
        title: reply.title,
        content: reply.content,
        category: reply.category,
        tags: reply.tags,
        isActive: reply.isActive,
        isPublic: reply.isPublic,
        usageCount: reply.usageCount,
        lastUsedAt: reply.lastUsedAt,
        variables: reply.variables,
        departmentRestricted: reply.departmentRestricted,
        createdBy: reply.createdBy ? {
          id: reply.createdBy._id,
          name: reply.createdBy.name || `${reply.createdBy.firstName} ${reply.createdBy.lastName}`,
          email: reply.createdBy.email
        } : null,
        updatedBy: reply.updatedBy ? {
          id: reply.updatedBy._id,
          name: reply.updatedBy.name || `${reply.updatedBy.firstName} ${reply.updatedBy.lastName}`,
          email: reply.updatedBy.email
        } : null,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt
      };
    } catch (error) {
      console.error('Error fetching saved reply:', error);
      throw error;
    }
  }

  /**
   * Create new saved reply
   */
  async createReply({
    title,
    content,
    category,
    tags = [],
    variables = [],
    isPublic = true,
    departmentRestricted = [],
    createdBy
  }) {
    try {
      const replyData = {
        title,
        content,
        category,
        tags,
        variables,
        isPublic,
        departmentRestricted,
        createdBy
      };

      const reply = await SavedReply.create(replyData);
      return await this.getReplyById(reply._id);
    } catch (error) {
      console.error('Error creating saved reply:', error);
      throw error;
    }
  }

  /**
   * Update saved reply
   */
  async updateReply(replyId, updates, updatedBy) {
    try {
      const reply = await SavedReply.findById(replyId);
      if (!reply) {
        throw new Error('Saved reply not found');
      }

      // Add updatedBy to updates
      updates.updatedBy = updatedBy;

      const updatedReply = await SavedReply.findByIdAndUpdate(
        replyId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      return await this.getReplyById(updatedReply._id);
    } catch (error) {
      console.error('Error updating saved reply:', error);
      throw error;
    }
  }

  /**
   * Delete saved reply (soft delete by setting isActive: false)
   */
  async deleteReply(replyId) {
    try {
      const reply = await SavedReply.findById(replyId);
      if (!reply) {
        throw new Error('Saved reply not found');
      }

      await SavedReply.findByIdAndUpdate(replyId, { isActive: false });
      return true;
    } catch (error) {
      console.error('Error deleting saved reply:', error);
      throw error;
    }
  }

  /**
   * Use a saved reply (increment usage count)
   */
  async useReply(replyId, variableValues = {}) {
    try {
      const reply = await SavedReply.findById(replyId);
      if (!reply) {
        throw new Error('Saved reply not found');
      }

      // Increment usage
      await reply.incrementUsage();

      // Replace variables if any
      const processedContent = reply.replaceVariables(variableValues);

      return {
        id: reply._id,
        title: reply.title,
        originalContent: reply.content,
        processedContent,
        category: reply.category,
        variables: reply.variables,
        usageCount: reply.usageCount + 1
      };
    } catch (error) {
      console.error('Error using saved reply:', error);
      throw error;
    }
  }

  /**
   * Search saved replies
   */
  async searchReplies(query, category = null) {
    try {
      const replies = await SavedReply.searchReplies(query, category);
      
      return replies.map(reply => ({
        id: reply._id,
        title: reply.title,
        content: reply.content,
        category: reply.category,
        tags: reply.tags,
        usageCount: reply.usageCount,
        createdBy: reply.createdBy ? {
          name: reply.createdBy.name || `${reply.createdBy.firstName} ${reply.createdBy.lastName}`,
          email: reply.createdBy.email
        } : null
      }));
    } catch (error) {
      console.error('Error searching saved replies:', error);
      throw error;
    }
  }

  /**
   * Get popular saved replies
   */
  async getPopularReplies(limit = 10) {
    try {
      const replies = await SavedReply.getPopularReplies(limit);
      
      return replies.map(reply => ({
        id: reply._id,
        title: reply.title,
        content: reply.content,
        category: reply.category,
        usageCount: reply.usageCount,
        lastUsedAt: reply.lastUsedAt,
        createdBy: reply.createdBy ? {
          name: reply.createdBy.name || `${reply.createdBy.firstName} ${reply.createdBy.lastName}`,
          email: reply.createdBy.email
        } : null
      }));
    } catch (error) {
      console.error('Error fetching popular replies:', error);
      throw error;
    }
  }

  /**
   * Get replies by category
   */
  async getRepliesByCategory(category) {
    try {
      const replies = await SavedReply.find({ 
        category, 
        isActive: true 
      })
      .sort({ usageCount: -1 })
      .populate('createdBy', 'firstName lastName name email')
      .lean();

      return replies.map(reply => ({
        id: reply._id,
        title: reply.title,
        content: reply.content,
        category: reply.category,
        tags: reply.tags,
        usageCount: reply.usageCount,
        variables: reply.variables,
        createdBy: reply.createdBy ? {
          name: reply.createdBy.name || `${reply.createdBy.firstName} ${reply.createdBy.lastName}`,
          email: reply.createdBy.email
        } : null
      }));
    } catch (error) {
      console.error('Error fetching replies by category:', error);
      throw error;
    }
  }

  /**
   * Get saved reply statistics
   */
  async getStats() {
    try {
      // Total replies
      const totalReplies = await SavedReply.countDocuments({ isActive: true });
      
      // Category distribution
      const categoryStats = await SavedReply.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Most used replies
      const mostUsed = await SavedReply.find({ isActive: true })
        .sort({ usageCount: -1 })
        .limit(5)
        .select('title usageCount category')
        .lean();

      // Usage statistics
      const usageStats = await SavedReply.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalUsage: { $sum: '$usageCount' },
            avgUsage: { $avg: '$usageCount' },
            maxUsage: { $max: '$usageCount' }
          }
        }
      ]);

      return {
        totalReplies,
        categoryDistribution: categoryStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        mostUsedReplies: mostUsed.map(reply => ({
          id: reply._id,
          title: reply.title,
          category: reply.category,
          usageCount: reply.usageCount
        })),
        usageStatistics: usageStats[0] || {
          totalUsage: 0,
          avgUsage: 0,
          maxUsage: 0
        }
      };
    } catch (error) {
      console.error('Error fetching saved reply stats:', error);
      throw error;
    }
  }

  /**
   * Bulk operations on saved replies
   */
  async bulkUpdateReplies(replyIds, updates) {
    try {
      const result = await SavedReply.updateMany(
        { _id: { $in: replyIds } },
        { $set: updates }
      );

      return {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      };
    } catch (error) {
      console.error('Error in bulk update:', error);
      throw error;
    }
  }
}

module.exports = new SavedReplyService();





