import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import asyncHandler from '../middlewares/asyncHandler.js';
import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import ClassroomResource from '../models/ClassroomResource.js';
import Membership from '../models/Membership.js';
import Message from '../models/Message.js';
import {
  canManageClassroomContent,
  canManageClassroomRoster,
  isChatMember,
  isClassroomCreator,
} from '../utils/classroomContentAuth.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';
import { getIo } from '../socket/index.js';

const MAX_MESSAGE_BODY = 8000;

function emitChatMessageEvent(chatId, event, payload) {
  try {
    const io = getIo();
    io?.to(String(chatId)).emit(event, payload);
  } catch {
    /* socket may be uninitialized (tests / CLI) */
  }
}

async function populateMessageLean(messageId) {
  return Message.findById(messageId)
    .populate('sender', 'username email avatar photo')
    .lean();
}

async function repairChatLastMessage(chatId) {
  const last = await Message.findOne({
    chat: chatId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();
  await Chat.updateOne(
    { _id: chatId },
    { lastMessage: last?._id ?? null },
  );
}

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

function populateChatForClient(chatId) {
  return Chat.findById(chatId).populate([
    { path: 'members', select: 'username email avatar photo' },
    { path: 'creator', select: 'username email avatar photo' },
    { path: 'admins', select: 'username email avatar photo' },
    {
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username email avatar photo' },
    },
  ]);
}

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
  assertCanWrite(req.user);
  if (!req.body) {
    const error = new Error('Request body is missing');
    error.status = 400;
    throw error;
  }

  const { name } = req.body;
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
  assertCanWrite(req.user);
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
        { path: 'creator', select: 'username email avatar photo' },
        { path: 'admins', select: 'username email avatar photo' },
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
  assertCanWrite(req.user);
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

  const populated = await populateChatForClient(chat._id);

  res.json(populated ?? chat);
});

export const leaveChat = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const e = new Error('Invalid classroom id');
    e.status = 400;
    throw e;
  }

  const chat = await Chat.findById(chatId).select('members admins creator');
  if (!chat) {
    const e = new Error('Classroom not found');
    e.status = 404;
    throw e;
  }

  if (!isChatMember(chat, req.user._id)) {
    throw forbidden('You are not part of this classroom');
  }

  if (isClassroomCreator(chat, req.user._id)) {
    throw forbidden(
      'Classroom owners cannot leave — archive or delete the classroom instead.',
    );
  }

  const uid = req.user._id;
  await Chat.updateOne(
    { _id: chatId },
    { $pull: { members: uid, admins: uid } },
  );
  await Membership.deleteMany({ chat: chatId, user: uid });

  res.json({ message: 'You left the classroom' });
});

export const patchChatMember = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, userId: targetUserId } = req.params;
  const action = req.body?.action;

  if (
    !mongoose.Types.ObjectId.isValid(chatId) ||
    !mongoose.Types.ObjectId.isValid(targetUserId)
  ) {
    const e = new Error('Invalid classroom or user id');
    e.status = 400;
    throw e;
  }

  const valid = ['promote_admin', 'demote_admin', 'remove'];
  if (!valid.includes(action)) {
    const e = new Error(
      'Body must include action: promote_admin, demote_admin, or remove',
    );
    e.status = 400;
    throw e;
  }

  const targetOid = new mongoose.Types.ObjectId(targetUserId);

  const chat = await Chat.findById(chatId).select('members admins creator');
  if (!chat) {
    const e = new Error('Classroom not found');
    e.status = 404;
    throw e;
  }

  if (!isChatMember(chat, req.user._id)) {
    throw forbidden('You are not part of this classroom');
  }
  if (!canManageClassroomRoster(chat, req.user._id)) {
    throw forbidden('Only the classroom creator can manage members');
  }

  if (!isChatMember(chat, targetOid)) {
    const e = new Error('User is not a member of this classroom');
    e.status = 400;
    throw e;
  }

  if (isClassroomCreator(chat, targetOid)) {
    if (action === 'demote_admin' || action === 'remove') {
      throw forbidden('Cannot remove or demote the classroom creator');
    }
    const populatedCreator = await populateChatForClient(chatId);
    return res.json(populatedCreator ?? chat);
  }

  if (action === 'remove' && targetOid.equals(req.user._id)) {
    throw forbidden('You cannot remove yourself from the classroom');
  }

  if (action === 'promote_admin') {
    await Chat.updateOne({ _id: chatId }, { $addToSet: { admins: targetOid } });
  } else if (action === 'demote_admin') {
    await Chat.updateOne({ _id: chatId }, { $pull: { admins: targetOid } });
  } else {
    await Chat.updateOne(
      { _id: chatId },
      { $pull: { members: targetOid, admins: targetOid } },
    );
  }

  const populated = await populateChatForClient(chatId);
  if (!populated) {
    const e = new Error('Classroom not found');
    e.status = 404;
    throw e;
  }
  res.json(populated);
});

