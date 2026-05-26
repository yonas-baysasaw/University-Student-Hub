import express from 'express';
import {
  getUnreadCount,
  listNotificationFeed,
  markSeen,
} from '../controllers/notificationsController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(isAuthenticated);
router.get('/', listNotificationFeed);
router.get('/unread-count', getUnreadCount);
router.post('/mark-seen', markSeen);

export default router;
