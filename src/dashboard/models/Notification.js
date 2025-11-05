const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "payment_failed",
        "new_subscriber", 
        "contract_pending",
        "info",
        "warning",
        "success",
        "subscription_expiring",
        "payment_success",
        "contract_signed",
        "system_update"
      ],
      default: "info",
    },
    read: {
      type: Boolean,
      default: false,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create notification
notificationSchema.statics.createNotification = async function (
  userId,
  title,
  message,
  type = "info",
  data = {},
  priority = "medium"
) {
  try {
    const notification = new this({
      userId,
      title,
      message,
      type,
      data,
      priority,
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }
};

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  await this.save();
  return this;
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({ userId, read: false });
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;





