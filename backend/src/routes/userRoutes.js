const express = require('express');
const router = express.Router();
const { getUserProfile, updateProfile, updateStatus, updateCustomStatus, toggleBlockUser, updateNotificationSettings } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateProfile);
router.put('/status', protect, updateStatus);
router.put('/custom-status', protect, updateCustomStatus);
router.put('/notification-settings', protect, updateNotificationSettings);
router.get('/:userId', protect, getUserProfile);
router.post('/block/:userId', protect, toggleBlockUser);

module.exports = router;
