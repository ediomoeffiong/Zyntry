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

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
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

// Socket.IO Logic
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

// Basic error handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
});

module.exports = app;
