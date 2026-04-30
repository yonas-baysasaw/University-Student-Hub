import bcrypt from 'bcrypt';
import express from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { serializeCurrentUser } from '../utils/userSerializer.js';
import { blockReadOnlyUser } from '../utils/userWriteAccess.js';

const router = express.Router();

/* ===== Middleware: Ensure Authenticated ===== */
function ensureAuth(req, res, next) {
  if (req.isAuthenticated?.()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

router.get(
  '/public/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid user id' });
    }

    const user = await User.findById(userId)
      .select('username name avatar createdAt subscribers')
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const viewerId = req.user?._id ? String(req.user._id) : null;
    const subscribers = Array.isArray(user.subscribers) ? user.subscribers : [];
    const viewerSubscribed = viewerId
      ? subscribers.some((id) => String(id) === viewerId)
      : false;

    const sharedBooks = await Book.find({
      userId,
      visibility: { $in: ['public', 'unlisted'] },
    })
      .sort({ createdAt: -1 })
      .select(
        'title description bookUrl thumbnailUrl format visibility createdAt updatedAt likesCount dislikesCount views academicTrack department publishYear courseSubject',
      )
      .lean();

    return res.status(200).json({
      success: true,
      profile: {
        id: String(user._id),
        name: user.name || user.username || 'User',
        username: user.username || '',
        avatar: user.avatar || '',
        joinedAt: user.createdAt || null,
        subscribersCount: subscribers.length,
      },
      stats: {
        sharedBooks: sharedBooks.length,
      },
      viewerState: {
        subscribed: viewerSubscribed,
      },
      sharedBooks,
    });
  }),
);

router.post(
  '/public/:userId/subscribe',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid user id' });
    }

    const currentUserId = String(req.user._id);
    if (currentUserId === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot subscribe to your own profile',
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: 'Current user not found' });
    }

    const subscriptions = Array.isArray(currentUser.subscriptions)
      ? currentUser.subscriptions
      : [];
    const subscribers = Array.isArray(targetUser.subscribers)
      ? targetUser.subscribers
      : [];

    const isSubscribed = subscriptions.some((id) => String(id) === userId);

    if (isSubscribed) {
      currentUser.subscriptions = subscriptions.filter(
        (id) => String(id) !== userId,
      );
      targetUser.subscribers = subscribers.filter(
        (id) => String(id) !== currentUserId,
      );
    } else {
      currentUser.subscriptions = [...subscriptions, targetUser._id];
      targetUser.subscribers = [...subscribers, currentUser._id];
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    return res.status(200).json({
      success: true,
      subscribed: !isSubscribed,
      profile: {
        id: String(targetUser._id),
        subscribersCount: Array.isArray(targetUser.subscribers)
          ? targetUser.subscribers.length
          : 0,
      },
    });
  }),
);

/* ===== Get Current User Profile ===== */
router.get('/', ensureAuth, (req, res) => {
  res.json(serializeCurrentUser(req.user));
});

