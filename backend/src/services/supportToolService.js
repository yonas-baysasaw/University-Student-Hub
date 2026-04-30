import { SchemaType } from '@google/generative-ai';
import mongoose from 'mongoose';
import Book from '../models/Books.js';
import Chat from '../models/Chat.js';
import ClassroomAnnouncement from '../models/ClassroomAnnouncement.js';
import ClassroomResource from '../models/ClassroomResource.js';
import Exam from '../models/Exam.js';
import Message from '../models/Message.js';

const MAX_LIST = 20;
const MAX_ANN_SNIPPET = 500;
const MAX_MSG_SNIPPET = 400;
const MAX_CROSS = 15;

/**
 * @typedef {{ userId: import('mongoose').Types.ObjectId }} SupportToolContext
 */

function clampLimit(n, fallback, cap = MAX_LIST) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 1) return fallback;
  return Math.min(Math.floor(x), cap);
}

function trimSnippet(s, max) {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

/**
 * Optional ISO8601 date strings for filtering by `createdAt` on resources.
 * @returns {{ ok: true, after?: Date, before?: Date } | { ok: false, error: string }}
 */
function parseResourceDateFilters(args) {
  const rawAfter = args?.createdAfter;
  const rawBefore = args?.createdBefore;
  const hasAfter = rawAfter != null && String(rawAfter).trim() !== '';
  const hasBefore = rawBefore != null && String(rawBefore).trim() !== '';
  if (!hasAfter && !hasBefore) return { ok: true };
  let after;
  let before;
  if (hasAfter) {
    const d = new Date(String(rawAfter));
    if (Number.isNaN(d.getTime())) {
      return {
        ok: false,
        error:
          'createdAfter is not a valid date (use ISO 8601, e.g. 2025-04-01)',
      };
    }
    after = d;
  }
  if (hasBefore) {
    const d = new Date(String(rawBefore));
    if (Number.isNaN(d.getTime())) {
      return {
        ok: false,
        error: 'createdBefore is not a valid date (use ISO 8601)',
      };
    }
    before = d;
  }
  if (after && before && after.getTime() > before.getTime()) {
    return {
      ok: false,
      error: 'createdAfter must be on or before createdBefore',
    };
  }
  return { ok: true, after, before };
}

function applyCreatedAtRange(filter, parsed) {
  if (!parsed.ok) return;
  const t = {};
  if (parsed.after) t.$gte = parsed.after;
  if (parsed.before) t.$lte = parsed.before;
  if (Object.keys(t).length) {
    filter.createdAt = t;
  }
}

const supportDateFmt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Human-readable date for support replies (not raw ISO).
 * @param {Date | string | null | undefined} v
 * @returns {string | null}
 */
function formatWhen(v) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return supportDateFmt.format(d);
}

/** Resource row for the model: no ids, when + linkText/url for markdown links. */
function mapResourceForModel(r, classroomName) {
  const fileUrl =
    r.fileUrl && String(r.fileUrl).trim() ? String(r.fileUrl).trim() : null;
  const extLink =
    r.link && String(r.link).trim() ? String(r.link).trim() : null;
  const by = r.authorName || 'Instructor';
  const when = formatWhen(r.createdAt);
  let linkText = null;
  let url = null;
  if (fileUrl) {
    url = fileUrl;
    const raw =
      (r.fileName && String(r.fileName).trim()) ||
      (r.title && String(r.title).trim());
    linkText = raw ? trimSnippet(raw, 90) : 'Download file';
  } else if (extLink) {
    url = extLink;
    const t = (r.title && String(r.title).trim()) || '';
    linkText = t ? trimSnippet(t, 90) : 'Open link';
  }
  return {
    classroom: classroomName,
    title: r.title,
    category: r.category || 'other',
    descriptionSnippet: r.description
      ? trimSnippet(String(r.description), 160)
      : null,
    by,
    when,
    linkText,
    url,
  };
}

