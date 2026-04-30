import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import BookReview from '../models/BookReview.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

export const getAdminStats = asyncHandler(async (_req, res) => {
  const [users, books, chats, messages] = await Promise.all([
    User.countDocuments(),
    Book.countDocuments(),
    Chat.countDocuments(),
    Message.countDocuments(),
  ]);

  res.json({ users, books, chats, messages });
});

export const listAdminUsers = asyncHandler(async (req, res) => {
  const pageRaw = parseInt(String(req.query.page || '1'), 10);
  const limitRaw = parseInt(String(req.query.limit || '20'), 10);
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20),
  );
  const skip = (page - 1) * limit;

  const accountTypeRaw = req.query.accountType;
  const filter = { role: { $ne: 'staff' } };
  if (accountTypeRaw === 'student') {
    filter.$or = [
      { accountType: 'student' },
      { accountType: { $exists: false } },
    ];
  } else if (accountTypeRaw === 'instructor') {
    filter.accountType = 'instructor';
  }

  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        'email username name displayName provider createdAt role email_verified accountType platformReadOnly instructorPostingSuspended',
      )
      .lean(),
  ]);

  const users = docs.map((u) => ({
    id: String(u._id),
    email: u.email,
    username: u.username ?? '',
    name: u.name ?? '',
    displayName: u.displayName ?? '',
    provider: u.provider,
    createdAt: u.createdAt,
    role: u.role ?? 'user',
    email_verified: u.email_verified ?? false,
    accountType: u.accountType === 'instructor' ? 'instructor' : 'student',
    platformReadOnly: !!u.platformReadOnly,
    instructorPostingSuspended: !!u.instructorPostingSuspended,
  }));

  res.json({
    users,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const patchAdminUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const target = await User.findById(userId);
  if (!target) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (target.role === 'staff') {
    return res.status(403).json({ message: 'Cannot modify staff users here' });
  }

  const body = req.body ?? {};
  let changed = false;

  if (body.accountType !== undefined) {
    if (!['student', 'instructor'].includes(body.accountType)) {
      return res.status(400).json({ message: 'Invalid accountType' });
    }
    target.accountType = body.accountType;
    if (body.accountType === 'student') {
      target.instructorPostingSuspended = false;
    }
    changed = true;
  }

  if (body.platformReadOnly !== undefined) {
    if (typeof body.platformReadOnly !== 'boolean') {
      return res.status(400).json({ message: 'platformReadOnly must be boolean' });
    }
    target.platformReadOnly = body.platformReadOnly;
    changed = true;
  }

  if (body.instructorPostingSuspended !== undefined) {
    if (typeof body.instructorPostingSuspended !== 'boolean') {
      return res
        .status(400)
        .json({ message: 'instructorPostingSuspended must be boolean' });
    }
    target.instructorPostingSuspended = body.instructorPostingSuspended;
    changed = true;
  }

  if (!changed) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  await target.save();

  res.json({
    user: {
      id: String(target._id),
      email: target.email,
      username: target.username ?? '',
      name: target.name ?? '',
      displayName: target.displayName ?? '',
      accountType:
        target.accountType === 'instructor' ? 'instructor' : 'student',
      platformReadOnly: !!target.platformReadOnly,
      instructorPostingSuspended: !!target.instructorPostingSuspended,
    },
  });
});

export const listAdminBooks = asyncHandler(async (req, res) => {
  const pageRaw = parseInt(String(req.query.page || '1'), 10);
  const limitRaw = parseInt(String(req.query.limit || '20'), 10);
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20),
  );
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Book.countDocuments({}),
    Book.find({})
      .sort({ dislikesCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username name email avatar')
      .lean(),
  ]);

  const books = docs.map((b) => {
    const uploader = b.userId && typeof b.userId === 'object' ? b.userId : null;
    return {
      id: String(b._id),
      title: b.title,
      visibility: b.visibility,
      likesCount: b.likesCount ?? 0,
      dislikesCount: b.dislikesCount ?? 0,
      createdAt: b.createdAt,
      uploader: uploader
        ? {
            id: String(uploader._id),
            name: uploader.name || uploader.username || '',
            email: uploader.email || '',
            username: uploader.username || '',
          }
        : null,
    };
  });

  res.json({
    books,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const deleteAdminBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return res.status(400).json({ message: 'Invalid book id' });
  }

  const deleted = await Book.findById(bookId);
  if (!deleted) {
    return res.status(404).json({ message: 'Book not found' });
  }

  await BookReview.deleteMany({ bookId: deleted._id });
  await Book.findByIdAndDelete(bookId);

  res.json({ success: true, message: 'Book deleted' });
});
