const express = require('express');
const router = express.Router();
const { 
  createChannel, 
  joinChannel, 
  getUserChannels, 
  getOrCreateDM, 
  getPublicChannels, 
  leaveChannel, 
  deleteChannel,
  getChannelRequests,
  handleChannelRequest,
  removeMember,
  setMemberExpiry,
  toggleModerator
} = require('../controllers/channelController');
const { protect } = require('../middleware/authMiddleware');
const { verifyWorkspaceMembership } = require('../middleware/workspaceMiddleware');

router.use(protect); // Protect all routes in this file

router.route('/')
  .get(verifyWorkspaceMembership, getUserChannels)
  .post(verifyWorkspaceMembership, createChannel);

router.get('/public', verifyWorkspaceMembership, getPublicChannels);
router.post('/dm', verifyWorkspaceMembership, getOrCreateDM);

router.get('/requests', verifyWorkspaceMembership, getChannelRequests);
router.post('/requests/:requestId', verifyWorkspaceMembership, handleChannelRequest);

router.post('/:channelId/join', verifyWorkspaceMembership, joinChannel); 
router.post('/:channelId/leave', verifyWorkspaceMembership, leaveChannel);
router.delete('/:channelId', verifyWorkspaceMembership, deleteChannel);

router.delete('/:channelId/members/:userId', verifyWorkspaceMembership, removeMember);
router.patch('/:channelId/members/:userId/expiry', verifyWorkspaceMembership, setMemberExpiry);
router.patch('/:channelId/moderators', verifyWorkspaceMembership, toggleModerator);

module.exports = router;
