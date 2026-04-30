import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import BookReview from '../models/BookReview.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

function listFilterForRequest(req) {
  const canUsePrivateBooks = req.isAuthenticated?.();

  if (!canUsePrivateBooks) {
    return { visibility: 'public' };
  }

  return {
    $or: [{ visibility: 'public' }, { userId: req.user?._id }],
  };
}

function formatReviewDoc(doc, req) {
  const r = doc.toObject ? doc.toObject() : doc;
  const u = r.userId && typeof r.userId === 'object' ? r.userId : null;
  const viewerId = req.user?._id ? String(req.user._id) : null;
  const authorId = u?._id ? String(u._id) : String(r.userId || '');

  return {
    id: String(r._id),
    body: r.body,
    rating:
      r.rating != null && Number.isFinite(Number(r.rating))
        ? Number(r.rating)
        : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: {
      id: authorId || null,
      name: u?.name || u?.username || 'Reader',
      username: u?.username || '',
      avatar: u?.avatar || '',
    },
    viewerOwns: Boolean(viewerId && authorId && viewerId === authorId),
  };
}

export const listBookReviews = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ success: false, message: 'Invalid book id' });
  }

  const book = await Book.findOne({
    _id: bookId,
    ...listFilterForRequest(req),
  })
    .select('_id')
    .lean();

  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const reviews = await BookReview.find({ bookId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'username name avatar')
    .lean();

  const data = reviews.map((r) => {
    const u = r.userId && typeof r.userId === 'object' ? r.userId : null;
    const authorId = u?._id ? String(u._id) : String(r.userId || '');
    const viewerId = req.user?._id ? String(req.user._id) : null;
    return {
      id: String(r._id),
      body: r.body,
      rating:
        r.rating != null && Number.isFinite(Number(r.rating))
          ? Number(r.rating)
          : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        id: authorId || null,
        name: u?.name || u?.username || 'Reader',
        username: u?.username || '',
        avatar: u?.avatar || '',
      },
      viewerOwns: Boolean(viewerId && authorId && viewerId === authorId),
    };
  });

  res.status(200).json({ success: true, count: data.length, reviews: data });
});

export const upsertBookReview = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { bookId } = req.params;
  const { body, rating } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ success: false, message: 'Invalid book id' });
  }

  const book = await Book.findOne({
    _id: bookId,
    ...listFilterForRequest(req),
  })
    .select('_id')
    .lean();

  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) {
    return res.status(400).json({ message: 'Please write your review.' });
  }
  if (text.length > 4000) {
    return res
      .status(400)
      .json({ message: 'Review must be at most 4000 characters.' });
  }

  let stars = null;
  if (rating !== undefined && rating !== null && rating !== '') {
    const n = Number(rating);
    if (!Number.isFinite(n) || n < 1 || n > 5 || !Number.isInteger(n)) {
      return res
        .status(400)
        .json({ message: 'Rating must be a whole number from 1 to 5.' });
    }
    stars = n;
  }

  let review = await BookReview.findOne({
    bookId,
    userId: req.user._id,
  });

  let created = false;
  if (review) {
    review.body = text;
    review.rating = stars;
    await review.save();
  } else {
    review = await BookReview.create({
      bookId,
      userId: req.user._id,
      body: text,
      rating: stars,
    });
    created = true;
  }

  await review.populate('userId', 'username name avatar');
  const payload = formatReviewDoc(review, req);

  res.status(created ? 201 : 200).json({ success: true, review: payload });
});

export const deleteBookReview = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { bookId, reviewId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(bookId) ||
    !mongoose.Types.ObjectId.isValid(reviewId)
  ) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const book = await Book.findOne({
    _id: bookId,
    ...listFilterForRequest(req),
  })
    .select('_id')
    .lean();

  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  const review = await BookReview.findOne({ _id: reviewId, bookId });
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  if (String(review.userId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only delete your own review.' });
  }

  await review.deleteOne();
  res.status(200).json({ success: true, message: 'Review removed.' });
});
