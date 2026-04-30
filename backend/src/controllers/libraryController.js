import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import {
  browseListFilter,
  directAccessOutcome,
  sendBookAccessDenied,
} from '../utils/bookAccess.js';
import { parsePublishYear, validateBookCatalogMeta } from '../utils/bookCatalogMeta.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

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
  const clauses = [browseListFilter(req)];

  const department = String(req.query.department || '').trim();
  if (department) {
    clauses.push({ department });
  }

  const yearRaw = req.query.year;
  if (yearRaw !== undefined && yearRaw !== null && String(yearRaw).trim() !== '') {
    const year = Number.parseInt(String(yearRaw).trim(), 10);
    if (Number.isFinite(year)) {
      clauses.push({ publishYear: year });
    }
  }

  const yFromRaw = req.query.yearFrom;
  const yToRaw = req.query.yearTo;
  if (
    (yFromRaw !== undefined &&
      yFromRaw !== null &&
      String(yFromRaw).trim() !== '') ||
    (yToRaw !== undefined && yToRaw !== null && String(yToRaw).trim() !== '')
  ) {
    const publishYear = {};
    if (yFromRaw !== undefined && yFromRaw !== null && String(yFromRaw).trim() !== '') {
      const yf = Number.parseInt(String(yFromRaw).trim(), 10);
      if (Number.isFinite(yf)) publishYear.$gte = yf;
    }
    if (yToRaw !== undefined && yToRaw !== null && String(yToRaw).trim() !== '') {
      const yt = Number.parseInt(String(yToRaw).trim(), 10);
      if (Number.isFinite(yt)) publishYear.$lte = yt;
    }
    if (Object.keys(publishYear).length > 0) {
      clauses.push({ publishYear });
    }
  }

  const fromIso = String(req.query.from || '').trim();
  const toIso = String(req.query.to || '').trim();
  if (fromIso || toIso) {
    const createdAt = {};
    if (fromIso) {
      const fromD = new Date(fromIso);
      if (!Number.isNaN(fromD.getTime())) createdAt.$gte = fromD;
    }
    if (toIso) {
      const toD = new Date(toIso);
      if (!Number.isNaN(toD.getTime())) createdAt.$lte = toD;
    }
    if (Object.keys(createdAt).length > 0) {
      clauses.push({ createdAt });
    }
  }

  const q = String(req.query.q || '').trim();
  if (q.length > 0) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(esc, 'i');
    clauses.push({
      $or: [
        { title: rx },
        { description: rx },
        { department: rx },
        { courseSubject: rx },
      ],
    });
  }

  const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

  const books = await Book.find(filter)
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

  const book = await Book.findById(bookId)
    .populate('userId', 'username name avatar subscribers')
    .lean();

  const access = directAccessOutcome(book, req);
  if (!access.ok) {
    return sendBookAccessDenied(res, access);
  }

  res.status(200).json({
    success: true,
    data: toBookResponse(book, req),
  });
});

export const createBook = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
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
  assertCanWrite(req.user);
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
    'academicTrack',
    'department',
    'publishYear',
    'courseSubject',
  ];

  const wantsCatalogTouch = [
    'academicTrack',
    'department',
    'publishYear',
    'courseSubject',
    'title',
    'description',
  ].some((f) => req.body[f] !== undefined);

  if (wantsCatalogTouch) {
    const nextTitle =
      req.body.title !== undefined
        ? String(req.body.title).trim()
        : book.title;
    const nextDesc =
      req.body.description !== undefined
        ? String(req.body.description)
        : book.description ?? '';
    const nextTrack =
      req.body.academicTrack !== undefined
        ? String(req.body.academicTrack).trim().toLowerCase()
        : book.academicTrack ?? '';
    const nextDept =
      req.body.department !== undefined
        ? String(req.body.department).trim()
        : book.department ?? '';
    let nextYear = book.publishYear;
    if (req.body.publishYear !== undefined) {
      nextYear = parsePublishYear(req.body.publishYear);
    }
    const nextCourse =
      req.body.courseSubject !== undefined
        ? String(req.body.courseSubject).trim()
        : book.courseSubject ?? '';

    const catalogError = validateBookCatalogMeta({
      academicTrack: nextTrack,
      department: nextDept,
      title: nextTitle,
      publishYear: nextYear,
      courseSubject: nextCourse,
    });
    if (catalogError) {
      return res.status(400).json({
        success: false,
        message: catalogError,
      });
    }
  }

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (field === 'publishYear') {
        book[field] = parsePublishYear(req.body[field]);
      } else if (field === 'academicTrack') {
        book[field] = String(req.body[field]).trim().toLowerCase();
      } else if (
        field === 'title' ||
        field === 'description' ||
        field === 'department' ||
        field === 'courseSubject'
      ) {
        book[field] = String(req.body[field]).trim();
      } else {
        book[field] = req.body[field];
      }
    }
  }

  await book.save();
  await book.populate('userId', 'username name avatar subscribers');

  res.status(200).json({
    success: true,
    data: toBookResponse(book.toObject(), req),
  });
});

export const deleteBook = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
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
  assertCanWrite(req.user);
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

  const book = await Book.findById(bookId);

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  const access = directAccessOutcome(book.toObject(), req);
  if (!access.ok) {
    return sendBookAccessDenied(res, access);
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
  assertCanWrite(req.user);
  const { bookId } = req.params;

  if (!ensureValidBookId(bookId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid book id',
    });
  }

  const book = await Book.findById(bookId);

  if (!book) {
    return res.status(404).json({
      success: false,
      message: 'Book not found',
    });
  }

  const access = directAccessOutcome(book.toObject(), req);
  if (!access.ok) {
    return sendBookAccessDenied(res, access);
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

  if (req.user?._id) {
    assertCanWrite(req.user);
  }

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

  const raw = await Book.findById(bookId).lean();
  const access = directAccessOutcome(raw, req);
  if (!access.ok) {
    return sendBookAccessDenied(res, access);
  }

  const book = await Book.findOneAndUpdate({ _id: bookId }, update, {
    new: true,
  }).lean();

  res.status(200).json({
    success: true,
    views: book?.views || 0,
  });
});
