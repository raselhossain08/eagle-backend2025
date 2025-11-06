const SupportTicket = require('../models/supportTicket.model');
const User = require('../user/models/user.model');
const mongoose = require('mongoose');

class SupportService {
  /**
   * Get all support tickets with filtering, search, and pagination
   */
  async getTickets({
    page = 1,
    limit = 20,
    search = '',
    status = '',
    priority = '',
    category = '',
    assignedTo = '',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    try {
      // Build filter object
      const filter = {};

      // Search across multiple fields
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
          { ticketNumber: searchRegex },
          { subject: searchRegex },
          { description: searchRegex },
          { 'customerInfo.name': searchRegex },
          { 'customerInfo.email': searchRegex },
          { tags: { $in: [searchRegex] } }
        ];
      }

      // Filter by status
      if (status && status !== 'all') {
        filter.status = status;
      }

      // Filter by priority
      if (priority && priority !== 'all') {
        filter.priority = priority;
      }

      // Filter by category
      if (category && category !== 'all') {
        filter.category = category;
      }

      // Filter by assigned agent
      if (assignedTo && assignedTo !== 'all') {
        filter.assignedTo = new mongoose.Types.ObjectId(assignedTo);
      }

      // Calculate pagination
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (pageNumber - 1) * pageSize;

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get total count
      const total = await SupportTicket.countDocuments(filter);

      // Get tickets with pagination and populate
      const tickets = await SupportTicket.find(filter)
        .populate('userId', 'firstName lastName name email avatar subscription')
        .populate('assignedTo', 'firstName lastName name email')
        .populate('resolvedBy', 'firstName lastName name email')
        .sort(sortConfig)
        .skip(skip)
        .limit(pageSize)
        .lean();

      // Transform data for frontend
      const transformedTickets = tickets.map(ticket => ({
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        customer: {
          id: ticket.userId?._id,
          name: ticket.customerInfo?.name || ticket.userId?.name || `${ticket.userId?.firstName} ${ticket.userId?.lastName}`,
          email: ticket.customerInfo?.email || ticket.userId?.email,
          avatar: ticket.userId?.avatar,
          subscription: ticket.customerInfo?.subscriptionPlan || ticket.userId?.subscription
        },
        assignedTo: ticket.assignedTo ? {
          id: ticket.assignedTo._id,
          name: ticket.assignedTo.name || `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
          email: ticket.assignedTo.email
        } : null,
        resolvedBy: ticket.resolvedBy ? {
          id: ticket.resolvedBy._id,
          name: ticket.resolvedBy.name || `${ticket.resolvedBy.firstName} ${ticket.resolvedBy.lastName}`,
          email: ticket.resolvedBy.email
        } : null,
        resolution: ticket.resolution,
        tags: ticket.tags,
        source: ticket.source,
        ageInHours: Math.floor((Date.now() - new Date(ticket.createdAt)) / (1000 * 60 * 60)),
        responseTime: ticket.responseTime,
        resolutionTime: ticket.resolutionTime,
        lastMessage: ticket.messages?.length > 0 ? {
          content: ticket.messages[ticket.messages.length - 1].content,
          author: ticket.messages[ticket.messages.length - 1].authorType,
          sentAt: ticket.messages[ticket.messages.length - 1].sentAt
        } : null,
        messagesCount: ticket.messages?.length || 0,
        satisfaction: ticket.satisfaction,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        assignedAt: ticket.assignedAt
      }));

      return {
        tickets: transformedTickets,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / pageSize),
          totalTickets: total,
          hasNext: pageNumber < Math.ceil(total / pageSize),
          hasPrev: pageNumber > 1
        }
      };
    } catch (error) {
      console.error('Error fetching tickets:', error);
      throw error;
    }
  }

  /**
   * Get single ticket by ID with full details
   */
  async getTicketById(ticketId) {
    try {
      const ticket = await SupportTicket.findById(ticketId)
        .populate('userId', 'firstName lastName name email avatar subscription address phone')
        .populate('assignedTo', 'firstName lastName name email')
        .populate('resolvedBy', 'firstName lastName name email')
        .populate('messages.author', 'firstName lastName name email')
        .lean();

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      return {
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        customer: {
          id: ticket.userId._id,
          name: ticket.customerInfo?.name || ticket.userId.name || `${ticket.userId.firstName} ${ticket.userId.lastName}`,
          email: ticket.customerInfo?.email || ticket.userId.email,
          phone: ticket.customerInfo?.phone || ticket.userId.phone,
          avatar: ticket.userId.avatar,
          subscription: ticket.customerInfo?.subscriptionPlan || ticket.userId.subscription,
          address: ticket.userId.address
        },
        assignedTo: ticket.assignedTo ? {
          id: ticket.assignedTo._id,
          name: ticket.assignedTo.name || `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
          email: ticket.assignedTo.email
        } : null,
        resolvedBy: ticket.resolvedBy ? {
          id: ticket.resolvedBy._id,
          name: ticket.resolvedBy.name || `${ticket.resolvedBy.firstName} ${ticket.resolvedBy.lastName}`,
          email: ticket.resolvedBy.email
        } : null,
        resolution: ticket.resolution,
        tags: ticket.tags,
        source: ticket.source,
        customFields: ticket.customFields,
        messages: ticket.messages.map(msg => ({
          id: msg.messageId,
          content: msg.content,
          isInternal: msg.isInternal,
          author: {
            id: msg.author._id,
            name: msg.author.name || `${msg.author.firstName} ${msg.author.lastName}`,
            email: msg.author.email
          },
          authorType: msg.authorType,
          attachments: msg.attachments,
          sentAt: msg.sentAt,
          readAt: msg.readAt
        })),
        ageInHours: Math.floor((Date.now() - new Date(ticket.createdAt)) / (1000 * 60 * 60)),
        responseTime: ticket.responseTime,
        resolutionTime: ticket.resolutionTime,
        satisfaction: ticket.satisfaction,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        assignedAt: ticket.assignedAt
      };
    } catch (error) {
      console.error('Error fetching ticket:', error);
      throw error;
    }
  }

  /**
   * Create new support ticket
   */
  async createTicket({
    userId,
    subject,
    description,
    category,
    priority = 'medium',
    source = 'web',
    tags = [],
    customFields = {}
  }) {
    try {
      // Get user information
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate ticket number
      const ticketNumber = await SupportTicket.generateTicketNumber();

      // Create ticket
      const ticketData = {
        ticketNumber,
        userId,
        subject,
        description,
        category,
        priority,
        source,
        tags,
        customFields,
        customerInfo: {
          name: user.name || `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone,
          subscriptionPlan: user.subscription,
          subscriptionStatus: user.isActive ? 'active' : 'inactive'
        }
      };

      const ticket = await SupportTicket.create(ticketData);
      
      // Return formatted ticket
      return await this.getTicketById(ticket._id);
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Update ticket
   */
  async updateTicket(ticketId, updates) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Handle special updates
      if (updates.status === 'resolved' && !ticket.resolvedAt) {
        updates.resolvedAt = new Date();
        updates.resolutionTime = Math.floor((updates.resolvedAt - ticket.createdAt) / (1000 * 60));
      }

      const updatedTicket = await SupportTicket.findByIdAndUpdate(
        ticketId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      return await this.getTicketById(updatedTicket._id);
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }
  }

  /**
   * Assign ticket to agent
   */
  async assignTicket(ticketId, agentId) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      await ticket.assignTo(agentId);
      return await this.getTicketById(ticketId);
    } catch (error) {
      console.error('Error assigning ticket:', error);
      throw error;
    }
  }

  /**
   * Add message to ticket
   */
  async addMessage(ticketId, { content, authorId, authorType, isInternal = false, attachments = [] }) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      await ticket.addMessage(content, authorId, authorType, isInternal, attachments);
      return await this.getTicketById(ticketId);
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Resolve ticket
   */
  async resolveTicket(ticketId, { resolution, resolvedBy }) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      await ticket.resolve(resolution, resolvedBy);
      return await this.getTicketById(ticketId);
    } catch (error) {
      console.error('Error resolving ticket:', error);
      throw error;
    }
  }

  /**
   * Get support statistics
   */
  async getStats() {
    try {
      const currentDate = new Date();
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      // Total tickets
      const totalTickets = await SupportTicket.countDocuments({});
      const lastMonthTotal = await SupportTicket.countDocuments({
        createdAt: { $lt: thisMonth }
      });

      // Open tickets
      const openTickets = await SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } });
      const lastMonthOpen = await SupportTicket.countDocuments({
        status: { $in: ['open', 'in_progress'] },
        createdAt: { $lt: thisMonth }
      });

      // Resolved this month
      const resolvedThisMonth = await SupportTicket.countDocuments({
        status: 'resolved',
        resolvedAt: { $gte: thisMonth }
      });
      const resolvedLastMonth = await SupportTicket.countDocuments({
        status: 'resolved',
        resolvedAt: { $gte: lastMonth, $lt: thisMonth }
      });

      // Average response time (in hours)
      const responseTimeResult = await SupportTicket.aggregate([
        { $match: { responseTime: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgResponseTime: { $avg: '$responseTime' } } }
      ]);
      const avgResponseTime = responseTimeResult[0]?.avgResponseTime ? Math.round(responseTimeResult[0].avgResponseTime / 60) : 0;

      // Calculate percentage changes
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100);
      };

      // Status distribution
      const statusStats = await SupportTicket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      // Priority distribution
      const priorityStats = await SupportTicket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      // Category distribution
      const categoryStats = await SupportTicket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      return {
        totalTickets: {
          value: totalTickets,
          change: calculateChange(totalTickets, lastMonthTotal),
          trend: totalTickets >= lastMonthTotal ? 'up' : 'down'
        },
        openTickets: {
          value: openTickets,
          change: calculateChange(openTickets, lastMonthOpen),
          trend: openTickets <= lastMonthOpen ? 'down' : 'up' // Less open tickets is better
        },
        resolvedThisMonth: {
          value: resolvedThisMonth,
          change: calculateChange(resolvedThisMonth, resolvedLastMonth),
          trend: resolvedThisMonth >= resolvedLastMonth ? 'up' : 'down'
        },
        avgResponseTime: {
          value: avgResponseTime,
          unit: 'hours',
          change: 0, // Would need historical data for trend
          trend: 'stable'
        },
        statusDistribution: statusStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        priorityDistribution: priorityStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        categoryDistribution: categoryStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error fetching support stats:', error);
      throw error;
    }
  }

  /**
   * Search tickets by various criteria
   */
  async searchTickets(query) {
    try {
      const searchRegex = new RegExp(query, 'i');
      
      const tickets = await SupportTicket.find({
        $or: [
          { ticketNumber: searchRegex },
          { subject: searchRegex },
          { description: searchRegex },
          { 'customerInfo.name': searchRegex },
          { 'customerInfo.email': searchRegex },
          { tags: { $in: [searchRegex] } }
        ]
      })
      .populate('userId', 'firstName lastName name email avatar')
      .populate('assignedTo', 'firstName lastName name email')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

      return tickets.map(ticket => ({
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        customer: {
          name: ticket.customerInfo?.name || ticket.userId?.name,
          email: ticket.customerInfo?.email || ticket.userId?.email
        },
        createdAt: ticket.createdAt
      }));
    } catch (error) {
      console.error('Error searching tickets:', error);
      throw error;
    }
  }

  /**
   * Get tickets for a specific user
   */
  async getUserTickets(userId, { status = '', limit = 10 } = {}) {
    try {
      const filter = { userId: new mongoose.Types.ObjectId(userId) };
      
      if (status && status !== 'all') {
        filter.status = status;
      }

      const tickets = await SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      return tickets.map(ticket => ({
        id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt
      }));
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      throw error;
    }
  }
}

module.exports = new SupportService();





