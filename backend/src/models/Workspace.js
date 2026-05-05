const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a workspace name'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Please add a unique workspace slug'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },


    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        role: {
          type: String,
          enum: ['owner', 'admin', 'member', 'guest'],
          default: 'member'
        },
        allowedChannels: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Channel'
          }
        ]
      },
    ],
    settings: {
      whoCanCreateChannels: {
        type: String,
        enum: ['admin', 'everyone'],
        default: 'everyone'
      },
      whoCanInviteUsers: {
        type: String,
        enum: ['admin', 'everyone'],
        default: 'everyone'
      }
    },
    pendingRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    invites: [
      {
        email: String,
        username: String,
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected'],
          default: 'pending',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Workspace', workspaceSchema);
