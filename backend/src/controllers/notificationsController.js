import asyncHandler from '../middlewares/asyncHandler.js';
import { getRecentAnnouncementsForUser } from '../services/dashboardService.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 150;

export const listNotificationFeed = asyncHandler(async (req, res) => {
  const parsed = Number.parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10);
  const limit = Math.min(
    Math.max(Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const announcements = await getRecentAnnouncementsForUser(
    req.user._id,
    limit,
  );

  const items = announcements.map((a) => ({
    type: 'announcement',
    ...a,
  }));

  res.json({ items });
});