function mapAnnouncementForModel(a, classroomName) {
  const imp =
    typeof a.importance === 'number' &&
    a.importance >= 0 &&
    a.importance <= 2
      ? a.importance
      : 0;
  const kind =
    a.kind === 'exam' || a.kind === 'assignment' ? a.kind : 'statement';
  let expiresAtIso = null;
  let isExpired = false;
  const now = Date.now();
  if (a.expiresAt) {
    const t = new Date(a.expiresAt).getTime();
    if (!Number.isNaN(t)) {
      expiresAtIso = new Date(a.expiresAt).toISOString();
      isExpired = t < now;
    }
  }
  return {
    classroom: classroomName,
    title: a.title,
    by: a.authorName || 'Instructor',
    when: formatWhen(a.createdAt),
    preview: trimSnippet(a.body || '', MAX_ANN_SNIPPET),
    importance: imp,
    importanceLabel:
      imp >= 2 ? 'urgent' : imp >= 1 ? 'highlight' : 'normal',
    kind,
    expiresAt: expiresAtIso,
    expiresSummary: expiresAtIso
      ? `${isExpired ? 'Expired (was relevant until)' : 'Relevant until'} ${formatWhen(a.expiresAt)}`
      : null,
    isExpired,
  };
}

async function ensureMemberChat(chatId, userId) {
  if (!mongoose.Types.ObjectId.isValid(String(chatId))) {
    return { error: 'Invalid chat id' };
  }
  const chat = await Chat.findById(chatId).select('members name').lean();
  if (!chat) {
    return { error: 'Classroom not found' };
  }
  const member = (chat.members || []).some((m) => String(m) === String(userId));
  if (!member) {
    return { error: 'Not a member of this classroom' };
  }
  return { chat };
}

// ── tool runners ───────────────────────────────────────────────────────────

async function runListMyClassrooms(ctx) {
  const uid = ctx.userId;
  const rows = await Chat.find({ members: uid })
    .sort({ updatedAt: -1 })
    .select('name updatedAt')
    .limit(50)
    .lean();
  return {
    classrooms: rows.map((c) => ({
      name: c.name,
      chatId: String(c._id),
      updatedWhen: formatWhen(c.updatedAt),
    })),
  };
}

