import express from 'express';
import {
  deleteAdminReport,
  listAdminReports,
  patchAdminReport,
} from '../controllers/adminReportController.js';
import {
  activateAdminUsers,
  assignDepartmentStudents,
  createDepartment,
  deleteAdminBook,
  deleteAdminEvent,
  deleteDepartment,
  getAdminStats,
  getAdminUser,
  getAnalytics,
  getSettings,
  listAdminBooks,
  listAdminUsers,
  listDepartments,
  listLogs,
  listNotifications,
  patchAdminBookVisibility,
  patchAdminEventVisibility,
  patchAdminUser,
  removeDepartmentStudent,
  sendAnnouncement,
  softDeleteAdminUser,
  suspendAdminUsers,
  updateDepartment,
  updateSettings,
} from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(requireAdmin);

router.get('/stats', getAdminStats);
router.get('/analytics', getAnalytics);

router.get('/users', listAdminUsers);
router.post('/users/suspend', suspendAdminUsers);
router.post('/users/activate', activateAdminUsers);
router.get('/users/:userId', getAdminUser);
router.put('/users/:userId', patchAdminUser);
router.patch('/users/:userId', patchAdminUser);
router.delete('/users/:userId', softDeleteAdminUser);

router.get('/departments', listDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:departmentId', updateDepartment);
router.delete('/departments/:departmentId', deleteDepartment);
router.post('/departments/:departmentId/students', assignDepartmentStudents);
router.delete(
  '/departments/:departmentId/students/:userId',
  removeDepartmentStudent,
);

router.get('/logs', listLogs);

router.get('/notifications', listNotifications);
router.post('/notifications/announcements', sendAnnouncement);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/reports', listAdminReports);
router.patch('/reports/:reportId', patchAdminReport);
router.delete('/reports/:reportId', deleteAdminReport);

router.get('/books', listAdminBooks);
router.delete('/books/:bookId', deleteAdminBook);
router.patch('/books/:bookId/visibility', patchAdminBookVisibility);

router.delete('/events/:eventId', deleteAdminEvent);
router.patch('/events/:eventId/visibility', patchAdminEventVisibility);

export default router;
