import asyncHandler from '../middlewares/asyncHandler.js';
import ClassroomMention from '../models/ClassroomMention.js';
import { getRecentAnnouncementsForUser } from '../services/dashboardService.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 150;

export const listNotificationFeed = asyncHandler(async (req, res) => {
  const parsed = Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10);
  const limit = Math.min(
    Math.max(Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const [announcements, mentions] = await Promise.all([
    getRecentAnnouncementsForUser(req.user._id, limit),
    ClassroomMention.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actor', 'username avatar photo')
      .populate('chat', 'name')
      .lean(),
  ]);

  const annItems = announcements.map((a) => ({
    type: 'announcement',
    ...a,
  }));

  const mentionItems = mentions.map((m) => ({
    type: 'mention',
    _id: m._id,
    createdAt: m.createdAt,
    readAt: m.readAt,
    actor: m.actor,
    chatName: m.chat?.name ?? 'Classroom',
    chatId: m.chat?._id ?? m.chat,
    messageId: m.message,
  }));

  const items = [...mentionItems, ...annItems].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime(),
  );

  res.json({ items: items.slice(0, limit) });
});
