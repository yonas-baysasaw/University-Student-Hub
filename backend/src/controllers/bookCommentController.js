import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import BookComment from '../models/BookComment.js';
import {
  bookOwnerId,
  directAccessOutcome,
  sendBookAccessDenied,
} from '../utils/bookAccess.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

async function loadBookStub(req, bookId) {
  const book = await Book.findById(bookId).select('userId visibility').lean();
  return { book, access: directAccessOutcome(book, req) };
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

export const listBookComments = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ success: false, message: 'Invalid book id' });
  }

  const { book, access } = await loadBookStub(req, bookId);
  if (!access.ok) return sendBookAccessDenied(res, access);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  const docs = await BookComment.find({ bookId })
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

export const createBookComment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { bookId } = req.params;
  const { body, parentCommentId } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ success: false, message: 'Invalid book id' });
  }

  const { book, access } = await loadBookStub(req, bookId);
  if (!access.ok) return sendBookAccessDenied(res, access);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
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
    const parent = await BookComment.findOne({
      _id: parentCommentId,
      bookId,
    }).lean();
    if (!parent) {
      return res.status(400).json({ message: 'Parent comment not found.' });
    }
    if (parent.parentCommentId) {
      return res.status(400).json({ message: 'Only one level of replies is allowed.' });
    }
    parentId = parent._id;
  }

  const comment = await BookComment.create({
    bookId,
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

export const deleteBookComment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { bookId, commentId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(bookId) ||
    !mongoose.Types.ObjectId.isValid(commentId)
  ) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const { book, access } = await loadBookStub(req, bookId);
  if (!access.ok) return sendBookAccessDenied(res, access);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  const comment = await BookComment.findOne({ _id: commentId, bookId });
  if (!comment) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  const owner = bookOwnerId(book);
  const viewer = String(req.user._id);
  const isAuthor = String(comment.userId) === viewer;
  const isBookOwner = owner && owner === viewer;

  if (!isAuthor && !isBookOwner) {
    return res.status(403).json({ message: 'You cannot delete this comment.' });
  }

  await BookComment.deleteMany({
    $or: [{ _id: commentId }, { parentCommentId: commentId }],
  });

  res.status(200).json({ success: true, message: 'Comment removed.' });
});
