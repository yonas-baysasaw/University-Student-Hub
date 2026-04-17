import express from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

const router = express.Router();

/* ===== Middleware: Ensure Authenticated ===== */
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

/* ===== Get Current User Profile ===== */
router.get('/', ensureAuth, (req, res) => {
  const photo =
    req.user.avatar
   

  res.json({
    id: req.user._id,
    username: req.user.username,
    name: req.user.name,
    email: req.user.email,
    displayName: req.user.displayName,
    provider: req.user.provider,
    photo,
    avatar: req.user.avatar || null,
    lastSeen: req.user.lastSeen || null,
  });
});

/* ===== Get Current User Activity ===== */
router.get(
  '/activity',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    const [books, sharedBooks, chats, messages, totalBooks, totalChatsCreated, totalMessages] = await Promise.all([
      Book.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title format visibility createdAt updatedAt')
        .lean(),
      Book.find({ userId: req.user._id, visibility: { $in: ['public', 'unlisted'] } })
        .sort({ createdAt: -1 })
        .select('title description bookUrl thumbnailUrl format visibility createdAt updatedAt')
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
    ]);

    const bookActivity = books.map(book => ({
      id: `book-${book._id}`,
      type: 'book_upload',
      title: `Uploaded "${book.title}"`,
      subtitle: `${book.format || 'unknown format'} • ${book.visibility}`,
      at: book.createdAt,
    }));

    const chatActivity = chats.map(chat => ({
      id: `chat-${chat._id}`,
      type: 'chat_create',
      title: `Created classroom "${chat.name}"`,
      subtitle: `${chat.members?.length || 0} member(s)`,
      at: chat.createdAt,
    }));

    const messageActivity = messages.map(message => ({
      id: `message-${message._id}`,
      type: 'message_send',
      title: `Sent a message in "${message.chat?.name || 'Classroom'}"`,
      subtitle: message.content ? message.content.slice(0, 90) : message.messageType,
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
    });
  })
);

/* ===== Update Profile ===== */
router.put(
  '/',
  ensureAuth,
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
        avatar: req.user.avatar || null
      }
    });
  })
);

/* ===== Delete Account ===== */
router.delete(
  '/',
  ensureAuth,
  asyncHandler(async (req, res, next) => {
    await req.user.deleteOne();

    req.logout(err => {
      if (err) return next(err);
      res.json({ message: 'Account deleted' });
    });
  })
);

export default router;
