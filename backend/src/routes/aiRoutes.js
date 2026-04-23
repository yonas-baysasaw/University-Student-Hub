import { Router } from 'express';
import { chatController } from '../controllers/aiController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.post('/chat', chatController);

export default router;
