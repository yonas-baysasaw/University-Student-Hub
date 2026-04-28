import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import asyncHandler from '../middlewares/asyncHandler.js';
import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import ClassroomResource from '../models/ClassroomResource.js';
import Membership from '../models/Membership.js';
import Message from '../models/Message.js';
import { canManageClassroomContent } from '../utils/classroomContentAuth.js';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * @param {string} t
 * @returns {number}
 */
function minutesFromHHMM(t) {
  const m = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function validateClassScheduleSlots(slots) {
  const fail = (msg) => {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  };
  if (!Array.isArray(slots)) {
    fail('classSchedule.slots must be an array');
  }
  if (slots.length > 48) {
    fail('Too many weekly slots');
  }
  for (const s of slots) {
    if (!s || typeof s !== 'object') {
      fail('Invalid slot');
    }
    const wd = Number(s.weekday);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) {
      fail('Each slot needs weekday 0–6 (Sunday=0)');
    }
    const startStr = String(s.start ?? '');
    const endStr = String(s.end ?? '');
    if (!HH_MM.test(startStr)) {
      fail('Invalid start time (use 24h HH:mm)');
    }
    if (!HH_MM.test(endStr)) {
      fail('Invalid end time (use 24h HH:mm)');
    }
    const startMin = minutesFromHHMM(startStr);
    const endMin = minutesFromHHMM(endStr);
    if (!(startMin < endMin)) {
      fail('Each slot must have start time before end time');
    }
    if (s.label != null && String(s.label).length > 120) {
      fail('Label too long');
    }
  }
}

const forbidden = (message) => {
  const err = new Error(message);
  err.status = 403;
  return err;
};

const invitationGenerator = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  8,
);

const ensureInvitationCode = async () => {
  for (let i = 0; i < 5; i += 1) {
    const code = invitationGenerator();
    const exists = await Chat.exists({ invitationCode: code });
    if (!exists) return code;
  }
  throw new Error('Unable to generate invitation code');
};

export const createChat = asyncHandler(async (req, res) => {
  if (!req.body) {
    const error = new Error('Request body is missing');
    error.status = 400;
    throw error;
  }

  const { name } = req.body;
  console.log('hi');
  if (!name?.trim()) {
    const error = new Error('Chat name is required');
    error.status = 400;
    throw error;
  }

  const invitationCode = await ensureInvitationCode();
  const chat = await Chat.create({
    name: name.trim(),
    isGroup: true,
    creator: req.user._id,
    members: [req.user._id],
    admins: [req.user._id],
    invitationCode,
  });

  res.status(201).json(chat);
});

export const joinChatByCode = asyncHandler(async (req, res) => {
  console.log(req.body);
  if (!req.body) {
    const error = new Error('Request body is missing');
    error.status = 400;
    throw error;
  }

  const { invitationCode } = req.body;
  if (!invitationCode) {
    const error = new Error('invitationCode is required');
    error.status = 400;
    throw error;
  }

  const chat = await Chat.findOne({ invitationCode });
  if (!chat) {
    const error = new Error('Invalid invitation code');
    error.status = 404;
    throw error;
  }

  if (chat.members.some((member) => member.equals(req.user._id))) {
    return res.json(chat);
  }

  chat.members.push(req.user._id);
  await chat.save();

  res.json(chat);
});

export const getUserChats = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, createdByMe } = req.query;
  const parsedPage = Math.max(Number(page) || 1, 1);
  const parsedLimit = Math.min(Math.max(Number(limit) || 20, 5), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const baseFilter =
    createdByMe === 'true'
      ? { creator: req.user._id }
      : { members: req.user._id };
  const [total, chats] = await Promise.all([
    Chat.countDocuments(baseFilter),
    Chat.find(baseFilter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate([
        { path: 'members', select: 'username email avatar photo' },
        {
          path: 'lastMessage',
          populate: { path: 'sender', select: 'username email avatar photo' },
        },
      ]),
  ]);

  res.json({
    page: parsedPage,
    limit: parsedLimit,
    total,
    hasMore: parsedPage * parsedLimit < total,
    chats,
  });
});

