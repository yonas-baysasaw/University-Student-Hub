import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
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
import CalendarEventModal, {
  dateToDatetimeLocalValue,
  isoToDatetimeLocalValue,
} from '../components/calendar/CalendarEventModal.jsx';
import MiniMonthPicker from '../components/calendar/MiniMonthPicker.jsx';
import { CALENDAR_INVALIDATE_EVENT } from '../constants/dashboardEvents.js';
import { useSocket } from '../contexts/SocketContext';
import { readJsonOrThrow } from '../utils/http';

const LS_LAYERS = 'ush.calendar.layers';
const LS_VIEW = 'ush.calendar.view';
const LS_REMINDED = 'ush.calendar.reminded';

const LAYER_DEFS = [
  { key: 'class', label: 'Classes', color: '#0891b2' },
  { key: 'assignment', label: 'Assignments', color: '#d97706' },
  { key: 'announcement', label: 'Exams & deadlines', color: '#dc2626' },
  { key: 'event', label: 'Events', color: '#15803d' },
  { key: 'personal', label: 'Personal', color: '#7c3aed' },
];

const VIEW_OPTIONS = [
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'timeGridDay', label: 'Day' },
  { id: 'listWeek', label: 'Schedule' },
];

const DEFAULT_LAYERS = Object.fromEntries(
  LAYER_DEFS.map((l) => [l.key, true]),
);

function CalendarLayerToggle({ label, color, checked, onChange, className = '' }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/80 focus-within:ring-2 focus-within:ring-cyan-500/40 dark:hover:bg-slate-800/80 ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ring-1 ring-inset ring-black/10 transition dark:ring-white/15"
        style={{ backgroundColor: checked ? color : `${color}33` }}
        aria-hidden
      >
        {checked ? (
          <Check className="h-3 w-3 stroke-[3] text-white" aria-hidden />
        ) : null}
      </span>
      <span className="truncate">{label}</span>
    </label>
  );
}

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