async function runListAnnouncementsForChat(ctx, args) {
  const chatId = args?.chatId;
  const limit = clampLimit(args?.limit, 15, MAX_LIST);
  const gate = await ensureMemberChat(chatId, ctx.userId);
  if (gate.error) return { error: gate.error };
  const items = await ClassroomAnnouncement.find({ chat: chatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const roomName = gate.chat.name || 'Classroom';
  return {
    classroom: roomName,
    announcements: items.map((a) => mapAnnouncementForModel(a, roomName)),
  };
}

async function runListResourcesForChat(ctx, args) {
  const chatId = args?.chatId;
  const limit = clampLimit(args?.limit, 15, MAX_LIST);
  const parsed = parseResourceDateFilters(args);
  if (!parsed.ok) return { error: parsed.error };
  const gate = await ensureMemberChat(chatId, ctx.userId);
  if (gate.error) return { error: gate.error };
  const filter = { chat: chatId };
  applyCreatedAtRange(filter, parsed);
  const items = await ClassroomResource.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const roomName = gate.chat.name || 'Classroom';
  return {
    classroom: roomName,
    resources: items.map((r) => mapResourceForModel(r, roomName)),
  };
}

async function runListRecentResources(ctx, args) {
  const limit = clampLimit(args?.limit, 15, MAX_CROSS);
  const parsed = parseResourceDateFilters(args);
  if (!parsed.ok) return { error: parsed.error };
  const chatIds = await Chat.find({ members: ctx.userId })
    .select('_id')
    .limit(200)
    .lean();
  const ids = chatIds.map((c) => c._id);
  if (ids.length === 0) {
    return { resources: [] };
  }
  const filter = { chat: { $in: ids } };
  applyCreatedAtRange(filter, parsed);
  const items = await ClassroomResource.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const chatNames = new Map();
  for (const id of [...new Set(items.map((i) => String(i.chat)))]) {
    const ch = await Chat.findById(id).select('name').lean();
    if (ch) chatNames.set(id, ch.name);
  }
  return {
    resources: items.map((r) => {
      const room = chatNames.get(String(r.chat)) || 'Classroom';
      return mapResourceForModel(r, room);
    }),
  };
}

async function runListRecentAnnouncements(ctx, args) {
  const limit = clampLimit(args?.limit, 10, MAX_CROSS);
  const chatIds = await Chat.find({ members: ctx.userId })
    .select('_id')
    .limit(200)
    .lean();
  const ids = chatIds.map((c) => c._id);
  if (ids.length === 0) {
    return { announcements: [] };
  }
  const items = await ClassroomAnnouncement.find({ chat: { $in: ids } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const chatNames = new Map();
  for (const id of [...new Set(items.map((i) => String(i.chat)))]) {
    const ch = await Chat.findById(id).select('name').lean();
    if (ch) chatNames.set(id, ch.name);
  }
  return {
    announcements: items.map((a) => {
      const room = chatNames.get(String(a.chat)) || 'Classroom';
      return mapAnnouncementForModel(a, room);
    }),
  };
}

async function runGetRecentClassMessages(ctx, args) {
  const chatId = args?.chatId;
  const limit = clampLimit(args?.limit, 15, MAX_LIST);
  const chat = await Chat.findById(chatId).select('members name').lean();
  if (!chat) return { error: 'Classroom not found' };
  const isMember = (chat.members || []).some(
    (m) => String(m) === String(ctx.userId),
  );
  if (!isMember) {
    return { error: 'Not a member of this classroom' };
  }
  const rows = await Message.find({ chat: chatId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username name')
    .lean();
  return {
    classroom: chat.name,
    messages: rows.map((m) => ({
      textSnippet: trimSnippet(
        m.content || (m.messageType === 'file' && m.fileUrl ? '[file]' : ''),
        MAX_MSG_SNIPPET,
      ),
      when: formatWhen(m.createdAt),
      from: m.sender?.name || m.sender?.username || 'Unknown',
    })),
  };
}

async function runListMyAccessibleBooks(ctx, args) {
  const limit = clampLimit(args?.limit, 12, 30);
  const userId = ctx.userId;
  const filter = {
    $or: [{ visibility: 'public' }, { userId }],
  };
  const books = await Book.find(filter)
    .sort({ createdAt: -1 })
    .select('title description visibility bookUrl createdAt')
    .limit(limit)
    .lean();
  return {
    books: books.map((b) => ({
      title: b.title,
      when: formatWhen(b.createdAt),
      linkText: b.title,
      url: b.bookUrl && String(b.bookUrl).trim() ? b.bookUrl : null,
      descriptionSnippet: trimSnippet(b.description || '', 200),
    })),
  };
}

async function runListMyExams(ctx, args) {
  const limit = clampLimit(args?.limit, 15, 30);
  const userId = ctx.userId;
  const filter = {
    $or: [{ uploadedBy: userId }, { visibility: 'public' }],
  };
  const rows = await Exam.find(filter)
    .sort({ createdAt: -1 })
    .select('filename subject topic totalQuestions processingStatus createdAt')
    .limit(limit)
    .lean();
  return {
    exams: rows.map((e) => ({
      name: e.filename,
      subject: e.subject || '',
      topic: e.topic || '',
      totalQuestions: e.totalQuestions,
      status: e.processingStatus,
      when: formatWhen(e.createdAt),
    })),
  };
}

// ── declarations + registry ────────────────────────────────────────────────

const S = SchemaType;

const DECLARATIONS = {
  list_my_classrooms: {
    declaration: {
      name: 'list_my_classrooms',
      description:
        "List classrooms the current user is enrolled in (name and chatId). Call this when the user asks about resources, announcements, or a class but hasn't named one—then summarize these classrooms instead of asking them to name one from scratch.",
      parameters: {
        type: S.OBJECT,
        properties: {
          unused: {
            type: S.STRING,
            description: 'Optional; leave empty',
            nullable: true,
          },
        },
      },
    },
    run: (ctx) => runListMyClassrooms(ctx),
  },
  list_announcements_for_chat: {
    declaration: {
      name: 'list_announcements_for_chat',
      description:
        'List announcements for a specific classroom. Requires chatId from list_my_classrooms. Optional limit (default 15, max 20).',
      parameters: {
        type: S.OBJECT,
        properties: {
          chatId: { type: S.STRING, description: 'Mongo id of the classroom' },
          limit: { type: S.INTEGER, description: 'Max items' },
        },
        required: ['chatId'],
      },
    },
    run: (ctx, args) => runListAnnouncementsForChat(ctx, args),
  },
  list_resources_for_chat: {
    declaration: {
      name: 'list_resources_for_chat',
      description:
        'List resources (links and uploaded files) for one classroom. Requires chatId from list_my_classrooms. Optional limit (default 15, max 20). Optional createdAfter/createdBefore as ISO 8601 strings to filter by upload date (inclusive range).',
      parameters: {
        type: S.OBJECT,
        properties: {
          chatId: { type: S.STRING, description: 'Classroom id' },
          limit: { type: S.INTEGER, description: 'Max items' },
          createdAfter: {
            type: S.STRING,
            description:
              'Optional: only resources on or after this instant (ISO 8601, e.g. 2025-04-01T00:00:00.000Z)',
            nullable: true,
          },
          createdBefore: {
            type: S.STRING,
            description:
              'Optional: only resources on or before this instant (ISO 8601)',
            nullable: true,
          },
        },
        required: ['chatId'],
      },
    },
    run: (ctx, args) => runListResourcesForChat(ctx, args),
  },
  list_recent_resources: {
    declaration: {
      name: 'list_recent_resources',
      description:
        "List the most recent resources (files and links) across all of the user's classrooms, newest first. Use when the user does not name a specific class, or wants a global view. Optional createdAfter/createdBefore (ISO 8601) to filter by date. Optional limit (default 15, max 15).",
      parameters: {
        type: S.OBJECT,
        properties: {
          limit: { type: S.INTEGER, description: 'Max items' },
          createdAfter: {
            type: S.STRING,
            description: 'Optional ISO 8601 lower bound for resource createdAt',
            nullable: true,
          },
          createdBefore: {
            type: S.STRING,
            description: 'Optional ISO 8601 upper bound for resource createdAt',
            nullable: true,
          },
        },
      },
    },
    run: (ctx, args) => runListRecentResources(ctx, args),
  },
  list_recent_announcements: {
    declaration: {
      name: 'list_recent_announcements',
      description:
        "List the most recent announcements across all of the user's classrooms, newest first. Optional limit (default 10, max 15).",
      parameters: {
        type: S.OBJECT,
        properties: {
          limit: { type: S.INTEGER, description: 'Max items' },
        },
      },
    },
    run: (ctx, args) => runListRecentAnnouncements(ctx, args),
  },
  get_recent_class_messages: {
    declaration: {
      name: 'get_recent_class_messages',
      description:
        'Fetch recent chat messages in a classroom discussion. Requires chatId. Optional limit.',
      parameters: {
        type: S.OBJECT,
        properties: {
          chatId: { type: S.STRING, description: 'Classroom id' },
          limit: { type: S.INTEGER, description: 'Max messages' },
        },
        required: ['chatId'],
      },
    },
    run: (ctx, args) => runGetRecentClassMessages(ctx, args),
  },
  list_my_accessible_books: {
    declaration: {
      name: 'list_my_accessible_books',
      description:
        'List library books the user can access (public and own uploads). Optional limit.',
      parameters: {
        type: S.OBJECT,
        properties: {
          limit: { type: S.INTEGER, description: 'Max books' },
        },
      },
    },
    run: (ctx, args) => runListMyAccessibleBooks(ctx, args),
  },
  list_my_exams: {
    declaration: {
      name: 'list_my_exams',
      description:
        'List practice exams the user can access (own plus public), with processing status. Optional limit.',
      parameters: {
        type: S.OBJECT,
        properties: {
          limit: { type: S.INTEGER, description: 'Max exams' },
        },
      },
    },
    run: (ctx, args) => runListMyExams(ctx, args),
  },
};

/**
 * @returns {import('@google/generative-ai').FunctionDeclaration[]}
 */
export function getSupportFunctionDeclarations() {
  return Object.values(DECLARATIONS).map((e) => e.declaration);
}

/**
 * @param {string} name
 * @param {SupportToolContext} ctx
 * @param {Record<string, unknown>} args
 */
export async function executeSupportTool(name, ctx, args) {
  if (!name || !DECLARATIONS[name]) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    const out = await DECLARATIONS[name].run(
      ctx,
      args && typeof args === 'object' ? args : {},
    );
    return out && typeof out === 'object' ? out : { result: out };
  } catch (e) {
    return { error: e?.message || 'Tool failed' };
  }
}
