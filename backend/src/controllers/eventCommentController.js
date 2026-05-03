import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Event from '../models/Event.js';
import EventComment from '../models/EventComment.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

async function loadEventStub(eventId) {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return null;
  }
  return Event.findById(eventId).select('userId').lean();
}

function formatComment(doc, viewerId) {
  const c = doc.toObject ? doc.toObject() : doc;
  const u = c.userId && typeof c.userId === 'object' ? c.userId : null;
  const authorId = u?._id ? String(u._id) : String(c.userId || '');
  return {
    id: String(c._id),
    body: c.body,
    parentCommentId: c.parentCommentId ? String(c.parentCommentId) : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: {
      id: authorId || null,
      name: u?.name || u?.username || 'Reader',
      username: u?.username || '',
      avatar: u?.avatar || '',
    },
    viewerOwns: Boolean(viewerId && authorId && viewerId === authorId),
  };
}

export const listEventComments = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  const event = await loadEventStub(eventId);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const docs = await EventComment.find({ eventId })
    .sort({ createdAt: 1 })
    .populate('userId', 'username name avatar')
    .lean();

  const viewerId = req.user?._id ? String(req.user._id) : null;
  const formatted = docs.map((c) => {
    const u = c.userId && typeof c.userId === 'object' ? c.userId : null;
    const authorId = u?._id ? String(u._id) : String(c.userId || '');
    return {
      id: String(c._id),
      body: c.body,
      parentCommentId: c.parentCommentId ? String(c.parentCommentId) : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: authorId || null,
        name: u?.name || u?.username || 'Reader',
        username: u?.username || '',
        avatar: u?.avatar || '',
      },
      viewerOwns: Boolean(viewerId && authorId && viewerId === authorId),
    };
  });

  res.status(200).json({ success: true, comments: formatted });
});

export const createEventComment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const { body, parentCommentId } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  const event = await loadEventStub(eventId);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) {
    return res.status(400).json({ message: 'Write a comment before posting.' });
  }
  if (text.length > 2000) {
    return res.status(400).json({ message: 'Comment must be at most 2000 characters.' });
  }

  let parentId = null;
  if (parentCommentId != null && String(parentCommentId).trim() !== '') {
    if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({ message: 'Invalid parent comment.' });
    }
    const parent = await EventComment.findOne({
      _id: parentCommentId,
      eventId,
    }).lean();
    if (!parent) {
      return res.status(400).json({ message: 'Parent comment not found.' });
    }
    if (parent.parentCommentId) {
      return res
        .status(400)
        .json({ message: 'Only one level of replies is allowed.' });
    }
    parentId = parent._id;
  }

  const comment = await EventComment.create({
    eventId,
    userId: req.user._id,
    body: text,
    parentCommentId: parentId,
  });
  await comment.populate('userId', 'username name avatar');
  const viewerId = String(req.user._id);
  res.status(201).json({
    success: true,
    comment: formatComment(comment, viewerId),
  });
});

export const deleteEventComment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId, commentId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(eventId) ||
    !mongoose.Types.ObjectId.isValid(commentId)
  ) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const event = await loadEventStub(eventId);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const comment = await EventComment.findOne({ _id: commentId, eventId });
  if (!comment) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  const organizerId = event.userId ? String(event.userId) : '';
  const viewer = String(req.user._id);
  const isAuthor = String(comment.userId) === viewer;
  const isOrganizer = organizerId && organizerId === viewer;

  if (!isAuthor && !isOrganizer) {
    return res.status(403).json({ message: 'You cannot delete this comment.' });
  }

  await EventComment.deleteMany({
    $or: [{ _id: commentId }, { parentCommentId: commentId }],
  });

  res.status(200).json({ success: true, message: 'Comment removed.' });
});
