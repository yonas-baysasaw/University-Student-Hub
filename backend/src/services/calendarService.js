import Assignment from '../models/Assignment.js';
import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import Event from '../models/Event.js';
import { getPersonalEventsForFeed } from './personalCalendarService.js';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const COLORS = {
  class: '#0891b2',
  assignment: '#d97706',
  assignmentLate: '#b45309',
  announcementExam: '#dc2626',
  announcementAssignment: '#ea580c',
  event: '#15803d',
};

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {Date}
 */
function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * @param {Date} d
 * @returns {string}
 */
function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {Date} from
 * @param {Date} to
 * @returns {Date[]}
 */
function eachDayInclusive(from, to) {
  const days = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * @param {string} dateKey
 * @param {string} hhmm
 * @returns {string}
 */
function combineDateAndTime(dateKey, hhmm) {
  if (!HH_MM.test(hhmm)) return `${dateKey}T00:00:00.000`;
  return `${dateKey}T${hhmm}:00.000`;
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {Date} from
 * @param {Date} to
 */
export async function getCalendarFeed(userId, from, to) {
  const chats = await Chat.find({
    members: userId,
    'metadata.archived': { $ne: true },
  })
    .select('name metadata')
    .lean();

  const chatIds = chats.map((c) => c._id);
  const chatNameById = new Map(chats.map((c) => [String(c._id), c.name]));

  const items = [];
  const days = eachDayInclusive(from, to);

  for (const chat of chats) {
    const chatId = String(chat._id);
    const classroomName = chat.name || 'Classroom';
    const slots = chat.metadata?.classSchedule?.slots;
    if (!Array.isArray(slots) || slots.length === 0) continue;

    for (const day of days) {
      const weekday = day.getDay();
      const dateKey = toDateKey(day);

      for (const slot of slots) {
        if (Number(slot.weekday) !== weekday) continue;
        const startStr = String(slot.start ?? '');
        const endStr = String(slot.end ?? '');
        if (!HH_MM.test(startStr) || !HH_MM.test(endStr)) continue;

        const startIso = combineDateAndTime(dateKey, startStr);
        const endIso = combineDateAndTime(dateKey, endStr);
        const label =
          typeof slot.label === 'string' && slot.label.trim()
            ? slot.label.trim()
            : '';

        items.push({
          id: `class:${chatId}:${startIso}`,
          source: 'class',
          kind: 'session',
          title: label ? `${classroomName} — ${label}` : classroomName,
          start: startIso,
          end: endIso,
          allDay: false,
          color: COLORS.class,
          url: `/classroom/${chatId}`,
          meta: {
            chatId,
            classroomName,
            label,
            startTime: startStr,
            endTime: endStr,
          },
        });
      }
    }
  }

  if (chatIds.length > 0) {
    const [assignments, announcements] = await Promise.all([
      Assignment.find({
        chat: { $in: chatIds },
        published: true,
        $or: [
          { dueAt: { $gte: from, $lte: to } },
          { allowLateUntil: { $gte: from, $lte: to } },
        ],
      })
        .sort({ dueAt: 1 })
        .lean(),
      ClassroomAnnouncement.find({
        chat: { $in: chatIds },
        kind: { $in: ['exam', 'assignment'] },
        expiresAt: { $ne: null, $gte: from, $lte: to },
      })
        .sort({ expiresAt: 1 })
        .lean(),
    ]);

    for (const a of assignments) {
      const chatId = String(a.chat);
      const classroomName = chatNameById.get(chatId) || 'Classroom';
      const dueAt = a.dueAt ? new Date(a.dueAt) : null;

      if (dueAt && dueAt >= from && dueAt <= to) {
        items.push({
          id: `assignment:${a._id}:due`,
          source: 'assignment',
          kind: 'due',
          title: `Due: ${a.title}`,
          start: dueAt.toISOString(),
          end: dueAt.toISOString(),
          allDay: false,
          color: COLORS.assignment,
          url: `/classroom/${chatId}/resources`,
          meta: {
            chatId,
            classroomName,
            assignmentId: String(a._id),
            subtype: 'due',
          },
        });
      }

      const lateUntil = a.allowLateUntil ? new Date(a.allowLateUntil) : null;
      if (
        lateUntil &&
        lateUntil >= from &&
        lateUntil <= to &&
        (!dueAt || lateUntil.getTime() !== dueAt.getTime())
      ) {
        items.push({
          id: `assignment:${a._id}:late`,
          source: 'assignment',
          kind: 'late',
          title: `Late deadline: ${a.title}`,
          start: lateUntil.toISOString(),
          end: lateUntil.toISOString(),
          allDay: false,
          color: COLORS.assignmentLate,
          url: `/classroom/${chatId}/resources`,
          meta: {
            chatId,
            classroomName,
            assignmentId: String(a._id),
            subtype: 'late',
          },
        });
      }
    }

    for (const ann of announcements) {
      if (!ann.expiresAt) continue;
      const chatId = String(ann.chat);
      const classroomName = chatNameById.get(chatId) || 'Classroom';
      const at = new Date(ann.expiresAt);
      const prefix = ann.kind === 'exam' ? 'Exam' : 'Assignment';

      items.push({
        id: `announcement:${ann._id}`,
        source: 'announcement',
        kind: ann.kind,
        title: `${prefix}: ${ann.title}`,
        start: at.toISOString(),
        end: at.toISOString(),
        allDay: false,
        color:
          ann.kind === 'exam'
            ? COLORS.announcementExam
            : COLORS.announcementAssignment,
        url: `/classroom/${chatId}/announcements`,
        meta: {
          chatId,
          classroomName,
          announcementId: String(ann._id),
        },
      });
    }
  }

  const eventFrom = new Date(from);
  eventFrom.setHours(0, 0, 0, 0);
  const eventTo = new Date(to);
  eventTo.setHours(23, 59, 59, 999);

  const events = await Event.find({
    $and: [
      {
        $or: [{ reservedBy: userId }, { userId }],
      },
      {
        $or: [
          {
            startsAt: { $lte: eventTo },
            endsAt: { $gte: eventFrom },
          },
          {
            startsAt: { $gte: eventFrom, $lte: eventTo },
            endsAt: null,
          },
        ],
      },
    ],
  })
    .sort({ startsAt: 1 })
    .lean();

  for (const ev of events) {
    const start = ev.startsAt ? new Date(ev.startsAt) : null;
    if (!start || Number.isNaN(start.getTime())) continue;
    const end = ev.endsAt ? new Date(ev.endsAt) : start;

    items.push({
      id: `event:${ev._id}`,
      source: 'event',
      kind: 'campus',
      title: ev.title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      color: COLORS.event,
      url: `/events/${ev._id}`,
      meta: {
        eventId: String(ev._id),
        location: ev.location || '',
        meetingUrl: ev.meetingUrl || '',
      },
    });
  }

  const personalItems = await getPersonalEventsForFeed(userId, from, to);
  items.push(...personalItems);

  items.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return items;
}

/**
 * @param {string} raw
 * @returns {Date | null}
 */
export function parseCalendarDateParam(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseDateKey(s);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
