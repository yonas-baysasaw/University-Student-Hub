import express from 'express';
import { getCalendarFeedHandler } from '../controllers/calendarController.js';
import {
  createPersonalEvent,
  deletePersonalEvent,
  getPersonalEvent,
  updatePersonalEvent,
} from '../controllers/personalCalendarController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(isAuthenticated);

router.get('/feed', getCalendarFeedHandler);

router.post('/personal', createPersonalEvent);
router.get('/personal/:eventId', getPersonalEvent);
router.patch('/personal/:eventId', updatePersonalEvent);
router.delete('/personal/:eventId', deletePersonalEvent);

export default router;
