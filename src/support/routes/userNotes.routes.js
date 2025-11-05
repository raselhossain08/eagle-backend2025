/**
 * Eagle User Notes Routes
 * Routes for user notes and flags functionality
 */

const express = require('express');
const router = express.Router();

// Controllers
const userNotesController = require('../controllers/userNotes.controller');

// Middlewares
const { protect, adminOnly } = require('../../middlewares/auth.middleware');

// All routes require authentication and admin privileges
router.use(protect);
router.use(adminOnly);

/**
 * @route   POST /api/support/notes/:userId
 * @desc    Create a new note for a user
 * @access  Admin
 */
router.post('/:userId', userNotesController.createNote);

/**
 * @route   GET /api/support/notes/:userId
 * @desc    Get notes for a user
 * @access  Admin
 */
router.get('/:userId', userNotesController.getUserNotes);

/**
 * @route   PUT /api/support/notes/note/:noteId
 * @desc    Update a specific note
 * @access  Admin (or note author)
 */
router.put('/note/:noteId', userNotesController.updateNote);

/**
 * @route   DELETE /api/support/notes/note/:noteId
 * @desc    Delete a specific note (soft delete)
 * @access  Admin (or note author)
 */
router.delete('/note/:noteId', userNotesController.deleteNote);

/**
 * @route   POST /api/support/notes/:userId/flags
 * @desc    Add a flag to a user
 * @access  Admin
 */
router.post('/:userId/flags', userNotesController.addFlag);

/**
 * @route   DELETE /api/support/notes/:userId/flags/:flagType
 * @desc    Remove a flag from a user
 * @access  Admin
 */
router.delete('/:userId/flags/:flagType', userNotesController.removeFlag);

/**
 * @route   GET /api/support/notes/:userId/flags
 * @desc    Get active flags for a user
 * @access  Admin
 */
router.get('/:userId/flags', userNotesController.getActiveFlags);

/**
 * @route   GET /api/support/notes/search
 * @desc    Search notes across all users
 * @access  Admin
 */
router.get('/search', userNotesController.searchNotes);

/**
 * @route   GET /api/support/notes/:userId/stats
 * @desc    Get note statistics for a user
 * @access  Admin
 */
router.get('/:userId/stats', userNotesController.getNoteStats);

module.exports = router;