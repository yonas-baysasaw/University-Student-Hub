import { useEffect, useState } from 'react';
import { readJsonOrThrow } from '../utils/http';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function newRowId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySlot() {
  return {
    rowId: newRowId(),
    weekday: 1,
    start: '09:00',
    end: '10:30',
    label: '',
  };
}

function normalizeIncoming(slots) {
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

/**
 * @param {{ chatId: string, initialSlots?: Array<{ weekday?: number, start?: string, end?: string, label?: string }>, onSaved?: () => void }} props
 */
function ClassroomScheduleEditor({ chatId, initialSlots, onSaved }) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState(() => normalizeIncoming(initialSlots));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSlots(normalizeIncoming(initialSlots));
      setError('');
    }
  }, [open, initialSlots]);

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
    setSaving(true);
    setError('');
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
      onSaved?.();
      setOpen(false);
    } catch (err) {
      setError(err?.message || 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-cyan-700 underline decoration-cyan-700/30 underline-offset-2 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
      >
        {open ? 'Hide weekly schedule' : 'Weekly schedule (for dashboard)'}
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add meeting times so they appear under &quot;Today&apos;s
            classes&quot; on your dashboard. Times use 24h format.
          </p>

          <div className="space-y-2">
            {slots.map((row) => (
              <div
                key={row.rowId}
                className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-600 dark:bg-slate-800/40"
              >
                <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Day
                  <select
                    value={row.weekday}
                    onChange={(e) =>
                      updateSlot(row.rowId, {
                        weekday: Number(e.target.value),
                      })
                    }
                    className="input-field h-9 min-w-[5.5rem] text-xs"
                  >
                    {WEEKDAY_LABELS.map((label, d) => (
                      <option key={label} value={d}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Start
                  <input
                    type="time"
                    value={row.start}
                    onChange={(e) =>
                      updateSlot(row.rowId, { start: e.target.value })
                    }
                    className="input-field h-9 w-[7rem] text-xs"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  End
                  <input
                    type="time"
                    value={row.end}
                    onChange={(e) =>
                      updateSlot(row.rowId, { end: e.target.value })
                    }
                    className="input-field h-9 w-[7rem] text-xs"
                  />
                </label>
                <label className="grid min-w-[120px] flex-1 gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Label (optional)
                  <input
                    type="text"
                    value={row.label}
                    placeholder="e.g. Lecture"
                    onChange={(e) =>
                      updateSlot(row.rowId, { label: e.target.value })
                    }
                    className="input-field h-9 text-xs"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeSlot(row.rowId)}
                  className="mb-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addSlot}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Add time slot
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
          </div>

          {error ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ClassroomScheduleEditor;
