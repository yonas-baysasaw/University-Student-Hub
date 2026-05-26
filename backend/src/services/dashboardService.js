import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getClassroomCountForUser(userId) {
  return Chat.countDocuments({
    members: userId,
    'metadata.archived': { $ne: true },
  });
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

function normalizeDueTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/^(due|assignment|exam)\s*[:-]\s*/i, '')
    .replace(/\s+/g, ' ');
}

function submissionDeadline(assignment) {
  if (assignment.allowLateUntil) return new Date(assignment.allowLateUntil);
  return new Date(assignment.dueAt);
}

function mapSubmissionStatus(submission, isOverdue) {
  if (submission?.status === 'graded') return 'graded';
  if (submission) return 'submitted';
  if (isOverdue) return 'overdue';
  return 'not_submitted';
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {number} limit
 */
export async function getRecentAnnouncementsForUser(userId, limit) {
  const chats = await Chat.find({
    members: userId,
    'metadata.archived': { $ne: true },
  })
    .select('_id name')
    .lean();
  const ids = chats.map((c) => c._id);
  if (ids.length === 0) return [];

  const nameById = new Map(chats.map((c) => [String(c._id), c.name]));

  const rows = await ClassroomAnnouncement.find({ chat: { $in: ids } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((a) => {
    const imp =
      typeof a.importance === 'number' && a.importance >= 0 && a.importance <= 2
        ? a.importance
        : 0;
    const kind =
      a.kind === 'exam' || a.kind === 'assignment' ? a.kind : 'statement';
    let expiresAtIso = null;
    if (a.expiresAt) {
      const t = new Date(a.expiresAt).getTime();
      if (!Number.isNaN(t)) expiresAtIso = new Date(a.expiresAt).toISOString();
    }
    return {
      id: String(a._id),
      title: a.title,
      bodyPreview: truncateBody(a.body),
      classroomName: nameById.get(String(a.chat)) || 'Classroom',
      chatId: String(a.chat),
      author: a.authorName || 'Instructor',
      importance: imp,
      kind,
      expiresAt: expiresAtIso,
      createdAt: a.createdAt
        ? new Date(a.createdAt).toISOString()
        : new Date().toISOString(),
    };
  });
}

/**
 * Overdue-but-open and upcoming dashboard due items across active classrooms.
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getDashboardDueItemsForUser(userId) {
  const now = new Date();
  const chats = await Chat.find({
    members: userId,
    'metadata.archived': { $ne: true },
  })
    .select('_id name')
    .lean();

  const chatIds = chats.map((c) => c._id);
  if (chatIds.length === 0) {
    return { upcomingAssignments: [], upcomingExams: [] };
  }

  const nameById = new Map(chats.map((c) => [String(c._id), c.name]));

  const [assignments, submissions, dueAnnouncements] = await Promise.all([
    Assignment.find({
      chat: { $in: chatIds },
      published: true,
      $or: [
        { dueAt: { $gte: now } },
        { allowLateUntil: { $ne: null, $gte: now } },
      ],
    })
      .sort({ dueAt: 1 })
      .lean(),
    AssignmentSubmission.find({
      chat: { $in: chatIds },
      student: userId,
    }).lean(),
    ClassroomAnnouncement.find({
      chat: { $in: chatIds },
      kind: { $in: ['assignment', 'exam'] },
      expiresAt: { $ne: null, $gte: now },
    })
      .sort({ expiresAt: 1 })
      .lean(),
  ]);

  const submissionByAssignment = new Map(
    submissions.map((s) => [String(s.assignment), s]),
  );
  const formalAssignmentKeys = new Set();

  const upcomingAssignments = assignments.map((a) => {
    const chatId = String(a.chat);
    const dueAt = new Date(a.dueAt);
    const lateUntil = a.allowLateUntil ? new Date(a.allowLateUntil) : null;
    const deadline = submissionDeadline(a);
    const isOverdue = now.getTime() > dueAt.getTime();
    const isSubmissionClosed = now.getTime() > deadline.getTime();
    const submission = submissionByAssignment.get(String(a._id));
    const status = mapSubmissionStatus(submission, isOverdue);

    formalAssignmentKeys.add(`${chatId}::${normalizeDueTitle(a.title)}`);

    return {
      id: String(a._id),
      source: 'assignment',
      title: a.title,
      classroomName: nameById.get(chatId) || 'Classroom',
      chatId,
      dueAt: dueAt.toISOString(),
      allowLateUntil: lateUntil ? lateUntil.toISOString() : null,
      points: a.points ?? 100,
      status,
      isOverdue,
      isSubmissionClosed,
      canSubmit:
        !isSubmissionClosed && (!submission || submission.status !== 'graded'),
      mySubmission: submission
        ? {
            status: submission.status || 'submitted',
            submittedAt: submission.submittedAt
              ? new Date(submission.submittedAt).toISOString()
              : null,
            score: submission.score != null ? submission.score : null,
            isLate: Boolean(submission.isLate),
          }
        : null,
    };
  });

  for (const a of dueAnnouncements.filter((row) => row.kind === 'assignment')) {
    const chatId = String(a.chat);
    const key = `${chatId}::${normalizeDueTitle(a.title)}`;
    if (formalAssignmentKeys.has(key)) continue;

    const dueAt = new Date(a.expiresAt);
    upcomingAssignments.push({
      id: String(a._id),
      source: 'announcement',
      title: a.title,
      classroomName: nameById.get(chatId) || 'Classroom',
      chatId,
      dueAt: dueAt.toISOString(),
      expiresAt: dueAt.toISOString(),
      bodyPreview: truncateBody(a.body),
      points: null,
      status: 'announcement',
      isOverdue: false,
      isSubmissionClosed: false,
      canSubmit: false,
      mySubmission: null,
    });
  }

  upcomingAssignments.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

  const upcomingExams = dueAnnouncements
    .filter((row) => row.kind === 'exam')
    .map((a) => {
      const chatId = String(a.chat);
      return {
        id: String(a._id),
        source: 'announcement',
        title: a.title,
        classroomName: nameById.get(chatId) || 'Classroom',
        chatId,
        expiresAt: new Date(a.expiresAt).toISOString(),
        bodyPreview: truncateBody(a.body),
        importance:
          typeof a.importance === 'number' &&
          a.importance >= 0 &&
          a.importance <= 2
            ? a.importance
            : 0,
      };
    });

  return { upcomingAssignments, upcomingExams };
}

/**
 * All classrooms with any weekly slots (full recurring pattern).
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getAllScheduledClassesForUser(userId) {
  const chats = await Chat.find({
    members: userId,
    'metadata.archived': { $ne: true },
  })
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
