import { getIo } from '../socket/index.js';

/**
 * @param {string | import('mongoose').Types.ObjectId} userId
 */
export function notifyUserCalendarInvalidate(userId) {
  try {
    const io = getIo();
    io?.to(`user:${String(userId)}`).emit('calendar:invalidate', {});
  } catch {
    /* socket may be uninitialized (tests / CLI) */
  }
}

/**
 * @param {string | import('mongoose').Types.ObjectId} userId
 */
export function notifyUsersCalendarInvalidate(userIds) {
  const unique = [...new Set(userIds.map((id) => String(id)))];
  for (const id of unique) {
    notifyUserCalendarInvalidate(id);
  }
}

/**
 * @param {{ members?: unknown[] } | null | undefined} chat
 */
export function notifyChatMembersCalendarInvalidate(chat) {
  if (!chat || !Array.isArray(chat.members)) return;
  notifyUsersCalendarInvalidate(chat.members);
}

export function notifyAllConnectedCalendarInvalidate() {
  try {
    const io = getIo();
    io?.emit('calendar:invalidate', {});
  } catch {
    /* socket may be uninitialized */
  }
}
