const Notification = require('../models/Notification');

/**
 * Create a notification and emit via socket
 * @param {Object} app - Express app instance to get io
 * @param {Object} params - { userId, type, title, message, metadata }
 */
const createNotification = async (app, { userId, type, title, message, metadata }) => {
  try {
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
