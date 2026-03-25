import { Router } from 'express';
import {
  createChat,
  joinChatByCode,
  getUserChats,
  getChatMessages,
} from '../controllers/chatController.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.post('/', createChat);
router.post('/join', joinChatByCode);
router.get('/', getUserChats);
router.get('/:chatId/messages', getChatMessages);

export default router;
