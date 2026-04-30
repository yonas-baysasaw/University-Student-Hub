import express from 'express';
import { listNotificationFeed } from '../controllers/notificationsController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(isAuthenticated);
router.get('/', listNotificationFeed);

export default router;
