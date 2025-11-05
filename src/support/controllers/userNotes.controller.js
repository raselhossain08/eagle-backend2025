/**
 * Eagle User Notes Controller
 * Handles internal notes and flags for user accounts
 */

const UserNote = require('../models/userNote.model');
const User = require('../../models/user.model');
const createError = require('http-errors');

/**
 * Create a new note
 */
exports.createNote = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      noteType = 'GENERAL',
      priority = 'NORMAL',
      title,
      content,
      tags = [],
      isPrivate = false,
      isPinned = false,
      visibility = 'ALL_STAFF'
    } = req.body;

    if (!title || !content) {
      return next(createError(400, 'Title and content are required'));
    }

    // Validate user exists
    const user = await User.findById(userId).select('name email');
    if (!user) {
      return next(createError(404, 'User not found'));
    }

    const note = new UserNote({
      userId,
      authorId: req.user._id,
      noteType,
      priority,
      title,
      content,
      tags,
      isPrivate,
      isPinned,
      visibility,
      lastModifiedBy: req.user._id
    });

    await note.save();
    await note.populate(['authorId', 'lastModifiedBy'], 'name email');

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: note
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notes for a user
 */
exports.getUserNotes = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      noteType, 
      priority, 
      tags,
      visibility
    } = req.query;

    // Build query
    const query = {
      userId,
      isDeleted: false
    };

    if (noteType) query.noteType = noteType;
    if (priority) query.priority = priority;
    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Handle visibility based on user role
    const userVisibility = req.user.role === 'admin' ? 'ALL_STAFF' : 
                          req.user.role === 'support' ? 'SUPPORT' :
                          req.user.role === 'finance' ? 'FINANCE' : 'ALL_STAFF';

    if (!visibility) {
      query.visibility = { $in: [userVisibility, 'ALL_STAFF'] };
    } else if (visibility !== 'ALL_STAFF') {
      query.visibility = visibility;
    }

    // Handle private notes - only show to author
    query.$or = [
      { isPrivate: false },
      { isPrivate: true, authorId: req.user._id }
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notes = await UserNote.find(query)
      .populate('authorId', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserNote.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Notes retrieved successfully',
      data: {
        notes,
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
 * Update a note
 */
exports.updateNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const updates = req.body;

    const note = await UserNote.findById(noteId);
    if (!note) {
      return next(createError(404, 'Note not found'));
    }

    if (note.isDeleted) {
      return next(createError(410, 'Note has been deleted'));
    }

    // Only allow author or admins to update
    if (note.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError(403, 'Only the author or admin can update this note'));
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'content', 'noteType', 'priority', 'tags', 'isPrivate', 'isPinned', 'visibility'];
    const updateObject = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateObject[field] = updates[field];
      }
    });

    updateObject.lastModifiedBy = req.user._id;

    Object.assign(note, updateObject);
    await note.save();
    await note.populate(['authorId', 'lastModifiedBy'], 'name email');

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: note
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a note (soft delete)
 */
exports.deleteNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;

    const note = await UserNote.findById(noteId);
    if (!note) {
      return next(createError(404, 'Note not found'));
    }

    if (note.isDeleted) {
      return next(createError(410, 'Note already deleted'));
    }

    // Only allow author or admins to delete
    if (note.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError(403, 'Only the author or admin can delete this note'));
    }

    await note.softDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a flag to user
 */
