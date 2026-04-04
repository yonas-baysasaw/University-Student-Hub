import { Router } from 'express';
import {
  createChat,
  joinChatByCode,
  getUserChats,
  getChatMessages,
  sendMessage,
} from '../controllers/chatController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.post('/', createChat);
router.post('/join', joinChatByCode);
router.get('/', getUserChats);
router.route('/:chatId/messages').get(getChatMessages).post(sendMessage);

export default router;
