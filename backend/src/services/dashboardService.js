import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getClassroomCountForUser(userId) {
  return Chat.countDocuments({ members: userId });
}

const BODY_PREVIEW_MAX = 220;

/**
 * @param {string} body
 */
function truncateBody(body) {
  const s = typeof body === 'string' ? body.trim().replace(/\s+/g, ' ') : '';
  if (s.length <= BODY_PREVIEW_MAX) return s;
  return `${s.slice(0, BODY_PREVIEW_MAX)}…`;
}

/**
 * @param {string} t
 */
function timeToMinutes(t) {
  const m = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {number} limit
 */
export async function getRecentAnnouncementsForUser(userId, limit) {
  const chats = await Chat.find({ members: userId }).select('_id name').lean();
  const ids = chats.map((c) => c._id);
  if (ids.length === 0) return [];

  const nameById = new Map(chats.map((c) => [String(c._id), c.name]));

  const rows = await ClassroomAnnouncement.find({ chat: { $in: ids } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((a) => ({
    id: String(a._id),
    title: a.title,
    bodyPreview: truncateBody(a.body),
    classroomName: nameById.get(String(a.chat)) || 'Classroom',
    chatId: String(a.chat),
    author: a.authorName || 'Instructor',
    createdAt: a.createdAt
      ? new Date(a.createdAt).toISOString()
      : new Date().toISOString(),
  }));
}

/**
 * All classrooms with any weekly slots (full recurring pattern).
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getAllScheduledClassesForUser(userId) {
  const chats = await Chat.find({ members: userId })
    .select('name metadata')
    .lean();

  const out = [];

  for (const chat of chats) {
    const slots = chat.metadata?.classSchedule?.slots;
    if (!Array.isArray(slots) || slots.length === 0) continue;

    const normalized = slots.map((s) => ({
      weekday: Number(s.weekday),
      start: String(s.start ?? ''),
      end: String(s.end ?? ''),
      label: typeof s.label === 'string' ? s.label : '',
    }));

    normalized.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    out.push({
      chatId: String(chat._id),
      name: chat.name,
      slots: normalized,
    });
  }

  out.sort(
    (a, b) =>
      timeToMinutes(a.slots[0]?.start ?? '99:99') -
      timeToMinutes(b.slots[0]?.start ?? '99:99'),
  );

  return out;
}

/**
 * Classes where `metadata.classSchedule.slots` includes this weekday (0=Sun … 6=Sat).
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {number} weekday
 */
export async function getTodayClassesForUser(userId, weekday) {
  const all = await getAllScheduledClassesForUser(userId);
  return all
    .map((room) => ({
      ...room,
      slots: room.slots.filter((s) => Number(s.weekday) === weekday),
    }))
    .filter((room) => room.slots.length > 0);
}
