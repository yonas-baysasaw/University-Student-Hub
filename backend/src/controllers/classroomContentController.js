import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import ClassroomResource from '../models/ClassroomResource.js';
import { notifyClassroomMembersOfAnnouncement } from '../services/announcementEmailService.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import {
  canManageClassroomContent,
  isChatMember,
  loadChatForClassroomRequest,
} from '../utils/classroomContentAuth.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

function authorLabel(user) {
  return (
    user?.displayName?.trim() ||
    user?.name?.trim() ||
    user?.username?.trim() ||
    'Instructor'
  );
}

function getUploadedFile(req) {
  if (req.file) return req.file;
  if (Array.isArray(req.files) && req.files.length > 0) return req.files[0];
  if (req.files && typeof req.files === 'object') {
    const first = Object.values(req.files)[0];
    if (Array.isArray(first) && first.length > 0) return first[0];
  }
  return null;
}

function assertMember(chat, userId) {
  if (!isChatMember(chat, userId)) {
    const err = new Error('You are not part of this classroom');
    err.status = 403;
    throw err;
  }
}

function assertCanManage(chat, userId) {
  if (!canManageClassroomContent(chat, userId)) {
    const err = new Error(
      'Only classroom admins can publish announcements or resources',
    );
    err.status = 403;
    throw err;
  }
}

const RESOURCE_CATEGORIES = new Set([
  'syllabus',
  'reading',
  'lecture',
  'lab',
  'reference',
  'other',
]);

function normalizeResourceCategory(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return RESOURCE_CATEGORIES.has(s) ? s : 'other';
}

function normalizeResourceDescription(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 2000);
}

function clampAnnouncementImportance(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(2, Math.max(0, Math.floor(n)));
}

const ANNOUNCEMENT_KINDS = new Set(['statement', 'assignment', 'exam']);

function clampAnnouncementKind(raw) {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return ANNOUNCEMENT_KINDS.has(s) ? s : 'statement';
}

function announcementToDto(a, now = Date.now()) {
  const kind = clampAnnouncementKind(a.kind);
  const importance =
    typeof a.importance === 'number' &&
    a.importance >= 0 &&
    a.importance <= 2
      ? a.importance
      : 0;
  let expiresAtIso = null;
  let isExpired = false;
  if (a.expiresAt) {
    const t = new Date(a.expiresAt).getTime();
    if (!Number.isNaN(t)) {
      expiresAtIso = new Date(a.expiresAt).toISOString();
      isExpired = t < now;
    }
  }
  return {
    id: String(a._id),
    title: a.title,
    body: a.body,
    author: a.authorName || 'Instructor',
    importance,
    kind,
    expiresAt: expiresAtIso,
    isExpired,
    createdAt: a.createdAt
      ? new Date(a.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

/**
 * Parse expiresAt from JSON body: undefined = omit field on create; null/'' = clear.
 * @returns {{ value?: Date | null, error?: string }}
 */
function coerceExpiresAtFromBody(raw) {
  if (raw === undefined) return {};
  if (raw === null || raw === '') return { value: null };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { error: 'Invalid expiresAt' };
  return { value: d };
}

// ── Announcements ───────────────────────────────────────────────────────────

export const listAnnouncements = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);

  const rows = await ClassroomAnnouncement.find({ chat: chatId })
    .sort({ importance: -1, createdAt: -1 })
    .lean();

  const now = Date.now();
  const announcements = rows.map((a) => announcementToDto(a, now));
  const canManage = canManageClassroomContent(chat, req.user._id);
  return res.json({ announcements, canManage });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!title || !body) {
    return res.status(400).json({ message: 'title and body are required' });
  }

  const importance = clampAnnouncementImportance(req.body?.importance);
  const kind = clampAnnouncementKind(req.body?.kind);

  const expCoerced = coerceExpiresAtFromBody(req.body?.expiresAt);
  if (expCoerced.error) {
    return res.status(400).json({ message: expCoerced.error });
  }

  const created = await ClassroomAnnouncement.create({
    chat: chatId,
    title,
    body,
    importance,
    kind,
    createdBy: req.user._id,
    authorName: authorLabel(req.user),
    ...(expCoerced.value !== undefined ? { expiresAt: expCoerced.value } : {}),
  });

  /** Email members only on create—not on PATCH edits (avoid notify spam). */
  void notifyClassroomMembersOfAnnouncement({
    classroomName: chat.name,
    chatId: String(chatId),
    authorUserId: req.user._id,
    memberIds: chat.members,
    announcement: {
      title: created.title,
      body: created.body,
      authorName: created.authorName,
      kind: created.kind,
      expiresAt: created.expiresAt
        ? new Date(created.expiresAt).toISOString()
        : null,
    },
  }).catch((err) => {
    console.error('[createAnnouncement] announcement email notify failed', err);
  });

  return res.status(201).json({
    announcement: announcementToDto(created),
  });
});

