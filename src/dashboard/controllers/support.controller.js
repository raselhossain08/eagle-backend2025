const supportService = require('../services/support.service');
const asyncHandler = require('../../../utils/asyncHandler');
const ApiError = require('../../../utils/ApiError');
const ApiResponse = require('../../../utils/ApiResponse');
const { validationResult } = require('express-validator');

// Get all support tickets with filtering and pagination
const getAllTickets = asyncHandler(async (req, res) => {
  try {
    const result = await supportService.getTickets(req.query);
    
    res.status(200).json(new ApiResponse(200, result, "Tickets retrieved successfully"));
  } catch (error) {
    console.error("Error fetching tickets:", error);
    throw new ApiError(500, "Failed to fetch tickets");
  }
});

// Get single ticket by ID
const getTicketById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const ticket = await supportService.getTicketById(id);
    
    res.status(200).json(new ApiResponse(200, ticket, "Ticket retrieved successfully"));
  } catch (error) {
    console.error("Error fetching ticket:", error);
    if (error.message === 'Ticket not found') {
      throw new ApiError(404, "Ticket not found");
    }
    throw new ApiError(500, "Failed to fetch ticket");
  }
});

// Create new support ticket
const createTicket = asyncHandler(async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const {
    userId,
    subject,
    description,
    category,
    priority = 'medium',
    source = 'web',
    tags = [],
    customFields = {}
  } = req.body;

  try {
    const ticket = await supportService.createTicket({
      userId,
      subject,
      description,
      category,
      priority,
      source,
      tags,
      customFields
    });
    
    res.status(201).json(new ApiResponse(201, ticket, "Ticket created successfully"));
  } catch (error) {
    console.error("Error creating ticket:", error);
    if (error.message === 'User not found') {
      throw new ApiError(404, "User not found");
    }
    throw new ApiError(500, "Failed to create ticket");
  }
});

// Update ticket
const updateTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const ticket = await supportService.updateTicket(id, updates);
    
    res.status(200).json(new ApiResponse(200, ticket, "Ticket updated successfully"));
  } catch (error) {
    console.error("Error updating ticket:", error);
    if (error.message === 'Ticket not found') {
      throw new ApiError(404, "Ticket not found");
    }
    throw new ApiError(500, "Failed to update ticket");
  }
});

// Assign ticket to agent
const assignTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { agentId } = req.body;

  if (!agentId) {
    throw new ApiError(400, "Agent ID is required");
  }

  try {
    const ticket = await supportService.assignTicket(id, agentId);
    
    res.status(200).json(new ApiResponse(200, ticket, "Ticket assigned successfully"));
  } catch (error) {
    console.error("Error assigning ticket:", error);
    if (error.message === 'Ticket not found') {
      throw new ApiError(404, "Ticket not found");
    }
    throw new ApiError(500, "Failed to assign ticket");
  }
});

// Add message to ticket
const addMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, authorType, isInternal = false, attachments = [] } = req.body;

  if (!content || !authorType) {
    throw new ApiError(400, "Content and author type are required");
  }

  try {
    const ticket = await supportService.addMessage(id, {
      content,
      authorId: req.user._id, // From auth middleware
      authorType,
      isInternal,
      attachments
    });
    
    res.status(200).json(new ApiResponse(200, ticket, "Message added successfully"));
  } catch (error) {
    console.error("Error adding message:", error);
    if (error.message === 'Ticket not found') {
      throw new ApiError(404, "Ticket not found");
    }
    throw new ApiError(500, "Failed to add message");
  }
});

// Resolve ticket
const resolveTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;

  if (!resolution) {
    throw new ApiError(400, "Resolution is required");
  }

  try {
    const ticket = await supportService.resolveTicket(id, {
      resolution,
      resolvedBy: req.user._id // From auth middleware
    });
    
    res.status(200).json(new ApiResponse(200, ticket, "Ticket resolved successfully"));
  } catch (error) {
    console.error("Error resolving ticket:", error);
    if (error.message === 'Ticket not found') {
      throw new ApiError(404, "Ticket not found");
    }
    throw new ApiError(500, "Failed to resolve ticket");
  }
});

// Get support statistics
const getSupportStats = asyncHandler(async (req, res) => {
  try {
    const stats = await supportService.getStats();
    
    res.status(200).json(new ApiResponse(200, stats, "Support statistics retrieved successfully"));
  } catch (error) {
    console.error("Error fetching support stats:", error);
    throw new ApiError(500, "Failed to fetch support statistics");
  }
});

