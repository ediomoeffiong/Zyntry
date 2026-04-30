const express = require('express');
const router = express.Router();
const { getUserProfile, updateProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.put('/profile', protect, updateProfile);
router.get('/:userId', protect, getUserProfile);

module.exports = router;
