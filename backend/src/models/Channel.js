const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: function() { return !this.isDirectMessage; }
    },
    isDirectMessage: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    memberMetadata: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        expiryDate: { type: Date },
        joinedAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Channel', channelSchema);
