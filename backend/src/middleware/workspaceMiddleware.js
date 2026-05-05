const Workspace = require('../models/Workspace');

const verifyWorkspaceMembership = async (req, res, next) => {
  try {
    const workspaceId = 
      (req?.headers && req.headers['x-workspace-id']) || 
      (req?.query && req.query.workspaceId) || 
      (req?.body && req.body.workspaceId) ||
      (req?.params && req.params.workspaceId) ||
      (req?.params && req.params.id);

    console.log('Verifying membership for Workspace ID:', workspaceId);

    if (!workspaceId) {
      return res.status(400).json({ message: 'Workspace ID is required' });
    }
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      console.log('Workspace not found:', workspaceId);
      return res.status(404).json({ message: 'Workspace not found' });
    }

    // Check if user is a member
    if (!req.user || !req.user._id) {
      console.error('User not found in request object. Is protect middleware used?');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = req.user._id.toString();
    console.log('Checking member:', userId);

    const member = workspace.members.find(
      (m) => m.user && m.user.toString() === userId
    );

    if (!member) {
      console.log(`User ${userId} is not a member of workspace ${workspaceId}`);
      return res.status(403).json({ message: 'Not authorized to access this workspace' });
    }

    // Attach workspace and role info to request for convenience
    req.workspace = workspace;
    req.workspaceRole = member.role;
    req.allowedChannels = member.allowedChannels || [];
    console.log('Membership verified. Role:', member.role);
    next();
  } catch (error) {
    console.error('Workspace middleware error details:', error);
    res.status(500).json({ message: 'Server error during workspace verification', error: error.message });
  }
};

module.exports = { verifyWorkspaceMembership };
