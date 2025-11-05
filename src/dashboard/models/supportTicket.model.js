const mongoose = require("mongoose");

// Enhanced Support Ticket Schema with Enterprise Features
const supportTicketSchema = new mongoose.Schema({
  // Core Ticket Information
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  impersonatedBy: { // When ticket created during impersonation
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  // Ticket Details
  subject: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },
  
  // Enhanced Classification
  category: {
    type: String,
    enum: [
      "billing", "technical", "account", "subscription", "refund", "cancellation",
      "feature_request", "bug_report", "general", "payment_failure", "upgrade",
      "downgrade", "data_export", "security", "compliance", "api_support",
      "integration", "training", "onboarding", "escalation"
    ],
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent", "critical"],
    default: "medium",
    index: true
  },
  status: {
    type: String,
    enum: [
      "open", "assigned", "in_progress", "waiting_for_customer", 
      "waiting_for_internal", "escalated", "resolved", "closed", 
      "cancelled", "on_hold", "requires_approval"
    ],
    default: "open",
    index: true
  },
  
  // Enhanced Assignment and Routing
  assignment: {
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    assignedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    department: {
      type: String,
      enum: ["support", "billing", "technical", "sales", "management", "legal", "compliance"],
      index: true
    },
    skillsRequired: [String],
    autoAssigned: {
      type: Boolean,
      default: false
    },
    reassignmentHistory: [{
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      reason: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // SLA and Metrics
  sla: {
    responseTimeTarget: Number, // minutes
    resolutionTimeTarget: Number, // minutes
    firstResponseAt: Date,
    firstResponseTime: Number, // minutes
    lastResponseAt: Date,
    responseCount: {
      type: Number,
      default: 0
    },
    breachedResponse: {
      type: Boolean,
      default: false
    },
    breachedResolution: {
      type: Boolean,
      default: false
    }
  },
  
  // Resolution Details
  resolution: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    resolutionTime: Number, // minutes
    resolutionCategory: {
      type: String,
      enum: [
        "resolved", "workaround_provided", "known_issue", "feature_request",
        "user_error", "configuration_issue", "bug_fixed", "escalated_resolved",
        "cancelled_by_customer", "duplicate", "spam"
      ]
    },
    resolutionDetails: {
      type: String,
      maxlength: 2000
    },
    preventionMeasures: String,
    followUpRequired: {
      type: Boolean,
      default: false
    },
    followUpDate: Date
  },
  
  // Enhanced Communication
  messages: [{
    messageId: {
      type: String,
      required: true,
      unique: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000
    },
    contentType: {
      type: String,
      enum: ["text", "html", "markdown"],
      default: "text"
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    isPrivate: { // Visible only to specific agents
      type: Boolean,
      default: false
    },
    visibleTo: [{ // Specific agents who can see private messages
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    authorType: {
      type: String,
      enum: ["customer", "agent", "system", "bot", "impersonated"],
      required: true
    },
    authorName: String, // Cached for performance
    authorEmail: String,
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    readAt: Date,
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    attachments: [{
      filename: String,
      originalName: String,
      url: String,
      cloudinaryPublicId: String,
      size: Number,
      contentType: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    messageType: {
      type: String,
      enum: ["reply", "note", "status_change", "assignment", "escalation", "resolution"],
      default: "reply"
    },
    templateUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavedReply"
    },
    sentiment: {
      score: Number, // -1 to 1
      confidence: Number,
      emotion: String
    }
  }],
  
  // Customer Context
  customer: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    name: String,
    email: String,
    phone: String,
    tier: String, // VIP, Premium, Standard, etc.
    language: String,
    timezone: String,
    subscription: {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MembershipPlan"
      },
      planName: String,
      status: String,
      billingCycle: String,
      mrr: Number,
      startDate: Date,
      renewalDate: Date,
      pastDue: Boolean
    },
    accountValue: {
      lifetime: Number,
      current: Number,
      potential: Number
    },
    supportHistory: {
      totalTickets: Number,
      openTickets: Number,
      averageResolutionTime: Number,
      satisfactionScore: Number,
      lastTicketDate: Date,
      escalatedTickets: Number
    },
    preferences: {
      communicationChannel: {
        type: String,
        enum: ["email", "phone", "chat", "sms"],
        default: "email"
      },
      language: String,
      notificationSettings: {
        emailUpdates: Boolean,
        smsUpdates: Boolean
      }
    }
  },
  
  // Escalation Management
  escalation: {
    isEscalated: {
      type: Boolean,
      default: false,
      index: true
    },
    escalatedAt: Date,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    escalatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    escalationReason: String,
    escalationLevel: {
      type: Number,
      default: 0
    },
    escalationHistory: [{
      level: Number,
      escalatedAt: Date,
      escalatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      reason: String
    }]
  },
  
  // Knowledge Base Integration
  knowledgeBase: {
    suggestedArticles: [{
      articleId: String,
      title: String,
      url: String,
      relevanceScore: Number,
      suggested: Boolean,
      sentToCustomer: Boolean,
      helpful: Boolean
    }],
    searchQueries: [String],
    relatedTickets: [{
      ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SupportTicket"
      },
      similarity: Number,
      reason: String
    }]
  },
  
  // Quality Assurance
  qa: {
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reviewedAt: Date,
    qaScore: Number, // 1-10
    qaFeedback: String,
    qaCategories: {
      accuracy: Number,
      professionalism: Number,
      efficiency: Number,
      customerSatisfaction: Number
    },
    improvementAreas: [String],
    exemplary: Boolean
  },
  
  // Integration and External Systems
  external: {
    source: {
      type: String,
      enum: ["web", "email", "phone", "chat", "api", "mobile_app", "social_media"],
      default: "web"
    },
    sourceDetails: {
      userAgent: String,
      ipAddress: String,
      referrer: String,
      sessionId: String
    },
    externalTicketId: String,
    thirdPartyIntegrations: [{
      system: String, // Zendesk, Salesforce, etc.
      externalId: String,
      syncStatus: String,
      lastSync: Date
    }],
    webhookEvents: [{
      event: String,
      url: String,
      status: String,
      sentAt: Date,
      response: String
    }]
  },
  
  // Satisfaction and Feedback
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date,
    followUpSurvey: {
      completed: Boolean,
      completedAt: Date,
      responses: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    },
    npsScore: Number, // Net Promoter Score
    cestScore: Number // Customer Effort Score
  },
  
  // Automation and AI
  automation: {
    aiSuggestions: [{
      type: String, // response, resolution, escalation, etc.
      suggestion: String,
      confidence: Number,
      applied: Boolean,
      feedback: String
    }],
    autoResponses: [{
      triggeredBy: String,
      template: String,
      sentAt: Date
    }],
    botInteractions: [{
      sessionId: String,
      messages: Number,
      escalatedToHuman: Boolean,
      satisfactionScore: Number
    }]
  },
  
  // Financial Impact
  financial: {
    potentialRevenueLoss: Number,
    actualRevenueLoss: Number,
    retentionRisk: {
      type: String,
      enum: ["low", "medium", "high", "critical"]
    },
    upsellOpportunity: Boolean,
    refundRequested: {
      amount: Number,
      approved: Boolean,
      processedAt: Date
    }
  },
  
  // Tags and Classification
  tags: [{
    name: String,
    category: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Custom Fields and Metadata
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // Audit Trail
  auditLog: [{
    action: String,
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }]
}, {
  timestamps: true,
  indexes: [
    { userId: 1, status: 1 },
    { "assignment.assignedTo": 1, status: 1 },
    { category: 1, priority: 1 },
    { status: 1, priority: 1 },
    { ticketNumber: 1 },
    { "escalation.isEscalated": 1 },
    { "assignment.department": 1 },
    { "customer.tier": 1 },
    { "sla.breachedResponse": 1 },
    { "sla.breachedResolution": 1 },
    { createdAt: -1 },
    { "messages.sentAt": -1 },
    { tags: 1 }
  ]
});

// Virtuals
supportTicketSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

supportTicketSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60));
});

