const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Channel = require('../models/Channel');
const { createNotification } = require('../utils/notifications');

// @desc    Create new workspace
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = async (req, res) => {
  try {
    const { name, slug, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Please add a workspace name' });
    }

    // Generate slug from name if not provided
    const workspaceSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Check if slug exists
    const slugExists = await Workspace.findOne({ slug: workspaceSlug });
    if (slugExists) {
      return res.status(400).json({ message: 'Workspace URL (slug) is already taken' });
    }

    const workspace = await Workspace.create({
      name,
      slug: workspaceSlug,
      description,
      createdBy: req.user.id,
      members: [{ user: req.user.id, role: 'owner' }],
    });

    // Add workspace to user
    await User.findByIdAndUpdate(req.user.id, {
      $push: { workspaces: workspace._id },
    });

    // Create a default general channel for the workspace
    await Channel.create({
      name: 'general',
      createdBy: req.user.id,
      workspaceId: workspace._id,
      members: [req.user.id],
    });

    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request to join a workspace
// @route   POST /api/workspaces/:workspaceId/request
// @access  Private
const requestToJoinWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is already a member
    if (workspace.members.some(m => m.user.toString() === req.user.id)) {
      return res.status(400).json({ message: 'Already a member of this workspace' });
    }

    // Check if already in pending requests
    if (workspace.pendingRequests.includes(req.user.id)) {
      return res.status(400).json({ message: 'Join request already pending' });
    }

    // Add user to pending requests
    workspace.pendingRequests.push(req.user.id);
    await workspace.save();

    res.json({ message: 'Join request sent successfully', workspace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Invite user to workspace
// @route   POST /api/workspaces/:workspaceId/invite
// @access  Private (Owner only)
const inviteUser = async (req, res) => {
  try {
    const { email, username } = req.body;
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check permissions
    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember) {
      return res.status(403).json({ message: 'Not a member of this workspace' });
    }
    
    const canInvite = workspace.settings?.whoCanInviteUsers === 'everyone' || 
                      ['owner', 'admin'].includes(requesterMember.role);
                      
    if (!canInvite) {
      return res.status(403).json({ message: 'You do not have permission to invite users' });
    }

    // Check if invite already exists
    const inviteExists = workspace.invites.some(
      (inv) => (email && inv.email === email) || (username && inv.username === username)
    );

    if (inviteExists) {
      return res.status(400).json({ message: 'Invite already sent to this user' });
    }

    workspace.invites.push({
      email,
      username,
      invitedBy: req.user.id,
      status: 'pending',
    });

    await workspace.save();

    // Trigger notification if user exists
    const targetUser = await User.findOne({
      $or: [{ email: email }, { username: username }]
    });
    if (targetUser) {
      await createNotification(req.app, {
        userId: targetUser._id,
        type: 'WORKSPACE_INVITE',
        title: 'New Workspace Invite',
        message: `You've been invited to join ${workspace.name}`,
        metadata: { workspaceId: workspace._id, senderId: req.user.id, senderName: req.user.username }
      });
    }

    res.json({ message: 'Invite sent successfully', workspace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve join request
// @route   POST /api/workspaces/:workspaceId/approve
// @access  Private (Owner only)
const approveRequest = async (req, res) => {
  try {
    const { userId } = req.body;
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check permissions
    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role)) {
      return res.status(403).json({ message: 'Only workspace owners and admins can approve requests' });
    }

    // Move from pending to members
    if (!workspace.pendingRequests.includes(userId)) {
      return res.status(400).json({ message: 'User not in pending requests' });
    }

    workspace.pendingRequests = workspace.pendingRequests.filter(
      (id) => id.toString() !== userId
    );
    workspace.members.push({ user: userId, role: 'member' });
    await workspace.save();

    // Add workspace to user
    await User.findByIdAndUpdate(userId, {
      $push: { workspaces: workspace._id },
    });

    // Add user to general channel
    const generalChannel = await Channel.findOne({
      workspaceId: workspace._id,
      name: 'general',
    });

    if (generalChannel) {
      if (!generalChannel.members.includes(userId)) {
        generalChannel.members.push(userId);
        await generalChannel.save();
      }
    }

    // Trigger notification
    await createNotification(req.app, {
      userId: userId,
      type: 'JOIN_REQUEST_APPROVED',
      title: 'Request Approved',
      message: `Your request to join ${workspace.name} has been approved!`,
      metadata: { workspaceId: workspace._id }
    });

    res.json({ message: 'Request approved successfully', workspace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject join request
// @route   POST /api/workspaces/:workspaceId/reject
// @access  Private (Owner only)
const rejectRequest = async (req, res) => {
  try {
    const { userId } = req.body;
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check permissions
    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role)) {
      return res.status(403).json({ message: 'Only workspace owners and admins can reject requests' });
    }

    workspace.pendingRequests = workspace.pendingRequests.filter(
      (id) => id.toString() !== userId
    );
    await workspace.save();

    // Trigger notification
    await createNotification(req.app, {
      userId: userId,
      type: 'JOIN_REQUEST_REJECTED',
      title: 'Request Declined',
      message: `Your request to join ${workspace.name} was declined.`,
      metadata: { workspaceId: workspace._id }
    });

    res.json({ message: 'Request rejected successfully', workspace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Accept invite
// @route   POST /api/workspaces/invite/accept
// @access  Private
const acceptInvite = async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Find invite for this user (by email or username)
    const user = await User.findById(req.user.id);
    const inviteIndex = workspace.invites.findIndex(
      (inv) => 
        (inv.email === user.email || inv.username === user.username) && 
        inv.status === 'pending'
    );

    if (inviteIndex === -1) {
      return res.status(400).json({ message: 'No pending invite found for you' });
    }

    // Update invite status
    workspace.invites[inviteIndex].status = 'accepted';
    
    // Move to pendingRequests (NOT auto-join as per requirement)
    if (!workspace.pendingRequests.includes(req.user.id)) {
      workspace.pendingRequests.push(req.user.id);
    }
    
    await workspace.save();

    res.json({ message: 'Invite accepted. Waiting for owner approval.', workspace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get workspace details
// @route   GET /api/workspaces/:id
// @access  Private
const getWorkspaceById = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId)
      .populate('members.user', 'username email fullName profilePicture title status customStatus')
      .populate('pendingRequests', 'username email')
      .populate('invites.invitedBy', 'username');

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Only return sensitive info if user is owner or member
    const userId = req.user._id.toString();
    const isOwner = workspace.createdBy.toString() === userId;
    const isMember = workspace.members.some(m => {
      const mUserId = m.user?._id ? m.user._id.toString() : m.user?.toString();
      return mUserId === userId;
    });

    const response = {
      ...workspace.toObject(),
      members: workspace.members.map(m => {
        if (!m.user) return null;
        const userObj = m.user.toObject ? m.user.toObject() : m.user;
        return {
          ...userObj,
          role: m.role,
          allowedChannels: m.allowedChannels
        };
      }).filter(Boolean),
      pendingRequests: isOwner ? workspace.pendingRequests : [],
      invites: isOwner || isMember ? workspace.invites : [],
    };

    res.json(response);
  } catch (error) {
    console.error('Error in getWorkspaceById:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user workspaces
// @route   GET /api/workspaces
// @access  Private
const getUserWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.user': req.user.id });
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all public workspaces (not joined)
// @route   GET /api/workspaces/all
// @access  Private
const getAllWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.user': { $ne: req.user.id } });
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get invites for current user
// @route   GET /api/workspaces/invites/me
// @access  Private
const getInvites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const workspaces = await Workspace.find({
      $or: [
        { 'invites.email': user.email, 'invites.status': 'pending' },
        { 'invites.username': user.username, 'invites.status': 'pending' }
      ]
    }).select('name invites');

    const invites = workspaces.map((ws) => {
      const invite = ws.invites.find(
        (inv) => (inv.email === user.email || inv.username === user.username) && inv.status === 'pending'
      );
      return {
        workspaceId: ws._id,
        workspaceName: ws.name,
        ...invite._doc,
      };
    });

    res.json(invites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Find workspaces by email
// @route   POST /api/workspaces/find
// @access  Private
const findWorkspacesByEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Please provide an email' });
    }

    // Find workspaces where user is member OR invited
    const workspaces = await Workspace.find({
      $or: [
        { 'invites.email': email },
        { 'members.user': req.user.id } // Also return workspaces they are already in
      ]
    }).select('name slug members invites');

    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Lookup workspace by slug (preview)
// @route   GET /api/workspaces/lookup/:slug
// @access  Private
const lookupWorkspaceBySlug = async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ slug: req.params.slug.toLowerCase() })
      .select('name slug members createdBy');

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Return limited info for preview
    const preview = {
      _id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      memberCount: workspace.members.length,
      isMember: workspace.members.some(m => m.user.toString() === req.user.id),
    };

    res.json(preview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search channels and users in workspace
// @route   GET /api/search
// @access  Private
const searchWorkspace = async (req, res) => {
  try {
    const { q, workspaceId } = req.query;

    if (!q || !workspaceId) {
      return res.status(400).json({ message: 'Query and workspaceId are required' });
    }

    // Verify user is member of workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.members.some(m => m.user.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to search in this workspace' });
    }

    // Search channels
    const channels = await Channel.find({
      workspaceId,
      name: { $regex: q, $options: 'i' }
    }).select('name isDirectMessage participants');

    // Search users in workspace
    const memberIds = workspace.members.map(m => m.user);
    const users = await User.find({
      _id: { $in: memberIds },
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { fullName: { $regex: q, $options: 'i' } }
      ]
    }).select('username email fullName profilePicture title status customStatus');

    res.json({ channels, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user role
// @route   PUT /api/workspaces/:workspaceId/members/:userId/role
// @access  Private (Owner only)
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['owner', 'admin', 'member', 'guest'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // Verify requester is owner
    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember || requesterMember.role !== 'owner') {
      return res.status(403).json({ message: 'Only workspace owners can change roles' });
    }

    const targetMember = workspace.members.find(m => m.user.toString() === req.params.userId);
    if (!targetMember) return res.status(404).json({ message: 'User is not a member' });

    // Prevent removing the last owner
    if (targetMember.role === 'owner' && role !== 'owner') {
      const ownerCount = workspace.members.filter(m => m.role === 'owner').length;
      if (ownerCount <= 1) return res.status(400).json({ message: 'Workspace must have at least one owner' });
    }

    targetMember.role = role;
    await workspace.save();

    res.json({ message: 'Role updated successfully', workspace });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove user from workspace
// @route   DELETE /api/workspaces/:workspaceId/members/:userId
// @access  Private (Owner/Admin only)
const removeUser = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember || !['owner', 'admin'].includes(requesterMember.role)) {
      return res.status(403).json({ message: 'Not authorized to remove members' });
    }

    const targetMember = workspace.members.find(m => m.user.toString() === req.params.userId);
    if (!targetMember) return res.status(404).json({ message: 'User is not a member' });

    // Admin cannot remove owner
    if (requesterMember.role === 'admin' && targetMember.role === 'owner') {
      return res.status(403).json({ message: 'Admins cannot remove owners' });
    }
    
    // Prevent removing the last owner
    if (targetMember.role === 'owner') {
      const ownerCount = workspace.members.filter(m => m.role === 'owner').length;
      if (ownerCount <= 1) return res.status(400).json({ message: 'Cannot remove the last owner' });
    }

    workspace.members = workspace.members.filter(m => m.user.toString() !== req.params.userId);
    await workspace.save();

    // Remove workspace from user's workspaces list
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { workspaces: workspace._id }
    });

    res.json({ message: 'User removed from workspace' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update workspace settings
// @route   PUT /api/workspaces/:workspaceId/settings
// @access  Private (Owner only)
const updateSettings = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember || requesterMember.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can update settings' });
    }

    if (req.body.settings) {
      workspace.settings = { ...workspace.settings, ...req.body.settings };
      await workspace.save();
    }

    res.json(workspace);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete workspace
// @route   DELETE /api/workspaces/:workspaceId
// @access  Private (Owner only)
const deleteWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const requesterMember = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requesterMember || requesterMember.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can delete the workspace' });
    }

    await Workspace.findByIdAndDelete(req.params.workspaceId);
    
    // Delete all channels in workspace
    await Channel.deleteMany({ workspaceId: req.params.workspaceId });
    
    // Remove workspace from all users
    await User.updateMany(
      { workspaces: req.params.workspaceId },
      { $pull: { workspaces: req.params.workspaceId } }
    );

    res.json({ message: 'Workspace deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createWorkspace,
  requestToJoinWorkspace,
  getUserWorkspaces,
  getAllWorkspaces,
  inviteUser,
  approveRequest,
  rejectRequest,
  acceptInvite,
  getWorkspaceById,
  getInvites,
  findWorkspacesByEmail,
  lookupWorkspaceBySlug,
  searchWorkspace,
  updateUserRole,
  removeUser,
  updateSettings,
  deleteWorkspace
};
