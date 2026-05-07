import express from 'express';
import { ENV } from '../config/env.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import Settings from '../models/Settings.js';
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
    const settings = await Settings.findOne({ key: 'system' }).lean();
    if (settings?.value?.registrationEnabled === false) {
      return res.status(403).json({
        message: 'Registration is temporarily disabled by the administrator.',
      });
    }

    const { username, email, password, accountType, department, schoolYear } =
      req.body;

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
