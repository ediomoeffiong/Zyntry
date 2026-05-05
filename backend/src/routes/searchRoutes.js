const express = require('express');
const router = express.Router();
const { searchWorkspace } = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');
const { verifyWorkspaceMembership } = require('../middleware/workspaceMiddleware');

router.get('/', protect, verifyWorkspaceMembership, searchWorkspace);

module.exports = router;
