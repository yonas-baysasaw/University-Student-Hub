import express from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { ENV } from '../config/env.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { createLocalUser } from '../services/userService.js';
import { toPublicUser } from '../utils/userSerializer.js';

const router = express.Router();

const registerLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_REGISTER_MAX,
  keyFn: (req) => `register:${req.ip}`,
});

router.post(
  '/',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const {
      username,
      email,
      password,
      accountType,
      department,
      schoolYear,
    } = req.body;

    const user = await createLocalUser({
      username,
      email,
      password,
      accountType,
      department,
      schoolYear,
    });

    res.status(201).json({
      user: toPublicUser(user),
      message:
        'Account created. Check your email to verify your address before signing in.',
    });
  }),
);

export default router;
