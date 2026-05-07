export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: 'Unauthorized' });
};

export const requireStaff = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff access required' });
  }
  return next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (['staff', 'admin'].includes(req.user.role)) {
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
