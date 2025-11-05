/**
 * Eagle Saved Replies Controller
 * Handles template library for support and finance responses
 */

const SavedReply = require('../models/savedReply.model');
const createError = require('http-errors');

/**
 * Create a new saved reply
 */
exports.createReply = async (req, res, next) => {
  try {
    const {
      title,
      category,
      subcategory,
      subject,
      content,
      variables = [],
      tags = [],
      language = 'en',
      isPublic = true,
      approvalRequired = false
    } = req.body;

    if (!title || !category || !content) {
      return next(createError(400, 'Title, category, and content are required'));
    }

    const validCategories = ['SUPPORT', 'FINANCE', 'TECHNICAL', 'BILLING', 'COMPLIANCE', 'GENERAL'];
    if (!validCategories.includes(category)) {
      return next(createError(400, 'Invalid category'));
    }

    const savedReply = new SavedReply({
      title,
      category,
      subcategory,
      subject,
      content,
      variables,
      tags,
      language,
      isPublic,
      approvalRequired,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });

    // Calculate metadata
    savedReply.metadata = {
      estimatedReadTime: Math.ceil(content.split(' ').length / 200), // 200 words per minute
      complexity: content.length > 2000 ? 'COMPLEX' : content.length > 500 ? 'MEDIUM' : 'SIMPLE',
      requiredPermissions: category === 'FINANCE' ? ['finance'] : category === 'TECHNICAL' ? ['technical'] : []
    };

    await savedReply.save();
    await savedReply.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Saved reply created successfully',
      data: savedReply
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get saved replies by category
 */
exports.getRepliesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20, subcategory, tags } = req.query;

    const validCategories = ['SUPPORT', 'FINANCE', 'TECHNICAL', 'BILLING', 'COMPLIANCE', 'GENERAL'];
    if (!validCategories.includes(category)) {
      return next(createError(400, 'Invalid category'));
    }

    let query = {
      category,
      isActive: true,
      $or: [
        { isPublic: true },
        { createdBy: req.user._id }
      ]
    };

    if (subcategory) query.subcategory = subcategory;
    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const replies = await SavedReply.find(query)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ usageCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SavedReply.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Saved replies retrieved successfully',
      data: {
        replies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search saved replies
 */
exports.searchReplies = async (req, res, next) => {
  try {
    const { query: searchQuery, category, page = 1, limit = 20 } = req.query;

    if (!searchQuery) {
      return next(createError(400, 'Search query is required'));
    }

    const replies = await SavedReply.searchReplies(searchQuery, category, req.user._id);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedReplies = replies.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: {
        replies: paginatedReplies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: replies.length,
          pages: Math.ceil(replies.length / parseInt(limit))
        },
        searchQuery
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get popular saved replies
 */
exports.getPopularReplies = async (req, res, next) => {
  try {
    const { category, limit = 10 } = req.query;

    const replies = await SavedReply.getPopular(category, parseInt(limit));

    res.status(200).json({
      success: true,
      message: 'Popular replies retrieved successfully',
      data: replies
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific saved reply
 */
exports.getReply = async (req, res, next) => {
  try {
    const { replyId } = req.params;

    const reply = await SavedReply.findById(replyId)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!reply) {
      return next(createError(404, 'Saved reply not found'));
    }

    if (!reply.isActive) {
      return next(createError(410, 'Saved reply is inactive'));
    }

    // Check access permissions
    if (!reply.isPublic && reply.createdBy._id.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Access denied to private reply'));
    }

    res.status(200).json({
      success: true,
      message: 'Saved reply retrieved successfully',
      data: reply
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a saved reply
 */
exports.updateReply = async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const updates = req.body;
    const { changeReason } = req.body;

    const reply = await SavedReply.findById(replyId);
    if (!reply) {
      return next(createError(404, 'Saved reply not found'));
    }

    // Only allow creator or admins to update
    if (reply.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError(403, 'Only the creator or admin can update this reply'));
    }

    // Handle content updates with versioning
    if (updates.content && updates.content !== reply.content) {
      await reply.updateContent(updates.content, req.user._id, changeReason);
      delete updates.content; // Remove from regular updates since handled above
    }

    // Update other allowed fields
    const allowedUpdates = ['title', 'category', 'subcategory', 'subject', 'variables', 'tags', 'language', 'isPublic', 'isActive'];
    const updateObject = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateObject[field] = updates[field];
      }
    });

    updateObject.lastModifiedBy = req.user._id;

    // Recalculate metadata if content changed
    if (reply.content) {
      updateObject.metadata = {
        estimatedReadTime: Math.ceil(reply.content.split(' ').length / 200),
        complexity: reply.content.length > 2000 ? 'COMPLEX' : reply.content.length > 500 ? 'MEDIUM' : 'SIMPLE',
        requiredPermissions: reply.category === 'FINANCE' ? ['finance'] : reply.category === 'TECHNICAL' ? ['technical'] : []
      };
    }

    Object.assign(reply, updateObject);
    await reply.save();
    await reply.populate(['createdBy', 'lastModifiedBy'], 'name email');

    res.status(200).json({
      success: true,
      message: 'Saved reply updated successfully',
      data: reply
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a saved reply
 */
exports.deleteReply = async (req, res, next) => {
  try {
    const { replyId } = req.params;

    const reply = await SavedReply.findById(replyId);
    if (!reply) {
      return next(createError(404, 'Saved reply not found'));
    }

    // Only allow creator or admins to delete
    if (reply.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError(403, 'Only the creator or admin can delete this reply'));
    }

    reply.isActive = false;
    reply.lastModifiedBy = req.user._id;
    await reply.save();

    res.status(200).json({
      success: true,
      message: 'Saved reply deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Use a saved reply (render with variables)
 */
exports.useReply = async (req, res, next) => {
  try {
    const { replyId } = req.params;
    const { variables = {} } = req.body;

    const reply = await SavedReply.findById(replyId);
    if (!reply) {
      return next(createError(404, 'Saved reply not found'));
    }

    if (!reply.isActive) {
      return next(createError(410, 'Saved reply is inactive'));
    }

    // Check access permissions
    if (!reply.isPublic && reply.createdBy.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Access denied to private reply'));
    }

    // Render content with variables
    const rendered = reply.renderContent(variables);

    // Track usage
    await reply.use(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Reply rendered successfully',
      data: {
        replyId: reply._id,
        title: reply.title,
        category: reply.category,
        rendered,
        originalTemplate: {
          subject: reply.subject,
          content: reply.content,
          variables: reply.variables
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reply version history
 */
exports.getReplyHistory = async (req, res, next) => {
  try {
    const { replyId } = req.params;

    const reply = await SavedReply.findById(replyId)
      .populate('createdBy', 'name email')
      .populate('previousVersions.modifiedBy', 'name email');

    if (!reply) {
      return next(createError(404, 'Saved reply not found'));
    }

    // Only allow creator or admins to view history
    if (reply.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError(403, 'Only the creator or admin can view reply history'));
    }

    res.status(200).json({
      success: true,
      message: 'Reply history retrieved successfully',
      data: {
        replyId: reply._id,
        currentVersion: reply.version,
        title: reply.title,
        createdBy: reply.createdBy,
        history: reply.previousVersions.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get saved reply statistics
 */
exports.getReplyStats = async (req, res, next) => {
  try {
    const { category } = req.query;

    const matchQuery = { isActive: true };
    if (category) matchQuery.category = category;

    const stats = await SavedReply.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' },
          avgUsage: { $avg: '$usageCount' },
          mostUsed: { $max: '$usageCount' },
          lastUsed: { $max: '$lastUsedAt' }
        }
      },
      { $sort: { totalUsage: -1 } }
    ]);

    const totalReplies = await SavedReply.countDocuments({ isActive: true });
    const totalUsage = await SavedReply.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$usageCount' } } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Reply statistics retrieved successfully',
      data: {
        totalReplies,
        totalUsage: totalUsage[0]?.total || 0,
        categoryStats: stats
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get categories and subcategories
 */
exports.getCategories = (req, res) => {
  const categories = {
    SUPPORT: ['General Inquiry', 'Technical Issue', 'Account Access', 'Feature Request'],
    FINANCE: ['Payment Issue', 'Refund Request', 'Billing Question', 'Invoice Query'],
    TECHNICAL: ['Bug Report', 'Integration Help', 'API Question', 'Setup Assistance'],
    BILLING: ['Subscription Change', 'Payment Method', 'Pricing Question', 'Usage Query'],
    COMPLIANCE: ['Data Request', 'Privacy Question', 'Legal Inquiry', 'Audit Response'],
    GENERAL: ['Welcome Message', 'Follow Up', 'Confirmation', 'Update Notification']
  };

  res.status(200).json({
    success: true,
    message: 'Categories retrieved successfully',
    data: categories
  });
};