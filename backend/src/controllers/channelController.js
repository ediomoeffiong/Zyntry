const Channel = require('../models/Channel');

// @desc    Create a channel
// @route   POST /api/channels
// @access  Private
exports.createChannel = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Please add a channel name' });
    }

    const channel = await Channel.create({
      name,
      createdBy: req.user._id,
      members: [req.user._id],
    });

    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a channel
// @route   POST /api/channels/:channelId/join
// @access  Private
exports.joinChannel = async (req, res) => {
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
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user channels
// @route   GET /api/channels
// @access  Private
exports.getUserChannels = async (req, res) => {
  try {
    const channels = await Channel.find({ members: req.user._id });
    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
