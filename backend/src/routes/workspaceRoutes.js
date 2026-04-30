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
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createWorkspace)
  .get(protect, getUserWorkspaces);

router.get('/all', protect, getAllWorkspaces);
router.get('/invites/me', protect, getInvites);
router.get('/:id', protect, getWorkspaceById);
router.post('/invite/accept', protect, acceptInvite);
router.post('/:workspaceId/request', protect, requestToJoinWorkspace);
router.post('/:workspaceId/invite', protect, inviteUser);
router.post('/:workspaceId/approve', protect, approveRequest);
router.post('/:workspaceId/reject', protect, rejectRequest);

module.exports = router;
