import express from 'express';
import {
  deleteAdminBook,
  getAdminStats,
  listAdminBooks,
  listAdminUsers,
  patchAdminUser,
} from '../controllers/adminController.js';
import { requireStaff } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/stats', requireStaff, getAdminStats);
router.get('/users', requireStaff, listAdminUsers);
router.patch('/users/:userId', requireStaff, patchAdminUser);
router.get('/books', requireStaff, listAdminBooks);
router.delete('/books/:bookId', requireStaff, deleteAdminBook);

export default router;