function loadViewPref() {
  if (typeof window === 'undefined') return 'dayGridMonth';
  try {
    const v = window.localStorage.getItem(LS_VIEW);
    if (VIEW_OPTIONS.some((o) => o.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'dayGridMonth';
}

function loadRemindedSet() {
  try {
    const raw = sessionStorage.getItem(LS_REMINDED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistRemindedSet(set) {
  try {
    sessionStorage.setItem(LS_REMINDED, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function defaultCreateRange(date = new Date()) {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  if (start.getHours() < 23) {
    start.setHours(start.getHours() + 1);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    startsAtLocal: dateToDatetimeLocalValue(start),
    endsAtLocal: dateToDatetimeLocalValue(end),
  };
}

function CalendarPage() {
  const navigate = useNavigate();
  const socket = useSocket();
  const calendarRef = useRef(null);
  const fetchGen = useRef(0);
  const remindedRef = useRef(loadRemindedSet());

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layers, setLayers] = useState(loadLayerPrefs);
  const [currentView, setCurrentView] = useState(loadViewPref);
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [titleLabel, setTitleLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [miniMonth, setMiniMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [visibleRange, setVisibleRange] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [modalPersonalId, setModalPersonalId] = useState(null);
  const [modalInitial, setModalInitial] = useState({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

  const loadFeed = useCallback(
    async (from, to, { silent = false, q = '' } = {}) => {
      if (!from || !to) return;
      const gen = ++fetchGen.current;
      if (!silent) setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ from, to });
        if (q) qs.set('q', q);
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
    },
    [],
  );

  const refetchVisible = useCallback(
    (opts) => {
      if (!visibleRange) return;
      void loadFeed(visibleRange.from, visibleRange.to, {
        ...opts,
        q: debouncedSearch,
      });
    },
    [visibleRange, loadFeed, debouncedSearch],
  );

  useEffect(() => {
    if (!visibleRange) return;
    void loadFeed(visibleRange.from, visibleRange.to, { q: debouncedSearch });
  }, [visibleRange, loadFeed, debouncedSearch]);

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

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const item of feedItems) {
        if (item.source !== 'personal') continue;
        const mins = item.meta?.reminderMinutesBefore;
        if (mins == null || !Number.isFinite(Number(mins))) continue;
        const start = new Date(item.start).getTime();
        if (Number.isNaN(start)) continue;
        const remindAt = start - Number(mins) * 60_000;
        const key = `${item.id}:${item.start}`;
        if (now >= remindAt && now < start && !remindedRef.current.has(key)) {
          remindedRef.current.add(key);
          persistRemindedSet(remindedRef.current);
          toast.info(`Upcoming: ${item.title}`, {
            description: `Starts ${new Date(item.start).toLocaleString()}`,
          });
        }
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [feedItems]);

  const filteredItems = useMemo(
    () => feedItems.filter((item) => layers[item.source] !== false),
    [feedItems, layers],
  );

  const conflicts = useMemo(() => {
    const timed = filteredItems
      .filter((i) => !i.allDay)
      .map((i) => ({
        title: i.title,
        startMs: new Date(i.start).getTime(),
        endMs: new Date(i.end).getTime(),
      }))
      .filter((i) => !Number.isNaN(i.startMs) && !Number.isNaN(i.endMs))
      .sort((a, b) => a.startMs - b.startMs);

    const pairs = [];
    for (let i = 0; i < timed.length; i += 1) {
      for (let j = i + 1; j < timed.length; j += 1) {
        if (timed[j].startMs >= timed[i].endMs) break;
        if (
          timed[j].startMs < timed[i].endMs &&
          timed[j].endMs > timed[i].startMs
        ) {
          pairs.push([timed[i], timed[j]]);
          if (pairs.length >= 3) return pairs;
        }
      }
    }
    return pairs;
  }, [filteredItems]);

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
          editable: Boolean(item.editable),
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
    setTitleLabel(info.view.title || '');
    setMiniMonth({
      y: info.view.currentStart.getFullYear(),
      m: info.view.currentStart.getMonth(),
    });
    setCurrentView(info.view.type);
  }, []);

  const getApi = () => calendarRef.current?.getApi?.();

  const goToday = () => {
    getApi()?.today();
    setSelectedDay(new Date());
  };

  const goPrev = () => getApi()?.prev();
  const goNext = () => getApi()?.next();

  const changeView = (viewId) => {
    getApi()?.changeView(viewId);
    setCurrentView(viewId);
    try {
      localStorage.setItem(LS_VIEW, viewId);
    } catch {
      /* ignore */
    }
  };

  const handleMiniSelect = (d) => {
    setSelectedDay(d);
    getApi()?.gotoDate(d);
  };

  const handleMiniMonthChange = (y, m) => {
    setMiniMonth({ y, m });
    getApi()?.gotoDate(new Date(y, m, 1));
  };

  const openCreateModal = useCallback((date = new Date()) => {
    setModalMode('create');
    setModalPersonalId(null);
    setModalInitial({
      title: '',
      ...defaultCreateRange(date),
      allDay: false,
      description: '',
      location: '',
      meetingUrl: '',
      recurrence: 'none',
      recurrenceUntilLocal: '',
      reminderMinutesBefore: '',
    });
    setModalOpen(true);
  }, []);

  const openEditPersonalModal = useCallback(async (personalId) => {
    try {
      const res = await fetch(
        `/api/calendar/personal/${encodeURIComponent(personalId)}`,
        { credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Could not load event');
      const ev = data.event;
      setModalMode('edit');
      setModalPersonalId(personalId);
      setModalInitial({
        title: ev.title || '',
        startsAtLocal: isoToDatetimeLocalValue(ev.startsAt),
        endsAtLocal: isoToDatetimeLocalValue(ev.endsAt),
        allDay: Boolean(ev.allDay),
        description: ev.description || '',
        location: ev.location || '',
        meetingUrl: ev.meetingUrl || '',
        recurrence: ev.recurrence || 'none',
        recurrenceUntilLocal: ev.recurrenceUntil
          ? ev.recurrenceUntil.slice(0, 10)
          : '',
        reminderMinutesBefore:
          ev.reminderMinutesBefore != null
            ? String(ev.reminderMinutesBefore)
            : '',
      });
      setModalOpen(true);
    } catch (e) {
      toast.error(e?.message || 'Could not load event');
    }
  }, []);

  const handleEventClick = (info) => {
    info.jsEvent.preventDefault();
    const { source, url, meta } = info.event.extendedProps || {};
    if (source === 'personal' && meta?.personalId) {
      void openEditPersonalModal(meta.personalId);
      return;
    }
    if (url) navigate(url);
  };

  const handleDateClick = (info) => {
    openCreateModal(info.date);
  };

  const renderCreateButton = (className) => (
    <button
      type="button"
      className={className}
      onClick={() => openCreateModal(new Date())}
    >
      <Plus className="h-4 w-4" aria-hidden />
      Create
    </button>
  );

  return (
    <div className="flex h-[calc(100dvh-4.25rem)] min-h-[480px] flex-col overflow-hidden bg-white dark:bg-slate-950">
      <CalendarEventModal
        open={modalOpen}
        mode={modalMode}
        personalId={modalPersonalId}
        initial={modalInitial}
        onClose={() => setModalOpen(false)}
        onSaved={() => refetchVisible({ silent: true })}
      />

      <div className="flex min-h-0 flex-1">
        <aside
          className={`${
            sidebarOpen ? 'w-[260px]' : 'w-0'
          } hidden shrink-0 overflow-hidden border-r border-slate-200 bg-slate-50/95 transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-900/80 md:block`}
        >
          <div className="flex h-full w-[260px] flex-col gap-4 overflow-y-auto p-4">
            {renderCreateButton(
              'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-900/15 transition hover:from-cyan-500 hover:to-cyan-600',
            )}

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
                    <CalendarLayerToggle
                      label={label}
                      color={color}
                      checked={layers[key] !== false}
                      onChange={() => toggleLayer(key)}
                      className="text-sm text-slate-700 dark:text-slate-200"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

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
                aria-label="Previous"
                onClick={goPrev}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={goNext}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50 sm:text-xl">
              {titleLabel}
            </h1>
            <div className="relative ml-auto flex min-w-[140px] flex-1 items-center gap-2 sm:max-w-xs sm:flex-none">
              <Search
                className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center gap-2">
              {loading ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-cyan-600"
                  aria-hidden
                />
              ) : null}
              <select
                value={currentView}
                onChange={(e) => changeView(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                aria-label="Calendar view"
              >
                {VIEW_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {conflicts.length > 0 ? (
            <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Schedule overlap detected</p>
                <ul className="mt-1 list-inside list-disc text-xs opacity-90">
                  {conflicts.map(([a, b], idx) => (
                    <li key={idx}>
                      {a.title} overlaps with {b.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {sidebarOpen ? (
            <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/80 md:hidden">
              {renderCreateButton(
                'mb-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2 text-sm font-semibold text-white',
              )}
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
                    <CalendarLayerToggle
                      label={label}
                      color={color}
                      checked={layers[key] !== false}
                      onChange={() => toggleLayer(key)}
                      className="text-xs font-medium text-slate-700 dark:text-slate-200"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="ush-calendar-grid min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                listPlugin,
                interactionPlugin,
              ]}
              initialView={currentView}
              headerToolbar={false}
              height="100%"
              events={fcEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              datesSet={handleDatesSet}
              dayMaxEvents={currentView === 'dayGridMonth' ? 3 : false}
              nowIndicator
              fixedWeekCount={false}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot
              listDayFormat={{ weekday: 'short', month: 'short', day: 'numeric' }}
              listDaySideFormat={false}
            />
          </div>
        </div>
      </div>

      <style>{`
        .ush-calendar-grid .fc {
          --fc-border-color: #e2e8f0;
          --fc-today-bg-color: rgba(6, 182, 212, 0.08);
          --fc-neutral-bg-color: #f8fafc;
          --fc-event-bg-color: #0891b2;
          --fc-event-border-color: #0891b2;
          height: 100%;
          font-family: inherit;
        }
        .dark .ush-calendar-grid .fc {
          --fc-border-color: #334155;
          --fc-today-bg-color: rgba(6, 182, 212, 0.12);
          --fc-neutral-bg-color: #0f172a;
        }
        .ush-calendar-grid .fc .fc-col-header-cell-cushion,
        .ush-calendar-grid .fc .fc-daygrid-day-number,
        .ush-calendar-grid .fc .fc-list-day-text,
        .ush-calendar-grid .fc .fc-list-day-side-text {
          color: #475569;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .dark .ush-calendar-grid .fc .fc-col-header-cell-cushion,
        .dark .ush-calendar-grid .fc .fc-daygrid-day-number,
        .dark .ush-calendar-grid .fc .fc-list-day-text,
        .dark .ush-calendar-grid .fc .fc-list-day-side-text {
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
        .ush-calendar-grid .fc .fc-timegrid-slot-label-cushion {
          font-size: 0.65rem;
        }
      `}</style>
    </div>
  );
}

export default CalendarPage;
