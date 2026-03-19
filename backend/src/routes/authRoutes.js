import express from 'express';
import passport from 'passport';
const router = express.Router();

// Local login
router.post('/login', passport.authenticate('local'), (req, res) => {
  res.json(req.user);
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/api/profile');
});

export default router