// Search tickets
const searchTickets = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, "Search query must be at least 2 characters");
  }

  try {
    const tickets = await supportService.searchTickets(q.trim());
    
    res.status(200).json(new ApiResponse(200, { tickets }, "Search completed successfully"));
  } catch (error) {
    console.error("Error searching tickets:", error);
    throw new ApiError(500, "Failed to search tickets");
  }
});

// Get tickets for a specific user
const getUserTickets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status, limit } = req.query;

  try {
    const tickets = await supportService.getUserTickets(userId, { status, limit });
    
    res.status(200).json(new ApiResponse(200, { tickets }, "User tickets retrieved successfully"));
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    throw new ApiError(500, "Failed to fetch user tickets");
  }
});

// Bulk operations on tickets
const bulkUpdateTickets = asyncHandler(async (req, res) => {
  const { ticketIds, action, data } = req.body;

  if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
    throw new ApiError(400, "Ticket IDs are required");
  }

  if (!action) {
    throw new ApiError(400, "Action is required");
  }

  try {
    let updateQuery = {};
    let message = "";

    switch (action) {
      case 'assign':
        if (!data?.agentId) {
          throw new ApiError(400, "Agent ID is required for assignment");
        }
        // Use Promise.all for bulk assignment
        const assignPromises = ticketIds.map(id => supportService.assignTicket(id, data.agentId));
        await Promise.all(assignPromises);
        message = "Tickets assigned successfully";
        break;
      
      case 'updateStatus':
        if (!data?.status) {
          throw new ApiError(400, "Status is required for status update");
        }
        const updatePromises = ticketIds.map(id => supportService.updateTicket(id, { status: data.status }));
        await Promise.all(updatePromises);
        message = `Ticket status updated to ${data.status} successfully`;
        break;
      
      case 'updatePriority':
        if (!data?.priority) {
          throw new ApiError(400, "Priority is required for priority update");
        }
        const priorityPromises = ticketIds.map(id => supportService.updateTicket(id, { priority: data.priority }));
        await Promise.all(priorityPromises);
        message = `Ticket priority updated to ${data.priority} successfully`;
        break;
      
      default:
        throw new ApiError(400, "Invalid action");
    }

    res.status(200).json(new ApiResponse(200, {
      updatedCount: ticketIds.length
    }, message));
  } catch (error) {
    console.error("Error in bulk update:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to perform bulk operation");
  }
});

// Add satisfaction rating to ticket
const addSatisfactionRating = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, feedback } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  try {
    const SupportTicket = require('../models/supportTicket.model');
    const ticket = await SupportTicket.findById(id);
    
    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    await ticket.addSatisfactionRating(rating, feedback);
    const updatedTicket = await supportService.getTicketById(id);
    
    res.status(200).json(new ApiResponse(200, updatedTicket, "Satisfaction rating added successfully"));
  } catch (error) {
    console.error("Error adding satisfaction rating:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to add satisfaction rating");
  }
});

// =============================================================================
// SUPPORT NOTES FUNCTIONS
// =============================================================================

// Get all support notes
const getAllNotes = asyncHandler(async (req, res) => {
  try {
    // For now, return mock data since notes model may not exist yet
    const mockNotes = [
      {
        id: "1",
        _id: "1",
        subscriberId: "user123",
        subscriberEmail: "test@example.com",
        content: "Customer requested additional support for billing inquiry",
        type: "note",
        isPrivate: true,
        createdBy: req.user?.id || "admin",
        createdByName: req.user?.name || "Admin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ["billing", "support"]
      },
      {
        id: "2", 
        _id: "2",
        subscriberId: "user456",
        subscriberEmail: "support@company.com",
        content: "Important: High-value customer requires priority support",
        type: "flag",
        flagType: "important",
        isPrivate: true,
        createdBy: req.user?.id || "admin",
        createdByName: req.user?.name || "Admin", 
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        tags: ["vip", "priority"]
      }
    ];

    res.status(200).json(new ApiResponse(200, { 
      notes: mockNotes,
      total: mockNotes.length,
      page: 1,
      limit: 50
    }, "Notes retrieved successfully"));
  } catch (error) {
    console.error("Error fetching notes:", error);
    throw new ApiError(500, "Failed to fetch notes");
  }
});

