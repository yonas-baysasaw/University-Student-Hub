import express from 'express';
import passport from 'passport';
import { loginSuccess, logout } from '../controllers/authcontroller.js';

const router = express.Router();

const ensureIdentifier = (req, _res, next) => {
  if (!req.body.identifier) {
    if (req.body.email) {
      req.body.identifier = req.body.email;
    } else if (req.body.username) {
      req.body.identifier = req.body.username;
    }
  }
  next();
};

router.post(
  '/login',
  ensureIdentifier,
  passport.authenticate('local'),
  loginSuccess,
);

router.get('/logout', logout);

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (_req, res) => {
    res.redirect('/');
  },
);

export default router;
