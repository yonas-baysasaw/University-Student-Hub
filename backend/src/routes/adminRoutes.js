import express from 'express';
import {
  activateAdminUsers,
  assignDepartmentStudents,
  createDepartment,
  deleteAdminBook,
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
  patchAdminUser,
  removeDepartmentStudent,
  sendAnnouncement,
  softDeleteAdminUser,
  suspendAdminUsers,
  updateDepartment,
  updateSettings,
} from '../controllers/adminController.js';
import { requireStaff } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(requireStaff);

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

router.get('/books', listAdminBooks);
router.delete('/books/:bookId', deleteAdminBook);

export default router;
