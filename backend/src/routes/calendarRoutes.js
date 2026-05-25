import express from 'express';
import { getCalendarFeedHandler } from '../controllers/calendarController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(isAuthenticated);

router.get('/feed', getCalendarFeedHandler);

export default router;
