import express from 'express';
import passport from 'passport';
import { loginSuccess, logout } from '../controllers/authcontroller.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => res.redirect('/profile')
);

router.get('/profile', isAuthenticated, loginSuccess);
router.get('/logout', logout);

export default router;