/**
 * Eagle Support Routes Index
 * Main routing file for all support functionality
 */

const express = require('express');
const router = express.Router();

// Import route modules
const impersonationRoutes = require('./impersonation.routes');
const emailResendRoutes = require('./emailResend.routes');
const userNotesRoutes = require('./userNotes.routes');
const savedRepliesRoutes = require('./savedReplies.routes');

// Mount routes
router.use('/impersonation', impersonationRoutes);
router.use('/email-resend', emailResendRoutes);
router.use('/notes', userNotesRoutes);
router.use('/saved-replies', savedRepliesRoutes);

// Support dashboard route
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Eagle Support Tools API',
    version: '1.0.0',
    features: [
      'User Impersonation',
      'Email Resend Services',
      'User Notes & Flags',
      'Saved Replies Library'
    ],
    endpoints: {
      impersonation: '/api/support/impersonation',
      emailResend: '/api/support/email-resend',
      userNotes: '/api/support/notes',
      savedReplies: '/api/support/saved-replies'
    }
  });
});

module.exports = router;