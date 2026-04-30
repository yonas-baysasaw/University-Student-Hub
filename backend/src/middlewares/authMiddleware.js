export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: 'Unauthorized' });
};

export const requireStaff = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (req.user.role !== 'staff') {
    return res.status(403).json({ message: 'Staff access required' });
  }
  return next();
};
