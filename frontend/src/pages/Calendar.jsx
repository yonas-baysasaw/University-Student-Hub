import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MiniMonthPicker from '../components/calendar/MiniMonthPicker.jsx';
import { CALENDAR_INVALIDATE_EVENT } from '../constants/dashboardEvents.js';
import { useSocket } from '../contexts/SocketContext';
import { readJsonOrThrow } from '../utils/http';

const LS_LAYERS = 'ush.calendar.layers';

const LAYER_DEFS = [
  { key: 'class', label: 'Classes', color: '#0891b2' },
  { key: 'assignment', label: 'Assignments', color: '#d97706' },
  { key: 'announcement', label: 'Exams & deadlines', color: '#dc2626' },
  { key: 'event', label: 'Events', color: '#15803d' },
];

const DEFAULT_LAYERS = Object.fromEntries(
  LAYER_DEFS.map((l) => [l.key, true]),
);

/**
 * @param {Date} d
 * @returns {string}
 */
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadLayerPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_LAYERS };
  try {
    const raw = window.localStorage.getItem(LS_LAYERS);
    if (!raw) return { ...DEFAULT_LAYERS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_LAYERS };
    return { ...DEFAULT_LAYERS, ...parsed };
  } catch {
    return { ...DEFAULT_LAYERS };
  }
}

