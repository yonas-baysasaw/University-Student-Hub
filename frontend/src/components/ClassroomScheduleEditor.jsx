import { Clock, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { SCHEDULE_SAVED_EVENT } from '../constants/dashboardEvents.js';
import {
  emptyPattern,
  formatRecurrenceSummary,
  getRecurrenceOptions,
  patternsToSlots,
  slotsToPatterns,
  validatePatterns,
  WEEKDAY_SHORT,
} from '../utils/classScheduleDraft.js';
import { notifyCalendarInvalidate } from '../utils/calendarEvents.js';
import { readJsonOrThrow } from '../utils/http';
import {
  earliestNextOccurrenceMs,
  formatCountdownFromNow,
} from '../utils/scheduleCountdown.js';

const RECURRENCE_OPTIONS = getRecurrenceOptions();

/**
 * @param {{
 *   pattern: ReturnType<typeof emptyPattern>,
 *   onChange: (patch: Partial<ReturnType<typeof emptyPattern>>) => void,
 *   onRemove: () => void,
 *   canRemove: boolean,
 *   index: number,
 * }} props
 */
function MeetingPatternRow({
  pattern,
  onChange,
  onRemove,
  canRemove,
  index,
}) {
  const toggleCustomDay = (wd) => {
    const prev = pattern.customDays ?? [];
    const next = prev.includes(wd)
      ? prev.filter((d) => d !== wd)
      : [...prev, wd].sort((a, b) => a - b);
    onChange({ customDays: next });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Meeting {index + 1}
        </p>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className="sr-only">Title</span>
        <input
          type="text"
          value={pattern.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Add title"
          className="w-full border-0 border-b border-slate-200 bg-transparent py-2 text-lg font-semibold text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-600 dark:text-slate-50"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Start
          </span>
          <input
            type="time"
            value={pattern.start}
            onChange={(e) => onChange({ start: e.target.value })}
            className="input-field mt-1 h-10 w-full text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            End
          </span>
          <input
            type="time"
            value={pattern.end}
            onChange={(e) => onChange({ end: e.target.value })}
            className="input-field mt-1 h-10 w-full text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Repeat
        </span>
        <select
          value={pattern.recurrence}
          onChange={(e) => onChange({ recurrence: e.target.value })}
          className="input-field mt-1 h-10 w-full text-sm"
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {pattern.recurrence === 'custom' ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            Repeat on
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Repeat on days">
            {WEEKDAY_SHORT.map((label, wd) => {
              const active = (pattern.customDays ?? []).includes(wd);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleCustomDay(wd)}
                  aria-pressed={active}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition ${
                    active
                      ? 'bg-cyan-600 text-white shadow-sm dark:bg-cyan-700'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {label.slice(0, 1)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Location
        </span>
        <div className="relative mt-1">
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={pattern.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Add location"
            className="input-field h-10 w-full pl-9 text-sm"
          />
        </div>
      </label>
    </div>
  );
}

/**
 * @param {{
 *   chatId: string,
 *   classroomName?: string,
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
  classroomName = '',
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

  const [patterns, setPatterns] = useState(() => slotsToPatterns(initialSlots));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());

  const readOnlyPatterns = useMemo(() => {
    if (!Array.isArray(initialSlots) || initialSlots.length === 0) return [];
    return slotsToPatterns(initialSlots);
  }, [initialSlots]);

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
      setPatterns(slotsToPatterns(initialSlots));
      setError('');
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
    const slots = canEdit
      ? patternsToSlots(patterns)
      : patternsToSlots(readOnlyPatterns);
    if (slots.length === 0) return null;
    return earliestNextOccurrenceMs(
      slots.map((s) => ({
        weekday: Number(s.weekday),
        start: String(s.start || '09:00'),
      })),
    );
  }, [canEdit, patterns, readOnlyPatterns]);

  const countdownLabel = useMemo(
    () => formatCountdownFromNow(nextMs, nowTick),
    [nextMs, nowTick],
  );

  const updatePattern = (rowId, patch) => {
    setPatterns((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  };

  const addPattern = () => {
    setPatterns((prev) => [...prev, emptyPattern()]);
  };

  const removePattern = (rowId) => {
    setPatterns((prev) => {
      const next = prev.filter((row) => row.rowId !== rowId);
      return next.length > 0 ? next : [emptyPattern()];
    });
  };

  const submit = async () => {
    setError('');
    const localCheck = validatePatterns(patterns);
    if (!localCheck.ok) {
      setError(localCheck.message);
      return;
    }

    setSaving(true);
    try {
      const payloadSlots = patternsToSlots(patterns);

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
      notifyCalendarInvalidate();
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
        <div className="fixed inset-0 z-[1005] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => updateModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => updateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              {canEdit ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={submit}
                  className="btn-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateModalOpen(false)}
                  className="btn-secondary rounded-full px-5 py-2 text-sm font-semibold"
                >
                  Close
                </button>
              )}
            </div>

            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <h2
                id="schedule-modal-title"
                className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
              >
                Weekly class schedule
              </h2>
              {classroomName ? (
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                  {classroomName}
                </p>
              ) : null}
              {countdownLabel ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Clock className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
                  <span>
                    Next session:{' '}
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {countdownLabel}
                    </span>
                  </span>
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {!canEdit && readOnlyPatterns.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  No class times published yet.
                </p>
              ) : null}

              {!canEdit && readOnlyPatterns.length > 0 ? (
                <ul className="space-y-3">
                  {readOnlyPatterns.map((p) => (
                    <li
                      key={p.rowId}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50"
                    >
                      {p.title ? (
                        <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {p.title}
                        </p>
                      ) : null}
                      <p
                        className={`text-sm text-slate-700 dark:text-slate-200${p.title ? ' mt-1' : ''}`}
                      >
                        {formatRecurrenceSummary(p)} · {p.start}–{p.end}
                      </p>
                      {p.location ? (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {p.location}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {canEdit ? (
                <div className="space-y-4">
                  {patterns.map((pattern, index) => (
                    <MeetingPatternRow
                      key={pattern.rowId}
                      pattern={pattern}
                      index={index}
                      canRemove={patterns.length > 1}
                      onChange={(patch) => updatePattern(pattern.rowId, patch)}
                      onRemove={() => removePattern(pattern.rowId)}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={addPattern}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add meeting time
                  </button>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
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

export default ClassroomScheduleEditor;
