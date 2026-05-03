import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import { ENV } from '../config/env.js';
import Event from '../models/Event.js';
import EventComment from '../models/EventComment.js';
import EventReview from '../models/EventReview.js';
import User from '../models/User.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

export const MAX_EVENT_MEDIA = 12;

export function eventFiniteCapacity(event) {
  const c = event?.capacity;
  if (c == null || !Number.isFinite(Number(c)) || Number(c) <= 0) return null;
  return Math.floor(Number(c));
}

/** Length of reserved list (works with populated or id-only entries). */
function reservedCountFromEvent(event) {
  const raw = Array.isArray(event.reservedBy) ? event.reservedBy : [];
  return raw.length;
}

function reservedIdList(event) {
  const raw = Array.isArray(event.reservedBy) ? event.reservedBy : [];
  return raw.map((x) =>
    typeof x === 'object' && x != null && x._id != null
      ? String(x._id)
      : String(x),
  );
}

function organizerIdFromEvent(event) {
  const u = event?.userId;
  if (u && typeof u === 'object' && u._id != null) return String(u._id);
  if (u) return String(u);
  return null;
}

/**
 * Public JSON for an event. Attendee roster only when viewer is organizer.
 */
export function toEventResponse(event, req) {
  const viewerId = req.user?._id ? String(req.user._id) : null;
  const likedBy = Array.isArray(event.likedBy) ? event.likedBy : [];
  const dislikedBy = Array.isArray(event.dislikedBy) ? event.dislikedBy : [];
  const reservedRaw = Array.isArray(event.reservedBy) ? event.reservedBy : [];
  const reservedIds = reservedIdList(event);

  const rest = { ...event };
  delete rest.likedBy;
  delete rest.dislikedBy;
  delete rest.reservedBy;
  delete rest.userId;

  const orgSource =
    event?.userId && typeof event.userId === 'object' ? event.userId : null;
  const organizer = orgSource
    ? {
        id: orgSource._id ? String(orgSource._id) : null,
        name: orgSource.name || orgSource.username || 'Organizer',
        username: orgSource.username || '',
        avatar: orgSource.avatar || '',
      }
    : null;

  const organizerId = organizerIdFromEvent(event);
  const isOrganizer = Boolean(
    viewerId && organizerId && viewerId === organizerId,
  );

  const rawCap = event.capacity;
  const capacity =
    rawCap != null &&
    Number.isFinite(Number(rawCap)) &&
    Number(rawCap) > 0
      ? Math.floor(Number(rawCap))
      : null;

  const mediaUrls = Array.isArray(event.mediaUrls)
    ? event.mediaUrls.filter((u) => typeof u === 'string' && u.trim())
    : [];

  const out = {
    ...rest,
    mediaUrls,
    organizer,
    reservedCount: reservedIds.length,
    capacity,
    likesCount: Number.isFinite(event.likesCount)
      ? event.likesCount
      : likedBy.length,
    dislikesCount: Number.isFinite(event.dislikesCount)
      ? event.dislikesCount
      : dislikedBy.length,
    viewerState: {
      liked: viewerId ? likedBy.some((id) => String(id) === viewerId) : false,
      disliked: viewerId
        ? dislikedBy.some((id) => String(id) === viewerId)
        : false,
      reserved: viewerId ? reservedIds.includes(viewerId) : false,
    },
  };

  if (isOrganizer) {
    const attendees = reservedRaw
      .map((entry) => {
        if (entry && typeof entry === 'object' && entry._id != null) {
          return {
            id: String(entry._id),
            name: entry.name || entry.username || 'User',
            username: entry.username || '',
            avatar: entry.avatar || '',
          };
        }
        return null;
      })
      .filter(Boolean);
    out.attendees = attendees;
  }

  return out;
}

export const listEvents = asyncHandler(async (req, res) => {
  const viewerId = req.user?._id ? String(req.user._id) : null;
  const docs = await Event.find({})
    .sort({ startsAt: 1 })
    .populate('userId', 'username name avatar')
    .lean();

  const organizerReservedIds = [];
  for (const e of docs) {
    const oid = e.userId?._id ? String(e.userId._id) : String(e.userId);
    if (
      viewerId &&
      oid === viewerId &&
      Array.isArray(e.reservedBy) &&
      e.reservedBy.length
    ) {
      for (const rid of e.reservedBy) {
        organizerReservedIds.push(String(rid));
      }
    }
  }
  const uniqueReserved = [...new Set(organizerReservedIds)];

  let idToUser = {};
  if (uniqueReserved.length > 0) {
    const users = await User.find({ _id: { $in: uniqueReserved } })
      .select('username name avatar')
      .lean();
    idToUser = Object.fromEntries(users.map((u) => [String(u._id), u]));
  }

  const data = docs.map((e) => {
    const oid = e.userId?._id ? String(e.userId._id) : String(e.userId);
    let enriched = e;
    if (
      viewerId &&
      oid === viewerId &&
      Array.isArray(e.reservedBy) &&
      e.reservedBy.length
    ) {
      enriched = {
        ...e,
        reservedBy: e.reservedBy
          .map((rid) => idToUser[String(rid)])
          .filter(Boolean),
      };
    }
    return toEventResponse(enriched, req);
  });

  res.status(200).json({ success: true, events: data });
});

