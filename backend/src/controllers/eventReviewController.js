import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Event from '../models/Event.js';
import EventReview from '../models/EventReview.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

async function findEventForReader(req, eventId) {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return { event: null, ok: false };
  }
  const event = await Event.findById(eventId).select('userId').lean();
  return { event, ok: Boolean(event) };
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

export const listEventReviews = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  const { event, ok } = await findEventForReader(req, eventId);
  if (!ok || !event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const reviews = await EventReview.find({ eventId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'username name avatar')
    .lean();

  const viewerId = req.user?._id ? String(req.user._id) : null;
  const data = reviews.map((r) => {
    const u = r.userId && typeof r.userId === 'object' ? r.userId : null;
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
  });

  res.status(200).json({ success: true, count: data.length, reviews: data });
});

export const upsertEventReview = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const { body, rating } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  const { event, ok } = await findEventForReader(req, eventId);
  if (!ok || !event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
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

  let review = await EventReview.findOne({
    eventId,
    userId: req.user._id,
  });

  let created = false;
  if (review) {
    review.body = text;
    review.rating = stars;
    await review.save();
  } else {
    review = await EventReview.create({
      eventId,
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

export const deleteEventReview = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId, reviewId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(eventId) ||
    !mongoose.Types.ObjectId.isValid(reviewId)
  ) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const { event, ok } = await findEventForReader(req, eventId);
  if (!ok || !event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const review = await EventReview.findOne({ _id: reviewId, eventId });
  if (!review) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  if (String(review.userId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only delete your own review.' });
  }

  await review.deleteOne();
  res.status(200).json({ success: true, message: 'Review removed.' });
});
