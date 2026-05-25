import { Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { readJsonOrThrow } from '../../utils/http';
import { notifyCalendarInvalidate } from '../../utils/calendarEvents.js';

/**
 * @param {string | null | undefined} iso
 */
export function isoToDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * @param {Date} d
 */
export function dateToDatetimeLocalValue(d) {
  return isoToDatetimeLocalValue(d.toISOString());
}

/**
 * @param {string} local
 */
function datetimeLocalToIso(local) {
  if (!local?.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * @param {string} local YYYY-MM-DD from date input
 */
function dateInputToIsoEndOfDay(local) {
  if (!local?.trim()) return null;
  const d = new Date(`${local}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
];

const REMINDER_OPTIONS = [
  { value: '', label: 'None' },
  { value: '10', label: '10 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

const EMPTY_FORM = {
  title: '',
  startsAtLocal: '',
  endsAtLocal: '',
  allDay: false,
  description: '',
  location: '',
  meetingUrl: '',
  recurrence: 'none',
  recurrenceUntilLocal: '',
  reminderMinutesBefore: '',
};

/**
 * @param {{
 *   open: boolean;
 *   mode: 'create' | 'edit';
 *   personalId?: string | null;
 *   initial?: Partial<typeof EMPTY_FORM>;
 *   onClose: () => void;
 *   onSaved: () => void;
 * }} props
 */
export default function CalendarEventModal({
  open,
  mode,
  personalId = null,
  initial = {},
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initial });
    }
  }, [open, initial]);

  if (!open) return null;

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }
    const startsAt = datetimeLocalToIso(form.startsAtLocal);
    const endsAt = datetimeLocalToIso(form.endsAtLocal);
    if (!startsAt) {
      toast.error('Start date and time are required');
      return;
    }
    if (!endsAt) {
      toast.error('End date and time are required');
      return;
    }

    setBusy(true);
    try {
      const body = {
        title,
        startsAt,
        endsAt,
        allDay: form.allDay,
        description: form.description,
        location: form.location,
        meetingUrl: form.meetingUrl,
        recurrence: form.recurrence,
        recurrenceUntil: form.recurrenceUntilLocal
          ? dateInputToIsoEndOfDay(form.recurrenceUntilLocal)
          : null,
        reminderMinutesBefore:
          form.reminderMinutesBefore === ''
            ? null
            : Number(form.reminderMinutesBefore),
      };

      const url =
        mode === 'edit' && personalId
          ? `/api/calendar/personal/${encodeURIComponent(personalId)}`
          : '/api/calendar/personal';
      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await readJsonOrThrow(res, 'Could not save event');
      toast.success(mode === 'edit' ? 'Event updated' : 'Event created');
      notifyCalendarInvalidate();
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not save event');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!personalId) return;
    if (!window.confirm('Delete this personal event?')) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/calendar/personal/${encodeURIComponent(personalId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Could not delete event');
      toast.success('Event deleted');
      notifyCalendarInvalidate();
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not delete event');
    } finally {
      setDeleteBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-modal-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="calendar-event-modal-title"
            className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            {mode === 'edit' ? 'Edit event' : 'Create event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-4 py-4"
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Add title"
              className="mt-1 w-full border-0 border-b border-slate-200 bg-transparent py-2 text-xl font-semibold text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-600 dark:text-slate-50"
              autoFocus
            />
          </label>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Starts
              </span>
              <input
                type="datetime-local"
                value={form.startsAtLocal}
                onChange={(e) => setField('startsAtLocal', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Ends
              </span>
              <input
                type="datetime-local"
                value={form.endsAtLocal}
                onChange={(e) => setField('endsAtLocal', e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setField('allDay', e.target.checked)}
              className="rounded border-slate-300"
            />
            All day
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Repeat
            </span>
            <select
              value={form.recurrence}
              onChange={(e) => setField('recurrence', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {form.recurrence !== 'none' ? (
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Repeat until (optional)
              </span>
              <input
                type="date"
                value={form.recurrenceUntilLocal}
                onChange={(e) =>
                  setField('recurrenceUntilLocal', e.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          ) : null}

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Reminder
            </span>
            <select
              value={form.reminderMinutesBefore}
              onChange={(e) =>
                setField('reminderMinutesBefore', e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Location
            </span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Add location"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Meeting link
            </span>
            <input
              type="url"
              value={form.meetingUrl}
              onChange={(e) => setField('meetingUrl', e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="Add description"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            {mode === 'edit' && personalId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy || busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deleteBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