export const getEventById = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!validId(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  const viewerId = req.user?._id ? String(req.user._id) : null;
  const stub = await Event.findById(eventId).select('userId').lean();
  if (!stub) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }
  const orgId = String(stub.userId);
  const isOrganizer = Boolean(viewerId && orgId === viewerId);

  let q = Event.findById(eventId).populate(
    'userId',
    'username name avatar',
  );
  if (isOrganizer) {
    q = q.populate('reservedBy', 'username name avatar');
  }
  const doc = await q.lean();
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  res.status(200).json({
    success: true,
    data: toEventResponse(doc, req),
  });
});

export const createEvent = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const {
    title,
    description,
    startsAt,
    endsAt,
    location,
    meetingUrl,
    capacity,
  } = req.body ?? {};

  const t = typeof title === 'string' ? title.trim() : '';
  if (!t) {
    return res.status(400).json({ message: 'Title is required.' });
  }

  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return res.status(400).json({ message: 'Valid start time is required.' });
  }

  let end = null;
  if (endsAt) {
    end = new Date(endsAt);
    if (Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid end time.' });
    }
  }

  let cap = null;
  if (
    capacity !== undefined &&
    capacity !== null &&
    String(capacity).trim() !== ''
  ) {
    const n = Number(capacity);
    if (!Number.isFinite(n) || n < 0) {
      return res
        .status(400)
        .json({ message: 'Capacity must be a non-negative number.' });
    }
    cap = n === 0 ? null : Math.floor(n);
  }

  const event = await Event.create({
    userId: req.user._id,
    title: t,
    description:
      typeof description === 'string' ? description.slice(0, 5000) : '',
    startsAt: start,
    endsAt: end,
    location:
      typeof location === 'string' ? location.trim().slice(0, 300) : '',
    meetingUrl:
      typeof meetingUrl === 'string' ? meetingUrl.trim().slice(0, 2000) : '',
    capacity: cap,
    mediaUrls: [],
  });
  await event.populate('userId', 'username name avatar');
  res.status(201).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});

export const deleteEvent = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  if (!validId(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }
  const ev = await Event.findById(eventId);
  if (!ev) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }
  if (String(ev.userId) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You can only delete your own events.' });
  }
  const bid = ev._id;
  await Promise.all([
    EventReview.deleteMany({ eventId: bid }),
    EventComment.deleteMany({ eventId: bid }),
  ]);
  await ev.deleteOne();
  res.status(200).json({ success: true, message: 'Event deleted' });
});

export const reactToEvent = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const { reaction } = req.body ?? {};

  if (!validId(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  if (!['like', 'dislike', null, 'none'].includes(reaction)) {
    return res.status(400).json({
      success: false,
      message: 'reaction must be like, dislike, or none',
    });
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const userId = String(req.user._id);
  event.likedBy = (event.likedBy || []).filter((id) => String(id) !== userId);
  event.dislikedBy = (event.dislikedBy || []).filter(
    (id) => String(id) !== userId,
  );

  if (reaction === 'like') {
    event.likedBy.push(req.user._id);
  } else if (reaction === 'dislike') {
    event.dislikedBy.push(req.user._id);
  }

  event.likesCount = event.likedBy.length;
  event.dislikesCount = event.dislikedBy.length;
  await event.save();
  await event.populate('userId', 'username name avatar');
  const orgAfter = organizerIdFromEvent(event);
  if (orgAfter && orgAfter === String(req.user._id)) {
    await event.populate('reservedBy', 'username name avatar');
  }

  res.status(200).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});

export const reserveEventSeat = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  if (!validId(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found' });
  }

  const uid = String(req.user._id);
  const list = event.reservedBy || [];
  const idx = list.map(String).indexOf(uid);
  const cap = eventFiniteCapacity(event);

  if (idx >= 0) {
    event.reservedBy = (event.reservedBy || []).filter(
      (id) => String(id) !== uid,
    );
  } else if (cap != null && list.length >= cap) {
    return res.status(409).json({
      success: false,
      message: 'This event is at full capacity.',
    });
  } else {
    if (!event.reservedBy) event.reservedBy = [];
    event.reservedBy.push(req.user._id);
  }

  await event.save();
  await event.populate('userId', 'username name avatar');
  const orgAfter = organizerIdFromEvent(event);
  if (orgAfter && orgAfter === String(req.user._id)) {
    await event.populate('reservedBy', 'username name avatar');
  }

  res.status(200).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});

