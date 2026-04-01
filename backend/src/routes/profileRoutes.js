import express from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';

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
router.put(
  '/',
  ensureAuth,
  asyncHandler(async (req, res) => {
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
  })
);

/* ===== Delete Account ===== */
router.delete(
  '/',
  ensureAuth,
  asyncHandler(async (req, res, next) => {
    await req.user.deleteOne();

    req.logout(err => {
      if (err) return next(err);
      res.json({ message: 'Account deleted' });
    });
  })
);

export default router;
