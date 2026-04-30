const Channel = require('../models/Channel');
const User = require('../models/User');

// @desc    Create a channel
// @route   POST /api/channels
// @access  Private
exports.createChannel = async (req, res, next) => {
  try {
    const { name, workspaceId } = req.body;

    if (!name || !workspaceId) {
      return res.status(400).json({ message: 'Please add a channel name and workspaceId' });
    }

    const channel = await Channel.create({
      name,
      workspaceId,
      createdBy: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json(channel);
  } catch (error) {
    next(error);
  }
};

// @desc    Get or Create a DM channel
// @route   POST /api/channels/dm
// @access  Private
exports.getOrCreateDM = async (req, res, next) => {
  try {
    const { userId, email, workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    if (!userId && !email) {
      return res.status(400).json({ message: 'Please provide a userId or email to chat with' });
    }

    let targetUserId = userId;

    // If email is provided, find the user ID (now supports username too)
    if (email) {
      const user = await User.findOne({
        $or: [
          { email: email },
          { username: email }
        ]
      });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      targetUserId = user._id;
    }

    // Prevent DM with self
    if (targetUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot start a DM with yourself' });
    }

    // Check if DM channel already exists between both users in this workspace
    let dmChannel = await Channel.findOne({
      isDirectMessage: true,
      workspaceId,
      participants: { $all: [req.user._id, targetUserId] }
    }).populate('participants', 'username email');

    if (dmChannel) {
      return res.json(dmChannel);
    }

    // Create new DM channel
    dmChannel = await Channel.create({
      isDirectMessage: true,
      workspaceId,
      participants: [req.user._id, targetUserId],
      members: [req.user._id, targetUserId],
      createdBy: req.user._id,
      name: 'DM' // Internal name, UI will use participants
    });

    dmChannel = await Channel.findById(dmChannel._id).populate('participants', 'username email');

    res.status(201).json(dmChannel);
  } catch (error) {
    next(error);
  }
};

// @desc    Join a channel
// @route   POST /api/channels/:channelId/join
// @access  Private
exports.joinChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.channelId);

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if user is already a member
    if (channel.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'User already a member of this channel' });
    }

    channel.members.push(req.user._id);
    await channel.save();

    res.json(channel);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user channels (including DMs)
// @route   GET /api/channels
// @access  Private
exports.getUserChannels = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId query parameter is required' });
    }

    const channels = await Channel.find({ 
      workspaceId,
      members: req.user._id 
    })
      .populate('participants', 'username email')
      .sort({ updatedAt: -1 });
    res.json(channels);
  } catch (error) {
    next(error);
  }
};
// @desc    Get all public channels (excluding DMs and joined channels)
// @route   GET /api/channels/public
// @access  Private
exports.getPublicChannels = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId query parameter is required' });
    }

    const channels = await Channel.find({ 
      workspaceId,
      isDirectMessage: false,
      members: { $ne: req.user._id }
    }).sort({ name: 1 });
    res.json(channels);
  } catch (error) {
    next(error);
  }
};

// @desc    Leave a channel (Unpin)
// @route   POST /api/channels/:channelId/leave
// @access  Private
exports.leaveChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.channelId);

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Remove user from members
    channel.members = channel.members.filter(
      (memberId) => memberId.toString() !== req.user._id.toString()
    );
    
    await channel.save();

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    next(error);
  }
};
