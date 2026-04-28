/** localStorage key for dashboard schedule presentation */
export const SCHEDULE_VIEW_STORAGE_KEY = 'ush-dashboard-schedule-view';

/** @typedef {'day' | 'week' | 'weekUpcoming' | 'month'} ScheduleViewId */

/** @type {ReadonlyArray<{ id: ScheduleViewId, label: string, hint: string }>} */
export const SCHEDULE_VIEW_OPTIONS = [
  {
    id: 'day',
    label: 'Today',
    hint: 'Everything scheduled for this calendar day',
  },
  {
    id: 'week',
    label: 'This week',
    hint: 'Sun–Sat for the week containing today',
  },
  {
    id: 'weekUpcoming',
    label: 'Coming up (week)',
    hint: 'Today through Saturday',
  },
  {
    id: 'month',
    label: 'This month',
    hint: 'Every scheduled day in the visible month',
  },
];

/**
 * @returns {ScheduleViewId}
 */
export function readScheduleViewPreference() {
  try {
    const v = localStorage.getItem(SCHEDULE_VIEW_STORAGE_KEY);
    if (v === 'day' || v === 'week' || v === 'weekUpcoming' || v === 'month') {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 'day';
}

/**
 * @param {ScheduleViewId} id
 */
export function writeScheduleViewPreference(id) {
  try {
    localStorage.setItem(SCHEDULE_VIEW_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * @param {Date} d
 */
export function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Sun–Sat week containing `anchor`
 * @param {Date} [anchor]
 * @returns {Date[]}
 */
export function getWeekContaining(anchor = new Date()) {
  const d = startOfLocalDay(anchor);
  const dow = d.getDay();
  const sun = new Date(d);
  sun.setDate(d.getDate() - dow);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sun);
    dt.setDate(sun.getDate() + i);
    days.push(dt);
  }
  return days;
}

/**
 * Today through end of week (Sat), same week as today
 * @param {Date} [fromDate]
 * @returns {Date[]}
 */
export function getComingDaysThisWeek(fromDate = new Date()) {
  const week = getWeekContaining(fromDate);
  const today = startOfLocalDay(new Date());
  return week.filter((dt) => dt.getTime() >= today.getTime());
}

/**
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @returns {Date[]}
 */
export function getDaysInMonth(year, monthIndex) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day++) {
    out.push(new Date(year, monthIndex, day));
  }
  return out;
}

/**
 * @param {Date} d
 */
export function formatIsoLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} t
 */
function timeToMinutes(t) {
  const m = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Expands recurring weekly slots onto concrete calendar dates.
 * @param {Array<{ chatId: string, name: string, slots: Array<{ weekday: number, start: string, end: string, label: string }> }>} rooms
 * @param {Date[]} dates
 * @returns {Array<{ date: Date, iso: string, weekday: number, entries: Array<{ chatId: string, roomName: string, slot: { weekday: number, start: string, end: string, label: string } }> }>}
 */
export function occurrencesForDates(rooms, dates) {
  const rows = [];
  for (const date of dates) {
    const wd = date.getDay();
    const iso = formatIsoLocalDate(date);
    /** @type {Array<{ chatId: string, roomName: string, slot: { weekday: number, start: string, end: string, label: string } }>} */
    const entries = [];
    for (const room of rooms) {
      for (const slot of room.slots) {
        if (Number(slot.weekday) !== wd) continue;
        entries.push({
          chatId: room.chatId,
          roomName: room.name,
          slot,
        });
      }
    }
    entries.sort(
      (a, b) => timeToMinutes(a.slot.start) - timeToMinutes(b.slot.start),
    );
    rows.push({ date, iso, weekday: wd, entries });
  }
  return rows;
}

/**
 * @param {ScheduleViewId} viewId
 */
export function scheduleHeadingTitle(viewId) {
  switch (viewId) {
    case 'week':
      return 'This week’s classes';
    case 'weekUpcoming':
      return 'Coming up this week';
    case 'month':
      return 'Monthly schedule';
    default:
      return 'Today’s classes';
  }
}

/**
 * @param {ScheduleViewId} viewId
 */
export function scheduleSubtitle(viewId) {
  switch (viewId) {
    case 'week':
      return 'Sun–Sat for this calendar week (based on weekly classroom hours).';
    case 'weekUpcoming':
      return 'From today through Saturday.';
    case 'month':
      return 'Every day this month that matches your weekly pattern.';
    default:
      return 'Weekly hours admins set on each classroom appear here.';
  }
}