function CalendarPage() {
  const navigate = useNavigate();
  const socket = useSocket();
  const calendarRef = useRef(null);
  const fetchGen = useRef(0);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layers, setLayers] = useState(loadLayerPrefs);
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [titleLabel, setTitleLabel] = useState('');
  const [miniMonth, setMiniMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [visibleRange, setVisibleRange] = useState(null);

  const persistLayers = useCallback((next) => {
    setLayers(next);
    try {
      window.localStorage.setItem(LS_LAYERS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLayer = useCallback(
    (key) => {
      persistLayers({ ...layers, [key]: !layers[key] });
    },
    [layers, persistLayers],
  );

  const loadFeed = useCallback(async (from, to, { silent = false } = {}) => {
    if (!from || !to) return;
    const gen = ++fetchGen.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/calendar/feed?${qs}`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not load calendar');
      if (gen !== fetchGen.current) return;
      setFeedItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      if (gen !== fetchGen.current) return;
      setError(e?.message || 'Could not load calendar');
    } finally {
      if (gen === fetchGen.current && !silent) setLoading(false);
    }
  }, []);

  const refetchVisible = useCallback(
    (opts) => {
      if (!visibleRange) return;
      void loadFeed(visibleRange.from, visibleRange.to, opts);
    },
    [visibleRange, loadFeed],
  );

  useEffect(() => {
    if (!visibleRange) return;
    void loadFeed(visibleRange.from, visibleRange.to);
  }, [visibleRange, loadFeed]);

  useEffect(() => {
    const debounced = () => refetchVisible({ silent: true });
    let t = null;
    const handler = () => {
      if (t) clearTimeout(t);
      t = setTimeout(debounced, 300);
    };
    window.addEventListener(CALENDAR_INVALIDATE_EVENT, handler);
    return () => {
      window.removeEventListener(CALENDAR_INVALIDATE_EVENT, handler);
      if (t) clearTimeout(t);
    };
  }, [refetchVisible]);

  useEffect(() => {
    if (!socket) return;
    let t = null;
    const handler = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => refetchVisible({ silent: true }), 300);
    };
    socket.on('calendar:invalidate', handler);
    return () => {
      socket.off('calendar:invalidate', handler);
      if (t) clearTimeout(t);
    };
  }, [socket, refetchVisible]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        refetchVisible({ silent: true });
      }
    };
    const interval = setInterval(onFocus, 60_000);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refetchVisible]);

  const filteredItems = useMemo(
    () => feedItems.filter((item) => layers[item.source] !== false),
    [feedItems, layers],
  );

  const fcEvents = useMemo(
    () =>
      filteredItems.map((item) => ({
        id: item.id,
        title: item.title,
        start: item.start,
        end: item.end,
        allDay: Boolean(item.allDay),
        backgroundColor: item.color,
        borderColor: item.color,
        extendedProps: {
          url: item.url,
          source: item.source,
          meta: item.meta,
        },
      })),
    [filteredItems],
  );

  const handleDatesSet = useCallback((info) => {
    const endExclusive = info.end;
    const lastVisible = new Date(endExclusive);
    lastVisible.setDate(lastVisible.getDate() - 1);
    const from = formatLocalDate(info.start);
    const to = formatLocalDate(lastVisible);
    setVisibleRange({ from, to });
    setTitleLabel(
      info.view.title ||
        info.start.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    );
    setMiniMonth({
      y: info.view.currentStart.getFullYear(),
      m: info.view.currentStart.getMonth(),
    });
  }, []);

  const getApi = () => calendarRef.current?.getApi?.();

  const goToday = () => {
    const api = getApi();
    api?.today();
    const n = new Date();
    setSelectedDay(n);
  };

  const goPrev = () => getApi()?.prev();
  const goNext = () => getApi()?.next();

  const handleMiniSelect = (d) => {
    setSelectedDay(d);
    getApi()?.gotoDate(d);
  };

  const handleMiniMonthChange = (y, m) => {
    setMiniMonth({ y, m });
    getApi()?.gotoDate(new Date(y, m, 1));
  };

  const handleEventClick = (info) => {
    info.jsEvent.preventDefault();
    const url = info.event.extendedProps?.url;
    if (url) navigate(url);
  };

  return (
    <div className="flex h-[calc(100dvh-4.25rem)] min-h-[480px] flex-col overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-[260px]' : 'w-0'
          } hidden shrink-0 overflow-hidden border-r border-slate-200 bg-slate-50/95 transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-900/80 md:block`}
        >
          <div className="flex h-full w-[260px] flex-col gap-4 overflow-y-auto p-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-900/15 transition hover:from-cyan-500 hover:to-cyan-600"
              onClick={() =>
                toast.info('Personal events are coming in a future update.')
              }
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create
            </button>

            <MiniMonthPicker
              year={miniMonth.y}
              month={miniMonth.m}
              selectedDate={selectedDay}
              onSelectDate={handleMiniSelect}
              onMonthChange={handleMiniMonthChange}
            />

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                My calendars
              </p>
              <ul className="space-y-1.5">
                {LAYER_DEFS.map(({ key, label, color }) => (
                  <li key={key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-slate-700 hover:bg-white/80 dark:text-slate-200 dark:hover:bg-slate-800/80">
                      <input
                        type="checkbox"
                        checked={layers[key] !== false}
                        onChange={() => toggleLayer(key)}
                        className="sr-only"
                      />
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="truncate">{label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700 sm:px-4">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300 md:hidden"
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <Menu className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300 md:inline-flex"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              ) : (
                <PanelLeftOpen className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={goPrev}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={goNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50 sm:text-xl">
              {titleLabel}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              {loading ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-cyan-600"
                  aria-hidden
                />
              ) : null}
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Month
              </span>
            </div>
          </div>

          {error ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {/* Mobile sidebar drawer */}
          {sidebarOpen ? (
            <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/80 md:hidden">
              <button
                type="button"
                className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={() =>
                  toast.info('Personal events are coming in a future update.')
                }
              >
                <Plus className="h-4 w-4" aria-hidden />
                Create
              </button>
              <MiniMonthPicker
                year={miniMonth.y}
                month={miniMonth.m}
                selectedDate={selectedDay}
                onSelectDate={handleMiniSelect}
                onMonthChange={handleMiniMonthChange}
              />
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {LAYER_DEFS.map(({ key, label, color }) => (
                  <li key={key}>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={layers[key] !== false}
                        onChange={() => toggleLayer(key)}
                        className="rounded border-slate-300"
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ush-calendar-grid min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              height="100%"
              events={fcEvents}
              eventClick={handleEventClick}
              datesSet={handleDatesSet}
              dayMaxEvents={3}
              nowIndicator
              fixedWeekCount={false}
            />
          </div>
        </div>
      </div>

      <style>{`
        .ush-calendar-grid .fc {
          --fc-border-color: #e2e8f0;
          --fc-today-bg-color: rgba(6, 182, 212, 0.08);
          --fc-neutral-bg-color: #f8fafc;
          height: 100%;
          font-family: inherit;
        }
        .dark .ush-calendar-grid .fc {
          --fc-border-color: #334155;
          --fc-today-bg-color: rgba(6, 182, 212, 0.12);
          --fc-neutral-bg-color: #0f172a;
        }
        .ush-calendar-grid .fc .fc-col-header-cell-cushion,
        .ush-calendar-grid .fc .fc-daygrid-day-number {
          color: #475569;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .dark .ush-calendar-grid .fc .fc-col-header-cell-cushion,
        .dark .ush-calendar-grid .fc .fc-daygrid-day-number {
          color: #94a3b8;
        }
        .ush-calendar-grid .fc .fc-event {
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 1px 4px;
          cursor: pointer;
        }
        .ush-calendar-grid .fc .fc-daygrid-day-frame {
          min-height: 5.5rem;
        }
      `}</style>
    </div>
  );
}

export default CalendarPage;
