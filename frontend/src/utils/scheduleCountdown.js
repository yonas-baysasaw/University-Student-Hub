/**
 * @param {string} str
 * @returns {{ h: number, min: number } | null}
 */
export function parseHHMM(str) {
  const m = String(str).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return { h: Number(m[1]), min: Number(m[2]) };
}

/**
 * Next start time (ms) for a recurring weekly slot.
 * @param {{ weekday: number, start: string }} slot
 * @returns {number | null}
 */
export function nextOccurrenceMs(slot) {
  const wd = Number(slot.weekday);
  const hm = parseHHMM(slot.start);
  if (!hm || !Number.isInteger(wd) || wd < 0 || wd > 6) return null;

  const now = Date.now();

  for (let delta = 0; delta < 14; delta += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + delta);
    if (d.getDay() !== wd) continue;
    const at = new Date(d);
    at.setHours(hm.h, hm.min, 0, 0);
    const t = at.getTime();
    if (t > now) return t;
  }
  return null;
}

/**
 * Earliest upcoming session among slots (by start time).
 * @param {Array<{ weekday: number, start: string }>} slots
 * @returns {number | null}
 */
export function earliestNextOccurrenceMs(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  let best = /** @type {number | null} */ (null);
  for (const s of slots) {
    const t = nextOccurrenceMs(s);
    if (t === null) continue;
    if (best === null || t < best) best = t;
  }
  return best;
}

/**
 * Human-readable countdown until `targetMs`, or null if invalid/past.
 * @param {number | null} targetMs
 * @param {number} [nowMs] Reference time (defaults to `Date.now()`).
 */
export function formatCountdownFromNow(targetMs, nowMs = Date.now()) {
  if (targetMs === null || targetMs <= nowMs) return null;
  const msUntil = targetMs - nowMs;
  const totalMin = Math.max(1, Math.ceil(msUntil / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const hrs = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} · ${hrs} hr${hrs === 1 ? '' : 's'}`;
  }
  if (hrs > 0) {
    return `${hrs} hr${hrs === 1 ? '' : 's'} · ${mins} min`;
  }
  return `${mins} min`;
}
