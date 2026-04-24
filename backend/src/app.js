const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const channelRoutes = require('./routes/channelRoutes');
const Message = require('./models/Message');

// Load env vars
dotenv.config();

console.log('Environment Check:', {
  MONGO_URI: process.env.MONGO_URI ? 'FOUND' : 'MISSING',
  JWT_SECRET: process.env.JWT_SECRET ? 'FOUND' : 'MISSING',
  NODE_ENV: process.env.NODE_ENV || 'development'
});

const app = express();
const server = http.createServer(app);

// Ensure DB connection for every request (crucial for serverless)
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);

// Get messages for a channel
app.get('/api/messages/:channelId', async (req, res) => {
  try {
    const messages = await Message.find({ channelId: req.params.channelId })
      .populate('sender', 'username email')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Socket.IO Logic (Only for non-serverless environments)
if (!process.env.VERCEL) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
      console.log(`User ${socket.id} joined channel: ${channelId}`);
      socket.emit('channel_joined', { channelId, message: `Successfully joined ${channelId}` });
    });

    socket.on('send_message', async (data) => {
      try {
        const { channelId, text, senderId } = data;

        if (!text || !channelId) return;

        // Save to DB
        const newMessage = await Message.create({
          channelId,
          sender: senderId,
          text,
        });

        // Populate sender info for broadcast
        const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username email');

        // Broadcast to room
        io.to(channelId).emit('receive_message', populatedMessage);
      } catch (error) {
        console.error('Socket error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}

// Basic error handler
app.use((err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

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
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
});

module.exports = app;