/* ===== Get Current User Activity ===== */
router.get(
  '/activity',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const currentUser = await User.findById(req.user._id)
      .select('subscriptions')
      .lean();
    const subscribedIds = Array.isArray(currentUser?.subscriptions)
      ? currentUser.subscriptions
      : [];

    const [
      books,
      sharedBooks,
      chats,
      messages,
      totalBooks,
      totalChatsCreated,
      totalMessages,
      viewedBooks,
      likedBooks,
      subscribedChannels,
    ] = await Promise.all([
      Book.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title format visibility createdAt updatedAt')
        .lean(),
      Book.find({
        userId: req.user._id,
        visibility: { $in: ['public', 'unlisted'] },
      })
        .sort({ createdAt: -1 })
        .select(
          'title description bookUrl thumbnailUrl format visibility createdAt updatedAt academicTrack department publishYear courseSubject',
        )
        .lean(),
      Chat.find({ creator: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('name members createdAt updatedAt')
        .lean(),
      Message.find({ sender: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('chat content messageType createdAt')
        .populate('chat', 'name')
        .lean(),
      Book.countDocuments({ userId: req.user._id }),
      Chat.countDocuments({ creator: req.user._id }),
      Message.countDocuments({ sender: req.user._id }),
      Book.find({ viewedBy: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select(
          'title description thumbnailUrl format visibility createdAt updatedAt',
        )
        .lean(),
      Book.find({ likedBy: req.user._id })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select(
          'title description thumbnailUrl format visibility createdAt updatedAt',
        )
        .lean(),
      User.find({ _id: { $in: subscribedIds } })
        .select('username name avatar')
        .lean(),
    ]);

    const bookActivity = books.map((book) => ({
      id: `book-${book._id}`,
      type: 'book_upload',
      title: `Uploaded "${book.title}"`,
      subtitle: `${book.format || 'unknown format'} • ${book.visibility}`,
      at: book.createdAt,
    }));

    const chatActivity = chats.map((chat) => ({
      id: `chat-${chat._id}`,
      type: 'chat_create',
      title: `Created classroom "${chat.name}"`,
      subtitle: `${chat.members?.length || 0} member(s)`,
      at: chat.createdAt,
    }));

    const messageActivity = messages.map((message) => ({
      id: `message-${message._id}`,
      type: 'message_send',
      title: `Sent a message in "${message.chat?.name || 'Classroom'}"`,
      subtitle: message.content
        ? message.content.slice(0, 90)
        : message.messageType,
      at: message.createdAt,
    }));

    const activity = [...bookActivity, ...chatActivity, ...messageActivity]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, limit);

    res.json({
      success: true,
      stats: {
        totalBooks,
        totalChatsCreated,
        totalMessages,
      },
      sharedBooks,
      activity,
      viewedBooks,
      likedBooks,
      subscribedChannels: subscribedChannels.map((channel) => ({
        id: String(channel._id),
        name: channel.name || channel.username || 'User',
        username: channel.username || '',
        avatar: channel.avatar || '',
      })),
    });
  }),
);

/* ===== Change password (local accounts) ===== */
router.put(
  '/password',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!req.user.password) {
      return res.status(400).json({
        message:
          'This account has no password set. Sign in with Google or use password reset.',
      });
    }

    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string'
    ) {
      return res
        .status(400)
        .json({ message: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: 'New password must be at least 8 characters' });
    }

    const match = await bcrypt.compare(currentPassword, req.user.password);
    if (!match) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    req.user.password = await bcrypt.hash(newPassword, 10);
    await req.user.save();

    res.json({ message: 'Password updated' });
  }),
);

/* ===== Update Profile ===== */
router.put(
  '/',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    const { username, displayName } = req.body;

    if (username !== undefined) req.user.username = username;
    if (displayName !== undefined) req.user.displayName = displayName;

    await req.user.save();

    res.json({
      message: 'Profile updated',
      user: {
        id: req.user._id,
        username: req.user.username,
        displayName: req.user.displayName,
        avatar: req.user.avatar || null,
      },
    });
  }),
);

/* ===== Delete Account ===== */
router.delete(
  '/',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res, next) => {
    await req.user.deleteOne();

    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: 'Account deleted' });
    });
  }),
);

/* ===== Save BYOK API Key + Model ===== */
router.post(
  '/api-key',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    const { geminiApiKey = '', geminiModelId = '' } = req.body;
    req.user.geminiApiKey = geminiApiKey.trim();
    req.user.geminiModelId = geminiModelId.trim();
    await req.user.save();
    res.json({ message: 'API key saved' });
  }),
);

/* ===== Clear BYOK API Key ===== */
router.delete(
  '/api-key',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    req.user.geminiApiKey = '';
    req.user.geminiModelId = '';
    await req.user.save();
    res.json({ message: 'API key cleared' });
  }),
);

export default router;