exports.addFlag = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { flagType, expiresAt, reason } = req.body;

    if (!flagType) {
      return next(createError(400, 'Flag type is required'));
    }

    const validFlagTypes = ['VIP', 'HIGH_VALUE', 'PROBLEMATIC', 'PAYMENT_ISSUES', 'REQUIRES_FOLLOW_UP', 'ESCALATED', 'RESOLVED'];
    if (!validFlagTypes.includes(flagType)) {
      return next(createError(400, 'Invalid flag type'));
    }

    // Validate user exists
    const user = await User.findById(userId).select('name email');
    if (!user) {
      return next(createError(404, 'User not found'));
    }

    // Create a note for the flag
    const flagNote = new UserNote({
      userId,
      authorId: req.user._id,
      noteType: 'GENERAL',
      priority: flagType === 'URGENT' ? 'URGENT' : 'NORMAL',
      title: `Flag Added: ${flagType}`,
      content: reason || `${flagType} flag added to account`,
      lastModifiedBy: req.user._id
    });

    await flagNote.addFlag(flagType, req.user._id, expiresAt);

    res.status(201).json({
      success: true,
      message: 'Flag added successfully',
      data: {
        flagType,
        addedBy: req.user.name,
        expiresAt,
        noteId: flagNote._id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a flag from user
 */
exports.removeFlag = async (req, res, next) => {
  try {
    const { userId, flagType } = req.params;

    // Validate user exists
    const user = await User.findById(userId).select('name email');
    if (!user) {
      return next(createError(404, 'User not found'));
    }

    // Find notes with this flag type and remove it
    const notes = await UserNote.find({
      userId,
      'flags.type': flagType,
      'flags.isActive': true,
      isDeleted: false
    });

    if (notes.length === 0) {
      return next(createError(404, 'Active flag not found'));
    }

    // Remove flag from all notes
    const removePromises = notes.map(note => note.removeFlag(flagType));
    await Promise.all(removePromises);

    res.status(200).json({
      success: true,
      message: 'Flag removed successfully',
      data: {
        flagType,
        removedFrom: notes.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active flags for a user
 */
exports.getActiveFlags = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const flags = await UserNote.getActiveFlags(userId);

    res.status(200).json({
      success: true,
      message: 'Active flags retrieved successfully',
      data: flags
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search notes across users
 */
exports.searchNotes = async (req, res, next) => {
  try {
    const { 
      query: searchQuery,
      noteType,
      priority,
      authorId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20
    } = req.query;

    if (!searchQuery) {
      return next(createError(400, 'Search query is required'));
    }

    const query = {
      $text: { $search: searchQuery },
      isDeleted: false
    };

    // Handle visibility based on user role
    const userVisibility = req.user.role === 'admin' ? 'ALL_STAFF' : 
                          req.user.role === 'support' ? 'SUPPORT' :
                          req.user.role === 'finance' ? 'FINANCE' : 'ALL_STAFF';
    
    query.visibility = { $in: [userVisibility, 'ALL_STAFF'] };

    // Handle private notes
    query.$or = [
      { isPrivate: false },
      { isPrivate: true, authorId: req.user._id }
    ];

    if (noteType) query.noteType = noteType;
    if (priority) query.priority = priority;
    if (authorId) query.authorId = authorId;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notes = await UserNote.find(query, { score: { $meta: 'textScore' } })
      .populate('userId', 'name email')
      .populate('authorId', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserNote.countDocuments(query);

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: {
        notes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        searchQuery
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get note statistics
 */
exports.getNoteStats = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const stats = await UserNote.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          totalNotes: { $sum: 1 },
          notesByType: {
            $push: '$noteType'
          },
          notesByPriority: {
            $push: '$priority'
          },
          pinnedNotes: {
            $sum: { $cond: ['$isPinned', 1, 0] }
          },
          privateNotes: {
            $sum: { $cond: ['$isPrivate', 1, 0] }
          }
        }
      }
    ]);

    const flagStats = await UserNote.getActiveFlags(userId);

    res.status(200).json({
      success: true,
      message: 'Note statistics retrieved successfully',
      data: {
        noteStats: stats[0] || {
          totalNotes: 0,
          notesByType: [],
          notesByPriority: [],
          pinnedNotes: 0,
          privateNotes: 0
        },
        activeFlags: flagStats
      }
    });
  } catch (error) {
    next(error);
  }
};