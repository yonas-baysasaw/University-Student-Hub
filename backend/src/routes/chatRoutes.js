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
  reportChatMessage,
  sendMessage,
  toggleMessageReaction,
  uploadChatAttachment,
} from '../controllers/chatController.js';
import {
  createAnnouncement,
  createResource,
  deleteAnnouncement,
  deleteResource,
  listAnnouncements,
  listResources,
  patchAnnouncement,
} from '../controllers/classroomContentController.js';
import {
  createAssignment,
  deleteAssignment,
  getMySubmission,
  listAssignments,
  listSubmissionsForAssignment,
  patchAssignment,
  patchSubmissionGrade,
  upsertSubmission,
} from '../controllers/classroomAssignmentController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import {
  uploadAssignmentStarterSingle,
  uploadAssignmentSubmissionSingle,
  uploadChatAttachmentSingle,
  uploadClassroomResourceSingle,
} from '../middlewares/uploadMiddleware.js';

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
router.patch('/:chatId/announcements/:announcementId', patchAnnouncement);
router.delete('/:chatId/announcements/:announcementId', deleteAnnouncement);

router.get('/:chatId/resources', listResources);
router.post(
  '/:chatId/resources',
  uploadClassroomResourceSingle,
  createResource,
);
router.delete('/:chatId/resources/:resourceId', deleteResource);

router.get('/:chatId/assignments', listAssignments);
router.post(
  '/:chatId/assignments',
  uploadAssignmentStarterSingle,
  createAssignment,
);
router.patch('/:chatId/assignments/:assignmentId', patchAssignment);
router.delete('/:chatId/assignments/:assignmentId', deleteAssignment);
router.post(
  '/:chatId/assignments/:assignmentId/submissions',
  uploadAssignmentSubmissionSingle,
  upsertSubmission,
);
router.get(
  '/:chatId/assignments/:assignmentId/submissions/me',
  getMySubmission,
);
router.get(
  '/:chatId/assignments/:assignmentId/submissions',
  listSubmissionsForAssignment,
);
router.patch(
  '/:chatId/assignments/:assignmentId/submissions/:submissionId',
  patchSubmissionGrade,
);

router.post(
  '/:chatId/messages/upload',
  uploadChatAttachmentSingle,
  uploadChatAttachment,
);
router.post('/:chatId/messages/:messageId/reactions', toggleMessageReaction);
router.post('/:chatId/messages/:messageId/report', reportChatMessage);

router.patch('/:chatId/messages/:messageId', patchChatMessage);
router.delete('/:chatId/messages/:messageId', deleteChatMessage);
// POST alias: some proxies strip or mishandle DELETE; same handler as DELETE.
router.post('/:chatId/messages/:messageId/delete', deleteChatMessage);
router.route('/:chatId/messages').get(getChatMessages).post(sendMessage);

router.patch('/:chatId', patchChat);
router.delete('/:chatId', deleteChat);

export default router;