export const patchChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const e = new Error('Invalid classroom id');
    e.status = 400;
    throw e;
  }

  const chat = await Chat.findById(chatId).select(
    'members admins creator name metadata',
  );
  if (!chat) {
    const e = new Error('Classroom not found');
    e.status = 404;
    throw e;
  }

  if (!canManageClassroomContent(chat, req.user._id)) {
    throw forbidden('Only classroom admins can update this classroom');
  }

  const { name, archived } = req.body ?? {};

  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      const e = new Error('Classroom name cannot be empty');
      e.status = 400;
      throw e;
    }
    if (trimmed.length > 120) {
      const e = new Error('Classroom name is too long');
      e.status = 400;
      throw e;
    }
    chat.name = trimmed;
  }

  if (typeof archived === 'boolean') {
    if (!chat.metadata || typeof chat.metadata !== 'object') {
      chat.metadata = {};
    }
    chat.metadata.archived = archived;
  }

  await chat.save();

  const populated = await Chat.findById(chat._id).populate([
    { path: 'members', select: 'username email avatar photo' },
    {
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username email avatar photo' },
    },
  ]);

  res.json(populated ?? chat);
});

export const deleteChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const e = new Error('Invalid classroom id');
    e.status = 400;
    throw e;
  }

  const chat = await Chat.findById(chatId).select(
    'members admins creator metadata name',
  );
  if (!chat) {
    const e = new Error('Classroom not found');
    e.status = 404;
    throw e;
  }

  if (!canManageClassroomContent(chat, req.user._id)) {
    throw forbidden('Only classroom admins can delete this classroom');
  }

  await Promise.all([
    Message.deleteMany({ chat: chatId }),
    ClassroomAnnouncement.deleteMany({ chat: chatId }),
    ClassroomResource.deleteMany({ chat: chatId }),
    Membership.deleteMany({ chat: chatId }),
  ]);

  await Chat.findByIdAndDelete(chatId);

  res.json({ message: 'Classroom deleted' });
});

export const patchChatSchedule = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const e = new Error('Invalid classroom id');
    e.status = 400;
    throw e;
  }

  const chat = await Chat.findById(chatId).select(
    'members admins creator metadata name',
  );
  if (!chat) {
    const e = new Error('Classroom not found');
    e.status = 404;
    throw e;
  }

  if (!canManageClassroomContent(chat, req.user._id)) {
    throw forbidden('Only classroom admins can update the weekly schedule');
  }

  const raw = req.body?.classSchedule ?? req.body;
  const slots = raw?.slots;
  validateClassScheduleSlots(slots);

  if (!chat.metadata || typeof chat.metadata !== 'object') {
    chat.metadata = {};
  }
  chat.metadata.classSchedule = { slots };
  await chat.save();

  res.json({
    message: 'Schedule updated',
    classSchedule: chat.metadata.classSchedule,
  });
});

export const getChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 5), 100);
  const skip = (page - 1) * limit;

  const chat = await Chat.findById(chatId).select('members');
  if (!chat) {
    throw new Error('Chat not found');
  }

  const isMember = chat.members.some((member) => member.equals(req.user._id));
  if (!isMember) {
    throw forbidden('You are not part of this chat');
  }

  const [messages, total] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username email avatar photo')
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);

  res.json({
    page,
    limit,
    total,
    hasMore: page * limit < total,
    messages,
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  if (!chatId) {
    const error = new Error('Chat ID is required');
    error.status = 400;
    throw error;
  }
  const { content, messageType = 'text', fileUrl } = req.body ?? {};
  const trimmedContent = typeof content === 'string' ? content.trim() : '';
  if (!trimmedContent && !fileUrl) {
    const error = new Error('Message content or file URL is required');
    error.status = 400;
    throw error;
  }

  const chat = await Chat.findById(chatId).select('members');
  if (!chat) {
    const error = new Error('Chat not found');
    error.status = 404;
    throw error;
  }

  const isMember = chat.members.some((member) => member.equals(req.user._id));
  if (!isMember) {
    throw forbidden('You are not part of this chat');
  }

  const message = await Message.create({
    chat: chatId,
    sender: req.user._id,
    content: trimmedContent,
    messageType,
    fileUrl,
    readBy: [req.user._id],
  });

  chat.lastMessage = message._id;
  await chat.save();

  const populated = await message.populate(
    'sender',
    'username email avatar photo',
  );

  res.status(201).json({ message: populated });
});
