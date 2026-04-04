import { Router } from 'express';
import { listOnlineUsers } from '../controllers/presenceController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.get('/online', listOnlineUsers);

export default router;
