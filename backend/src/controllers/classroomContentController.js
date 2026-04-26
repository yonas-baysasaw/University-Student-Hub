import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import ClassroomResource from '../models/ClassroomResource.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import {
  canManageClassroomContent,
  isChatMember,
  loadChatForClassroomRequest,
} from '../utils/classroomContentAuth.js';

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

// ── Announcements ───────────────────────────────────────────────────────────

export const listAnnouncements = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);

  const rows = await ClassroomAnnouncement.find({ chat: chatId })
    .sort({ createdAt: -1 })
    .lean();

  const announcements = rows.map((a) => ({
    id: String(a._id),
    title: a.title,
    body: a.body,
    author: a.authorName || 'Instructor',
    createdAt: a.createdAt
      ? new Date(a.createdAt).toISOString()
      : new Date().toISOString(),
  }));
  const canManage = canManageClassroomContent(chat, req.user._id);
  return res.json({ announcements, canManage });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
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

  const created = await ClassroomAnnouncement.create({
    chat: chatId,
    title,
    body,
    createdBy: req.user._id,
    authorName: authorLabel(req.user),
  });

  return res.status(201).json({
    announcement: {
      id: String(created._id),
      title: created.title,
      body: created.body,
      author: created.authorName,
      createdAt: created.createdAt.toISOString(),
    },
  });
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
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
    createdAt: r.createdAt
      ? new Date(r.createdAt).toISOString()
      : new Date().toISOString(),
  }));
  const canManage = canManageClassroomContent(chat, req.user._id);
  return res.json({ resources, canManage });
});

export const createResource = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const link = typeof req.body?.link === 'string' ? req.body.link.trim() : '';
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
      createdAt: created.createdAt.toISOString(),
    },
  });
});

export const deleteResource = asyncHandler(async (req, res) => {
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
