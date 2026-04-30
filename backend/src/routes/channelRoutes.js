const express = require('express');
const router = express.Router();
const { createChannel, joinChannel, getUserChannels, getOrCreateDM, getPublicChannels, leaveChannel } = require('../controllers/channelController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes in this file

router.route('/')
  .get(getUserChannels)
  .post(createChannel);

router.get('/public', getPublicChannels);
router.post('/dm', getOrCreateDM);
router.post('/:channelId/join', joinChannel);
router.post('/:channelId/leave', leaveChannel);

module.exports = router;
