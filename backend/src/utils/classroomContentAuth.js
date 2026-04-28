import mongoose from 'mongoose';
import Chat from '../models/Chat.js';

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
function idInList(list, userId) {
  if (!Array.isArray(list)) return false;
  return list.some((id) => id.equals(userId));
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
  if (chat.creator?.equals(userId)) return true;
  if (idInList(chat.admins, userId)) return true;
  return false;
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
