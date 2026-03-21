import express from 'express';
import bcrypt from 'bcrypt';
import asyncHandler from '../middleware/asyncHandler.js';
import User from '../models/User.js';

const router = express.Router();

router.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      const error = new Error('Invalid or expired token');
      error.status = 400;
      throw error;
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset' });
  })
);

export default router;
