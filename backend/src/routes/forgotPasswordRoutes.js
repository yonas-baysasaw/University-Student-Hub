import express from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import asyncHandler from '../middleware/asyncHandler.js';
import User from '../models/User.js';
import { ENV } from '../config/env.js';

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: ENV.EMAIL_USER, pass: ENV.EMAIL_PASS }
    });

    const resetURL = `${ENV.FRONTEND_URL}/reset-password/${token}`;

    await transporter.sendMail({
      to: user.email,
      from: ENV.EMAIL_USER,
      subject: 'Password Reset',
      text: `Click here to reset your password: ${resetURL}`
    });

    res.json({ message: 'Password reset email sent' });
  })
);

export default router;
