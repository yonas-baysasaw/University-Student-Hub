export const loginSuccess = (req, res) => {
  res.json({ user: req.user });
};

export const logout = (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
};