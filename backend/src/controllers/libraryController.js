import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';

const listFilterForRequest = (req) => {
  const canUsePrivateBooks = req.isAuthenticated?.();

  if (!canUsePrivateBooks) {
    return { visibility: 'public' };
  }

  return {
    $or: [{ visibility: 'public' }, { userId: req.user?._id }],
  };
};

const ensureValidBookId = (bookId) => mongoose.Types.ObjectId.isValid(bookId);

const toBookResponse = (book, req) => {
  const viewerId = req.user?._id ? String(req.user._id) : null;
  const likedBy = Array.isArray(book.likedBy) ? book.likedBy : [];
  const dislikedBy = Array.isArray(book.dislikedBy) ? book.dislikedBy : [];
  const savedBy = Array.isArray(book.savedBy) ? book.savedBy : [];

  const rest = { ...book };
  delete rest.likedBy;
  delete rest.dislikedBy;
  delete rest.savedBy;

  const uploaderSource =
    book?.userId && typeof book.userId === 'object' ? book.userId : null;
  const uploader = uploaderSource
    ? {
        id: uploaderSource._id ? String(uploaderSource._id) : null,
        name: uploaderSource.name || uploaderSource.username || 'Unknown user',
        username: uploaderSource.username || '',
        avatar: uploaderSource.avatar || '',
        subscribersCount: Array.isArray(uploaderSource.subscribers)
          ? uploaderSource.subscribers.length
          : 0,
        viewerSubscribed:
          viewerId && Array.isArray(uploaderSource.subscribers)
            ? uploaderSource.subscribers.some((id) => String(id) === viewerId)
            : false,
      }
    : null;

  return {
    ...rest,
    uploader,
    likesCount: Number.isFinite(book.likesCount)
      ? book.likesCount
      : likedBy.length,
    dislikesCount: Number.isFinite(book.dislikesCount)
      ? book.dislikesCount
      : dislikedBy.length,
    viewerState: {
      liked: viewerId ? likedBy.some((id) => String(id) === viewerId) : false,
      disliked: viewerId
        ? dislikedBy.some((id) => String(id) === viewerId)
        : false,
      saved: viewerId ? savedBy.some((id) => String(id) === viewerId) : false,
    },
  };
};

export const getAllBooks = asyncHandler(async (req, res) => {
  const books = await Book.find(listFilterForRequest(req))
    .sort({ createdAt: -1 })
    .populate('userId', 'username name avatar subscribers')
    .lean();
  const data = books.map((book) => toBookResponse(book, req));

  res.status(200).json({
    success: true,
    count: data.length,
    data,
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
  })
    .populate('userId', 'username name avatar subscribers')
    .lean();

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  res.status(200).json({
    success: true,
    data: toBookResponse(book, req),
  });
});

export const createBook = asyncHandler(async (req, res) => {
  const { title, description, bookUrl, thumbnailUrl, format, visibility } =
    req.body ?? {};

  if (!title?.trim() || !bookUrl?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'title and bookUrl are required',
    });
  }

  const book = await Book.create({
    userId: req.user._id,
    title: title.trim(),
    description: typeof description === 'string' ? description : '',
    bookUrl: bookUrl.trim(),
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : '',
    format: typeof format === 'string' ? format : '',
    visibility: typeof visibility === 'string' ? visibility : 'public',
  });

  res.status(201).json({
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

  const allowedFields = [
    'title',
    'description',
    'bookUrl',
    'thumbnailUrl',
    'format',
    'visibility',
  ];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      book[field] = req.body[field];
    }
  }

  await book.save();
  await book.populate('userId', 'username name avatar subscribers');

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

  const deleted = await Book.findOneAndDelete({
    _id: bookId,
    userId: req.user._id,
  });

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

export const reactToBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { reaction } = req.body ?? {};

  if (!ensureValidBookId(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book id',
    });
  }

  if (!['like', 'dislike', null, 'none'].includes(reaction)) {
    return res.status(400).json({
      success: false,
      message: 'reaction must be like, dislike, or none',
    });
  }

  const book = await Book.findOne({
    _id: bookId,
    ...listFilterForRequest(req),
  });

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  const userId = String(req.user._id);
  book.likedBy = (book.likedBy || []).filter((id) => String(id) !== userId);
  book.dislikedBy = (book.dislikedBy || []).filter(
    (id) => String(id) !== userId,
  );

  if (reaction === 'like') {
    book.likedBy.push(req.user._id);
  } else if (reaction === 'dislike') {
    book.dislikedBy.push(req.user._id);
  }

  book.likesCount = book.likedBy.length;
  book.dislikesCount = book.dislikedBy.length;
  await book.save();
  await book.populate('userId', 'username name avatar subscribers');

  res.status(200).json({
    success: true,
    data: toBookResponse(book.toObject(), req),
  });
});

export const toggleSaveBook = asyncHandler(async (req, res) => {
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
  });

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  const userId = String(req.user._id);
  const savedBy = Array.isArray(book.savedBy) ? book.savedBy : [];
  const hasSaved = savedBy.some((id) => String(id) === userId);

  if (hasSaved) {
    book.savedBy = savedBy.filter((id) => String(id) !== userId);
  } else {
    book.savedBy = [...savedBy, req.user._id];
  }

  await book.save();
  await book.populate('userId', 'username name avatar subscribers');

  res.status(200).json({
    success: true,
    saved: !hasSaved,
    data: toBookResponse(book.toObject(), req),
  });
});

export const incrementBookDownload = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  if (!ensureValidBookId(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book id',
    });
  }

  const update = { $inc: { views: 1 } };
  if (req.user?._id) {
    update.$addToSet = { viewedBy: req.user._id };
  }

  const book = await Book.findOneAndUpdate(
    {
      _id: bookId,
      ...listFilterForRequest(req),
    },
    update,
    { new: true },
  ).lean();

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  res.status(200).json({
    success: true,
    views: book.views || 0,
  });
});
