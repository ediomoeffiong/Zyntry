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

module.exports = {
  getUserProfile,
  updateProfile,
};
