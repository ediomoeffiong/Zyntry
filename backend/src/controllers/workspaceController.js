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

// @desc    Join a workspace
// @route   POST /api/workspaces/:workspaceId/join
// @access  Private
const joinWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is already a member
    if (workspace.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already a member of this workspace' });
    }

    // Add user to workspace members
    workspace.members.push(req.user.id);
    await workspace.save();

    // Add workspace to user's workspaces
    await User.findByIdAndUpdate(req.user.id, {
      $push: { workspaces: workspace._id },
    });

    res.json({ message: 'Joined workspace successfully', workspace });
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

module.exports = {
  createWorkspace,
  joinWorkspace,
  getUserWorkspaces,
  getAllWorkspaces,
};
