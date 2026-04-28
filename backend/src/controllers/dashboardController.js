import asyncHandler from '../middlewares/asyncHandler.js';
import Book from '../models/Books.js';
import {
  getAllScheduledClassesForUser,
  getClassroomCountForUser,
  getRecentAnnouncementsForUser,
} from '../services/dashboardService.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const weekdayRaw = req.query.weekday;
  const weekday =
    weekdayRaw === undefined || weekdayRaw === ''
      ? NaN
      : Number.parseInt(String(weekdayRaw), 10);

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return res.status(400).json({
      message:
        'Query weekday is required (integer 0–6, matching Date.getDay()).',
    });
  }

  const parsedLimit = Number.parseInt(
    String(req.query.announcementsLimit ?? '12'),
    10,
  );
  const announcementsLimit = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 12, 1),
    30,
  );

  const localDate =
    typeof req.query.localDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)
      ? req.query.localDate
      : null;

  const [recentAnnouncements, scheduleCalendar, classroomCount, bookTotal] =
    await Promise.all([
      getRecentAnnouncementsForUser(req.user._id, announcementsLimit),
      getAllScheduledClassesForUser(req.user._id),
      getClassroomCountForUser(req.user._id),
      Book.countDocuments({ userId: req.user._id }),
    ]);

  const todayClasses = scheduleCalendar
    .map((room) => ({
      ...room,
      slots: room.slots.filter((s) => Number(s.weekday) === weekday),
    }))
    .filter((room) => room.slots.length > 0);

  res.json({
    localDate,
    weekday,
    recentAnnouncements,
    todayClasses,
    scheduleCalendar,
    stats: {
      classroomCount,
      booksUploaded: bookTotal,
    },
  });
});
