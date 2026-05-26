import asyncHandler from '../middlewares/asyncHandler.js';
import {
  getCalendarFeed,
  parseCalendarDateParam,
} from '../services/calendarService.js';

const MAX_RANGE_DAYS = 93;

export const getCalendarFeedHandler = asyncHandler(async (req, res) => {
  const from = parseCalendarDateParam(String(req.query.from ?? ''));
  const to = parseCalendarDateParam(String(req.query.to ?? ''));

  if (!from || !to) {
    return res.status(400).json({
      message: 'Query params from and to are required (YYYY-MM-DD).',
    });
  }

  if (to < from) {
    return res.status(400).json({
      message: 'Query param to must be on or after from.',
    });
  }

  const rangeMs = to.getTime() - from.getTime();
  const rangeDays = Math.ceil(rangeMs / (24 * 60 * 60 * 1000)) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return res.status(400).json({
      message: `Date range may not exceed ${MAX_RANGE_DAYS} days.`,
    });
  }

  const endInclusive = new Date(to);
  endInclusive.setHours(23, 59, 59, 999);

  let items = await getCalendarFeed(req.user._id, from, endInclusive);

  const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (qRaw) {
    const q = qRaw.toLowerCase();
    items = items.filter((item) =>
      String(item.title ?? '')
        .toLowerCase()
        .includes(q),
    );
  }

  res.json({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    items,
  });
});
