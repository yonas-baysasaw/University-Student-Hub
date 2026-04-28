import asyncHandler from '../middlewares/asyncHandler.js';
import {
  getRagIndexStatus,
  scheduleRagIndexForBook,
} from '../services/bookRagService.js';

export const postIndexBookRag = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const out = await scheduleRagIndexForBook(bookId, req.user._id, req.user);
  if (out.error) {
    if (out.code === 'busy') {
      return res.status(409).json({
        message: out.error,
        ragIndexStatus: 'indexing',
        ...out.status,
      });
    }
    return res.status(400).json({ message: out.error });
  }
  return res.status(202).json({ started: true, bookId: out.bookId });
});

export const getBookRagStatus = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const out = await getRagIndexStatus(bookId, req.user._id);
  if (out.error) {
    return res.status(400).json({ message: out.error });
  }
  return res.json(out);
});
