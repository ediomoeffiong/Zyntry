const Channel = require('../models/Channel');
const User = require('../models/User');
const Request = require('../models/Request');
const { createNotification } = require('../utils/notifications');
const Workspace = require('../models/Workspace');

// @desc    Request to create a channel
// @route   POST /api/channels
// @access  Private
exports.createChannel = async (req, res, next) => {
  try {
    const { name, workspaceId, description, isPrivate } = req.body;

    if (!name || !workspaceId) {
      return res.status(400).json({ message: 'Please add a channel name and workspaceId' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    if (!member) return res.status(403).json({ message: 'Not authorized' });

    // If user is owner/admin, they can create immediately
    const isAdmin = ['owner', 'admin'].includes(member.role);
    
    if (isAdmin) {
      const channel = await Channel.create({
        name,
        workspaceId,
        description,
        isPrivate: !!isPrivate,
        createdBy: req.user._id,
        members: [req.user._id],
        moderators: [req.user._id],
        memberMetadata: [{ user: req.user._id, joinedAt: new Date() }]
      });

      const populatedChannel = await Channel.findById(channel._id)
        .populate('createdBy', 'username email')
        .populate('members', 'username email fullName profilePicture title')
        .populate('participants', 'username email fullName profilePicture title bio description');

      return res.status(201).json(populatedChannel);
    }

    // Otherwise, create a request
    const request = await Request.create({
      type: 'create_channel',
      requester: req.user._id,
      workspaceId,
      channelData: { name, description, isPrivate: !!isPrivate }
    });

    // Notify admins
    const admins = workspace.members.filter(m => ['owner', 'admin'].includes(m.role));
    for (const admin of admins) {
      await createNotification(req.app, {
        userId: admin.user,
        type: 'CHANNEL_CREATE_REQUEST',
        title: 'New Channel Request',
        message: `${req.user.username} wants to create channel: ${name}`,
        metadata: { workspaceId, requestId: request._id }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`workspace_${workspaceId}`).emit('channel_request_update', { workspaceId });
    }

    res.status(202).json({ message: 'Channel creation request sent for approval', request });
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

    // VERIFY: Target user MUST be a member of the workspace
    const Workspace = require('../models/Workspace');
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      'members.user': targetUserId
    });

    if (!workspace) {
      return res.status(403).json({ message: 'User is not a member of this workspace. You can only DM workspace members.' });
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

    dmChannel = await Channel.findById(dmChannel._id)
      .populate('participants', 'username email fullName profilePicture title bio description')
      .populate('members', 'username email fullName profilePicture title');

    res.status(201).json(dmChannel);
  } catch (error) {
    next(error);
  }
};

// @desc    Request to join a channel
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

    // Check if there is already a pending request
    const existingRequest = await Request.findOne({
      type: 'join_channel',
      requester: req.user._id,
      channelId: req.params.channelId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Join request already pending' });
    }

    // Create a request
    const request = await Request.create({
      type: 'join_channel',
      requester: req.user._id,
      workspaceId: channel.workspaceId,
      channelId: channel._id
    });

    // Notify admins and moderators (deduplicated)
    const workspace = await Workspace.findById(channel.workspaceId);
    const admins = workspace.members.filter(m => ['owner', 'admin'].includes(m.role)).map(m => m.user.toString());
    const moderators = (channel.moderators || []).map(m => m.toString());
    
    const targets = [...new Set([...admins, ...moderators])];

    for (const targetId of targets) {
      await createNotification(req.app, {
        userId: targetId,
        type: 'CHANNEL_JOIN_REQUEST',
        title: 'New Channel Join Request',
        message: `${req.user.username} wants to join channel: ${channel.name}`,
        metadata: { workspaceId: channel.workspaceId, channelId: channel._id, requestId: request._id }
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`workspace_${channel.workspaceId}`).emit('channel_request_update', { workspaceId: channel.workspaceId });
    }

    res.status(202).json({ message: 'Join request sent for approval', request });
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

    const query = { 
      workspaceId,
      members: req.user._id 
    };

    if (req.workspaceRole === 'guest') {
      query._id = { $in: req.allowedChannels };
    }

    const channels = await Channel.find(query)
      .populate('participants', 'username email fullName profilePicture title bio description')
      .populate('createdBy', 'username email')
      .populate('members', 'username email fullName profilePicture title')
      .sort({ updatedAt: -1 });

    // Filter out channels where user membership has expired
    const validChannels = channels.filter(ch => {
      if (ch.isDirectMessage) return true;
      const meta = ch.memberMetadata.find(m => m.user.toString() === req.user._id.toString());
      if (meta && meta.expiryDate && new Date(meta.expiryDate) < new Date()) {
        return false;
      }
      return true;
    });

    res.json(validChannels);
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

    if (req.workspaceRole === 'guest') {
      return res.json([]); // Guests cannot see public channels
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
    channel.memberMetadata = channel.memberMetadata.filter(
      (m) => m.user.toString() !== req.user._id.toString()
    );
    channel.moderators = channel.moderators.filter(
      (m) => m.toString() !== req.user._id.toString()
    );
    
    await channel.save();

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a channel
// @route   DELETE /api/channels/:channelId
// @access  Private (Owner/Admin)
exports.deleteChannel = async (req, res, next) => {
  try {
    if (!['owner', 'admin'].includes(req.workspaceRole)) {
      return res.status(403).json({ message: 'Only admins and owners can delete channels' });
    }

    const channel = await Channel.findById(req.params.channelId);

    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (channel.name === 'general') {
      return res.status(400).json({ message: 'Cannot delete the general channel' });
    }

    await Channel.findByIdAndDelete(req.params.channelId);

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending channel requests
// @route   GET /api/channels/requests
// @access  Private
exports.getChannelRequests = async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    // Verify user is admin or moderator
    const workspace = await Workspace.findById(workspaceId);
    const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    const isAdmin = ['owner', 'admin'].includes(member?.role);

    // Get channels where user is moderator
    const moderatedChannels = await Channel.find({ workspaceId, moderators: req.user._id });
    const moderatedChannelIds = moderatedChannels.map(c => c._id);

    const requests = await Request.find({
      workspaceId,
      status: 'pending',
      $or: [
        { type: 'create_channel' }, // Admins see create requests
        { channelId: { $in: moderatedChannelIds } } // Mods see join requests for their channels
      ]
    }).populate('requester', 'username email fullName profilePicture')
      .populate('channelId', 'name');

    // Filter so only admins see create requests
    const filteredRequests = requests.filter(r => {
      if (r.type === 'create_channel') return isAdmin;
      return true; // Join requests are seen by anyone who matches the $or above
    });

    res.json(filteredRequests);
  } catch (error) {
    next(error);
  }
};

// @desc    Handle channel request (approve/reject)
// @route   POST /api/channels/requests/:requestId
// @access  Private
exports.handleChannelRequest = async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const request = await Request.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const workspace = await Workspace.findById(request.workspaceId);
    const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    const isAdmin = ['owner', 'admin'].includes(member?.role);

    let isModerator = false;
    if (request.channelId) {
      const channel = await Channel.findById(request.channelId);
      isModerator = channel.moderators.includes(req.user._id);
    }

    if (!isAdmin && !isModerator) {
      return res.status(403).json({ message: 'Not authorized to handle this request' });
    }

    if (action === 'reject') {
      request.status = 'rejected';
      await request.save();
      
      await createNotification(req.app, {
        userId: request.requester,
        type: 'CHANNEL_REQUEST_REJECTED',
        title: 'Channel Request Declined',
        message: `Your request has been declined.`,
        metadata: { workspaceId: request.workspaceId }
      });

      return res.json({ message: 'Request rejected' });
    }

    if (action === 'approve') {
      request.status = 'approved';
      request.approvedBy = req.user._id;

      if (request.type === 'create_channel') {
        const channel = await Channel.create({
          name: request.channelData.name,
          description: request.channelData.description,
          isPrivate: request.channelData.isPrivate,
          workspaceId: request.workspaceId,
          createdBy: request.requester,
          members: [request.requester],
          moderators: [request.requester],
          memberMetadata: [{ user: request.requester, joinedAt: new Date() }]
        });
        
        await createNotification(req.app, {
          userId: request.requester,
          type: 'CHANNEL_REQUEST_APPROVED',
          title: 'Channel Created!',
          message: `Your request to create #${channel.name} has been approved. You are now a moderator.`,
          metadata: { workspaceId: request.workspaceId, channelId: channel._id }
        });
      } else if (request.type === 'join_channel') {
        const channel = await Channel.findById(request.channelId);
        if (!channel.members.includes(request.requester)) {
          channel.members.push(request.requester);
          channel.memberMetadata.push({ user: request.requester, joinedAt: new Date() });
          await channel.save();
        }

        await createNotification(req.app, {
          userId: request.requester,
          type: 'CHANNEL_REQUEST_APPROVED',
          title: 'Join Request Approved',
          message: `You have been added to #${channel.name}.`,
          metadata: { workspaceId: request.workspaceId, channelId: channel._id }
        });
      }

      await request.save();
      
      const io = req.app.get('io');
      if (io) {
        io.to(`workspace_${request.workspaceId}`).emit('channel_request_update', { workspaceId: request.workspaceId });
        if (request.type === 'join_channel' || request.type === 'create_channel') {
           io.to(request.requester.toString()).emit('channel_list_update', { workspaceId: request.workspaceId });
        }
      }
      
      res.json({ message: 'Request approved' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Remove user from channel
// @route   DELETE /api/channels/:channelId/members/:userId
// @access  Private
exports.removeMember = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const workspace = await Workspace.findById(channel.workspaceId);
    const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    const isAdmin = ['owner', 'admin'].includes(member?.role);
    const isModerator = channel.moderators.includes(req.user._id);

    if (!isAdmin && !isModerator) {
      return res.status(403).json({ message: 'Only admins and moderators can remove members' });
    }

    channel.members = channel.members.filter(m => m.toString() !== req.params.userId);
    channel.memberMetadata = channel.memberMetadata.filter(m => m.user.toString() !== req.params.userId);
    channel.moderators = channel.moderators.filter(m => m.toString() !== req.params.userId);
    
    await channel.save();
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Set member expiry date
// @route   PATCH /api/channels/:channelId/members/:userId/expiry
// @access  Private
exports.setMemberExpiry = async (req, res, next) => {
  try {
    const { expiryDate } = req.body;
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const workspace = await Workspace.findById(channel.workspaceId);
    const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    const isAdmin = ['owner', 'admin'].includes(member?.role);
    const isModerator = channel.moderators.includes(req.user._id);

    if (!isAdmin && !isModerator) {
      return res.status(403).json({ message: 'Only admins and moderators can set expiry dates' });
    }

    const metaIndex = channel.memberMetadata.findIndex(m => m.user.toString() === req.params.userId);
    if (metaIndex === -1) {
      channel.memberMetadata.push({ user: req.params.userId, expiryDate, joinedAt: new Date() });
    } else {
      channel.memberMetadata[metaIndex].expiryDate = expiryDate;
    }

    await channel.save();
    res.json({ message: 'Expiry date updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle moderator rights
// @route   PATCH /api/channels/:channelId/moderators
// @access  Private
exports.toggleModerator = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const workspace = await Workspace.findById(channel.workspaceId);
    const member = workspace.members.find(m => m.user.toString() === req.user._id.toString());
    const isAdmin = ['owner', 'admin'].includes(member?.role);

    if (!isAdmin) {
      return res.status(403).json({ message: 'Only workspace admins can toggle moderator rights' });
    }

    if (channel.moderators.includes(userId)) {
      channel.moderators = channel.moderators.filter(m => m.toString() !== userId);
    } else {
      channel.moderators.push(userId);
    }

    await channel.save();
    res.json({ message: 'Moderator rights updated', moderators: channel.moderators });
  } catch (error) {
    next(error);
  }
};
