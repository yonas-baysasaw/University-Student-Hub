import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
 * Cross-classroom duplicates are enforced on the server.
 * @param {Array<{ weekday: number, start: string, end: string, label?: string }>} rows
 */
function validateDraftSlots(rows) {
  const seen = new Set();
  for (const row of rows) {
    const wd = Number(row.weekday);
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
    const triple = `${wd}|${start}|${end}`;
    if (seen.has(triple)) {
      return {
        ok: false,
        message:
          'Two rows use the same weekday with identical start and end times. Remove one or change the times.',
      };
    }
    seen.add(triple);
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
 *   year: number,
 *   month: number,
 *   selectedWeekday: number,
 *   onPickDate: (d: Date) => void,
 *   onPrevMonth: () => void,
 *   onNextMonth: () => void,
 * }} props
 */
function MiniCalendar({
  year,
  month,
  selectedWeekday,
  onPickDate,
  onPrevMonth,
  onNextMonth,
}) {
  const first = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const pad = first.getDay();
  const cells = [];
  for (let i = 0; i < pad; i += 1) cells.push(null);
  for (let d = 1; d <= lastDate; d += 1) cells.push(d);

  const title = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          {title}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
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
                // biome-ignore lint/suspicious/noArrayIndexKey: Leading blanks are fixed positions for this month grid.
                key={`pad-${year}-${month}-${idx}`}
                className="aspect-square min-h-[1.75rem]"
              />
            );
          }
          const dateObj = new Date(year, month, dayNum);
          const dow = dateObj.getDay();
          const isWeekdayMatch = dow === selectedWeekday;
          return (
            <button
              key={`${year}-${month}-${dayNum}`}
              type="button"
              onClick={() => onPickDate(dateObj)}
              className={`aspect-square min-h-[1.75rem] rounded-lg text-xs font-medium transition ${
                isWeekdayMatch
                  ? 'bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-400 ring-offset-1 dark:bg-cyan-700 dark:ring-cyan-600'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Tap a date — this row repeats every {WEEKDAY_LABELS[selectedWeekday]}.
        Other rows can use the same weekday with different times.
      </p>
    </div>
  );
}

/**
 * @param {{
 *   chatId: string,
 *   initialSlots?: Array<{ weekday?: number, start?: string, end?: string, label?: string }>,
 *   onSaved?: () => void,
 *   canEdit?: boolean,
 * }} props
 */
function ClassroomScheduleEditor({
  chatId,
  initialSlots,
  onSaved,
  canEdit = true,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [slots, setSlots] = useState(() => normalizeDraft(initialSlots));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());

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
    }
  }, [modalOpen, initialSlots, canEdit]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setModalOpen(false);
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
      onSaved?.();
      setModalOpen(false);
    } catch (err) {
      setError(err?.message || 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  const modal = modalOpen
    ? createPortal(
        <div className="fixed inset-0 z-[1001] flex items-center justify-center px-3 py-8">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2
                id="schedule-modal-title"
                className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50"
              >
                Schedule
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-slate-100 bg-slate-50/90 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80">
              {countdownLabel ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                    Next class in{' '}
                  </span>
                  {countdownLabel}
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

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!canEdit && normalizeReadOnly(initialSlots).length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  No class times published yet.
                </p>
              ) : null}

              {!canEdit && normalizeReadOnly(initialSlots).length > 0 ? (
                <ul className="space-y-3">
                  {normalizeReadOnly(initialSlots).map((s) => (
                    <li
                      key={`ro-${s.weekday}-${s.start}-${s.end}-${s.label ?? ''}`}
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
              ) : null}

              {canEdit ? (
                <div className="space-y-5">
                  <p
                    id="schedule-editor-hint"
                    className="text-xs leading-relaxed text-slate-600 dark:text-slate-400"
                  >
                    Weekly times sync to the dashboard.{' '}
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">
                      Same day, different times
                    </strong>{' '}
                    (for example a morning and afternoon class): click{' '}
                    <strong>Add time slot</strong> again and pick the same
                    weekday on each row—only the start/end times need to differ.
                    To list a <strong>different course title</strong>, create
                    another classroom on the Classrooms page—each classroom has
                    one course name.
                  </p>
                  {slots.map((row) => (
                    <ScheduleSlotBlock
                      key={row.rowId}
                      row={row}
                      onChange={(patch) => updateSlot(row.rowId, patch)}
                      onRemove={() => removeSlot(row.rowId)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {canEdit ? (
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={addSlot}
                  aria-describedby="schedule-editor-hint"
                  className="btn-secondary flex-1 px-4 py-2.5 text-sm sm:flex-none"
                >
                  Add time slot
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={submit}
                  className="btn-primary flex-1 px-6 py-2.5 text-sm disabled:opacity-50 sm:flex-none"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary w-full py-2.5 text-sm"
                >
                  Close
                </button>
              </div>
            )}

            {error ? (
              <p className="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
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
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="btn-secondary mt-3 inline-flex w-full justify-center px-4 py-2.5 text-sm font-semibold"
      >
        Schedule
      </button>
      {modal}
    </>
  );
}

/**
 * @param {{
 *   row: { rowId: string, weekday: number, start: string, end: string, label: string },
 *   onChange: (patch: Partial<{ weekday: number, start: string, end: string, label: string }>) => void,
 *   onRemove: () => void,
 * }} props
 */
function ScheduleSlotBlock({ row, onChange, onRemove }) {
  const anchor = useMemo(() => {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth();
    if (row.weekday !== undefined) {
      for (let delta = 0; delta < 14; delta += 1) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + delta);
        if (d.getDay() === row.weekday) {
          y = d.getFullYear();
          m = d.getMonth();
          break;
        }
      }
    }
    return { y, m };
  }, [row.weekday]);

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

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-sm dark:border-slate-600 dark:from-slate-900 dark:to-slate-900/80">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Class time
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
        >
          Remove
        </button>
      </div>

      <MiniCalendar
        year={viewY}
        month={viewM}
        selectedWeekday={row.weekday}
        onPickDate={(d) => onChange({ weekday: d.getDay() })}
        onPrevMonth={() => bump(-1)}
        onNextMonth={() => bump(1)}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Start
          <input
            type="time"
            value={row.start}
            onChange={(e) => onChange({ start: e.target.value })}
            className="input-field h-10 text-sm"
          />
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          End
          <input
            type="time"
            value={row.end}
            onChange={(e) => onChange({ end: e.target.value })}
            className="input-field h-10 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        Professor / Instructor (optional)
        <input
          type="text"
          value={row.label}
          placeholder="Name"
          onChange={(e) => onChange({ label: e.target.value })}
          className="input-field h-10 text-sm"
        />
      </label>
    </div>
  );
}

export default ClassroomScheduleEditor;
