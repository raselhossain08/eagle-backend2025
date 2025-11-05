const savedReplyService = require('../services/savedReply.service');
const asyncHandler = require('../../../utils/asyncHandler');
const ApiError = require('../../../utils/ApiError');
const ApiResponse = require('../../../utils/ApiResponse');
const { validationResult } = require('express-validator');

// Get all saved replies with filtering and pagination
const getAllReplies = asyncHandler(async (req, res) => {
  try {
    const result = await savedReplyService.getReplies(req.query);
    
    res.status(200).json(new ApiResponse(200, result, "Saved replies retrieved successfully"));
  } catch (error) {
    console.error("Error fetching saved replies:", error);
    throw new ApiError(500, "Failed to fetch saved replies");
  }
});

// Get single saved reply by ID
const getReplyById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const reply = await savedReplyService.getReplyById(id);
    
    res.status(200).json(new ApiResponse(200, reply, "Saved reply retrieved successfully"));
  } catch (error) {
    console.error("Error fetching saved reply:", error);
    if (error.message === 'Saved reply not found') {
      throw new ApiError(404, "Saved reply not found");
    }
    throw new ApiError(500, "Failed to fetch saved reply");
  }
});

// Create new saved reply
const createReply = asyncHandler(async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const {
    title,
    content,
    category,
    tags = [],
    variables = [],
    isPublic = true,
    departmentRestricted = []
  } = req.body;

  try {
    const reply = await savedReplyService.createReply({
      title,
      content,
      category,
      tags,
      variables,
      isPublic,
      departmentRestricted,
      createdBy: req.user._id // From auth middleware
    });
    
    res.status(201).json(new ApiResponse(201, reply, "Saved reply created successfully"));
  } catch (error) {
    console.error("Error creating saved reply:", error);
    throw new ApiError(500, "Failed to create saved reply");
  }
});

// Update saved reply
const updateReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const reply = await savedReplyService.updateReply(id, updates, req.user._id);
    
    res.status(200).json(new ApiResponse(200, reply, "Saved reply updated successfully"));
  } catch (error) {
    console.error("Error updating saved reply:", error);
    if (error.message === 'Saved reply not found') {
      throw new ApiError(404, "Saved reply not found");
    }
    throw new ApiError(500, "Failed to update saved reply");
  }
});

// Delete saved reply
const deleteReply = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    await savedReplyService.deleteReply(id);
    
    res.status(200).json(new ApiResponse(200, null, "Saved reply deleted successfully"));
  } catch (error) {
    console.error("Error deleting saved reply:", error);
    if (error.message === 'Saved reply not found') {
      throw new ApiError(404, "Saved reply not found");
    }
    throw new ApiError(500, "Failed to delete saved reply");
  }
});

// Use a saved reply (increment usage and process variables)
const useReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { variables = {} } = req.body;

  try {
    const result = await savedReplyService.useReply(id, variables);
    
    res.status(200).json(new ApiResponse(200, result, "Saved reply processed successfully"));
  } catch (error) {
    console.error("Error using saved reply:", error);
    if (error.message === 'Saved reply not found') {
      throw new ApiError(404, "Saved reply not found");
    }
    throw new ApiError(500, "Failed to process saved reply");
  }
});

// Search saved replies
const searchReplies = asyncHandler(async (req, res) => {
  const { q, category } = req.query;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  try {
    const replies = await savedReplyService.searchReplies(q.trim(), category);
    
    res.status(200).json(new ApiResponse(200, { replies }, "Search completed successfully"));
  } catch (error) {
    console.error("Error searching saved replies:", error);
    throw new ApiError(500, "Failed to search saved replies");
  }
});

// Get popular saved replies
const getPopularReplies = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const replies = await savedReplyService.getPopularReplies(parseInt(limit));
    
    res.status(200).json(new ApiResponse(200, { replies }, "Popular replies retrieved successfully"));
  } catch (error) {
    console.error("Error fetching popular replies:", error);
    throw new ApiError(500, "Failed to fetch popular replies");
  }
});

// Get replies by category
const getRepliesByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;

  try {
    const replies = await savedReplyService.getRepliesByCategory(category);
    
    res.status(200).json(new ApiResponse(200, { replies }, "Category replies retrieved successfully"));
  } catch (error) {
    console.error("Error fetching category replies:", error);
    throw new ApiError(500, "Failed to fetch category replies");
  }
});

// Get saved reply statistics
const getReplyStats = asyncHandler(async (req, res) => {
  try {
    const stats = await savedReplyService.getStats();
    
    res.status(200).json(new ApiResponse(200, stats, "Saved reply statistics retrieved successfully"));
  } catch (error) {
    console.error("Error fetching reply stats:", error);
    throw new ApiError(500, "Failed to fetch saved reply statistics");
  }
});

// Bulk operations on saved replies
const bulkUpdateReplies = asyncHandler(async (req, res) => {
  const { replyIds, action, data } = req.body;

  if (!replyIds || !Array.isArray(replyIds) || replyIds.length === 0) {
    throw new ApiError(400, "Reply IDs are required");
  }

  if (!action) {
    throw new ApiError(400, "Action is required");
  }

  try {
    let updateQuery = {};
    let message = "";

    switch (action) {
      case 'activate':
        updateQuery = { isActive: true };
        message = "Replies activated successfully";
        break;
      case 'deactivate':
        updateQuery = { isActive: false };
        message = "Replies deactivated successfully";
        break;
      case 'updateCategory':
        if (!data?.category) {
          throw new ApiError(400, "Category is required for category update");
        }
        updateQuery = { category: data.category };
        message = `Reply category updated to ${data.category} successfully`;
        break;
      case 'makePublic':
        updateQuery = { isPublic: true };
        message = "Replies made public successfully";
        break;
      case 'makePrivate':
        updateQuery = { isPublic: false };
        message = "Replies made private successfully";
        break;
      default:
        throw new ApiError(400, "Invalid action");
    }

    // Add updatedBy to all updates
    updateQuery.updatedBy = req.user._id;

    const result = await savedReplyService.bulkUpdateReplies(replyIds, updateQuery);

    res.status(200).json(new ApiResponse(200, result, message));
  } catch (error) {
    console.error("Error in bulk update:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to perform bulk operation");
  }
});

module.exports = {
  getAllReplies,
  getReplyById,
  createReply,
  updateReply,
  deleteReply,
  useReply,
  searchReplies,
  getPopularReplies,
  getRepliesByCategory,
  getReplyStats,
  bulkUpdateReplies
};





