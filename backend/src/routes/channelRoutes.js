const express = require('express');
const router = express.Router();
const { createChannel, joinChannel, getUserChannels, getOrCreateDM, getPublicChannels, leaveChannel, deleteChannel } = require('../controllers/channelController');
const { protect } = require('../middleware/authMiddleware');
const { verifyWorkspaceMembership } = require('../middleware/workspaceMiddleware');

router.use(protect); // Protect all routes in this file

router.route('/')
  .get(verifyWorkspaceMembership, getUserChannels)
  .post(verifyWorkspaceMembership, createChannel);

router.get('/public', verifyWorkspaceMembership, getPublicChannels);
router.post('/dm', verifyWorkspaceMembership, getOrCreateDM);
router.post('/:channelId/join', verifyWorkspaceMembership, joinChannel); 
router.post('/:channelId/leave', verifyWorkspaceMembership, leaveChannel);
router.delete('/:channelId', verifyWorkspaceMembership, deleteChannel);

module.exports = router;
