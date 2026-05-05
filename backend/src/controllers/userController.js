const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/users/:userId
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // VERIFY: Requester and Target User MUST share at least one workspace
    // If it's the user's own profile, allow it
    if (req.user.id !== req.params.userId) {
      const Workspace = require('../models/Workspace');
      const sharedWorkspace = await Workspace.findOne({
        'members.user': { $all: [req.user.id, req.params.userId] }
      });

      if (!sharedWorkspace) {
        return res.status(403).json({ message: 'Not authorized to view this profile. You do not share a workspace with this user.' });
      }
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    console.log('Update Profile request for user ID:', req.user?.id);
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Not authorized, user missing' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      console.warn('User not found in DB:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      fullName,
      profilePicture,
      title,
      description,
      timezone,
      phone,
      website,
      location,
      company,
    } = req.body;

    console.log('Updating fields:', { fullName, title, phone, website });

    // Update fields
    if (fullName !== undefined) user.fullName = fullName;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (title !== undefined) user.title = title;
    if (description !== undefined) user.description = description;
    if (timezone !== undefined) user.timezone = timezone;
    if (location !== undefined) user.location = location;
    if (company !== undefined) user.company = company;

    // Robust contact update
    if (!user.contact) {
      user.contact = {};
    }
    if (phone !== undefined) user.contact.phone = phone;
    if (website !== undefined) user.contact.website = website;

    console.log('Saving user document...');
    const updatedUser = await user.save();
    console.log('User saved successfully');

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      profilePicture: updatedUser.profilePicture,
      title: updatedUser.title,
      description: updatedUser.description,
      timezone: updatedUser.timezone,
      contact: updatedUser.contact,
      location: updatedUser.location,
      company: updatedUser.company,
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user presence status
// @route   PUT /api/users/status
// @access  Private
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['online', 'away', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { status, lastActiveAt: new Date() },
      { new: true }
    ).select('-password');

    // Broadcast update via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      const Workspace = require('../models/Workspace');
      const workspaces = await Workspace.find({ 'members.user': req.user.id });
      workspaces.forEach(ws => {
        io.to(`workspace_${ws._id}`).emit('user_presence_update', {
          userId: req.user.id,
          status,
          customStatus: user.customStatus
        });
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update custom status (text + emoji)
// @route   PUT /api/users/custom-status
// @access  Private
const updateCustomStatus = async (req, res) => {
  try {
    const { text, emoji } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { customStatus: { text, emoji }, lastActiveAt: new Date() },
      { new: true }
    ).select('-password');

    // Broadcast update
    const io = req.app.get('io');
    if (io) {
      const Workspace = require('../models/Workspace');
      const workspaces = await Workspace.find({ 'members.user': req.user.id });
      workspaces.forEach(ws => {
        io.to(`workspace_${ws._id}`).emit('user_presence_update', {
          userId: req.user.id,
          status: user.status,
          customStatus: user.customStatus
        });
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  updateStatus,
  updateCustomStatus,
};