export const patchAnnouncement = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, announcementId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(announcementId)) {
    return res.status(400).json({ message: 'Invalid announcement id' });
  }

  const doc = await ClassroomAnnouncement.findOne({
    _id: announcementId,
    chat: chatId,
  });
  if (!doc) {
    return res.status(404).json({ message: 'Announcement not found' });
  }

  const b = req.body || {};
  if (b.title !== undefined) {
    const t = typeof b.title === 'string' ? b.title.trim() : '';
    if (!t) return res.status(400).json({ message: 'title cannot be empty' });
    doc.title = t;
  }
  if (b.body !== undefined) {
    const bd = typeof b.body === 'string' ? b.body.trim() : '';
    if (!bd) return res.status(400).json({ message: 'body cannot be empty' });
    doc.body = bd;
  }
  if (b.importance !== undefined) {
    doc.importance = clampAnnouncementImportance(b.importance);
  }
  if (b.kind !== undefined) {
    doc.kind = clampAnnouncementKind(b.kind);
  }
  if (b.expiresAt !== undefined) {
    const expCoerced = coerceExpiresAtFromBody(b.expiresAt);
    if (expCoerced.error) {
      return res.status(400).json({ message: expCoerced.error });
    }
    doc.expiresAt = expCoerced.value;
  }

  await doc.save();

  return res.json({
    announcement: announcementToDto(doc),
  });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, announcementId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(announcementId)) {
    return res.status(400).json({ message: 'Invalid announcement id' });
  }

  const ann = await ClassroomAnnouncement.findOne({
    _id: announcementId,
    chat: chatId,
  });
  if (!ann) {
    return res.status(404).json({ message: 'Announcement not found' });
  }

  await ann.deleteOne();
  return res.json({ message: 'Deleted' });
});

// ── Resources (optional link, optional S3 file; at least one) ────────────────

export const listResources = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);

  const rows = await ClassroomResource.find({ chat: chatId })
    .sort({ createdAt: -1 })
    .lean();

  const resources = rows.map((r) => ({
    id: String(r._id),
    title: r.title,
    link: r.link || '',
    fileName: r.fileName || '',
    fileUrl: r.fileUrl || '',
    author: r.authorName || 'Instructor',
    category: r.category || 'other',
    description: r.description || '',
    createdAt: r.createdAt
      ? new Date(r.createdAt).toISOString()
      : new Date().toISOString(),
  }));
  const canManage = canManageClassroomContent(chat, req.user._id);
  return res.json({ resources, canManage });
});

export const createResource = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const link = typeof req.body?.link === 'string' ? req.body.link.trim() : '';
  const category = normalizeResourceCategory(req.body?.category);
  const description = normalizeResourceDescription(req.body?.description);
  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }

  const file = getUploadedFile(req);
  if (!file && !link) {
    return res
      .status(400)
      .json({ message: 'Provide a resource link or upload a file' });
  }

  let fileKey = '';
  let fileUrl = '';
  let fileName = '';
  let fileMimeType = '';

  if (file) {
    const dir = `${req.user._id}/classroom-resources/${chatId}`;
    const up = await uploadFileToS3(file, dir);
    fileKey = up.key;
    fileUrl = up.location;
    fileName = file.originalname || 'file';
    fileMimeType = file.mimetype || '';
  }

  const created = await ClassroomResource.create({
    chat: chatId,
    title,
    link,
    category,
    description,
    fileKey,
    fileUrl,
    fileName,
    fileMimeType,
    createdBy: req.user._id,
    authorName: authorLabel(req.user),
  });

  return res.status(201).json({
    resource: {
      id: String(created._id),
      title: created.title,
      link: created.link,
      fileName: created.fileName,
      fileUrl: created.fileUrl,
      author: created.authorName,
      category: created.category || 'other',
      description: created.description || '',
      createdAt: created.createdAt.toISOString(),
    },
  });
});

export const deleteResource = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, resourceId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    return res.status(400).json({ message: 'Invalid resource id' });
  }

  const doc = await ClassroomResource.findOne({
    _id: resourceId,
    chat: chatId,
  });
  if (!doc) {
    return res.status(404).json({ message: 'Resource not found' });
  }

  if (doc.fileKey) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: ENV.AWS_BUCKET_NAME,
          Key: doc.fileKey,
        }),
      );
    } catch (s3Err) {
      console.warn(`S3 delete failed for ${doc.fileKey}:`, s3Err?.message);
    }
  }

  await doc.deleteOne();
  return res.json({ message: 'Deleted' });
});