export const deleteChat = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
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
  assertCanWrite(req.user);
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
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 5), 100);
  const beforeRaw = req.query.before;
  const afterRaw = req.query.after;

  const chat = await Chat.findById(chatId).select('members');
  if (!chat) {
    throw new Error('Chat not found');
  }

  const isMember = chat.members.some((member) => member.equals(req.user._id));
  if (!isMember) {
    throw forbidden('You are not part of this chat');
  }

  const filter = { chat: chatId };

  if (afterRaw && mongoose.Types.ObjectId.isValid(String(afterRaw))) {
    const anchor = await Message.findById(afterRaw).select('createdAt').lean();
    if (anchor?.createdAt) {
      filter.createdAt = { $gt: anchor.createdAt };
    }
    const batchAsc = await Message.find(filter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('sender', 'username email avatar photo')
      .lean();

    res.json({
      limit,
      mode: 'after',
      messages: batchAsc,
    });
    return;
  }

  if (beforeRaw && mongoose.Types.ObjectId.isValid(String(beforeRaw))) {
    const anchor = await Message.findById(beforeRaw).select('createdAt').lean();
    if (anchor?.createdAt) {
      filter.createdAt = { $lt: anchor.createdAt };
    }
  }

  const batchDesc = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username email avatar photo')
    .lean();

  const messages = batchDesc.reverse();

  let hasMoreOlder = false;
  if (messages.length > 0) {
    const oldest = messages[0];
    const oc = oldest?.createdAt;
    if (oc) {
      hasMoreOlder = !!(await Message.exists({
        chat: chatId,
        createdAt: { $lt: new Date(oc) },
      }));
    }
  }

  const total = await Message.countDocuments({ chat: chatId });

  res.json({
    limit,
    total,
    hasMoreOlder,
    messages,
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
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

  emitChatMessageEvent(chatId, 'message', {
    chatId: String(chatId),
    message: populated.toObject
      ? populated.toObject()
      : populated,
  });

  res.status(201).json({ message: populated });
});

export const patchChatMessage = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, messageId } = req.params;
  if (
    !mongoose.Types.ObjectId.isValid(chatId) ||
    !mongoose.Types.ObjectId.isValid(messageId)
  ) {
    const e = new Error('Invalid classroom or message id');
    e.status = 400;
    throw e;
  }

  const chat = await Chat.findById(chatId).select('members admins creator');
  if (!chat || !isChatMember(chat, req.user._id)) {
    throw forbidden('You are not part of this classroom');
  }

  const msg = await Message.findOne({ _id: messageId, chat: chatId });
  if (!msg) {
    const e = new Error('Message not found');
    e.status = 404;
    throw e;
  }
  if (msg.deletedAt) {
    const e = new Error('Message has been deleted');
    e.status = 400;
    throw e;
  }

  if (!msg.sender.equals(req.user._id)) {
    throw forbidden('You can only edit your own messages');
  }

  const raw = req.body?.content;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    const e = new Error('Message cannot be empty');
    e.status = 400;
    throw e;
  }
  if (trimmed.length > MAX_MESSAGE_BODY) {
    const e = new Error('Message is too long');
    e.status = 400;
    throw e;
  }

  msg.content = trimmed;
  msg.editedAt = new Date();
  await msg.save();

  const populated = await populateMessageLean(msg._id);
  emitChatMessageEvent(chatId, 'messageUpdated', {
    chatId: String(chatId),
    message: populated,
  });

  res.json({ message: populated });
});

export const deleteChatMessage = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, messageId } = req.params;
  if (
    !mongoose.Types.ObjectId.isValid(chatId) ||
    !mongoose.Types.ObjectId.isValid(messageId)
  ) {
    const e = new Error('Invalid classroom or message id');
    e.status = 400;
    throw e;
  }

  const chat = await Chat.findById(chatId).select('members admins creator');
  if (!chat || !isChatMember(chat, req.user._id)) {
    throw forbidden('You are not part of this classroom');
  }

  const msg = await Message.findOne({ _id: messageId, chat: chatId });
  if (!msg) {
    const e = new Error('Message not found');
    e.status = 404;
    throw e;
  }
  if (msg.deletedAt) {
    const e = new Error('Message already deleted');
    e.status = 400;
    throw e;
  }

  const isSender = msg.sender.equals(req.user._id);
  const isModerator = canManageClassroomContent(chat, req.user._id);
  if (!isSender && !isModerator) {
    throw forbidden('You cannot delete this message');
  }

  msg.deletedAt = new Date();
  msg.content = '';
  await msg.save();

  await repairChatLastMessage(chatId);

  const populated = await populateMessageLean(msg._id);
  emitChatMessageEvent(chatId, 'messageUpdated', {
    chatId: String(chatId),
    message: populated,
  });

  res.json({ ok: true, message: populated });
});
