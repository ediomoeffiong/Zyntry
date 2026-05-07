const Notification = require('../models/Notification');

/**
 * Create a notification and emit via socket
 * @param {Object} app - Express app instance to get io
 * @param {Object} params - { userId, type, title, message, metadata }
 */
const createNotification = async (app, { userId, type, title, message, metadata }) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return null;

    // Global Settings Check
    const settings = user.notificationSettings || { channelMessages: true, directMessages: true, mentions: true, requests: true };
    
    if (type === 'DIRECT_MESSAGE' && !settings.directMessages) return null;
    if ((type === 'CHANNEL_MESSAGE' || type === 'CHANNEL_MENTION') && !settings.channelMessages) return null;
    if (type.includes('REQUEST') && !settings.requests) return null;
    if (type === 'CHANNEL_MENTION' && !settings.mentions) return null;

    // Channel Mute Check
    if (metadata?.workspaceId && metadata?.channelId) {
      const Workspace = require('../models/Workspace');
      const workspace = await Workspace.findById(metadata.workspaceId);
      if (workspace) {
        const userIdStr = userId.toString();
        const member = workspace.members.find(m => m.user.toString() === userIdStr);
        const channelIdStr = metadata.channelId.toString();
        if (member?.mutedChannels?.some(id => id.toString() === channelIdStr)) {
          return null; // Muted
        }
      }
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      metadata,
    });

    const io = app.get('io');
    if (io) {
      io.to(userId.toString()).emit('new_notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

module.exports = { createNotification };
