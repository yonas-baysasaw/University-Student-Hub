import { Router } from 'express';
import {
  deleteBookReview,
  listBookReviews,
  upsertBookReview,
} from '../controllers/bookReviewController.js';
import {
  createBookComment,
  deleteBookComment,
  listBookComments,
} from '../controllers/bookCommentController.js';
import { getBookRagStatus, postIndexBookRag } from '../controllers/bookRagController.js';
import {
  createBook,
  deleteBook,
  getAllBooks,
  getBookById,
  getBookFile,
  incrementBookDownload,
  reactToBook,
  reindexMyBooks,
  searchBooksByChunkContent,
  searchBookChunks,
  toggleSaveBook,
  updateBook,
} from '../controllers/libraryController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', getAllBooks);
router.get('/search/chunks', searchBookChunks);
router.post('/search/books', searchBooksByChunkContent);
router.post('/rag/reindex-mine', isAuthenticated, reindexMyBooks);
router.get('/:bookId/rag/status', isAuthenticated, getBookRagStatus);
router.post('/:bookId/rag/index', isAuthenticated, postIndexBookRag);
router.get('/:bookId/file', getBookFile);
router.get('/:bookId/reviews', listBookReviews);
router.get('/:bookId/comments', listBookComments);
router.get('/:bookId', getBookById);
router.post('/:bookId/download', incrementBookDownload);

router.use(isAuthenticated);
router.post('/:bookId/reviews', upsertBookReview);
router.delete('/:bookId/reviews/:reviewId', deleteBookReview);
router.post('/:bookId/comments', createBookComment);
router.delete('/:bookId/comments/:commentId', deleteBookComment);
router.post('/:bookId/react', reactToBook);
router.post('/:bookId/save', toggleSaveBook);
router.post('/', createBook);
router.patch('/:bookId', updateBook);
router.delete('/:bookId', deleteBook);

export default router;
