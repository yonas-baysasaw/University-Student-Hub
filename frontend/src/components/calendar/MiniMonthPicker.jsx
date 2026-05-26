import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * @param {Date} d
 * @returns {string}
 */
function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {{ year: number; month: number; selectedDate?: Date | null; onSelectDate: (d: Date) => void; onMonthChange?: (y: number, m: number) => void }} props
 */
export default function MiniMonthPicker({
  year,
  month,
  selectedDate = null,
  onSelectDate,
  onMonthChange,
}) {
  const todayKey = toDateKey(new Date());
  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

  const { firstWeekday, daysInMonth, monthTitle } = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return {
      firstWeekday: first.getDay(),
      daysInMonth: last.getDate(),
      monthTitle: first.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    };
  }, [year, month]);

  const shiftMonth = (delta) => {
    const nm = month + delta;
    let ny = year;
    let m = nm;
    if (nm < 0) {
      ny = year - 1;
      m = 11;
    } else if (nm > 11) {
      ny = year + 1;
      m = 0;
    }
    onMonthChange?.(ny, m);
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="font-display text-xs font-semibold text-slate-800 dark:text-slate-100">
          {monthTitle}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`pad-${i}`} className="aspect-square" aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const d = new Date(year, month, dayNum);
          const key = toDateKey(d);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(d)}
              className={`flex aspect-square items-center justify-center rounded-full text-xs font-medium transition ${
                isSelected
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : isToday
                    ? 'bg-cyan-100 font-bold text-cyan-800 ring-1 ring-cyan-400 dark:bg-cyan-900/50 dark:text-cyan-100'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
