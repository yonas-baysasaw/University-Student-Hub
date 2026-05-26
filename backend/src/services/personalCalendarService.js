import PersonalCalendarEvent from '../models/PersonalCalendarEvent.js';

const COLORS = {
  personal: '#7c3aed',
};

const MAX_INSTANCES = 366;

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
 * @param {object} doc
 * @param {Date} start
 * @param {Date} end
 * @returns {object}
 */
function personalFeedItem(doc, start, end) {
  const id = String(doc._id);
  const startIso = start.toISOString();
  return {
    id: `personal:${id}:${startIso}`,
    source: 'personal',
    kind: 'personal',
    title: doc.title,
    start: startIso,
    end: end.toISOString(),
    allDay: Boolean(doc.allDay),
    color: doc.color || COLORS.personal,
    url: null,
    editable: true,
    meta: {
      personalId: id,
      description: doc.description || '',
      location: doc.location || '',
      meetingUrl: doc.meetingUrl || '',
      recurrence: doc.recurrence || 'none',
      recurrenceUntil: doc.recurrenceUntil
        ? new Date(doc.recurrenceUntil).toISOString()
        : null,
      reminderMinutesBefore:
        doc.reminderMinutesBefore != null
          ? Number(doc.reminderMinutesBefore)
          : null,
      instanceStart: startIso,
    },
  };
}

/**
 * @param {object} doc
 * @param {Date} from
 * @param {Date} to
 * @returns {object[]}
 */
export function expandPersonalEvent(doc, from, to) {
  const baseStart = new Date(doc.startsAt);
  const baseEnd = doc.endsAt
    ? new Date(doc.endsAt)
    : new Date(baseStart.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(baseStart.getTime())) return [];

  const durationMs = Math.max(baseEnd.getTime() - baseStart.getTime(), 0);
  const recurrence = doc.recurrence || 'none';

  if (recurrence === 'none') {
    const instEnd = new Date(baseStart.getTime() + durationMs);
    if (instEnd < from || baseStart > to) return [];
    return [personalFeedItem(doc, baseStart, instEnd)];
  }

  const recurUntil = doc.recurrenceUntil
    ? new Date(doc.recurrenceUntil)
    : to;
  recurUntil.setHours(23, 59, 59, 999);

  const items = [];
  let cur = new Date(baseStart);
  let guard = 0;

  while (cur <= recurUntil && cur <= to && guard < MAX_INSTANCES) {
    guard += 1;
    const instStart = new Date(cur);
    const instEnd = new Date(instStart.getTime() + durationMs);

    if (instEnd >= from && instStart <= to) {
      if (recurrence === 'weekdays') {
        const dow = instStart.getDay();
        if (dow !== 0 && dow !== 6) {
          items.push(personalFeedItem(doc, instStart, instEnd));
        }
      } else {
        items.push(personalFeedItem(doc, instStart, instEnd));
      }
    }

    if (recurrence === 'daily') {
      cur.setDate(cur.getDate() + 1);
    } else if (recurrence === 'weekly') {
      cur.setDate(cur.getDate() + 7);
    } else if (recurrence === 'weekdays') {
      cur.setDate(cur.getDate() + 1);
    } else {
      break;
    }
  }

  return items;
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {Date} from
 * @param {Date} to
 */
export async function getPersonalEventsForFeed(userId, from, to) {
  const docs = await PersonalCalendarEvent.find({ userId })
    .sort({ startsAt: 1 })
    .lean();

  const items = [];
  for (const doc of docs) {
    items.push(...expandPersonalEvent(doc, from, to));
  }
  return items;
}

/**
 * @param {object} doc
 */
export function personalEventToJson(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description || '',
    startsAt: doc.startsAt ? new Date(doc.startsAt).toISOString() : null,
    endsAt: doc.endsAt ? new Date(doc.endsAt).toISOString() : null,
    allDay: Boolean(doc.allDay),
    location: doc.location || '',
    meetingUrl: doc.meetingUrl || '',
    recurrence: doc.recurrence || 'none',
    recurrenceUntil: doc.recurrenceUntil
      ? new Date(doc.recurrenceUntil).toISOString()
      : null,
    reminderMinutesBefore:
      doc.reminderMinutesBefore != null
        ? Number(doc.reminderMinutesBefore)
        : null,
    color: doc.color || COLORS.personal,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