async function loadEventAsOrganizer(eventId, userId) {
  if (!validId(eventId)) return { error: { status: 400, message: 'Invalid event id' } };
  const event = await Event.findById(eventId);
  if (!event) return { error: { status: 404, message: 'Event not found' } };
  if (String(event.userId) !== String(userId)) {
    return { error: { status: 403, message: 'Only the host can do this.' } };
  }
  return { event };
}

export const postEventMedia = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const { event, error } = await loadEventAsOrganizer(eventId, req.user._id);
  if (error) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  const file = Array.isArray(req.files) ? req.files[0] : req.file;
  if (!file?.buffer) {
    return res.status(400).json({ success: false, message: 'No image uploaded.' });
  }

  const urls = Array.isArray(event.mediaUrls) ? event.mediaUrls : [];
  if (urls.length >= MAX_EVENT_MEDIA) {
    return res.status(400).json({
      success: false,
      message: `At most ${MAX_EVENT_MEDIA} images per event.`,
    });
  }

  const dir = `${req.user._id}/Events/${eventId}`;
  const { location } = await uploadFileToS3(file, dir);
  event.mediaUrls = [...urls, location];
  await event.save();
  await event.populate('userId', 'username name avatar');

  res.status(201).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});

function s3UrlLooksOwnedByBucket(url) {
  if (!url || !ENV.AWS_BUCKET_NAME || !ENV.AWS_REGION) return true;
  const expected = `https://${ENV.AWS_BUCKET_NAME}.s3.${ENV.AWS_REGION}.amazonaws.com/`;
  return typeof url === 'string' && url.startsWith(expected);
}

export const deleteEventMedia = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

  const { event, error } = await loadEventAsOrganizer(eventId, req.user._id);
  if (error) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  if (!url) {
    return res.status(400).json({ success: false, message: 'url is required.' });
  }
  const urls = Array.isArray(event.mediaUrls) ? event.mediaUrls : [];
  if (!urls.includes(url)) {
    return res.status(404).json({ success: false, message: 'Image not on this event.' });
  }
  if (!s3UrlLooksOwnedByBucket(url)) {
    return res.status(400).json({ success: false, message: 'Invalid image URL.' });
  }

  event.mediaUrls = urls.filter((u) => u !== url);
  await event.save();
  await event.populate('userId', 'username name avatar');

  res.status(200).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});

export const addEventAttendee = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId } = req.params;
  const targetRaw = req.body?.userId ?? req.body?.userID;
  if (!validId(targetRaw)) {
    return res.status(400).json({ success: false, message: 'Valid userId required.' });
  }

  const { event, error } = await loadEventAsOrganizer(eventId, req.user._id);
  if (error) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  const targetUser = await User.findById(targetRaw).select('_id').lean();
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const tid = String(targetUser._id);
  const list = event.reservedBy || [];
  if (list.map(String).includes(tid)) {
    return res.status(409).json({
      success: false,
      message: 'That student is already on the guest list.',
    });
  }

  const cap = eventFiniteCapacity(event);
  if (cap != null && list.length >= cap) {
    return res.status(409).json({
      success: false,
      message: 'This event is at full capacity.',
    });
  }

  if (!event.reservedBy) event.reservedBy = [];
  event.reservedBy.push(targetUser._id);
  await event.save();
  await event.populate('userId', 'username name avatar');
  await event.populate('reservedBy', 'username name avatar');

  res.status(200).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});

export const removeEventAttendee = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { eventId, targetUserId } = req.params;
  if (!validId(eventId) || !validId(targetUserId)) {
    return res.status(400).json({ success: false, message: 'Invalid id' });
  }

  const { event, error } = await loadEventAsOrganizer(eventId, req.user._id);
  if (error) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  const before = (event.reservedBy || []).length;
  event.reservedBy = (event.reservedBy || []).filter(
    (id) => String(id) !== String(targetUserId),
  );
  if (event.reservedBy.length === before) {
    return res.status(404).json({
      success: false,
      message: 'That user is not on the guest list.',
    });
  }
  await event.save();
  await event.populate('userId', 'username name avatar');
  await event.populate('reservedBy', 'username name avatar');

  res.status(200).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});
