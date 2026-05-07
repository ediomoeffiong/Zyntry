const User = require('../models/User');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check for existing username
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      // If the username is permanently deleted, only the same email can reclaim it
      if (existingUserByUsername.accountStatus === 'permanently_deleted') {
        if (existingUserByUsername.email === email) {
          // Reactivate this account
          existingUserByUsername.password = password;
          existingUserByUsername.accountStatus = 'active';
          existingUserByUsername.deletionRequestDate = undefined;
          existingUserByUsername.deletionType = undefined;
          await existingUserByUsername.save();

          return res.status(200).json({
            success: true,
            message: 'Account restored successfully',
            data: {
              _id: existingUserByUsername._id,
              username: existingUserByUsername.username,
              email: existingUserByUsername.email,
            },
          });
        } else {
          return res.status(400).json({ message: 'Username already taken. Please choose another.' });
        }
      } else {
        return res.status(400).json({ message: 'Username already taken. Please choose another.' });
      }
    }

    // Check for existing email (reserve it even if deleted)
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({ message: 'Email already in use. Please try another.' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: email }, { username: email }],
    });

    if (user && (await user.matchPassword(password))) {
      // Check if account is permanently deleted (gone)
      if (user.accountStatus === 'permanently_deleted') {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        accountStatus: user.accountStatus,
        deletionRequestDate: user.deletionRequestDate,
        deletionType: user.deletionType,
        token: generateToken(user._id, user.email),
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    next(error);
  }
};

// Generate JWT
const generateToken = (id, email) => {
  return jwt.sign({ id, email }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};
