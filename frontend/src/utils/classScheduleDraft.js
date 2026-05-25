export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5];

function newRowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pattern-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** @param {string} t */
function slotMinutes(t) {
  const m = String(t).match(HH_MM);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * @param {string} title
 * @param {string} location
 */
function patternLabelToApi(title, location) {
  const parts = [String(title || '').trim(), String(location || '').trim()].filter(
    Boolean,
  );
  return parts.length ? parts.join(' · ') : '';
}

/**
 * @param {string | undefined} label
 */
function apiLabelToTitleLocation(label) {
  const s = String(label || '').trim();
  if (!s) return { title: '', location: '' };
  const sep = ' · ';
  const idx = s.indexOf(sep);
  if (idx === -1) return { title: '', location: s };
  return { title: s.slice(0, idx), location: s.slice(idx + sep.length) };
}

/**
 * @param {string} recurrence
 * @param {number[]} customDays
 * @returns {number[]}
 */
function weekdaysFromRecurrence(recurrence, customDays) {
  if (recurrence === 'weekdays') return [...WEEKDAYS_MON_FRI];
  if (recurrence === 'custom') {
    return [...new Set(customDays)]
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b);
  }
  const m = String(recurrence).match(/^weekly:(\d)$/);
  if (m) {
    const wd = Number(m[1]);
    if (wd >= 0 && wd <= 6) return [wd];
  }
  return [];
}

/**
 * @returns {{
 *   rowId: string,
 *   title: string,
 *   start: string,
 *   end: string,
 *   recurrence: string,
 *   customDays: number[],
 *   location: string,
 * }}
 */
export function emptyPattern() {
  return {
    rowId: newRowId(),
    title: '',
    start: '09:00',
    end: '10:30',
    recurrence: 'weekly:1',
    customDays: [],
    location: '',
  };
}

/**
 * @param {Array<{ weekday?: number, start?: string, end?: string, label?: string }>} patterns
 * @returns {Array<{ weekday: number, start: string, end: string, label?: string }>}
 */
export function patternsToSlots(patterns) {
  /** @type {Array<{ weekday: number, start: string, end: string, label?: string }>} */
  const slots = [];
  for (const p of patterns) {
    const label = patternLabelToApi(p.title, p.location);
    const days = weekdaysFromRecurrence(p.recurrence, p.customDays ?? []);
    for (const wd of days) {
      const base = {
        weekday: wd,
        start: String(p.start || '09:00'),
        end: String(p.end || '10:30'),
      };
      slots.push(label ? { ...base, label } : base);
    }
  }
  return slots;
}

/**
 * @param {Array<{ weekday?: number, start?: string, end?: string, label?: string }> | undefined} slots
 */
export function slotsToPatterns(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [emptyPattern()];
  }

  /** @type {Map<string, { start: string, end: string, label: string, weekdays: number[] }>} */
  const groups = new Map();

  for (const s of slots) {
    const start = typeof s.start === 'string' ? s.start : '09:00';
    const end = typeof s.end === 'string' ? s.end : '10:30';
    const label = typeof s.label === 'string' ? s.label : '';
    const key = `${start}|${end}|${label}`;
    if (!groups.has(key)) {
      groups.set(key, { start, end, label, weekdays: [] });
    }
    const wd = Number(s.weekday);
    if (Number.isInteger(wd) && wd >= 0 && wd <= 6) {
      groups.get(key).weekdays.push(wd);
    }
  }

  return [...groups.values()].map((g) => {
    const weekdays = [...new Set(g.weekdays)].sort((a, b) => a - b);
    const { title, location } = apiLabelToTitleLocation(g.label);

    let recurrence;
    let customDays = [];

    const isMonFri =
      weekdays.length === 5 &&
      weekdays.every((d, i) => d === WEEKDAYS_MON_FRI[i]);

    if (isMonFri) {
      recurrence = 'weekdays';
    } else if (weekdays.length === 1) {
      recurrence = `weekly:${weekdays[0]}`;
    } else {
      recurrence = 'custom';
      customDays = weekdays;
    }

    return {
      rowId: newRowId(),
      title,
      start: g.start,
      end: g.end,
      recurrence,
      customDays,
      location,
    };
  });
}

/**
 * @param {Array<{ title?: string, start?: string, end?: string, recurrence?: string, customDays?: number[], location?: string }>} patterns
 */
export function validatePatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return { ok: false, message: 'Add at least one meeting time.' };
  }

  for (const p of patterns) {
    const start = String(p.start || '').trim();
    const end = String(p.end || '').trim();
    if (!HH_MM.test(start) || !HH_MM.test(end)) {
      return {
        ok: false,
        message: 'Use 24-hour times (HH:mm) for start and end.',
      };
    }
    const sm = slotMinutes(start);
    const em = slotMinutes(end);
    if (!(sm < em)) {
      return {
        ok: false,
        message: 'Each meeting needs a start time before its end time.',
      };
    }
    const days = weekdaysFromRecurrence(
      String(p.recurrence || ''),
      p.customDays ?? [],
    );
    if (days.length === 0) {
      return {
        ok: false,
        message:
          p.recurrence === 'custom'
            ? 'Custom repeat: select at least one day.'
            : 'Select a valid repeat option.',
      };
    }
  }

  return { ok: true };
}

export function getRecurrenceOptions() {
  /** @type {Array<{ value: string, label: string }>} */
  const options = [];
  for (let wd = 0; wd <= 6; wd += 1) {
    options.push({
      value: `weekly:${wd}`,
      label: `Weekly on ${WEEKDAY_LABELS[wd]}`,
    });
  }
  options.push({
    value: 'weekdays',
    label: 'Every weekday (Monday to Friday)',
  });
  options.push({ value: 'custom', label: 'Custom…' });
  return options;
}

/**
 * Human-readable repeat summary for read-only view.
 * @param {{ recurrence?: string, customDays?: number[] }} pattern
 */
export function formatRecurrenceSummary(pattern) {
  const recurrence = String(pattern.recurrence || '');
  if (recurrence === 'weekdays') {
    return 'Every weekday (Mon–Fri)';
  }
  if (recurrence === 'custom') {
    const days = weekdaysFromRecurrence(recurrence, pattern.customDays ?? []);
    if (days.length === 0) return 'Custom';
    return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
  }
  const m = recurrence.match(/^weekly:(\d)$/);
  if (m) {
    return `Weekly on ${WEEKDAY_LABELS[Number(m[1])]}`;
  }
  return 'Repeats weekly';
}
