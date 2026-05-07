import mongoose from 'mongoose';
import Book from '../models/Books.js';
import Event from '../models/Event.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { getReasonLabel, isValidReasonCode } from '../constants/reportReasons.js';

const TARGET_TYPES_SUBMITTABLE = ['book', 'event', 'user'];

export async function assertTargetExists(targetType, targetId) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    const err = new Error('Invalid target id');
    err.status = 400;
    throw err;
  }

  if (targetType === 'book') {
    const doc = await Book.findById(targetId).select('_id').lean();
    if (!doc) {
      const err = new Error('Book not found');
      err.status = 404;
      throw err;
    }
    return;
  }

  if (targetType === 'event') {
    const doc = await Event.findById(targetId).select('_id').lean();
    if (!doc) {
      const err = new Error('Event not found');
      err.status = 404;
      throw err;
    }
    return;
  }

  if (targetType === 'user') {
    const doc = await User.findById(targetId).select('_id status').lean();
    if (!doc || doc.status === 'deleted') {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    return;
  }

  const err = new Error('Unsupported report target');
  err.status = 400;
  throw err;
}

/**
 * @param {{ userId: import('mongoose').Types.ObjectId, targetType: string, targetId: string, reasonCode: string, description?: string }}
 */
export async function createReport({ userId, targetType, targetId, reasonCode, description }) {
  if (!TARGET_TYPES_SUBMITTABLE.includes(targetType)) {
    const err = new Error('Invalid target type');
    err.status = 400;
    throw err;
  }

  if (String(userId) === String(targetId) && targetType === 'user') {
    const err = new Error('You cannot report yourself');
    err.status = 400;
    throw err;
  }

  if (!isValidReasonCode(targetType, reasonCode)) {
    const err = new Error('Invalid reason for this report type');
    err.status = 400;
    throw err;
  }

  const desc =
    typeof description === 'string' ? description.trim().slice(0, 500) : '';

  await assertTargetExists(targetType, targetId);

  const activeDuplicate = await Report.findOne({
    reporter: userId,
    targetType,
    targetId: String(targetId),
    status: { $in: ['pending', 'reviewed', 'open', 'reviewing'] },
  })
    .select('_id')
    .lean();

  if (activeDuplicate) {
    const err = new Error(
      'You already have an open report for this item. Admins will review it soon.',
    );
    err.status = 409;
    throw err;
  }

  const reasonLabel = getReasonLabel(targetType, reasonCode);

  const doc = await Report.create({
    reporter: userId,
    targetType,
    targetId: String(targetId),
    reasonCode,
    reasonLabel,
    description: desc,
    reason: `${reasonLabel}${desc ? `: ${desc}` : ''}`.slice(0, 1000),
    status: 'pending',
  });

  return doc;
}

export async function loadTargetSummary(targetType, targetId) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) return null;

  if (targetType === 'book') {
    const b = await Book.findById(targetId)
      .select('title visibility userId')
      .populate('userId', 'username name')
      .lean();
    if (!b) return { missing: true };
    return {
      title: b.title,
      visibility: b.visibility,
      creatorName: b.userId?.name || b.userId?.username || '',
    };
  }

  if (targetType === 'event') {
    const e = await Event.findById(targetId)
      .select('title visibility startsAt userId')
      .populate('userId', 'username name')
      .lean();
    if (!e) return { missing: true };
    return {
      title: e.title,
      visibility: e.visibility,
      startsAt: e.startsAt,
      creatorName: e.userId?.name || e.userId?.username || '',
    };
  }

  if (targetType === 'user') {
    const u = await User.findById(targetId)
      .select('username name email status accountType')
      .lean();
    if (!u || u.status === 'deleted') return { missing: true };
    return {
      username: u.username,
      name: u.name,
      email: u.email,
      accountType: u.accountType,
      status: u.status,
    };
  }

  return null;
}