supportTicketSchema.virtual('lastMessage').get(function() {
  const publicMessages = this.messages.filter(msg => !msg.isInternal && !msg.isPrivate);
  return publicMessages.length > 0 ? publicMessages[publicMessages.length - 1] : null;
});

supportTicketSchema.virtual('lastActivity').get(function() {
  if (this.messages.length === 0) return this.createdAt;
  return this.messages[this.messages.length - 1].sentAt;
});

supportTicketSchema.virtual('isOverdue').get(function() {
  if (this.status === 'closed' || this.status === 'resolved') return false;
  
  const targetTime = this.resolution.resolvedAt ? 
    this.sla.resolutionTimeTarget : 
    this.sla.responseTimeTarget;
    
  if (!targetTime) return false;
  
  const deadlineTime = new Date(this.createdAt.getTime() + (targetTime * 60 * 1000));
  return Date.now() > deadlineTime.getTime();
});

supportTicketSchema.virtual('priority_score').get(function() {
  const priorityScores = { low: 1, medium: 2, high: 3, urgent: 4, critical: 5 };
  let score = priorityScores[this.priority] || 2;
  
  // Boost for VIP customers
  if (this.customer.tier === 'VIP') score += 2;
  else if (this.customer.tier === 'Premium') score += 1;
  
  // Boost for escalated tickets
  if (this.escalation.isEscalated) score += this.escalation.escalationLevel;
  
  // Boost for overdue tickets
  if (this.isOverdue) score += 1;
  
  return Math.min(score, 10);
});

