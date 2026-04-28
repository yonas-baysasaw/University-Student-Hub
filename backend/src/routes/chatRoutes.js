import { Router } from 'express';
import {
  createChat,
  getChatMessages,
  getUserChats,
  joinChatByCode,
  patchChatSchedule,
  sendMessage,
} from '../controllers/chatController.js';
import {
  createAnnouncement,
  createResource,
  deleteAnnouncement,
  deleteResource,
  listAnnouncements,
  listResources,
} from '../controllers/classroomContentController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import { uploadClassroomResourceSingle } from '../middlewares/uploadMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.post('/', createChat);
router.post('/join', joinChatByCode);
router.get('/', getUserChats);

router.patch('/:chatId/schedule', patchChatSchedule);

router.get('/:chatId/announcements', listAnnouncements);
router.post('/:chatId/announcements', createAnnouncement);
router.delete('/:chatId/announcements/:announcementId', deleteAnnouncement);

router.get('/:chatId/resources', listResources);
router.post(
  '/:chatId/resources',
  uploadClassroomResourceSingle,
  createResource,
);
router.delete('/:chatId/resources/:resourceId', deleteResource);

router.route('/:chatId/messages').get(getChatMessages).post(sendMessage);

export default router;
