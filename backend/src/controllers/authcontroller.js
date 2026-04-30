import { serializeCurrentUser } from '../utils/userSerializer.js';

export const loginSuccess = (req, res) => {
  res.json({ user: serializeCurrentUser(req.user) });
};

export const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
};
