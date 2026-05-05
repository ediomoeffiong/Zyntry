const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.workspaceRole) {
      return res.status(403).json({ message: 'Role information not found. Ensure workspace middleware runs first.' });
    }

    if (!allowedRoles.includes(req.workspaceRole)) {
      return res.status(403).json({ message: `Access denied. Requires one of: ${allowedRoles.join(', ')}` });
    }

    next();
  };
};

module.exports = { requireRole };
