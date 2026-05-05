const express = require('express');
const router = express.Router();
const {
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
  deleteWorkspace,
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');
const { verifyWorkspaceMembership } = require('../middleware/workspaceMiddleware');

router.route('/')
  .post(protect, createWorkspace)
  .get(protect, getUserWorkspaces);

router.post('/find', protect, findWorkspacesByEmail);
router.get('/lookup/:slug', protect, lookupWorkspaceBySlug);
router.get('/search', protect, searchWorkspace);
router.get('/invites/me', protect, getInvites);

// Workspace specific routes
router.route('/:workspaceId')
  .get(protect, verifyWorkspaceMembership, getWorkspaceById)
  .delete(protect, verifyWorkspaceMembership, deleteWorkspace);

router.put('/:workspaceId/settings', protect, verifyWorkspaceMembership, updateSettings);

router.post('/invite/accept', protect, acceptInvite);
router.post('/:workspaceId/request', protect, requestToJoinWorkspace);
router.post('/:workspaceId/invite', protect, verifyWorkspaceMembership, inviteUser);
router.post('/:workspaceId/approve', protect, verifyWorkspaceMembership, approveRequest);
router.post('/:workspaceId/reject', protect, verifyWorkspaceMembership, rejectRequest);

router.put('/:workspaceId/members/:userId/role', protect, verifyWorkspaceMembership, updateUserRole);
router.delete('/:workspaceId/members/:userId', protect, verifyWorkspaceMembership, removeUser);

module.exports = router;
