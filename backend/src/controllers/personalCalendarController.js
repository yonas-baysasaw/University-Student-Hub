import asyncHandler from '../middlewares/asyncHandler.js';
import PersonalCalendarEvent from '../models/PersonalCalendarEvent.js';
import { personalEventToJson } from '../services/personalCalendarService.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';
import { notifyUserCalendarInvalidate } from '../utils/calendarNotify.js';

function parseDate(value, label) {
  if (value == null || value === '') return { error: `${label} is required` };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: `Invalid ${label}` };
  return { value: d };
}

function parseOptionalDate(value, label) {
  if (value == null || value === '') return { value: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: `Invalid ${label}` };
  return { value: d };
}

function parseBody(req) {
  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return { error: 'title is required' };

  const startParsed = parseDate(req.body?.startsAt, 'startsAt');
  if (startParsed.error) return { error: startParsed.error };

  let endParsed = parseOptionalDate(req.body?.endsAt, 'endsAt');
  if (endParsed.error) return { error: endParsed.error };
  if (!endParsed.value) {
    endParsed = {
      value: new Date(startParsed.value.getTime() + 60 * 60 * 1000),
    };
  }
  if (endParsed.value < startParsed.value) {
    return { error: 'endsAt must be after startsAt' };
  }

  const recurrenceRaw = String(req.body?.recurrence ?? 'none');
  const recurrence = ['none', 'daily', 'weekly', 'weekdays'].includes(
    recurrenceRaw,
  )
    ? recurrenceRaw
    : 'none';

  const untilParsed = parseOptionalDate(
    req.body?.recurrenceUntil,
    'recurrenceUntil',
  );
  if (untilParsed.error) return { error: untilParsed.error };

  let reminderMinutesBefore = null;
  if (
    req.body?.reminderMinutesBefore != null &&
    req.body?.reminderMinutesBefore !== ''
  ) {
    const n = Number(req.body.reminderMinutesBefore);
    if (!Number.isFinite(n) || n < 0 || n > 10_080) {
      return { error: 'reminderMinutesBefore must be 0–10080' };
    }
    reminderMinutesBefore = Math.floor(n);
  }

  const color =
    typeof req.body?.color === 'string' && req.body.color.trim()
      ? req.body.color.trim().slice(0, 20)
      : '#7c3aed';

  return {
    data: {
      title,
      description:
        typeof req.body?.description === 'string'
          ? req.body.description.slice(0, 5000)
          : '',
      startsAt: startParsed.value,
      endsAt: endParsed.value,
      allDay: Boolean(req.body?.allDay),
      location:
        typeof req.body?.location === 'string'
          ? req.body.location.trim().slice(0, 300)
          : '',
      meetingUrl:
        typeof req.body?.meetingUrl === 'string'
          ? req.body.meetingUrl.trim().slice(0, 2000)
          : '',
      recurrence,
      recurrenceUntil: untilParsed.value,
      reminderMinutesBefore,
      color,
    },
  };
}

export const createPersonalEvent = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const parsed = parseBody(req);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  const created = await PersonalCalendarEvent.create({
    userId: req.user._id,
    ...parsed.data,
  });

  notifyUserCalendarInvalidate(req.user._id);

  res.status(201).json({ event: personalEventToJson(created) });
});

export const updatePersonalEvent = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const doc = await PersonalCalendarEvent.findOne({
    _id: eventId,
    userId: req.user._id,
  });
  if (!doc) {
    return res.status(404).json({ message: 'Personal event not found' });
  }

  const parsed = parseBody(req);
  if (parsed.error) {
    return res.status(400).json({ message: parsed.error });
  }

  Object.assign(doc, parsed.data);
  await doc.save();

  notifyUserCalendarInvalidate(req.user._id);

  res.json({ event: personalEventToJson(doc) });
});

export const deletePersonalEvent = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const doc = await PersonalCalendarEvent.findOne({
    _id: eventId,
    userId: req.user._id,
  });
  if (!doc) {
    return res.status(404).json({ message: 'Personal event not found' });
  }

  await doc.deleteOne();
  notifyUserCalendarInvalidate(req.user._id);

  res.json({ message: 'Deleted' });
});

export const getPersonalEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const doc = await PersonalCalendarEvent.findOne({
    _id: eventId,
    userId: req.user._id,
  }).lean();
  if (!doc) {
    return res.status(404).json({ message: 'Personal event not found' });
  }
  res.json({ event: personalEventToJson(doc) });
});
