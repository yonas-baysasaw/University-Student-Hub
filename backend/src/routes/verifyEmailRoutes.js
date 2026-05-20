import express from 'express';
import crypto from 'node:crypto';
import asyncHandler from '../middlewares/asyncHandler.js';
import User from '../models/User.js';
import { sendVerificationEmail } from '../services/verificationEmail.js';

const router = express.Router();

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token =
      typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const user = await User.findOneAndUpdate(
      {
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() },
      },
      {
        $set: { email_verified: true },
        $unset: {
          emailVerificationToken: 1,
          emailVerificationExpires: 1,
        },
      },
      { returnDocument: 'after' },
    );

    if (!user) {
      const staleUser = await User.findOne({
        emailVerificationToken: token,
      }).select('+emailVerificationToken +emailVerificationExpires');

      if (staleUser?.password && staleUser.email_verified === false) {
        const nextToken = crypto.randomBytes(20).toString('hex');
        staleUser.emailVerificationToken = nextToken;
        staleUser.emailVerificationExpires = Date.now() + 48 * 3600000;
        await staleUser.save();
        try {
          await sendVerificationEmail({
            to: staleUser.email,
            token: nextToken,
            verifyNext: staleUser.role === 'admin' ? '/admin' : undefined,
          });
        } catch (err) {
          console.error('[verify-email] resend failed', err);
        }

        return res.status(400).json({
          message:
            'This verification link expired. We sent a new verification email. Please check your inbox.',
        });
      }

      return res.status(400).json({
        message: 'Invalid or expired verification link. Request a new one from sign-in.',
      });
    }

    res.json({
      message: 'Email verified successfully. Please sign in to continue.',
    });
  }),
);

export default router;
