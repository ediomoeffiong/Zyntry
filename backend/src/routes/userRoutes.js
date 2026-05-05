const express = require('express');
const router = express.Router();
const { getUserProfile, updateProfile, updateStatus, updateCustomStatus } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateProfile);
router.put('/status', protect, updateStatus);
router.put('/custom-status', protect, updateCustomStatus);
router.get('/:userId', protect, getUserProfile);

module.exports = router;
