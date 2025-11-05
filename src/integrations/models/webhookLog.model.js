/**
 * Eagle Webhook Log Model
 * Tracks webhook deliveries and attempts
 */

const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  provider: String,
  targetUrl: {
    type: String,
    required: true
  },
  payload: mongoose.Schema.Types.Mixed,
  headers: mongoose.Schema.Types.Mixed,
  method: {
    type: String,
    default: 'POST'
  },
  attempts: [{
    attemptNumber: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'TIMEOUT', 'RETRY']
    },
    statusCode: Number,
    responseBody: String,
    responseHeaders: mongoose.Schema.Types.Mixed,
    responseTime: Number, // in milliseconds
    errorMessage: String
  }],
  finalStatus: {
    type: String,
    enum: ['DELIVERED', 'FAILED', 'PENDING'],
    default: 'PENDING'
  },
  retryCount: {
    type: Number,
    default: 0
  },
  nextRetryAt: Date,
  maxRetries: {
    type: Number,
    default: 5
  },
  metadata: {
    source: String,
    userId: mongoose.Schema.Types.ObjectId,
    subscriptionId: String,
    invoiceId: String,
    contractId: String,
    environment: String
  }
}, {
  timestamps: true,
  collection: 'webhookLogs'
});

// Indexes
webhookLogSchema.index({ eventType: 1, createdAt: -1 });
webhookLogSchema.index({ eventId: 1 });
webhookLogSchema.index({ finalStatus: 1, nextRetryAt: 1 });
webhookLogSchema.index({ provider: 1, createdAt: -1 });

// Methods
webhookLogSchema.methods.addAttempt = function(status, statusCode, responseBody, responseTime, errorMessage = null) {
  const attemptNumber = this.attempts.length + 1;
  
  this.attempts.push({
    attemptNumber,
    status,
    statusCode,
    responseBody: responseBody ? responseBody.substring(0, 1000) : null, // Limit size
    responseTime,
    errorMessage
  });
  
  if (status === 'SUCCESS') {
    this.finalStatus = 'DELIVERED';
    this.nextRetryAt = undefined;
  } else if (attemptNumber >= this.maxRetries) {
    this.finalStatus = 'FAILED';
    this.nextRetryAt = undefined;
  } else {
    this.retryCount = attemptNumber;
    // Exponential backoff: 2^attempt minutes
    const retryDelayMinutes = Math.pow(2, attemptNumber);
    this.nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
  }
  
  return this.save();
};

// Statics
webhookLogSchema.statics.getPendingRetries = function() {
  return this.find({
    finalStatus: 'PENDING',
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: 5 }
  }).sort({ nextRetryAt: 1 });
};

webhookLogSchema.statics.getDeliveryStats = function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$eventType',
        total: { $sum: 1 },
        delivered: {
          $sum: { $cond: [{ $eq: ['$finalStatus', 'DELIVERED'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$finalStatus', 'FAILED'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$finalStatus', 'PENDING'] }, 1, 0] }
        },
        avgResponseTime: {
          $avg: {
            $arrayElemAt: ['$attempts.responseTime', 0]
          }
        }
      }
    },
    {
      $addFields: {
        successRate: {
          $multiply: [
            { $divide: ['$delivered', '$total'] },
            100
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('WebhookLog', webhookLogSchema);