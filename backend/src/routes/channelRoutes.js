const express = require('express');
const router = express.Router();
const { createChannel, joinChannel, getUserChannels } = require('../controllers/channelController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes in this file

router.route('/')
  .get(getUserChannels)
  .post(createChannel);

router.post('/:channelId/join', joinChannel);

module.exports = router;
