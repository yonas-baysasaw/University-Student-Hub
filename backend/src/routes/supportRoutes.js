import { Router } from 'express';
import { supportChatController } from '../controllers/supportController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();
router.use(isAuthenticated);
router.post('/chat', supportChatController);

export default router;
