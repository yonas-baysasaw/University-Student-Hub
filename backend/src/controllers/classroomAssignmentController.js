import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import User from '../models/User.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import {
  canManageClassroomContent,
  canSubmitAssignments,
  isChatMember,
  loadChatForClassroomRequest,
} from '../utils/classroomContentAuth.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

function getUploadedFile(req) {
  if (req.file) return req.file;
  if (Array.isArray(req.files) && req.files.length > 0) return req.files[0];
  if (req.files && typeof req.files === 'object') {
    const first = Object.values(req.files)[0];
    if (Array.isArray(first) && first.length > 0) return first[0];
  }
  return null;
}

function authorLabel(user) {
  return (
    user?.displayName?.trim() ||
    user?.name?.trim() ||
    user?.username?.trim() ||
    'Instructor'
  );
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
    const err = new Error('Only classroom admins can manage assignments');
    err.status = 403;
    throw err;
  }
}

function assertCanSubmit(chat, userId) {
  if (!canSubmitAssignments(chat, userId)) {
    const err = new Error('Only students in this class can submit assignments');
    err.status = 403;
    throw err;
  }
}

/** Last instant submissions are accepted. */
function submissionDeadline(assignment) {
  if (assignment.allowLateUntil) return assignment.allowLateUntil;
  return assignment.dueAt;
}

function isSubmissionWindowClosed(assignment, now = new Date()) {
  return now.getTime() > submissionDeadline(assignment).getTime();
}

async function deleteS3Key(key) {
  if (!key) return;
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: ENV.AWS_BUCKET_NAME,
        Key: key,
      }),
    );
  } catch (e) {
    console.warn(`S3 delete failed for ${key}:`, e?.message);
  }
}

function mapAssignmentRow(a, extras = {}) {
  const dueAt = a.dueAt ? new Date(a.dueAt).toISOString() : null;
  const allowLateUntil =
    a.allowLateUntil != null ? new Date(a.allowLateUntil).toISOString() : null;
  return {
    id: String(a._id),
    title: a.title,
    instructions: a.instructions,
    dueAt,
    allowLateUntil,
    points: a.points ?? 100,
    published: Boolean(a.published),
    starterFileName: a.fileName || '',
    starterFileUrl: a.fileUrl || '',
    authorName: a.authorName || '',
    createdAt: a.createdAt
      ? new Date(a.createdAt).toISOString()
      : new Date().toISOString(),
    ...extras,
  };
}

function mapSubmissionLean(doc, studentDisplay = '') {
  const files = Array.isArray(doc.files) ? doc.files : [];
  const primary = files[0] || {};
  return {
    id: String(doc._id),
    assignmentId: String(doc.assignment),
    studentId: String(doc.student),
    studentDisplay,
    note: doc.note || '',
    status: doc.status || 'submitted',
    score: doc.score != null ? doc.score : null,
    feedback: doc.feedback || '',
    gradedAt: doc.gradedAt
      ? new Date(doc.gradedAt).toISOString()
      : null,
    submittedAt: doc.submittedAt
      ? new Date(doc.submittedAt).toISOString()
      : doc.createdAt
        ? new Date(doc.createdAt).toISOString()
        : null,
    isLate: Boolean(doc.isLate),
    fileUrl: primary.fileUrl || '',
    fileName: primary.fileName || '',
  };
}

export const listAssignments = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);

  const canManage = canManageClassroomContent(chat, req.user._id);
  const submitter = canSubmitAssignments(chat, req.user._id);

  const filter = canManage
    ? { chat: chatId }
    : { chat: chatId, published: true };

  const rows = await Assignment.find(filter).sort({ dueAt: 1 }).lean();
  const ids = rows.map((r) => r._id);

  let mineByAssignment = new Map();
  if (submitter && ids.length) {
    const mine = await AssignmentSubmission.find({
      assignment: { $in: ids },
      student: req.user._id,
    }).lean();
    mineByAssignment = new Map(mine.map((m) => [String(m.assignment), m]));
  }

  const now = new Date();

  const assignments = rows.map((a) => {
    const due = a.dueAt ? new Date(a.dueAt) : now;
    const closed = isSubmissionWindowClosed(a, now);
    const isOverdue = now.getTime() > due.getTime();
    const mySub = mineByAssignment.get(String(a._id));

    let submissionSummary = null;
    if (mySub) {
      submissionSummary = {
        status: mySub.status,
        submittedAt: mySub.submittedAt
          ? new Date(mySub.submittedAt).toISOString()
          : null,
        score: mySub.score != null ? mySub.score : null,
        feedback: mySub.feedback || '',
        isLate: Boolean(mySub.isLate),
      };
    }

    const canSubmitHere =
      submitter &&
      a.published &&
      !closed &&
      (!mySub || mySub.status !== 'graded');

    return mapAssignmentRow(a, {
      isOverdue,
      acceptsLate: Boolean(a.allowLateUntil),
      isSubmissionClosed: closed,
      canSubmit: Boolean(canSubmitHere),
      mySubmission: submissionSummary,
    });
  });

  return res.json({
    assignments,
    canManage,
    canSubmitAssignments: submitter,
  });
});

