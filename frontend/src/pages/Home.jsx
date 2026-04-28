import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Library,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';
import {
  getComingDaysThisWeek,
  getDaysInMonth,
  getWeekContaining,
  occurrencesForDates,
  readScheduleViewPreference,
  SCHEDULE_VIEW_OPTIONS,
  scheduleHeadingTitle,
  scheduleSubtitle,
  startOfLocalDay,
  writeScheduleViewPreference,
} from '../utils/scheduleViews.js';

const NOTES_KEY = 'ush_frontend_notes_v1';

const starterTasks = [
  { id: 'task-1', label: 'Skim latest announcements', done: false },
  { id: 'task-2', label: 'Review today’s class slots', done: false },
  { id: 'task-3', label: 'Pick one library resource to revisit', done: false },
];

function formatLocalDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function Home() {
  const { user } = useAuth();
  const name = user?.displayName ?? user?.username ?? 'Student';

  const [tasks, setTasks] = useState(starterTasks);
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
  const [dashError, setDashError] = useState('');
  const [summary, setSummary] = useState(null);

  const [scheduleView, setScheduleView] = useState(() =>
    readScheduleViewPreference(),
  );
  const [displayMonth, setDisplayMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  const weekdayNow = useMemo(() => new Date().getDay(), []);

  const scheduleRows = useMemo(() => {
    const rooms = summary?.scheduleCalendar ?? [];
    if (!Array.isArray(rooms) || rooms.length === 0) return [];
    const now = new Date();

    if (scheduleView === 'day') {
      return occurrencesForDates(rooms, [startOfLocalDay(now)]);
    }
    if (scheduleView === 'week') {
      return occurrencesForDates(rooms, getWeekContaining(now));
    }
    if (scheduleView === 'weekUpcoming') {
      return occurrencesForDates(rooms, getComingDaysThisWeek(now));
    }
    if (scheduleView === 'month') {
      return occurrencesForDates(
        rooms,
        getDaysInMonth(displayMonth.y, displayMonth.m),
      );
    }
    return [];
  }, [summary?.scheduleCalendar, scheduleView, displayMonth]);

  const hasScheduleData = (summary?.scheduleCalendar ?? []).length > 0;
  const hasAnyOccurrence = scheduleRows.some((row) => row.entries.length > 0);

  const monthTitle = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(displayMonth.y, displayMonth.m, 1));

  const bumpMonth = (delta) => {
    setDisplayMonth((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const formatDayHeading = (date) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);

  const todayIso = formatLocalDate(new Date());

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setDashLoading(true);
      setDashError('');
      try {
        const params = new URLSearchParams({
          weekday: String(weekdayNow),
          localDate: formatLocalDate(new Date()),
          announcementsLimit: '12',
        });
        const res = await fetch(`/api/dashboard/summary?${params}`, {
          credentials: 'include',
        });
        const data = await readJsonOrThrow(res, 'Could not load dashboard');
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled)
          setDashError(err?.message || 'Could not load dashboard');
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [weekdayNow]);

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

  const clearNotes = () => setNotes([]);

  const dateHeading = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const todayClasses = summary?.todayClasses ?? [];
  const announcements = summary?.recentAnnouncements ?? [];
  const stats = summary?.stats ?? {};

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
      to: '/exams',
      label: 'Exams',
      hint: 'Practice sets',
      icon: BookOpen,
    },
  ];

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="panel-card fade-in-up rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            Dashboard
          </p>
          <h1 className="mt-2 font-display text-3xl text-slate-900 dark:text-slate-50 md:text-4xl">
            Hello, {name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <CalendarDays className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <span>{dateHeading}</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-400 md:text-base">
            Here’s what’s on your plate—today’s meetings across classrooms,
            latest announcements, and shortcuts into your workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/classroom" className="btn-primary px-5 py-2.5 text-sm">
              Go to classrooms
            </Link>
            <Link to="/settings" className="btn-secondary px-5 py-2.5 text-sm">
              Settings
            </Link>
          </div>
        </section>

        {!dashLoading && !dashError && summary ? (
          <section className="grid gap-4 sm:grid-cols-3">
            <article className="panel-card rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Classrooms
              </p>
              <p className="mt-2 font-display text-3xl text-slate-900 dark:text-slate-50">
                {stats.classroomCount ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Spaces you belong to
              </p>
            </article>
            <article className="panel-card rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Books uploaded
              </p>
              <p className="mt-2 font-display text-3xl text-slate-900 dark:text-slate-50">
                {stats.booksUploaded ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Your library contributions
              </p>
            </article>
            <article className="panel-card rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Today’s meetings
              </p>
              <p className="mt-2 font-display text-3xl text-slate-900 dark:text-slate-50">
                {todayClasses.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                From weekly schedules
              </p>
            </article>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel-card rounded-2xl p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl text-slate-900 dark:text-slate-50">
                  {scheduleHeadingTitle(scheduleView)}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {scheduleSubtitle(scheduleView)}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end lg:w-auto lg:max-w-md">
                {scheduleView === 'month' ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-2 py-1 dark:border-slate-600 dark:bg-slate-800/60">
                    <button
                      type="button"
                      onClick={() => bumpMonth(-1)}
                      className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-[10rem] flex-1 text-center text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {monthTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => bumpMonth(1)}
                      className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                <label className="flex min-w-[12rem] flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Schedule view
                  </span>
                  <select
                    value={scheduleView}
                    onChange={(e) => {
                      const v = e.target.value;
                      setScheduleView(v);
                      writeScheduleViewPreference(v);
                    }}
                    className="input-field h-10 cursor-pointer text-xs font-medium"
                  >
                    {SCHEDULE_VIEW_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} title={opt.hint}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <Link
                  to="/classroom"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-600 dark:text-slate-200 dark:hover:border-cyan-600 dark:hover:bg-cyan-950/30"
                >
                  Edit classroom hours
                </Link>
              </div>
            </div>

            {dashLoading ? (
              <p className="mt-6 text-sm text-slate-500">Loading schedule…</p>
            ) : dashError ? (
              <p className="mt-6 text-sm text-rose-600">{dashError}</p>
            ) : !hasScheduleData ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center dark:border-slate-600 dark:bg-slate-800/40">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No weekly hours yet. Admins can add meeting times from each
                  classroom card on the Classrooms page.
                </p>
                <Link
                  to="/classroom"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
                >
                  Open classrooms
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : !hasAnyOccurrence ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center dark:border-slate-600 dark:bg-slate-800/40">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {scheduleView === 'day'
                    ? 'Nothing on your calendar for today.'
                    : scheduleView === 'month'
                      ? 'No classes fall on these weekdays in this month.'
                      : 'No classes in this date range for your current weekly pattern.'}
                </p>
                <Link
                  to="/classroom"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
                >
                  Adjust weekly hours
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {scheduleRows.map((row) => (
                  <div
                    key={row.iso}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-900/35"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 px-4 py-2.5 dark:border-slate-600/90">
                      <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {formatDayHeading(row.date)}
                      </span>
                      {row.iso === todayIso ? (
                        <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200">
                          Today
                        </span>
                      ) : null}
                    </div>
                    {row.entries.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                        No classes this day.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-200/90 dark:divide-slate-600/90">
                        {row.entries.map((entry) => (
                          <li
                            key={`${row.iso}-${entry.chatId}-${entry.slot.weekday}-${entry.slot.start}-${entry.slot.end}-${entry.slot.label ?? ''}`}
                          >
                            <Link
                              to={`/classroom/${entry.chatId}`}
                              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition hover:bg-white dark:hover:bg-slate-800/80"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {entry.roomName}
                                </p>
                                {entry.slot.label ? (
                                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    {entry.slot.label}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                                  {entry.slot.start}–{entry.slot.end}
                                </span>
                                <ArrowRight className="h-4 w-4 text-slate-400" />
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="panel-card rounded-2xl p-5 md:p-6">
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
              <p className="mt-6 text-sm text-slate-500">
                Loading announcements…
              </p>
            ) : dashError ? (
              <p className="mt-6 text-sm text-rose-600">{dashError}</p>
            ) : announcements.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                No announcements yet. Check each classroom&apos;s Announcements
                tab after instructors post updates.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/classroom/${a.chatId}/announcements`}
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-cyan-300 hover:shadow-sm dark:border-slate-600 dark:bg-slate-900/30 dark:hover:border-cyan-700"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                        {a.classroomName}
                        <span className="font-normal text-slate-400 dark:text-slate-500">
                          · {formatRelativeTime(a.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 font-display text-[15px] font-semibold text-slate-900 dark:text-slate-50">
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
          <h2 className="mb-3 font-display text-lg text-slate-900 dark:text-slate-100">
            Quick links
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map(({ to, label, hint, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="panel-card flex items-start gap-3 rounded-2xl p-4 transition hover:border-cyan-300/80 hover:shadow-md dark:hover:border-cyan-700/80"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
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
          <article className="panel-card rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg text-slate-900 dark:text-slate-50">
                Quick checklist
              </h2>
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                {completedCount}/{tasks.length}
              </span>
            </div>
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

          <article className="panel-card rounded-2xl p-5">
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
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/20 dark:text-slate-300"
                  >
                    {note.text}
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
                Clear notes
              </button>
            ) : null}
          </article>
        </section>
      </div>
    </div>
  );
}

export default Home;
