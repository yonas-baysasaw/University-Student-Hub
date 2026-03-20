import express from 'express';

const router = express.Router();

/* ===== Middleware: Ensure Authenticated ===== */
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

/* ===== Get Current User Profile ===== */
router.get('/', ensureAuth, (req, res) => {
  // req.user is populated by passport.deserializeUser
  const photo =
    req.user.profile?.photos?.[0]?.value ||
    req.user.profile?.picture ||
    null;

  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    displayName: req.user.displayName,
    provider: req.user.provider,
    photo
  });
});

/* ===== Update Profile ===== */
router.put('/', ensureAuth, async (req, res) => {
  try {
    const { username, displayName } = req.body;

    if (username !== undefined) req.user.username = username;
    if (displayName !== undefined) req.user.displayName = displayName;

    await req.user.save();

    res.json({
      message: 'Profile updated',
      user: {
        id: req.user._id,
        username: req.user.username,
        displayName: req.user.displayName
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
});

/* ===== Delete Account ===== */
router.delete('/', ensureAuth, async (req, res) => {
  try {
    await req.user.deleteOne();

    req.logout(err => {
      if (err) return res.status(500).json({ message: 'Logout failed' });
      res.json({ message: 'Account deleted' });
    });
  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
});

export default router;
