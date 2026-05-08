const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'WORKSPACE_INVITE',
        'JOIN_REQUEST_APPROVED',
        'JOIN_REQUEST_REJECTED',
        'DIRECT_MESSAGE',
        'MENTION',
        'CHANNEL_MESSAGE',
        'CHANNEL_MENTION',
        'CHANNEL_JOIN_REQUEST',
        'CHANNEL_CREATE_REQUEST',
        'CHANNEL_REQUEST_APPROVED',
        'CHANNEL_REQUEST_REJECTED',
        'CHANNEL_MODERATOR_ADDED',
        'WORKSPACE_JOIN_REQUEST',
        'WORKSPACE_REQUEST_APPROVED',
        'WORKSPACE_REQUEST_REJECTED',
        'LEAVE_REQUEST_APPROVED',
        'LEAVE_REQUEST_REJECTED'
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      workspaceId: mongoose.Schema.Types.ObjectId,
      channelId: mongoose.Schema.Types.ObjectId,
      senderId: mongoose.Schema.Types.ObjectId,
      senderName: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
