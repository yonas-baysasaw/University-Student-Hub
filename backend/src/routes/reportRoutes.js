import express from 'express';
import { submitReport } from '../controllers/reportController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';

const router = express.Router();

const reportSubmitLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: (req) =>
    req.user?._id ? `reports:submit:${String(req.user._id)}` : 'reports:anon',
});

router.post('/', isAuthenticated, reportSubmitLimiter, submitReport);

export default router;
