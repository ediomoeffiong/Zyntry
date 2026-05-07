const express = require('express');
const router = express.Router();
const { getUserProfile, updateProfile, updateStatus, updateCustomStatus, toggleBlockUser, updateNotificationSettings, deactivateAccount, requestAccountDeletion, restoreAccount } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateProfile);
router.put('/status', protect, updateStatus);
router.put('/custom-status', protect, updateCustomStatus);
router.put('/notification-settings', protect, updateNotificationSettings);
router.get('/:userId', protect, getUserProfile);
router.post('/block/:userId', protect, toggleBlockUser);

// Account Management
router.post('/deactivate', protect, deactivateAccount);
router.post('/delete-request', protect, requestAccountDeletion);
router.post('/restore', protect, restoreAccount);

module.exports = router;