// Static Methods
supportTicketSchema.statics.generateTicketNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  
  const latestTicket = await this.findOne({
    ticketNumber: { $regex: `^${prefix}` }
  }).sort({ ticketNumber: -1 });
  
  let number = 1;
  if (latestTicket) {
    const lastNumber = parseInt(latestTicket.ticketNumber.replace(prefix, ''));
    number = lastNumber + 1;
  }
  
  return `${prefix}${number.toString().padStart(6, '0')}`;
};

supportTicketSchema.statics.getAgentWorkload = async function(agentId) {
  const stats = await this.aggregate([
    { $match: { "assignment.assignedTo": agentId, status: { $nin: ["closed", "resolved"] } } },
    {
      $group: {
        _id: "$priority",
        count: { $sum: 1 },
        avgAge: { $avg: { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60] } }
      }
    }
  ]);
  
  const totalOpen = await this.countDocuments({
    "assignment.assignedTo": agentId,
    status: { $nin: ["closed", "resolved"] }
  });
  
  return { stats, totalOpen };
};

supportTicketSchema.statics.getSLABreaches = async function(startDate, endDate) {
  return this.find({
    createdAt: { $gte: startDate, $lte: endDate },
    $or: [
      { "sla.breachedResponse": true },
      { "sla.breachedResolution": true }
    ]
  }).populate('assignment.assignedTo', 'firstName lastName email');
};

