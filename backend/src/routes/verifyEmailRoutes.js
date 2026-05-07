import express from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import User from '../models/User.js';

const router = express.Router();

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token =
      typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification link. Request a new one from sign-in.',
      });
    }

    user.email_verified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified. You can sign in now.' });
  }),
);

export default router;
