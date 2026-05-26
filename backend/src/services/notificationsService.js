import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import ClassroomMention from '../models/ClassroomMention.js';
import User from '../models/User.js';

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function getUserChatIds(userId) {
  const chats = await Chat.find({
    members: userId,
    'metadata.archived': { $ne: true },
  })
    .select('_id')
    .lean();
  return chats.map((c) => c._id);
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getUnreadNotificationCount(userId) {
  const user = await User.findById(userId)
    .select('notificationsLastSeenAt')
    .lean();
  const lastSeen = user?.notificationsLastSeenAt ?? null;

  const [mentionCount, chatIds] = await Promise.all([
    ClassroomMention.countDocuments({ recipient: userId, readAt: null }),
    getUserChatIds(userId),
  ]);

  let announcementCount = 0;
  if (chatIds.length > 0) {
    const annFilter = { chat: { $in: chatIds } };
    if (lastSeen) {
      annFilter.createdAt = { $gt: lastSeen };
    }
    announcementCount = await ClassroomAnnouncement.countDocuments(annFilter);
  }

  return mentionCount + announcementCount;
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function markNotificationsSeen(userId) {
  const now = new Date();
  await Promise.all([
    User.findByIdAndUpdate(userId, { notificationsLastSeenAt: now }),
    ClassroomMention.updateMany(
      { recipient: userId, readAt: null },
      { $set: { readAt: now } },
    ),
  ]);
  return now;
}
