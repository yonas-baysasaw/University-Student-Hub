import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  GraduationCap,
  Library,
  RotateCw,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TodayClassesCard from '../components/TodayClassesCard.jsx';
import {
  CLASSROOM_LIST_CHANGED_EVENT,
  SCHEDULE_SAVED_EVENT,
} from '../constants/dashboardEvents.js';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';

const NOTES_KEY = 'ush_frontend_notes_v1';
const TASKS_KEY = 'ush_dashboard_tasks_v1';

const starterTasks = [
  { id: 'task-1', label: 'Skim latest announcements', done: false },
  { id: 'task-2', label: 'Review today’s class slots', done: false },
  { id: 'task-3', label: 'Pick one library resource to revisit', done: false },
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function loadPersistedTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (t) =>
            t &&
            typeof t.id === 'string' &&
            typeof t.label === 'string' &&
            typeof t.done === 'boolean',
        )
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return starterTasks;
}

function formatLocalDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @param {string} t */
function slotStartToMinutes(t) {
  const m = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesNowFromDate(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function formatRelativeTime(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function greetingLine(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function rowStatusKey(row) {
  return `${row.chatId}-${row.slot.weekday}-${row.slot.start}-${row.slot.end}-${row.slot.label ?? ''}`;
}

function Home() {
  const { user } = useAuth();
  const name = user?.displayName ?? user?.username ?? 'Student';

  const [tasks, setTasks] = useState(loadPersistedTasks);
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  });

  const [dashLoading, setDashLoading] = useState(true);
  const [dashRefreshing, setDashRefreshing] = useState(false);
  const [dashError, setDashError] = useState('');
  const [summary, setSummary] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const loadDashboard = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) {
      setDashLoading(true);
      setDashError('');
    }
    try {
      const clock = new Date();
      const params = new URLSearchParams({
        weekday: String(clock.getDay()),
        localDate: formatLocalDate(clock),
        announcementsLimit: '12',
      });
      const res = await fetch(`/api/dashboard/summary?${params}`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not load dashboard');
      setSummary(data);
      setDashError('');
      } catch (err) {
        setDashError(err?.message || 'Could not load dashboard');
      } finally {
        if (!silent) setDashLoading(false);
      }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setDashRefreshing(true);
    try {
      await loadDashboard({ silent: true });
    } finally {
      setDashRefreshing(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    loadDashboard({ silent: false });
  }, [loadDashboard]);

  useEffect(() => {
    const onScheduleSaved = () => {
      loadDashboard({ silent: true });
    };
    window.addEventListener(SCHEDULE_SAVED_EVENT, onScheduleSaved);
    return () =>
      window.removeEventListener(SCHEDULE_SAVED_EVENT, onScheduleSaved);
  }, [loadDashboard]);

  useEffect(() => {
    const onClassroomsChanged = () => {
      loadDashboard({ silent: true });
    };
    window.addEventListener(CLASSROOM_LIST_CHANGED_EVENT, onClassroomsChanged);
    return () =>
      window.removeEventListener(
        CLASSROOM_LIST_CHANGED_EVENT,
        onClassroomsChanged,
      );
  }, [loadDashboard]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.done).length,
    [tasks],
  );

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  };

  const addNote = () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    setNotes((prev) => [
      { id: `${Date.now()}`, text: trimmed },
      ...prev.slice(0, 5),
    ]);
    setNoteInput('');
  };

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const clearNotes = () => setNotes([]);

  const dateHeading = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now);

  const timeShort = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);

  const announcements = summary?.recentAnnouncements ?? [];
  const stats = summary?.stats ?? {};

  const todayMeetingRows = useMemo(() => {
    const rooms = summary?.todayClasses;
    if (!Array.isArray(rooms)) return [];
    const rows = [];
    for (const room of rooms) {
      const slots = room.slots;
      if (!Array.isArray(slots)) continue;
      for (const slot of slots) {
        rows.push({
          chatId: String(room.chatId),
          courseName: room.name,
          slot,
        });
      }
    }
    rows.sort(
      (a, b) =>
        slotStartToMinutes(a.slot.start) - slotStartToMinutes(b.slot.start),
    );
    return rows;
  }, [summary?.todayClasses]);

  const scheduleInsights = useMemo(() => {
    const n = minutesNowFromDate(now);
    let currentKey = null;
    let nextKey = null;
    let nextStart = Infinity;

    for (const row of todayMeetingRows) {
      const startM = slotStartToMinutes(row.slot.start);
      const endM = slotStartToMinutes(row.slot.end);
      if (endM > startM && n >= startM && n < endM) {
        currentKey = rowStatusKey(row);
        break;
      }
    }

    if (!currentKey) {
      for (const row of todayMeetingRows) {
        const startM = slotStartToMinutes(row.slot.start);
        if (startM > n && startM < nextStart) {
          nextKey = rowStatusKey(row);
          nextStart = startM;
        }
      }
    }

    return { currentKey, nextKey };
  }, [todayMeetingRows, now]);

  const weekdaySlotCounts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const room of summary?.scheduleCalendar ?? []) {
      for (const slot of room.slots ?? []) {
        const w = Number(slot.weekday);
        if (w >= 0 && w <= 6) c[w]++;
      }
    }
    return c;
  }, [summary?.scheduleCalendar]);

  const scheduleDateLabel = useMemo(() => {
    const iso = summary?.localDate;
    const d =
      typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? new Date(`${iso}T12:00:00`)
        : new Date();
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }, [summary?.localDate]);

  const todayWeekday = now.getDay();

  const quickLinks = [
    {
      to: '/classroom',
      label: 'Classrooms',
      hint: 'Chats & courses',
      icon: GraduationCap,
    },
    {
      to: '/library',
      label: 'Library',
      hint: 'Books & uploads',
      icon: Library,
    },
    {
      to: '/liqu-ai',
      label: 'Liqu AI',
      hint: 'Study assistant',
      icon: Sparkles,
    },
    {
      to: '/liqu-ai/exams',
      label: 'Exams',
      hint: 'Practice sets',
      icon: BookOpen,
    },
    {
      to: '/profile',
      label: 'Profile',
      hint: 'Uploads & activity',
      icon: UserRound,
    },
  ];

  const statTiles = [
    {
      label: 'Classrooms',
      value: stats.classroomCount ?? 0,
      hint: 'Spaces you belong to',
      href: '/classroom',
      icon: GraduationCap,
      accent:
        'bg-gradient-to-br from-violet-500/15 to-indigo-500/10 text-violet-700 ring-violet-500/20 dark:from-violet-400/12 dark:text-violet-200 dark:ring-violet-400/25',
    },
    {
      label: 'Books uploaded',
      value: stats.booksUploaded ?? 0,
      hint: 'Your library contributions',
      href: '/library',
      icon: Library,
      accent:
        'bg-gradient-to-br from-cyan-500/15 to-teal-500/10 text-cyan-800 ring-cyan-500/25 dark:from-cyan-400/12 dark:text-cyan-200 dark:ring-cyan-400/25',
    },
    {
      label: 'Today’s meetings',
      value: todayMeetingRows.length,
      hint: 'From weekly schedules',
      href: '/classroom',
      icon: CalendarDays,
      accent:
        'bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-900 ring-amber-500/25 dark:from-amber-400/12 dark:text-amber-100 dark:ring-amber-400/25',
    },
  ];

  const insightBanner = scheduleInsights.currentKey
    ? todayMeetingRows.find(
        (r) => rowStatusKey(r) === scheduleInsights.currentKey,
      )
    : null;
  const nextBanner =
    scheduleInsights.nextKey && !insightBanner
      ? todayMeetingRows.find(
          (r) => rowStatusKey(r) === scheduleInsights.nextKey,
        )
      : null;

  return (
    <div className="dashboard-ambient page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-12 pt-6 md:px-6 md:pb-14 md:pt-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(280px,36vh)] workspace-hero-mesh opacity-75 dark:opacity-55" />

      <div className="relative z-[2] mx-auto max-w-6xl space-y-6 md:space-y-8">
        <section className="dashboard-card-lift relative overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-gradient-to-br from-white via-white to-cyan-50/50 p-6 shadow-[0_28px_70px_-28px_rgba(15,23,42,0.22)] dark:border-slate-600/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/95 dark:shadow-[0_32px_80px_-28px_rgba(0,0,0,0.55)] md:p-9">
          <div className="dashboard-hero-shimmer pointer-events-none absolute inset-0 opacity-60 dark:opacity-[0.18]" />
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/12" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/10" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-800 ring-1 ring-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-cyan-400/30">
                  Dashboard
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.04] px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-slate-600">
                  <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  Workspace overview
                </span>
              </div>

              <div>
                <h1 className="font-display text-balance text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-[2.35rem] md:leading-[1.15]">
                  {greetingLine(now)}, {name.split(' ')[0]}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
                  Track today&apos;s schedule, catch up on announcements, and
                  jump back into study tools—everything in one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-800/80 dark:ring-slate-600">
                  <CalendarDays className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  {dateHeading}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-800/80 dark:ring-slate-600">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {timeShort}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    local
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/classroom"
                  className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm shadow-lg shadow-cyan-900/15"
                >
                  Go to classrooms
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  disabled={dashLoading || dashRefreshing}
                  onClick={handleManualRefresh}
                  className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:pointer-events-none disabled:opacity-60"
                >
                  <RotateCw
                    className={`h-4 w-4 ${dashRefreshing ? 'animate-spin' : ''}`}
                    aria-hidden
                  />
                  Refresh data
                </button>
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:border-cyan-300/60 hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-slate-600 dark:hover:border-cyan-500/40"
                >
                  Settings
                </Link>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-sm lg:shrink-0">
              {dashLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                  Loading insights…
                </div>
              ) : dashError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100">
                  {dashError}
                </div>
              ) : (
                <>
                  {insightBanner ? (
                    <div className="fade-in-up rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-500/15 dark:from-emerald-950/50 dark:to-slate-900 dark:shadow-black/30 dark:ring-emerald-500/20">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        Happening now
                      </p>
                      <p className="mt-2 font-display text-lg font-semibold text-slate-900 dark:text-white">
                        {insightBanner.courseName}
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                        {insightBanner.slot.start}–{insightBanner.slot.end}
                      </p>
                      <Link
                        to={`/classroom/${insightBanner.chatId}`}
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                      >
                        Open classroom
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : nextBanner ? (
                    <div className="fade-in-up rounded-2xl border border-cyan-300/50 bg-gradient-to-br from-cyan-50/95 to-white p-4 shadow-md ring-1 ring-cyan-500/15 dark:border-cyan-700/50 dark:from-cyan-950/35 dark:to-slate-900 dark:ring-cyan-500/20">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-800 dark:text-cyan-300">
                        Up next today
                      </p>
                      <p className="mt-2 font-display text-lg font-semibold text-slate-900 dark:text-white">
                        {nextBanner.courseName}
                      </p>
                      <p className="mt-1 font-mono text-sm text-cyan-900 dark:text-cyan-200">
                        {nextBanner.slot.start}–{nextBanner.slot.end}
                      </p>
                    </div>
                  ) : todayMeetingRows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                      No meetings on your schedule for this weekday. Add weekly
                      slots in any classroom to see them here.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                      No more sessions left today—nice work. Check announcements
                      or the library for something to review.
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/55">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      Week at a glance
                    </p>
                    <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
                      {WEEKDAY_SHORT.map((label, i) => {
                        const count = weekdaySlotCounts[i] ?? 0;
                        const isToday = i === todayWeekday;
                        return (
                          <div
                            key={label}
                            className={`rounded-xl px-1 py-2 transition ${
                              isToday
                                ? 'bg-gradient-to-b from-cyan-500/20 to-cyan-600/10 ring-2 ring-cyan-500/35 dark:from-cyan-500/15 dark:to-cyan-600/5 dark:ring-cyan-400/35'
                                : 'bg-slate-50/90 dark:bg-slate-800/50'
                            }`}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {label}
                            </p>
                            <p className="mt-1 font-display text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                              {count}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                      Slot count per weekday from your saved classroom
                      schedules.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {!dashLoading && !dashError && summary ? (
          <section className="grid gap-4 sm:grid-cols-3">
            {statTiles.map(
              ({ label, value, hint, href, icon: Icon, accent }) => (
                <Link
                  key={label}
                  to={href}
                  className="dashboard-card-lift group fade-in-up panel-card flex items-start gap-4 rounded-2xl p-5 ring-1 ring-transparent transition hover:ring-cyan-500/20 dark:hover:ring-cyan-400/15"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${accent}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 font-display text-3xl tabular-nums text-slate-900 dark:text-slate-50">
                      {value}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {hint}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-slate-600" />
                </Link>
              ),
            )}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <TodayClassesCard
            now={now}
            dashLoading={dashLoading}
            dashError={dashError}
            todayMeetingRows={todayMeetingRows}
            scheduleInsights={scheduleInsights}
            insightBanner={insightBanner}
            nextBanner={nextBanner}
            scheduleDateLabel={scheduleDateLabel}
            timeShort={timeShort}
          />

          <article className="panel-card rounded-[1.35rem] p-5 shadow-[0_18px_44px_-20px_rgba(15,23,42,0.18)] dark:shadow-[0_22px_50px_-18px_rgba(0,0,0,0.45)] md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-slate-900 dark:text-slate-50">
                  Latest announcements
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Newest posts across your classrooms.
                </p>
              </div>
            </div>

            {dashLoading ? (
              <div className="mt-6 space-y-3">
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : dashError ? (
              <p className="mt-6 text-sm text-rose-600">{dashError}</p>
            ) : announcements.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                No announcements yet. Check each classroom&apos;s Announcements
                tab after instructors post updates.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {announcements.map((a, index) => (
                  <li
                    key={a.id}
                    style={{
                      animationDelay: `${Math.min(index * 55, 400)}ms`,
                    }}
                    className="fade-in-up"
                  >
                    <Link
                      to={`/classroom/${a.chatId}/announcements`}
                      className="group block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-cyan-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-900/30 dark:hover:border-cyan-700"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                        {a.classroomName}
                        <span className="font-normal text-slate-400 dark:text-slate-500">
                          · {formatRelativeTime(a.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 font-display text-[15px] font-semibold text-slate-900 dark:text-slate-50 group-hover:text-cyan-800 dark:group-hover:text-cyan-200">
                        {a.title}
                      </p>
                      {a.bodyPreview ? (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                          {a.bodyPreview}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                        {a.author}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg text-slate-900 dark:text-slate-100">
            Quick links
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quickLinks.map(({ to, label, hint, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="dashboard-card-lift panel-card flex flex-col items-start gap-3 rounded-2xl p-4 ring-1 ring-transparent transition hover:border-cyan-300/80 hover:shadow-lg hover:ring-cyan-500/15 dark:hover:border-cyan-700/80 dark:hover:ring-cyan-400/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 text-cyan-700 dark:from-cyan-400/15 dark:to-indigo-400/10 dark:text-cyan-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-display font-semibold text-slate-900 dark:text-slate-50">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {hint}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="panel-card rounded-[1.35rem] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg text-slate-900 dark:text-slate-50">
                Quick checklist
              </h2>
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                {completedCount}/{tasks.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Checked items sync in this browser only.
            </p>
            <div className="mt-4 space-y-2">
              {tasks.map((task) => (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-cyan-200 dark:border-slate-600 dark:bg-slate-900/20 dark:hover:border-cyan-800"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary rounded border-slate-300"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span
                    className={`text-sm ${task.done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {task.label}
                  </span>
                </label>
              ))}
            </div>
          </article>

          <article className="panel-card rounded-[1.35rem] p-5 md:p-6">
            <h2 className="font-display text-lg text-slate-900 dark:text-slate-50">
              Scratch notes
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Stored only in this browser—perfect for quick reminders.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNote();
                  }
                }}
                placeholder="Write something…"
                className="input-field h-10 flex-1 text-sm"
              />
              <button
                type="button"
                className="btn-primary shrink-0 px-4 text-sm"
                onClick={addNote}
              >
                Add
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  No notes yet.
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="group flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/20 dark:text-slate-300"
                  >
                    <span className="min-w-0 flex-1">{note.text}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      onClick={() => removeNote(note.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            {notes.length > 0 ? (
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={clearNotes}
              >
                Clear all notes
              </button>
            ) : null}
          </article>
        </section>
      </div>
    </div>
  );
}

export default Home;
