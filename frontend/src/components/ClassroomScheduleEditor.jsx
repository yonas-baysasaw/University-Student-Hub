import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { SCHEDULE_SAVED_EVENT } from '../constants/dashboardEvents.js';
import { readJsonOrThrow } from '../utils/http';
import {
  earliestNextOccurrenceMs,
  formatCountdownFromNow,
} from '../utils/scheduleCountdown.js';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** @param {string} t */
function slotMinutes(t) {
  const m = String(t).match(HH_MM);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Client-side checks aligned with PATCH `/api/chats/:chatId/schedule`.
 * Duplicate weekday/time rows are allowed when you need them (e.g. labs + lectures).
 * @param {Array<{ weekday: number, start: string, end: string, label?: string }>} rows
 */
function validateDraftSlots(rows) {
  for (const row of rows) {
    const start = String(row.start || '09:00').trim();
    const end = String(row.end || '10:00').trim();
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
        message: 'Each row needs a start time before its end time.',
      };
    }
  }
  return { ok: true };
}

function newRowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySlot() {
  return {
    rowId: newRowId(),
    weekday: new Date().getDay(),
    start: '09:00',
    end: '10:30',
    label: '',
  };
}

/** @param {Array<{ weekday?: number, start?: string, end?: string, label?: string }> | undefined} slots */
function normalizeDraft(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [emptySlot()];
  }
  return slots.map((s) => ({
    rowId: newRowId(),
    weekday: Number.isInteger(Number(s.weekday)) ? Number(s.weekday) : 1,
    start: typeof s.start === 'string' ? s.start : '09:00',
    end: typeof s.end === 'string' ? s.end : '10:30',
    label: typeof s.label === 'string' ? s.label : '',
  }));
}

/** @param {Array<{ weekday?: number, start?: string, end?: string, label?: string }> | undefined} slots */
function normalizeReadOnly(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return [];
  return slots.map((s) => ({
    weekday: Number.isInteger(Number(s.weekday)) ? Number(s.weekday) : 0,
    start: typeof s.start === 'string' ? s.start : '',
    end: typeof s.end === 'string' ? s.end : '',
    label: typeof s.label === 'string' ? s.label : '',
  }));
}

/**
 * @param {{
 *   value: number,
 *   onChange: (weekday: number) => void,
 * }} props
 */
function WeekdayPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day of week">
      {WEEKDAY_LABELS.map((label, wd) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(wd)}
          className={`min-h-[40px] min-w-[2.5rem] rounded-xl px-2 text-[11px] font-bold uppercase tracking-wide transition ${
            value === wd
              ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-md ring-2 ring-cyan-400/40 dark:from-cyan-700 dark:to-cyan-900'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-600'
          }`}
        >
          {label.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

/**
 * Mini month grid: set one weekday per tap, or toggle multiple weekdays (same times via bulk action below).
 * @param {{
 *   variant?: 'pickOne' | 'toggleMany',
 *   selectedWeekday: number,
 *   selectedWeekdays?: number[],
 *   onPickDate?: (d: Date) => void,
 *   onToggleWeekday?: (weekday: number) => void,
 * }} props
 */
function SlotCalendarMini({
  variant = 'pickOne',
  selectedWeekday,
  selectedWeekdays = [],
  onPickDate,
  onToggleWeekday,
}) {
  const anchorWeekday = useMemo(() => {
    if (variant === 'toggleMany' && selectedWeekdays.length > 0) {
      return selectedWeekdays[0];
    }
    return selectedWeekday;
  }, [variant, selectedWeekdays, selectedWeekday]);

  const anchor = useMemo(() => {
    let y = new Date().getFullYear();
    let m = new Date().getMonth();
    const target = anchorWeekday ?? 1;
    for (let delta = 0; delta < 14; delta += 1) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + delta);
      if (d.getDay() === target) {
        y = d.getFullYear();
        m = d.getMonth();
        break;
      }
    }
    return { y, m };
  }, [anchorWeekday]);

  const [viewY, setViewY] = useState(anchor.y);
  const [viewM, setViewM] = useState(anchor.m);

  useEffect(() => {
    setViewY(anchor.y);
    setViewM(anchor.m);
  }, [anchor.y, anchor.m]);

  const bump = (delta) => {
    const d = new Date(viewY, viewM + delta, 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  };

  const first = new Date(viewY, viewM, 1);
  const lastDate = new Date(viewY, viewM + 1, 0).getDate();
  const pad = first.getDay();
  const cells = [];
  for (let i = 0; i < pad; i += 1) cells.push(null);
  for (let d = 1; d <= lastDate; d += 1) cells.push(d);

  const title = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(viewY, viewM, 1));

  const cellActive = (dow) => {
    if (variant === 'toggleMany') {
      return selectedWeekdays.includes(dow);
    }
    return dow === selectedWeekday;
  };

  const handleDayClick = (dateObj) => {
    const dow = dateObj.getDay();
    if (variant === 'toggleMany' && onToggleWeekday) {
      onToggleWeekday(dow);
    } else if (onPickDate) {
      onPickDate(dateObj);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-2 shadow-inner dark:border-slate-600 dark:bg-slate-900/50">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          {title}
        </span>
        <button
          type="button"
          onClick={() => bump(1)}
          className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="py-0.5">
            {d.slice(0, 1)}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((dayNum, idx) => {
          if (dayNum === null) {
            return (
              <span
                key={`pad-${viewY}-${viewM}-${idx}`}
                className="aspect-square min-h-[1.75rem]"
              />
            );
          }
          const dateObj = new Date(viewY, viewM, dayNum);
          const dow = dateObj.getDay();
          const active = cellActive(dow);
          return (
            <button
              key={`${viewY}-${viewM}-${dayNum}`}
              type="button"
              onClick={() => handleDayClick(dateObj)}
              className={`aspect-square min-h-[1.75rem] rounded-lg text-xs font-medium transition active:scale-95 ${
                active
                  ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-md ring-2 ring-cyan-400/50 ring-offset-1 dark:from-cyan-700 dark:to-cyan-900 dark:ring-cyan-600'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        {variant === 'toggleMany' ? (
          <>
            <span className="font-semibold text-cyan-700 dark:text-cyan-400">
              {selectedWeekdays.length}
            </span>{' '}
            weekday{selectedWeekdays.length === 1 ? '' : 's'} selected — tap any
            date to toggle that day of the week.
          </>
        ) : (
          <>
            Tap a date so this row repeats every{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {WEEKDAY_LABELS[selectedWeekday]}
            </span>
            .
          </>
        )}
      </p>
    </div>
  );
}

/**
 * @param {{
 *   slots: Array<{ rowId: string, weekday: number, start: string, end: string, label: string }>,
 * }} props
 */
function WeekAtAGlance({ slots }) {
  const sorted = useMemo(() => {
    return [...slots].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return slotMinutes(a.start) - slotMinutes(b.start);
    });
  }, [slots]);

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50/95 via-white to-cyan-50/30 px-4 py-3 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        <Clock className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
        Week at a glance
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sorted.map((s) => (
          <span
            key={s.rowId}
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm dark:border-cyan-900/50 dark:bg-slate-800 dark:text-slate-100"
          >
            <span className="font-bold text-cyan-700 dark:text-cyan-400">
              {WEEKDAY_LABELS[s.weekday]}
            </span>
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              {s.start}–{s.end}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Click a weekday column to scroll to the first slot on that day.
 * @param {{
 *   slots: Array<{ rowId: string, weekday: number, start: string, end: string, label: string }>,
 * }} props
 */
function WeekDensityStrip({ slots }) {
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const s of slots) {
      const wd = Number(s.weekday);
      if (wd >= 0 && wd <= 6) c[wd] += 1;
    }
    return c;
  }, [slots]);

  const scrollToDay = (wd) => {
    document
      .querySelector(`[data-schedule-slot-weekday="${wd}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
      <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        <Layers className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
        Sessions per day
      </p>
      <div className="flex gap-1">
        {WEEKDAY_LABELS.map((label, wd) => {
          const n = counts[wd];
          const has = n > 0;
          return (
            <button
              key={label}
              type="button"
              onClick={() => scrollToDay(wd)}
              title={`Jump to ${label}`}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl border text-[10px] font-bold transition hover:ring-2 hover:ring-cyan-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                has
                  ? 'border-cyan-300/80 bg-gradient-to-b from-cyan-600 to-cyan-700 text-white shadow-md dark:border-cyan-800 dark:from-cyan-800 dark:to-cyan-950'
                  : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-500'
              }`}
            >
              <span>{label.slice(0, 1)}</span>
              {has ? (
                <span className="mt-0.5 text-[9px] font-semibold opacity-90">
                  ×{n}
                </span>
              ) : (
                <span className="mt-0.5 text-[9px] opacity-60">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   chatId: string,
 *   initialSlots?: Array<{ weekday?: number, start?: string, end?: string, label?: string }>,
 *   onSaved?: () => void,
 *   canEdit?: boolean,
 *   showTrigger?: boolean,
 *   open?: boolean,
 *   onOpenChange?: (open: boolean) => void,
 * }} props
 */
function ClassroomScheduleEditor({
  chatId,
  initialSlots,
  onSaved,
  canEdit = true,
  showTrigger = true,
  open: controlledOpen,
  onOpenChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const modalOpen = isControlled ? controlledOpen : internalOpen;

  const updateModalOpen = (next) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [slots, setSlots] = useState(() => normalizeDraft(initialSlots));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [quickDays, setQuickDays] = useState(() => []);
  const [quickStart, setQuickStart] = useState('09:00');
  const [quickEnd, setQuickEnd] = useState('10:30');
  const [quickLabel, setQuickLabel] = useState('');

  useEffect(() => {
    if (modalOpen) setNowTick(Date.now());
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (canEdit) {
      setSlots(normalizeDraft(initialSlots));
      setError('');
      setQuickDays([]);
    }
  }, [modalOpen, initialSlots, canEdit]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') updateModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const nextMs = useMemo(() => {
    const list = canEdit ? slots : normalizeReadOnly(initialSlots);
    if (!Array.isArray(list) || list.length === 0) return null;
    const payload = list.map((s) => ({
      weekday: Number(s.weekday),
      start: String(s.start || '09:00'),
    }));
    return earliestNextOccurrenceMs(payload);
  }, [canEdit, slots, initialSlots]);

  const countdownLabel = useMemo(
    () => formatCountdownFromNow(nextMs, nowTick),
    [nextMs, nowTick],
  );

  const updateSlot = (rowId, patch) => {
    setSlots((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, emptySlot()]);
  };

  const removeSlot = (rowId) => {
    setSlots((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  /** Append rows copying times/label from template row (same slot block). */
  const duplicateRowsFromTemplate = (rowId, weekdays) => {
    setSlots((prev) => {
      const row = prev.find((r) => r.rowId === rowId);
      if (!row || weekdays.length === 0) return prev;
      const labelTrim = row.label?.trim() ?? '';
      const additions = weekdays.map((wd) => ({
        rowId: newRowId(),
        weekday: wd,
        start: row.start,
        end: row.end,
        label: labelTrim,
      }));
      return [...prev, ...additions];
    });
    toast.success(
      weekdays.length === 1
        ? 'Added 1 row with the same times.'
        : `Added ${weekdays.length} rows with the same times.`,
    );
  };

  const toggleQuickDay = (wd) => {
    setQuickDays((prev) =>
      prev.includes(wd)
        ? prev.filter((d) => d !== wd)
        : [...prev, wd].sort((a, b) => a - b),
    );
  };

  const applyQuickAdd = () => {
    setError('');
    if (!HH_MM.test(quickStart) || !HH_MM.test(quickEnd)) {
      setError('Quick add: use valid start and end times (HH:mm).');
      return;
    }
    const sm = slotMinutes(quickStart);
    const em = slotMinutes(quickEnd);
    if (!(sm < em)) {
      setError('Quick add: start must be before end.');
      return;
    }
    if (quickDays.length === 0) {
      setError('Quick add: select at least one weekday.');
      return;
    }

    const labelTrim = quickLabel.trim();
    const next = [...slots];
    let added = 0;
    for (const wd of quickDays) {
      next.push({
        rowId: newRowId(),
        weekday: wd,
        start: quickStart,
        end: quickEnd,
        label: labelTrim,
      });
      added += 1;
    }
    setSlots(next);
    toast.success(
      added === 1
        ? 'Added 1 weekly slot.'
        : `Added ${added} weekly slots.`,
    );
  };

  const submit = async () => {
    setError('');
    const localCheck = validateDraftSlots(slots);
    if (!localCheck.ok) {
      setError(localCheck.message);
      return;
    }

    setSaving(true);
    try {
      const payloadSlots = slots.map((s) => {
        const base = {
          weekday: Number(s.weekday),
          start: String(s.start || '09:00'),
          end: String(s.end || '10:00'),
        };
        if (s.label?.trim()) {
          return { ...base, label: s.label.trim() };
        }
        return base;
      });

      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/schedule`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: payloadSlots }),
        },
      );
      await readJsonOrThrow(res, 'Could not save schedule');
      window.dispatchEvent(new CustomEvent(SCHEDULE_SAVED_EVENT));
      toast.success('Schedule saved. Dashboard updated.');
      onSaved?.();
      updateModalOpen(false);
    } catch (err) {
      setError(err?.message || 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  const modal = modalOpen
    ? createPortal(
        <div className="fixed inset-0 z-[1005] flex items-center justify-center px-3 py-8">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => updateModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.35)] dark:border-slate-600 dark:bg-slate-900"
          >
            <div className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-gradient-to-br from-cyan-50/95 via-white to-indigo-50/40 px-5 py-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95 md:px-7">
              <div className="pointer-events-none absolute -right-16 -top-12 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10" />
              <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-indigo-400/10 blur-2xl dark:bg-indigo-500/5" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/95 text-cyan-700 shadow-lg ring-1 ring-cyan-200/90 dark:bg-slate-800 dark:text-cyan-300 dark:ring-cyan-900/60">
                    <CalendarDays className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/90 bg-white/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-800 shadow-sm dark:border-cyan-900/50 dark:bg-slate-800/90 dark:text-cyan-300">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Recurring weekly
                    </span>
                    <h2
                      id="schedule-modal-title"
                      className="font-display mt-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-white"
                    >
                      Class schedule
                    </h2>
                    <p className="mt-1 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Build your rhythm: overlap times across courses if you need
                      to — everything saves for your dashboard and reminders.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50/95 to-cyan-50/40 px-5 py-3.5 dark:border-slate-700 dark:from-slate-800/90 dark:to-slate-900/95 md:px-7">
              {countdownLabel ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-cyan-800 shadow-sm ring-1 ring-cyan-200/70 dark:bg-slate-800 dark:text-cyan-300 dark:ring-cyan-900/60">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Next session
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {countdownLabel}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {!canEdit && normalizeReadOnly(initialSlots).length === 0
                    ? 'No class times published yet.'
                    : canEdit && slots.length === 0
                      ? 'Add weekly times below.'
                      : 'No upcoming sessions match these times.'}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
              {!canEdit && normalizeReadOnly(initialSlots).length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  No class times published yet.
                </p>
              ) : null}

              {!canEdit && normalizeReadOnly(initialSlots).length > 0 ? (
                <>
                  <WeekAtAGlance
                    slots={normalizeReadOnly(initialSlots).map((s, i) => ({
                      rowId: `readonly-${i}-${s.weekday}-${s.start}-${s.end}`,
                      weekday: s.weekday,
                      start: s.start,
                      end: s.end,
                      label: s.label ?? '',
                    }))}
                  />
                  <div className="mt-4">
                    <WeekDensityStrip
                      slots={normalizeReadOnly(initialSlots).map((s, i) => ({
                        rowId: `readonly-strip-${i}`,
                        weekday: s.weekday,
                        start: s.start,
                        end: s.end,
                        label: s.label ?? '',
                      }))}
                    />
                  </div>
                  <ul className="mt-4 space-y-3">
                    {normalizeReadOnly(initialSlots).map((s, i) => (
                      <li
                        key={`ro-${i}-${s.weekday}-${s.start}-${s.end}-${s.label ?? ''}`}
                        data-schedule-slot-weekday={s.weekday}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50"
                      >
                        <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {WEEKDAY_LABELS[s.weekday]} · {s.start}–{s.end}
                        </p>
                        {s.label ? (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {s.label}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {canEdit ? (
                <div className="space-y-5">
                  <WeekAtAGlance slots={slots} />

                  <WeekDensityStrip slots={slots} />

                  <section className="rounded-2xl border border-dashed border-cyan-300/70 bg-gradient-to-br from-cyan-50/50 to-white p-5 shadow-sm dark:border-cyan-900/50 dark:from-slate-900 dark:to-slate-950/95">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                        <Zap className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          Quick add several days
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          Toggle weekdays below, set one time block, then apply —
                          perfect for MWF or T/Th patterns. Edit individual rows
                          anytime.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {WEEKDAY_LABELS.map((label, wd) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleQuickDay(wd)}
                          className={`min-h-[38px] min-w-[2.35rem] rounded-lg px-2 text-[10px] font-bold uppercase tracking-wide transition ${
                            quickDays.includes(wd)
                              ? 'bg-slate-900 text-white shadow-md dark:bg-cyan-800'
                              : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {label.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Start
                        <input
                          type="time"
                          value={quickStart}
                          onChange={(e) => setQuickStart(e.target.value)}
                          className="input-field h-10 text-sm"
                        />
                      </label>
                      <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        End
                        <input
                          type="time"
                          value={quickEnd}
                          onChange={(e) => setQuickEnd(e.target.value)}
                          className="input-field h-10 text-sm"
                        />
                      </label>
                    </div>
                    <label className="mt-3 grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Instructor (optional, applied to each new row)
                      <input
                        type="text"
                        value={quickLabel}
                        onChange={(e) => setQuickLabel(e.target.value)}
                        placeholder="Optional"
                        className="input-field h-10 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={applyQuickAdd}
                      className="btn-secondary mt-4 w-full px-4 py-2.5 text-sm font-semibold sm:w-auto"
                    >
                      Apply to selected days
                    </button>
                  </section>

                  {slots.map((row) => (
                    <ScheduleSlotBlock
                      key={row.rowId}
                      row={row}
                      onChange={(patch) => updateSlot(row.rowId, patch)}
                      onRemove={() => removeSlot(row.rowId)}
                      onBulkDuplicateWeekdays={duplicateRowsFromTemplate}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {canEdit ? (
              <div className="flex shrink-0 flex-wrap gap-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/98 to-white px-5 py-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 md:px-7">
                <button
                  type="button"
                  onClick={addSlot}
                  aria-label="Add another weekly time slot"
                  className="btn-secondary flex-1 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm sm:flex-none"
                >
                  + Add slot
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={submit}
                  className="btn-primary flex-1 rounded-xl px-8 py-3 text-sm font-semibold shadow-lg disabled:opacity-50 sm:flex-none"
                >
                  {saving ? 'Saving…' : 'Save schedule'}
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700 md:px-6">
                <button
                  type="button"
                  onClick={() => updateModalOpen(false)}
                  className="btn-secondary w-full py-2.5 text-sm"
                >
                  Close
                </button>
              </div>
            )}

            {error ? (
              <p className="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 md:px-6">
                {error}
              </p>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => updateModalOpen(true)}
          className="btn-secondary mt-3 inline-flex w-full justify-center rounded-xl px-5 py-3 text-sm font-semibold shadow-sm ring-1 ring-slate-200/80 transition hover:ring-cyan-300/50 dark:ring-slate-600"
        >
          Schedule
        </button>
      ) : null}
      {modal}
    </>
  );
}

/**
 * @param {{
 *   row: { rowId: string, weekday: number, start: string, end: string, label: string },
 *   onChange: (patch: Partial<{ weekday: number, start: string, end: string, label: string }>) => void,
 *   onRemove: () => void,
 *   onBulkDuplicateWeekdays: (rowId: string, weekdays: number[]) => void,
 * }} props
 */
function ScheduleSlotBlock({
  row,
  onChange,
  onRemove,
  onBulkDuplicateWeekdays,
}) {
  const [bulkWeekdays, setBulkWeekdays] = useState([]);

  useEffect(() => {
    setBulkWeekdays([]);
  }, [row.rowId]);

  const toggleBulkWd = (wd) => {
    setBulkWeekdays((prev) =>
      prev.includes(wd)
        ? prev.filter((x) => x !== wd)
        : [...prev, wd].sort((a, b) => a - b),
    );
  };

  const applyBulkDuplicate = () => {
    if (bulkWeekdays.length === 0) {
      toast.info('Tap dates in the calendar below to choose weekdays first.');
      return;
    }
    onBulkDuplicateWeekdays(row.rowId, bulkWeekdays);
    setBulkWeekdays([]);
  };

  return (
    <div
      data-schedule-slot-weekday={row.weekday}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/95 p-5 shadow-md ring-1 ring-slate-100/80 transition hover:border-cyan-300/70 hover:shadow-lg dark:border-slate-600 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95 dark:ring-slate-800 dark:hover:border-cyan-800/80"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl dark:bg-cyan-600/10" />
      <div className="relative mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-white dark:bg-cyan-900">
            {WEEKDAY_LABELS[row.weekday].slice(0, 1)}
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Time slot
            </p>
            <p className="font-display text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {row.start} – {row.end}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          Remove
        </button>
      </div>

      <p className="mb-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        Primary day (chips)
      </p>
      <WeekdayPicker value={row.weekday} onChange={(wd) => onChange({ weekday: wd })} />
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Repeats every{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {WEEKDAY_LABELS[row.weekday]}
        </span>
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Calendar · single day
          </p>
          <SlotCalendarMini
            variant="pickOne"
            selectedWeekday={row.weekday}
            selectedWeekdays={[]}
            onPickDate={(d) => onChange({ weekday: d.getDay() })}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Calendar · multi-day (same start/end)
          </p>
          <SlotCalendarMini
            variant="toggleMany"
            selectedWeekday={row.weekday}
            selectedWeekdays={bulkWeekdays}
            onToggleWeekday={toggleBulkWd}
          />
          <button
            type="button"
            onClick={applyBulkDuplicate}
            className="btn-primary mt-3 w-full px-4 py-2.5 text-sm font-semibold shadow-md"
          >
            Add rows for selected weekdays
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Start
          <input
            type="time"
            value={row.start}
            onChange={(e) => onChange({ start: e.target.value })}
            className="input-field h-11 text-sm font-medium tabular-nums"
          />
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          End
          <input
            type="time"
            value={row.end}
            onChange={(e) => onChange({ end: e.target.value })}
            className="input-field h-11 text-sm font-medium tabular-nums"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        Label / instructor (optional)
        <input
          type="text"
          value={row.label}
          placeholder="e.g. Lab section, room number"
          onChange={(e) => onChange({ label: e.target.value })}
          className="input-field h-11 text-sm"
        />
      </label>
    </div>
  );
}

export default ClassroomScheduleEditor;
