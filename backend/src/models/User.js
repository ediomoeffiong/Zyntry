const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Please add a username'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
    },
    workspaces: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
      },
    ],
    fullName: {
      type: String,
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    timezone: {
      type: String,
      trim: true,
    },
    contact: {
      phone: {
        type: String,
        trim: true,
      },
      website: {
        type: String,
        trim: true,
      },
    },
    location: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['online', 'away', 'offline'],
      default: 'away',
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    customStatus: {
      text: { type: String, trim: true, maxlength: 100 },
      emoji: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
