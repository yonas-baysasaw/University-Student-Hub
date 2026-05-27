import bcrypt from 'bcrypt';
import express from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { testGeminiApiKey, listGeminiModels } from '../utils/geminiApiClient.js';
import {
  encryptGeminiApiKey,
  isValidGeminiKeyFormat,
} from '../utils/geminiKeyCrypto.js';
import { validatePasswordPolicy } from '../utils/passwordPolicy.js';
import { serializeCurrentUser } from '../utils/userSerializer.js';
import { blockReadOnlyUser } from '../utils/userWriteAccess.js';

const router = express.Router();

const PUBLIC_PROFILE_FIELDS =
  'username name displayName avatar createdAt subscribers department schoolYear accountType email showEmailPublic bio interests careerGoals skills socialGitHub socialUpwork socialTelegram socialLinkedIn socialInstagram socialFacebook';

/** @param {unknown} body @param {string} key @param {number} maxLen */
function readOptionalTrimmedString(body, key, maxLen) {
  if (body[key] === undefined) return undefined;
  if (typeof body[key] !== 'string') return null;
  return body[key].trim().slice(0, maxLen);
}

function readOptionalBoolean(body, key) {
  if (body[key] === undefined) return undefined;
  if (typeof body[key] === 'boolean') return body[key];
  return null;
}

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
      .select(PUBLIC_PROFILE_FIELDS)
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
        displayName: user.displayName || '',
        username: user.username || '',
        avatar: user.avatar || '',
        joinedAt: user.createdAt || null,
        subscribersCount: subscribers.length,
        department: user.department || '',
        schoolYear:
          typeof user.schoolYear === 'number' && Number.isFinite(user.schoolYear)
            ? user.schoolYear
            : null,
        accountType:
          user.accountType === 'instructor' ? 'instructor' : 'student',
        email:
          user.showEmailPublic &&
          typeof user.email === 'string' &&
          user.email.trim()
            ? user.email.trim()
            : '',
        bio: typeof user.bio === 'string' ? user.bio : '',
        interests: typeof user.interests === 'string' ? user.interests : '',
        careerGoals:
          typeof user.careerGoals === 'string' ? user.careerGoals : '',
        skills: typeof user.skills === 'string' ? user.skills : '',
        socialTelegram:
          typeof user.socialTelegram === 'string' ? user.socialTelegram : '',
        socialLinkedIn:
          typeof user.socialLinkedIn === 'string' ? user.socialLinkedIn : '',
        socialInstagram:
          typeof user.socialInstagram === 'string' ? user.socialInstagram : '',
        socialFacebook:
          typeof user.socialFacebook === 'string' ? user.socialFacebook : '',
        socialUpwork:
          typeof user.socialUpwork === 'string' ? user.socialUpwork : '',
        socialGitHub:
          typeof user.socialGitHub === 'string' ? user.socialGitHub : '',
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

