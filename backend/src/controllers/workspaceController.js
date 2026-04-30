const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Channel = require('../models/Channel');

// @desc    Create new workspace
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Please add a workspace name' });
    }

    const workspace = await Workspace.create({
      name,
      createdBy: req.user.id,
      members: [req.user.id],
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
    if (workspace.members.includes(req.user.id)) {
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

    // Verify requester is owner
    if (workspace.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only workspace owner can invite users' });
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

    // Verify requester is owner
    if (workspace.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only workspace owner can approve requests' });
    }

    // Move from pending to members
    if (!workspace.pendingRequests.includes(userId)) {
      return res.status(400).json({ message: 'User not in pending requests' });
    }

    workspace.pendingRequests = workspace.pendingRequests.filter(
      (id) => id.toString() !== userId
    );
    workspace.members.push(userId);
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

    // Verify requester is owner
    if (workspace.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only workspace owner can reject requests' });
    }

    workspace.pendingRequests = workspace.pendingRequests.filter(
      (id) => id.toString() !== userId
    );
    await workspace.save();

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
    const workspace = await Workspace.findById(req.params.id)
      .populate('members', 'username email')
      .populate('pendingRequests', 'username email')
      .populate('invites.invitedBy', 'username');

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Only return sensitive info if user is owner or member
    const isOwner = workspace.createdBy.toString() === req.user.id;
    const isMember = workspace.members.some(m => m._id.toString() === req.user.id);

    const response = {
      ...workspace._doc,
      pendingRequests: isOwner ? workspace.pendingRequests : [],
      invites: isOwner || isMember ? workspace.invites : [],
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user workspaces
// @route   GET /api/workspaces
// @access  Private
const getUserWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({ members: req.user.id });
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
    const workspaces = await Workspace.find({ members: { $ne: req.user.id } });
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
};
