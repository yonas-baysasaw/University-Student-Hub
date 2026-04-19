import { Router } from 'express';
import {
  deleteBook,
  getAllBooks,
  getBookById,
  updateBook,
} from '../controllers/libraryController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', getAllBooks);
router.get('/:bookId', getBookById);

router.use(isAuthenticated);
router.patch('/:bookId', updateBook);
router.delete('/:bookId', deleteBook);

export default router;
