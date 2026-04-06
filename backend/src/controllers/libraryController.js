import Book from '../models/Books.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import mongoose from 'mongoose';

const listFilterForRequest = req => {
  const canUsePrivateBooks = req.isAuthenticated && req.isAuthenticated();

  if (!canUsePrivateBooks) {
    return { visibility: 'public' };
  }

  return {
    $or: [
      { visibility: 'public' },
      { userId: req.user?._id },
    ],
  };
};

const ensureValidBookId = bookId => mongoose.Types.ObjectId.isValid(bookId);

export const getAllBooks = asyncHandler(async (req, res) => {
  const books = await Book.find(listFilterForRequest(req)).sort({ createdAt: -1 }).lean();

  res.status(200).json({
    success: true,
    count: books.length,
    data: books,
  });
});

export const getBookById = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  if (!ensureValidBookId(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book id',
    });
  }

  const book = await Book.findOne({
    _id: bookId,
    ...listFilterForRequest(req),
  }).lean();

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  res.status(200).json({
    success: true,
    data: book,
  });
});


export const updateBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  if (!ensureValidBookId(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book id',
    });
  }

  const book = await Book.findOne({ _id: bookId, userId: req.user._id });

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  const allowedFields = ['title', 'description', 'bookUrl', 'thumbnailUrl', 'format', 'visibility'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      book[field] = req.body[field];
    }
  }

  await book.save();

  res.status(200).json({
    success: true,
    data: book,
  });
});

export const deleteBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  if (!ensureValidBookId(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book id',
    });
  }

  const deleted = await Book.findOneAndDelete({ _id: bookId, userId: req.user._id });

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Book deleted',
  });
});
