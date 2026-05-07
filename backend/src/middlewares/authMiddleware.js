export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: 'Unauthorized' });
};

export const requireAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access required' });
  }
  return next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (req.user.role === 'admin') {
    return next();
  }
  const permissions = Array.isArray(req.user.permissions)
    ? req.user.permissions
    : [];
  if (permissions.includes(permission)) {
    return next();
  }
  return res.status(403).json({ message: 'Permission denied' });
};