/** Directory search for host invite pickers (min 2 chars). */
router.get(
  '/users/search',
  ensureAuth,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Enter at least 2 characters.',
      });
    }
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    const users = await User.find({
      $or: [{ username: re }, { name: re }],
    })
      .select('username name avatar')
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      users: users.map((u) => ({
        id: String(u._id),
        username: u.username || '',
        name: u.name || u.username || 'User',
        avatar: u.avatar || '',
      })),
    });
  }),
);

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

    const passwordCheck = validatePasswordPolicy(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ message: passwordCheck.message });
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
    const { username, displayName, department, schoolYear } = req.body;

    const showEmailPublic = readOptionalBoolean(req.body, 'showEmailPublic');
    if (showEmailPublic === null) {
      return res.status(400).json({ message: 'Invalid showEmailPublic' });
    }
    if (showEmailPublic !== undefined) {
      req.user.showEmailPublic = showEmailPublic;
    }

    const bio = readOptionalTrimmedString(req.body, 'bio', 1600);
    if (bio === null) {
      return res.status(400).json({ message: 'Invalid bio' });
    }
    if (bio !== undefined) req.user.bio = bio;

    const interests = readOptionalTrimmedString(req.body, 'interests', 600);
    if (interests === null) {
      return res.status(400).json({ message: 'Invalid interests' });
    }
    if (interests !== undefined) req.user.interests = interests;

    const careerGoals = readOptionalTrimmedString(req.body, 'careerGoals', 600);
    if (careerGoals === null) {
      return res.status(400).json({ message: 'Invalid career goals' });
    }
    if (careerGoals !== undefined) req.user.careerGoals = careerGoals;

    const skills = readOptionalTrimmedString(req.body, 'skills', 600);
    if (skills === null) {
      return res.status(400).json({ message: 'Invalid skills' });
    }
    if (skills !== undefined) req.user.skills = skills;

    const socialKeys = [
      ['socialGitHub', 'socialGitHub'],
      ['socialUpwork', 'socialUpwork'],
      ['socialTelegram', 'socialTelegram'],
      ['socialLinkedIn', 'socialLinkedIn'],
      ['socialInstagram', 'socialInstagram'],
      ['socialFacebook', 'socialFacebook'],
    ];
    for (const [bodyKey, docKey] of socialKeys) {
      const v = readOptionalTrimmedString(req.body, bodyKey, 400);
      if (v === null) {
        return res.status(400).json({ message: `Invalid ${bodyKey}` });
      }
      if (v !== undefined) req.user[docKey] = v;
    }

    const phone = readOptionalTrimmedString(req.body, 'phone', 40);
    if (phone === null) {
      return res.status(400).json({ message: 'Invalid phone' });
    }
    if (phone !== undefined) req.user.phone = phone;

    const campus = readOptionalTrimmedString(req.body, 'campus', 120);
    if (campus === null) {
      return res.status(400).json({ message: 'Invalid campus' });
    }
    if (campus !== undefined) req.user.campus = campus;

    const emergencyContact = readOptionalTrimmedString(
      req.body,
      'emergencyContact',
      200,
    );
    if (emergencyContact === null) {
      return res.status(400).json({ message: 'Invalid emergencyContact' });
    }
    if (emergencyContact !== undefined) {
      req.user.emergencyContact = emergencyContact;
    }

    if (username !== undefined) req.user.username = username;
    if (displayName !== undefined) req.user.displayName = displayName;

    if (req.user.accountType === 'student') {
      if (department !== undefined) {
        if (typeof department !== 'string') {
          return res.status(400).json({ message: 'Invalid department' });
        }
        const d = department.trim();
        if (d.length > 120) {
          return res
            .status(400)
            .json({ message: 'Department must be at most 120 characters' });
        }
        req.user.department = d;
      }
      if (schoolYear !== undefined) {
        const y = Number(schoolYear);
        if (!Number.isFinite(y)) {
          return res.status(400).json({ message: 'Invalid school year' });
        }
        const yi = Math.round(y);
        if (yi < 1 || yi > 7) {
          return res
            .status(400)
            .json({ message: 'School year must be between 1 and 7' });
        }
        req.user.schoolYear = yi;
      }
    }

    await req.user.save();

    res.json({
      message: 'Profile updated',
      user: serializeCurrentUser(req.user),
    });
  }),
);

/* ===== Liqu AI / Gemini BYOK ===== */
router.post(
  '/gemini/test',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    const apiKey =
      typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    if (!isValidGeminiKeyFormat(apiKey)) {
      return res.status(400).json({
        message: 'Enter a valid Google Gemini API key (starts with AIza).',
      });
    }
    try {
      await testGeminiApiKey(apiKey);
      const models = await listGeminiModels(apiKey);
      return res.json({ ok: true, message: 'API key is valid.', models });
    } catch (error) {
      return res.status(400).json({
        message: error.message || 'API key test failed.',
      });
    }
  }),
);

router.put(
  '/gemini',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    const apiKey =
      typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const modelId =
      typeof req.body?.modelId === 'string' ? req.body.modelId.trim() : '';

    if (!isValidGeminiKeyFormat(apiKey)) {
      return res.status(400).json({
        message: 'Enter a valid Google Gemini API key (starts with AIza).',
      });
    }

    try {
      await testGeminiApiKey(apiKey);
    } catch (error) {
      return res.status(400).json({
        message: error.message || 'API key validation failed.',
      });
    }

    req.user.geminiApiKey = encryptGeminiApiKey(apiKey);
    req.user.geminiModelId = modelId;
    req.user.geminiKeySet = true;
    await req.user.save();

    return res.json({
      message: 'Liqu AI settings saved.',
      user: serializeCurrentUser(req.user),
    });
  }),
);

router.delete(
  '/gemini',
  ensureAuth,
  blockReadOnlyUser,
  asyncHandler(async (req, res) => {
    req.user.geminiApiKey = undefined;
    req.user.geminiModelId = '';
    req.user.geminiKeySet = false;
    await req.user.save();

    return res.json({
      message: 'Liqu AI key cleared.',
      user: serializeCurrentUser(req.user),
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

export default router;
