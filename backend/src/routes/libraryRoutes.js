import { Router } from 'express';
import {
  getBookRagStatus,
  postIndexBookRag,
} from '../controllers/bookRagController.js';
import {
  createBook,
  deleteBook,
  getAllBooks,
  getBookById,
  incrementBookDownload,
  reactToBook,
  toggleSaveBook,
  updateBook,
} from '../controllers/libraryController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', getAllBooks);
router.get('/:bookId/rag/status', isAuthenticated, getBookRagStatus);
router.post('/:bookId/rag/index', isAuthenticated, postIndexBookRag);
router.get('/:bookId', getBookById);
router.post('/:bookId/download', incrementBookDownload);

router.use(isAuthenticated);
router.post('/:bookId/react', reactToBook);
router.post('/:bookId/save', toggleSaveBook);
router.post('/', createBook);
router.patch('/:bookId', updateBook);
router.delete('/:bookId', deleteBook);

export default router;