export const createAssignment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  const title =
    typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const instructions =
    typeof req.body?.instructions === 'string'
      ? req.body.instructions.trim()
      : '';
  const dueRaw = req.body?.dueAt;
  const dueAt = dueRaw ? new Date(dueRaw) : null;

  let allowLateUntil = null;
  const lateRaw = req.body?.allowLateUntil;
  if (lateRaw != null && String(lateRaw).trim() !== '') {
    allowLateUntil = new Date(lateRaw);
    if (Number.isNaN(allowLateUntil.getTime())) {
      return res.status(400).json({ message: 'Invalid allowLateUntil' });
    }
  }

  let points = 100;
  if (req.body?.points != null && req.body.points !== '') {
    points = Number(req.body.points);
    if (!Number.isFinite(points) || points < 0 || points > 10000) {
      return res.status(400).json({ message: 'Invalid points (0–10000)' });
    }
  }

  let published = true;
  if (req.body?.published === false || req.body?.published === 'false') {
    published = false;
  }

  if (!title || !instructions || !dueAt || Number.isNaN(dueAt.getTime())) {
    return res
      .status(400)
      .json({ message: 'title, instructions, and dueAt are required' });
  }

  if (
    allowLateUntil &&
    allowLateUntil.getTime() <= dueAt.getTime()
  ) {
    return res.status(400).json({
      message: 'Late cutoff must be after the due date',
    });
  }

  let fileKey = '';
  let fileUrl = '';
  let fileName = '';
  let fileMimeType = '';

  const file = getUploadedFile(req);
  if (file) {
    const dir = `${req.user._id}/classroom-assignments/${chatId}`;
    const up = await uploadFileToS3(file, dir);
    fileKey = up.key;
    fileUrl = up.location;
    fileName = file.originalname || 'file';
    fileMimeType = file.mimetype || '';
  }

  const created = await Assignment.create({
    chat: chatId,
    title,
    instructions,
    dueAt,
    allowLateUntil,
    points,
    published,
    fileKey,
    fileUrl,
    fileName,
    fileMimeType,
    createdBy: req.user._id,
    authorName: authorLabel(req.user),
  });

  const now = new Date();
  return res.status(201).json({
    assignment: mapAssignmentRow(created, {
      isOverdue: now.getTime() > dueAt.getTime(),
      acceptsLate: Boolean(allowLateUntil),
      isSubmissionClosed: isSubmissionWindowClosed(created, now),
      canSubmit: false,
      mySubmission: null,
    }),
  });
});

export const patchAssignment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, assignmentId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({ message: 'Invalid assignment id' });
  }

  const doc = await Assignment.findOne({ _id: assignmentId, chat: chatId });
  if (!doc) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const b = req.body || {};
  if (typeof b.title === 'string') doc.title = b.title.trim();
  if (typeof b.instructions === 'string') {
    doc.instructions = b.instructions.trim();
  }
  if (b.dueAt != null) {
    const d = new Date(b.dueAt);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ message: 'Invalid dueAt' });
    }
    doc.dueAt = d;
  }
  if (b.allowLateUntil !== undefined) {
    if (b.allowLateUntil == null || String(b.allowLateUntil).trim() === '') {
      doc.allowLateUntil = null;
    } else {
      const l = new Date(b.allowLateUntil);
      if (Number.isNaN(l.getTime())) {
        return res.status(400).json({ message: 'Invalid allowLateUntil' });
      }
      doc.allowLateUntil = l;
    }
  }
  if (b.points != null && b.points !== '') {
    const p = Number(b.points);
    if (!Number.isFinite(p) || p < 0 || p > 10000) {
      return res.status(400).json({ message: 'Invalid points' });
    }
    doc.points = p;
  }
  if (typeof b.published === 'boolean') doc.published = b.published;

  await doc.save();

  const now = new Date();
  return res.json({
    assignment: mapAssignmentRow(doc, {
      isOverdue: doc.dueAt && now.getTime() > doc.dueAt.getTime(),
      acceptsLate: Boolean(doc.allowLateUntil),
      isSubmissionClosed: isSubmissionWindowClosed(doc, now),
      canSubmit: false,
      mySubmission: null,
    }),
  });
});

export const deleteAssignment = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, assignmentId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({ message: 'Invalid assignment id' });
  }

  const doc = await Assignment.findOne({ _id: assignmentId, chat: chatId });
  if (!doc) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const submissions = await AssignmentSubmission.find({
    assignment: assignmentId,
  }).lean();

  for (const sub of submissions) {
    for (const f of sub.files || []) {
      await deleteS3Key(f.fileKey);
    }
  }
  await AssignmentSubmission.deleteMany({ assignment: assignmentId });

  if (doc.fileKey) await deleteS3Key(doc.fileKey);
  await doc.deleteOne();

  return res.json({ message: 'Deleted' });
});

