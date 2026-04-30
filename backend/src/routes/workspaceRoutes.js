const express = require('express');
const router = express.Router();
const {
  createWorkspace,
  joinWorkspace,
  getUserWorkspaces,
  getAllWorkspaces,
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, createWorkspace)
  .get(protect, getUserWorkspaces);

router.get('/all', protect, getAllWorkspaces);
router.post('/:workspaceId/join', protect, joinWorkspace);

module.exports = router;