// Get single note by ID
const getNoteById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Mock response for now
    const mockNote = {
      id,
      _id: id,
      subscriberId: "user123",
      subscriberEmail: "test@example.com",
      content: "Customer requested additional support for billing inquiry",
      type: "note",
      isPrivate: true,
      createdBy: req.user?.id || "admin",
      createdByName: req.user?.name || "Admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["billing", "support"]
    };

    res.status(200).json(new ApiResponse(200, mockNote, "Note retrieved successfully"));
  } catch (error) {
    console.error("Error fetching note:", error);
    throw new ApiError(500, "Failed to fetch note");
  }
});

// Create new support note
const createNote = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { 
    subscriberId, 
    subscriberEmail, 
    content, 
    type, 
    flagType, 
    isPrivate = true, 
    tags = [] 
  } = req.body;

  try {
    // Mock creation for now
    const newNote = {
      id: Date.now().toString(),
      _id: Date.now().toString(),
      subscriberId: subscriberId || "unknown",
      subscriberEmail: subscriberEmail || "unknown@example.com",
      content,
      type,
      flagType,
      isPrivate,
      createdBy: req.user?.id || "admin",
      createdByName: req.user?.name || "Admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags
    };

    res.status(201).json(new ApiResponse(201, newNote, "Note created successfully"));
  } catch (error) {
    console.error("Error creating note:", error);
    throw new ApiError(500, "Failed to create note");
  }
});

// Update support note
const updateNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  try {
    // Mock update for now
    const updatedNote = {
      id,
      _id: id,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    res.status(200).json(new ApiResponse(200, updatedNote, "Note updated successfully"));
  } catch (error) {
    console.error("Error updating note:", error);
    throw new ApiError(500, "Failed to update note");
  }
});

// Delete support note
const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Mock deletion for now
    res.status(200).json(new ApiResponse(200, { id }, "Note deleted successfully"));
  } catch (error) {
    console.error("Error deleting note:", error);
    throw new ApiError(500, "Failed to delete note");
  }
});

// =============================================================================
// EMAIL AND QUICK ACTIONS FUNCTIONS
// =============================================================================

// Send email
const sendEmail = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { to, subject, message, isHtml = false } = req.body;

  try {
    // Mock email sending for now
    // In a real implementation, you would use the emailService
    const emailResult = {
      messageId: `mock-${Date.now()}`,
      to,
      subject,
      sentAt: new Date().toISOString()
    };

    res.status(200).json(new ApiResponse(200, emailResult, "Email sent successfully"));
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ApiError(500, "Failed to send email");
  }
});

// Resend welcome email
const resendWelcomeEmail = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { subscriberId } = req.body;

  try {
    // Mock welcome email resend
    const result = {
      subscriberId,
      emailType: "welcome",
      sentAt: new Date().toISOString(),
      status: "sent"
    };

    res.status(200).json(new ApiResponse(200, result, "Welcome email sent successfully"));
  } catch (error) {
    console.error("Error resending welcome email:", error);
    throw new ApiError(500, "Failed to resend welcome email");
  }
});

// Reset password
const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { subscriberId } = req.body;

  try {
    // Mock password reset
    const result = {
      subscriberId,
      action: "password_reset",
      resetTokenSent: true,
      sentAt: new Date().toISOString()
    };

    res.status(200).json(new ApiResponse(200, result, "Password reset email sent successfully"));
  } catch (error) {
    console.error("Error resetting password:", error);
    throw new ApiError(500, "Failed to reset password");
  }
});

// Impersonate user
const impersonateUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { subscriberId } = req.body;

  try {
    // Mock impersonation session creation
    const impersonationSession = {
      sessionId: `imp-${Date.now()}`,
      adminId: req.user?.id || "admin",
      subscriberId,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    };

    res.status(200).json(new ApiResponse(200, impersonationSession, "Impersonation session created successfully"));
  } catch (error) {
    console.error("Error starting impersonation:", error);
    throw new ApiError(500, "Failed to start impersonation");
  }
});

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  assignTicket,
  addMessage,
  resolveTicket,
  getSupportStats,
  searchTickets,
  getUserTickets,
  bulkUpdateTickets,
  addSatisfactionRating,
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  sendEmail,
  resendWelcomeEmail,
  resetPassword,
  impersonateUser
};





