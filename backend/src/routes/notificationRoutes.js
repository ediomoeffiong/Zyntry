const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { verifyWorkspaceMembership } = require('../middleware/workspaceMiddleware');

router.use(protect);

router.get('/', verifyWorkspaceMembership, getNotifications);
router.put('/read-all', verifyWorkspaceMembership, markAllAsRead);
router.put('/:id/read', protect, markAsRead);

module.exports = router;
