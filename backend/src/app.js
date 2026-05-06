const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const channelRoutes = require('./routes/channelRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const Message = require('./models/Message');
const Channel = require('./models/Channel');
const User = require('./models/User');
const { createNotification } = require('./utils/notifications');

// Load env vars
dotenv.config();

console.log('Environment Check:', {
  MONGO_URI: process.env.MONGO_URI ? 'FOUND' : 'MISSING',
  JWT_SECRET: process.env.JWT_SECRET ? 'FOUND' : 'MISSING',
  NODE_ENV: process.env.NODE_ENV || 'development'
});

const app = express();
const server = http.createServer(app);

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Ensure DB connection for every request (crucial for serverless)
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://zyntry.vercel.app'],
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));


app.get('/', (req, res) => {
  res.send('Zyntry API is running...');
});

app.get('/api', (req, res) => {
  res.json({ status: 'API is running', version: '1.0.0' });
});

const { protect } = require('./middleware/authMiddleware');
const { verifyWorkspaceMembership } = require('./middleware/workspaceMiddleware');

// Get messages for a channel
app.get('/api/messages/:channelId', protect, verifyWorkspaceMembership, async (req, res) => {
  try {
    // Additionally verify that the channel belongs to the workspace
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    const currentWorkspaceId = req.workspace?._id?.toString() || 
                               (req.headers && req.headers['x-workspace-id']) || 
                               (req.query && req.query.workspaceId);

    if (channel.workspaceId && channel.workspaceId.toString() !== currentWorkspaceId) {
      return res.status(403).json({ message: 'Channel does not belong to this workspace' });
    }

    const messages = await Message.find({ channelId: req.params.channelId })
      .populate('sender', 'username email')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const jwt = require('jsonwebtoken');

// Socket.IO Logic (Only for non-serverless environments)
if (!process.env.VERCEL) {
  // Authentication Middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Contains id and email
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.id} (${socket.id})`);
    
    // Update user status to online
    try {
      const user = await User.findById(socket.user.id);
      if (user) {
        user.status = 'online';
        user.lastActiveAt = new Date();
        await user.save();
        
        const Workspace = require('./models/Workspace');
        const userWorkspaces = await Workspace.find({ 'members.user': socket.user.id });
        userWorkspaces.forEach(ws => {
          socket.join(`workspace_${ws._id}`);
          // Notify others in this workspace that user is online
          socket.to(`workspace_${ws._id}`).emit('user_presence_update', {
            userId: socket.user.id,
            status: 'online',
            customStatus: user.customStatus
          });
        });
      }
    } catch (err) {
      console.error('Error updating presence on connect:', err);
    }
    
    // Join a room unique to this user for notifications
    socket.join(socket.user.id);

    socket.on('join_channel', (channelId) => {
      // Leave previous rooms if any (except its own id room)
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id) socket.leave(room);
      });

      socket.join(channelId);
      console.log(`User ${socket.user.id} joined channel: ${channelId}`);
      socket.emit('channel_joined', { channelId, message: `Successfully joined ${channelId}` });
    });

    socket.on('send_message', async (data) => {
      try {
        const { channelId, text } = data;
        const trimmedText = text ? text.trim() : '';

        if (!trimmedText || !channelId) {
          return socket.emit('error', { message: 'Message text and channel ID are required' });
        }

        // Save to DB using authenticated user ID from socket
        const newMessage = await Message.create({
          channelId,
          sender: socket.user.id,
          text: trimmedText,
        });

        // Populate sender info for broadcast
        const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username email');

        // Broadcast to room (including the sender for confirmation)
        io.to(channelId).emit('receive_message', populatedMessage);

        // --- NOTIFICATIONS LOGIC ---
        const channel = await Channel.findById(channelId);
        
        // 1. Mentions (@username)
        const mentionRegex = /@(\w+)/g;
        const matches = trimmedText.match(mentionRegex);
        const mentionedUserIds = new Set();

        if (matches) {
          for (const match of matches) {
            const username = match.substring(1);
            const mentionedUser = await User.findOne({ username });
            if (mentionedUser && mentionedUser._id.toString() !== socket.user.id) {
              mentionedUserIds.add(mentionedUser._id.toString());
              await createNotification(app, {
                userId: mentionedUser._id,
                type: 'MENTION',
                title: 'New Mention',
                message: `${populatedMessage.sender.username} mentioned you in #${channel.name || 'channel'}`,
                metadata: { channelId: channel._id, senderId: socket.user.id, senderName: populatedMessage.sender.username }
              });
            }
          }
        }

        // 2. Direct Message Notification
        if (channel.isDirectMessage) {
          const recipientId = channel.participants.find(p => p.toString() !== socket.user.id);
          // Only notify if they haven't already been notified by a mention
          if (recipientId && !mentionedUserIds.has(recipientId.toString())) {
            await createNotification(app, {
              userId: recipientId,
              type: 'DIRECT_MESSAGE',
              title: 'New Message',
              message: `${populatedMessage.sender.username} sent you a message`,
              metadata: { channelId: channel._id, senderId: socket.user.id, senderName: populatedMessage.sender.username }
            });
          }
        }
      } catch (error) {
        console.error('Socket error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      try {
        const user = await User.findById(socket.user.id);
        if (user) {
          user.status = 'away'; // Set to away on disconnect
          user.lastActiveAt = new Date();
          await user.save();
          
          // Notify workspaces
          const Workspace = require('./models/Workspace');
          const userWorkspaces = await Workspace.find({ 'members.user': socket.user.id });
          userWorkspaces.forEach(ws => {
            io.to(`workspace_${ws._id}`).emit('user_presence_update', {
              userId: socket.user.id,
              status: 'away'
            });
          });
        }
      } catch (err) {
        console.error('Error updating presence on disconnect:', err);
      }
    });

    // Activity tracking
    socket.on('user_activity', async () => {
      try {
        await User.findByIdAndUpdate(socket.user.id, { lastActiveAt: new Date(), status: 'online' });
      } catch (err) {
        console.error('Error updating activity:', err);
      }
    });
  });
}

// Basic error handler
app.use((err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Log the actual error for the developer in the console
  console.error('SERVER ERROR:', {
    message: err.message,
    stack: err.stack
  });

  // Intercept Mongoose buffering/selection/config timeout errors
  if (message.includes('buffering timed out') || message.includes('selection timeout') || message.includes('Database configuration missing')) {
    statusCode = 503;
    message = 'Service is temporarily unavailable. Please try again later.';
  }

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  connectDB().then(() => {
    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to connect to MongoDB on startup:', err.message);
    process.exit(1);
  });
}

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
});

module.exports = app;
