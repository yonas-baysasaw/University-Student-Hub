import { Router } from 'express';
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  reactToBook,
  toggleSaveBook,
  incrementBookDownload,
} from '../controllers/libraryController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', getAllBooks);
router.get('/:bookId', getBookById);
router.post('/:bookId/download', incrementBookDownload);

router.use(isAuthenticated);
router.post('/:bookId/react', reactToBook);
router.post('/:bookId/save', toggleSaveBook);
router.post('/', createBook);
router.patch('/:bookId', updateBook);
router.delete('/:bookId', deleteBook);

export default router;
