import mongoose from 'mongoose';
import Chat from '../models/Chat.js';

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function sameId(a, b) {
  if (a == null || b == null) return false;
  if (typeof a.equals === 'function') return a.equals(b);
  if (typeof b.equals === 'function') return b.equals(a);
  return String(a) === String(b);
}

/**
 * @param {unknown[]} list
 * @param {import('mongoose').Types.ObjectId} userId
 */
function idInList(list, userId) {
  if (!Array.isArray(list)) return false;
  return list.some((entry) => {
    const oid = entry?._id ?? entry;
    if (oid != null && typeof oid.equals === 'function') return oid.equals(userId);
    return String(oid) === String(userId);
  });
}

/**
 * Classroom creator id (handles populated or raw ref).
 * @param {{ creator?: unknown }} chat
 */
export function getCreatorId(chat) {
  const c = chat?.creator;
  if (c == null) return undefined;
  return c._id ?? c;
}

/**
 * @param {import('mongoose').Document} chat
 * @param {import('mongoose').Types.ObjectId} userId
 */
export function isClassroomCreator(chat, userId) {
  return sameId(getCreatorId(chat) ?? chat.creator, userId);
}

/**
 * @param {import('mongoose').Document} chat
 * @param {import('mongoose').Types.ObjectId} userId
 */
export function isChatMember(chat, userId) {
  return idInList(chat.members, userId);
}

/**
 * Creator or member of `admins` can manage classroom announcements/resources.
 * @param {import('mongoose').Document} chat
 * @param {import('mongoose').Types.ObjectId} userId
 */
export function canManageClassroomContent(chat, userId) {
  if (isClassroomCreator(chat, userId)) return true;
  if (idInList(chat.admins, userId)) return true;
  return false;
}

/**
 * Any classroom member may upload assignment submissions (creators/admins included).
 * Grading and roster actions remain limited to {@link canManageClassroomContent}.
 * @param {import('mongoose').Document} chat
 * @param {import('mongoose').Types.ObjectId} userId
 */
export function canSubmitAssignments(chat, userId) {
  return isChatMember(chat, userId);
}

/**
 * Only the classroom creator may promote/demote admins or remove members.
 * @param {import('mongoose').Document} chat
 * @param {import('mongoose').Types.ObjectId} userId
 */
export function canManageClassroomRoster(chat, userId) {
  return isClassroomCreator(chat, userId);
}

/**
 * @param {string} chatId
 * @param {import('express').Response} res
 * @returns {Promise<import('mongoose').Document | null>} chat or null (response may be sent)
 */
export async function loadChatForClassroomRequest(chatId, res) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    res.status(400).json({ message: 'Invalid classroom id' });
    return null;
  }

  const chat = await Chat.findById(chatId).select(
    'members admins creator name',
  );
  if (!chat) {
    res.status(404).json({ message: 'Classroom not found' });
    return null;
  }
  return chat;
}
