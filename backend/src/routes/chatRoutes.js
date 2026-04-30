import { Router } from 'express';
import {
  createChat,
  deleteChat,
  deleteChatMessage,
  getChatMessages,
  getUserChats,
  joinChatByCode,
  leaveChat,
  patchChat,
  patchChatMember,
  patchChatMessage,
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

router.patch('/:chatId/members/:userId', patchChatMember);

router.post('/:chatId/leave', leaveChat);

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

router.patch('/:chatId/messages/:messageId', patchChatMessage);
router.delete('/:chatId/messages/:messageId', deleteChatMessage);
// POST alias: some proxies strip or mishandle DELETE; same handler as DELETE.
router.post('/:chatId/messages/:messageId/delete', deleteChatMessage);
router.route('/:chatId/messages').get(getChatMessages).post(sendMessage);

router.patch('/:chatId', patchChat);
router.delete('/:chatId', deleteChat);

export default router;