// Instance Methods
supportTicketSchema.methods.addMessage = async function(messageData) {
  const messageId = `MSG_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  const message = {
    messageId,
    content: messageData.content,
    contentType: messageData.contentType || 'text',
    isInternal: messageData.isInternal || false,
    isPrivate: messageData.isPrivate || false,
    visibleTo: messageData.visibleTo || [],
    author: messageData.author,
    authorType: messageData.authorType,
    authorName: messageData.authorName,
    authorEmail: messageData.authorEmail,
    attachments: messageData.attachments || [],
    messageType: messageData.messageType || 'reply',
    templateUsed: messageData.templateUsed,
    sentiment: messageData.sentiment
  };
  
  this.messages.push(message);
  
  // Update SLA metrics
  if (!this.sla.firstResponseAt && messageData.authorType === 'agent') {
    this.sla.firstResponseAt = new Date();
    this.sla.firstResponseTime = Math.floor((this.sla.firstResponseAt - this.createdAt) / (1000 * 60));
    
    if (this.sla.responseTimeTarget && this.sla.firstResponseTime > this.sla.responseTimeTarget) {
      this.sla.breachedResponse = true;
    }
  }
  
  if (messageData.authorType === 'agent' || messageData.authorType === 'system') {
    this.sla.lastResponseAt = new Date();
    this.sla.responseCount += 1;
  }
  
  // Update status based on message type
  if (messageData.authorType === 'customer' && this.status === 'waiting_for_customer') {
    this.status = 'open';
  }
  
  // Log audit trail
  this.auditLog.push({
    action: 'message_added',
    field: 'messages',
    newValue: messageId,
    performedBy: messageData.author,
    timestamp: new Date()
  });
  
  return this.save();
};

supportTicketSchema.methods.assignTo = async function(agentId, assignedBy, reason) {
  const oldAgent = this.assignment.assignedTo;
  
  // Add to reassignment history
  if (oldAgent && oldAgent.toString() !== agentId.toString()) {
    this.assignment.reassignmentHistory.push({
      from: oldAgent,
      to: agentId,
      reason: reason || 'Manual reassignment'
    });
  }
  
  this.assignment.assignedTo = agentId;
  this.assignment.assignedAt = new Date();
  this.assignment.assignedBy = assignedBy;
  
  if (this.status === 'open') {
    this.status = 'assigned';
  }
  
  // Log audit trail
  this.auditLog.push({
    action: 'assigned',
    field: 'assignment.assignedTo',
    oldValue: oldAgent,
    newValue: agentId,
    performedBy: assignedBy,
    timestamp: new Date()
  });
  
  return this.save();
};

supportTicketSchema.methods.escalate = async function(escalatedBy, escalatedTo, reason, level = 1) {
  // Add to escalation history
  this.escalation.escalationHistory.push({
    level,
    escalatedAt: new Date(),
    escalatedBy,
    escalatedTo,
    reason
  });
  
  this.escalation.isEscalated = true;
  this.escalation.escalatedAt = new Date();
  this.escalation.escalatedBy = escalatedBy;
  this.escalation.escalatedTo = escalatedTo;
  this.escalation.escalationReason = reason;
  this.escalation.escalationLevel = level;
  
  this.status = 'escalated';
  this.priority = level >= 2 ? 'urgent' : 'high';
  
  // Auto-assign to escalated agent
  if (escalatedTo) {
    this.assignment.assignedTo = escalatedTo;
    this.assignment.assignedAt = new Date();
    this.assignment.assignedBy = escalatedBy;
  }
  
  // Log audit trail
  this.auditLog.push({
    action: 'escalated',
    field: 'escalation',
    newValue: { level, reason, escalatedTo },
    performedBy: escalatedBy,
    timestamp: new Date()
  });
  
  return this.save();
};

supportTicketSchema.methods.resolve = async function(resolutionData, resolvedBy) {
  this.status = 'resolved';
  this.resolution.resolvedAt = new Date();
  this.resolution.resolvedBy = resolvedBy;
  this.resolution.resolutionTime = Math.floor((this.resolution.resolvedAt - this.createdAt) / (1000 * 60));
  this.resolution.resolutionCategory = resolutionData.category;
  this.resolution.resolutionDetails = resolutionData.details;
  this.resolution.preventionMeasures = resolutionData.preventionMeasures;
  this.resolution.followUpRequired = resolutionData.followUpRequired || false;
  this.resolution.followUpDate = resolutionData.followUpDate;
  
  // Check SLA breach
  if (this.sla.resolutionTimeTarget && this.resolution.resolutionTime > this.sla.resolutionTimeTarget) {
    this.sla.breachedResolution = true;
  }
  
  // Log audit trail
  this.auditLog.push({
    action: 'resolved',
    field: 'status',
    oldValue: this.status,
    newValue: 'resolved',
    performedBy: resolvedBy,
    timestamp: new Date()
  });
  
  return this.save();
};

supportTicketSchema.methods.addSatisfactionRating = async function(ratingData) {
  this.satisfaction.rating = ratingData.rating;
  this.satisfaction.feedback = ratingData.feedback;
  this.satisfaction.ratedAt = new Date();
  this.satisfaction.npsScore = ratingData.npsScore;
  this.satisfaction.cestScore = ratingData.cestScore;
  
  if (ratingData.followUpSurvey) {
    this.satisfaction.followUpSurvey = {
      completed: true,
      completedAt: new Date(),
      responses: ratingData.followUpSurvey
    };
  }
  
  return this.save();
};

supportTicketSchema.methods.updateCustomerContext = async function() {
  // This would typically fetch fresh customer data
  // Implementation depends on your User model structure
  const User = mongoose.model('User');
  const customer = await User.findById(this.userId)
    .populate('subscriptions')
    .lean();
    
  if (customer) {
    this.customer.name = customer.firstName + ' ' + customer.lastName;
    this.customer.email = customer.email;
    this.customer.phone = customer.phone;
    this.customer.tier = customer.tier || 'Standard';
    this.customer.language = customer.language || 'en';
    this.customer.timezone = customer.timezone || 'UTC';
    
    // Update subscription info if available
    if (customer.subscriptions && customer.subscriptions.length > 0) {
      const activeSubscription = customer.subscriptions.find(sub => sub.status === 'active');
      if (activeSubscription) {
        this.customer.subscription = {
          planId: activeSubscription.planId,
          planName: activeSubscription.planName,
          status: activeSubscription.status,
          billingCycle: activeSubscription.billingCycle,
          mrr: activeSubscription.mrr,
          startDate: activeSubscription.startDate,
          renewalDate: activeSubscription.renewalDate,
          pastDue: activeSubscription.pastDue || false
        };
      }
    }
  }
  
  return this.save();
};

// User Impersonation Schema
const userImpersonationSchema = new mongoose.Schema({
  // Core Information
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  impersonator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  impersonatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session Details
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: {
    type: Date,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Justification and Approval
  reason: {
    type: String,
    required: true,
    enum: [
      'customer_support', 'technical_assistance', 'billing_issue',
      'account_recovery', 'subscription_management', 'data_export',
      'compliance_investigation', 'security_incident', 'training',
      'quality_assurance', 'emergency_access'
    ]
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  approvalRequired: {
    type: Boolean,
    default: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'auto_approved'],
    default: 'pending',
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  
  // Permissions and Scope
  permissions: {
    read: {
      type: Boolean,
      default: true
    },
    modify: {
      type: Boolean,
      default: false
    },
    billing: {
      type: Boolean,
      default: false
    },
    subscription: {
      type: Boolean,
      default: false
    },
    support: {
      type: Boolean,
      default: true
    },
    admin: {
      type: Boolean,
      default: false
    }
  },
  restrictedAreas: [String], // Areas that cannot be accessed during impersonation
  
  // Activity Tracking
  activities: [{
    action: String,
    target: String, // What was accessed/modified
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    details: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }],
  
  // Security and Monitoring
  security: {
    ipAddress: String,
    userAgent: String,
    location: {
      country: String,
      region: String,
      city: String
    },
    riskScore: {
      type: Number,
      default: 0
    },
    anomaliesDetected: [String],
    flaggedActivities: [{
      activity: String,
      reason: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      timestamp: Date
    }]
  },
  
  // Session Metrics
  metrics: {
    actionsPerformed: {
      type: Number,
      default: 0
    },
    pagesVisited: {
      type: Number,
      default: 0
    },
    dataAccessed: {
      type: Number,
      default: 0
    },
    modificationsCount: {
      type: Number,
      default: 0
    },
    duration: Number, // in minutes
    maxSessionTime: {
      type: Number,
      default: 240 // 4 hours default
    }
  },
  
  // Related Records
  relatedTickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket'
  }],
  relatedCases: [String],
  
  // Compliance and Audit
  compliance: {
    gdprNotified: {
      type: Boolean,
      default: false
    },
    customerConsent: {
      type: String,
      enum: ['explicit', 'implied', 'not_required', 'emergency'],
      default: 'not_required'
    },
    dataAccessLog: [{
      dataType: String,
      accessTime: Date,
      purpose: String
    }],
    retentionPeriod: {
      type: Number,
      default: 2555 // 7 years in days
    }
  },
  
  // Termination Details
  termination: {
    terminatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    terminationReason: {
      type: String,
      enum: ['completed', 'timeout', 'manual', 'security_breach', 'policy_violation', 'emergency']
    },
    automaticTermination: {
      type: Boolean,
      default: false
    }
  },
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  tags: [String]
}, {
  timestamps: true,
  indexes: [
    { impersonator: 1, startTime: -1 },
    { impersonatedUser: 1, startTime: -1 },
    { isActive: 1, startTime: -1 },
    { approvalStatus: 1 },
    { sessionId: 1 },
    { reason: 1 },
    { 'security.riskScore': -1 }
  ]
});

// Support Note Schema (for customer account notes)
const supportNoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['general', 'warning', 'billing', 'technical', 'escalation', 'positive', 'complaint'],
    default: 'general',
    index: true
  },
  visibility: {
    type: String,
    enum: ['private', 'team', 'department', 'all_agents'],
    default: 'team'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  tags: [String],
  relatedTickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: Date, // For temporary notes
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  indexes: [
    { userId: 1, createdAt: -1 },
    { author: 1 },
    { type: 1 },
    { visibility: 1 },
    { isActive: 1 },
    { expiresAt: 1 }
  ]
});

// Models
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
const UserImpersonation = mongoose.model('UserImpersonation', userImpersonationSchema);
const SupportNote = mongoose.model('SupportNote', supportNoteSchema);

module.exports = {
  SupportTicket,
  UserImpersonation,
  SupportNote
};





