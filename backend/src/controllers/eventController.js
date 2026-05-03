import mongoose from 'mongoose';
import asyncHandler from '../middlewares/asyncHandler.js';
import Event from '../models/Event.js';
import EventComment from '../models/EventComment.js';
import EventReview from '../models/EventReview.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

export function toEventResponse(event, req) {
  const viewerId = req.user?._id ? String(req.user._id) : null;
  const likedBy = Array.isArray(event.likedBy) ? event.likedBy : [];
  const dislikedBy = Array.isArray(event.dislikedBy) ? event.dislikedBy : [];
  const reservedBy = Array.isArray(event.reservedBy) ? event.reservedBy : [];

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

  const rawCap = event.capacity;
  const capacity =
    rawCap != null &&
    Number.isFinite(Number(rawCap)) &&
    Number(rawCap) > 0
      ? Math.floor(Number(rawCap))
      : null;

  return {
    ...rest,
    organizer,
    reservedCount: reservedBy.length,
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
      reserved: viewerId
        ? reservedBy.some((id) => String(id) === viewerId)
        : false,
    },
  };
}

export const listEvents = asyncHandler(async (req, res) => {
  const docs = await Event.find({})
    .sort({ startsAt: 1 })
    .populate('userId', 'username name avatar')
    .lean();

  const data = docs.map((e) => toEventResponse(e, req));
  res.status(200).json({ success: true, events: data });
});

export const getEventById = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!validId(eventId)) {
    return res.status(400).json({ success: false, message: 'Invalid event id' });
  }
  const doc = await Event.findById(eventId)
    .populate('userId', 'username name avatar')
    .lean();
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
  const cap =
    event.capacity != null &&
    Number.isFinite(Number(event.capacity)) &&
    Number(event.capacity) > 0
      ? Math.floor(Number(event.capacity))
      : null;

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

  res.status(200).json({
    success: true,
    data: toEventResponse(event.toObject(), req),
  });
});