export const upsertSubmission = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, assignmentId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanSubmit(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({ message: 'Invalid assignment id' });
  }

  const assignment = await Assignment.findOne({
    _id: assignmentId,
    chat: chatId,
    published: true,
  });
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const now = new Date();
  if (isSubmissionWindowClosed(assignment, now)) {
    return res.status(403).json({ message: 'Submissions are closed' });
  }

  const file = getUploadedFile(req);
  if (!file) {
    return res.status(400).json({ message: 'A file is required' });
  }

  const note =
    typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 4000) : '';

  const dir = `${req.user._id}/assignment-submissions/${chatId}/${assignmentId}`;
  const up = await uploadFileToS3(file, dir);
  const filePart = {
    fileKey: up.key,
    fileUrl: up.location,
    fileName: file.originalname || 'submission',
    fileMimeType: file.mimetype || '',
  };

  const dueAt = assignment.dueAt ? new Date(assignment.dueAt) : now;
  const isLate = now.getTime() > dueAt.getTime();

  let doc = await AssignmentSubmission.findOne({
    assignment: assignmentId,
    student: req.user._id,
  });

  let createdNew = false;

  if (doc) {
    if (doc.status === 'graded') {
      return res.status(403).json({
        message: 'This submission has been graded; contact your instructor.',
      });
    }
    for (const f of doc.files || []) {
      await deleteS3Key(f.fileKey);
    }
    doc.files = [filePart];
    doc.note = note;
    doc.submittedAt = now;
    doc.isLate = isLate;
    doc.status = 'submitted';
    await doc.save();
  } else {
    doc = await AssignmentSubmission.create({
      assignment: assignmentId,
      chat: chatId,
      student: req.user._id,
      note,
      files: [filePart],
      submittedAt: now,
      isLate,
      status: 'submitted',
    });
    createdNew = true;
  }

  const studentDisplay = authorLabel(req.user);
  return res.status(createdNew ? 201 : 200).json({
    submission: mapSubmissionLean(doc.toObject(), studentDisplay),
  });
});

export const getMySubmission = asyncHandler(async (req, res) => {
  const { chatId, assignmentId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanSubmit(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({ message: 'Invalid assignment id' });
  }

  const doc = await AssignmentSubmission.findOne({
    assignment: assignmentId,
    chat: chatId,
    student: req.user._id,
  }).lean();

  if (!doc) {
    return res.status(404).json({ message: 'No submission yet' });
  }

  const studentDisplay = authorLabel(req.user);
  return res.json({ submission: mapSubmissionLean(doc, studentDisplay) });
});

export const listSubmissionsForAssignment = asyncHandler(async (req, res) => {
  const { chatId, assignmentId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    return res.status(400).json({ message: 'Invalid assignment id' });
  }

  const assignment = await Assignment.findOne({
    _id: assignmentId,
    chat: chatId,
  }).lean();
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const rows = await AssignmentSubmission.find({ assignment: assignmentId })
    .sort({ submittedAt: -1 })
    .lean();

  const userIds = [...new Set(rows.map((r) => String(r.student)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select('username name email')
    .lean();
  const nameById = new Map(
    users.map((u) => [
      String(u._id),
      u.username?.trim() || u.name?.trim() || u.email?.split('@')[0] || 'Student',
    ]),
  );

  const submissions = rows.map((r) =>
    mapSubmissionLean(r, nameById.get(String(r.student)) || 'Student'),
  );

  return res.json({
    submissions,
    assignment: {
      id: String(assignment._id),
      title: assignment.title,
      points: assignment.points ?? 100,
    },
  });
});

export const patchSubmissionGrade = asyncHandler(async (req, res) => {
  assertCanWrite(req.user);
  const { chatId, assignmentId, submissionId } = req.params;
  const chat = await loadChatForClassroomRequest(chatId, res);
  if (!chat) return;
  assertMember(chat, req.user._id);
  assertCanManage(chat, req.user._id);

  if (
    !mongoose.Types.ObjectId.isValid(assignmentId) ||
    !mongoose.Types.ObjectId.isValid(submissionId)
  ) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  const doc = await AssignmentSubmission.findOne({
    _id: submissionId,
    assignment: assignmentId,
    chat: chatId,
  });
  if (!doc) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  const b = req.body || {};
  if (b.score != null && b.score !== '') {
    const s = Number(b.score);
    if (!Number.isFinite(s) || s < 0) {
      return res.status(400).json({ message: 'Invalid score' });
    }
    doc.score = s;
  }
  if (typeof b.feedback === 'string') {
    doc.feedback = b.feedback.trim().slice(0, 8000);
  }
  if (typeof b.status === 'string') {
    const st = b.status.trim();
    if (['submitted', 'graded', 'returned'].includes(st)) {
      doc.status = st;
    }
  }

  doc.gradedBy = req.user._id;
  doc.gradedAt = new Date();
  if (!doc.status || doc.status === 'submitted') doc.status = 'graded';

  await doc.save();

  const stu = await User.findById(doc.student)
    .select('username name email')
    .lean();
  const studentDisplay =
    stu?.username?.trim() ||
    stu?.name?.trim() ||
    stu?.email?.split('@')[0] ||
    'Student';

  return res.json({
    submission: mapSubmissionLean(doc.toObject(), studentDisplay),
  });
});
