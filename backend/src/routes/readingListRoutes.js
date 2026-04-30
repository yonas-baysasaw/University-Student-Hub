import { Router } from 'express';
import {
  addBookToReadingList,
  createReadingList,
  deleteReadingList,
  getReadingList,
  listReadingLists,
  removeBookFromReadingList,
  updateReadingList,
} from '../controllers/readingListController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(isAuthenticated);

router.get('/', listReadingLists);
router.post('/', createReadingList);
router.get('/:listId', getReadingList);
router.patch('/:listId', updateReadingList);
router.delete('/:listId', deleteReadingList);
router.post('/:listId/books', addBookToReadingList);
router.delete('/:listId/books/:bookId', removeBookFromReadingList);

export default router;
