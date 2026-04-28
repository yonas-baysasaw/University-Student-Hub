import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Library,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SCHEDULE_SAVED_EVENT } from '../constants/dashboardEvents.js';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';

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

/** @param {string} t */
function slotStartToMinutes(t) {
  const m = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
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

  const weekdayNow = useMemo(() => new Date().getDay(), []);

  const loadDashboard = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      if (!silent) {
        setDashLoading(true);
        setDashError('');
      }
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
        setSummary(data);
        setDashError('');
      } catch (err) {
        setDashError(err?.message || 'Could not load dashboard');
      } finally {
        if (!silent) setDashLoading(false);
      }
    },
    [weekdayNow],
  );

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

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
                {todayMeetingRows.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                From weekly schedules
              </p>
            </article>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="panel-card flex flex-col rounded-2xl p-5 md:p-6">
            <div className="border-b border-slate-100 pb-4 dark:border-slate-700">
              <h2 className="font-display text-xl text-slate-900 dark:text-slate-50">
                Today&apos;s classes
              </h2>
            </div>

            {dashLoading ? (
              <p className="mt-6 text-sm text-slate-500">Loading schedule…</p>
            ) : dashError ? (
              <p className="mt-6 text-sm text-rose-600">{dashError}</p>
            ) : todayMeetingRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/90 to-white px-4 py-10 text-center dark:border-slate-600 dark:from-slate-900/50 dark:to-slate-900/30">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  No upcoming class
                </p>
                <Link
                  to="/classroom"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
                >
                  Open classrooms
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5">
                <div className="hidden overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm dark:border-slate-600 md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/95 dark:border-slate-600 dark:bg-slate-800/80">
                        <th className="px-4 py-3 font-display font-semibold text-slate-700 dark:text-slate-200">
                          Course
                        </th>
                        <th className="px-4 py-3 font-display font-semibold text-slate-700 dark:text-slate-200">
                          Date
                        </th>
                        <th className="px-4 py-3 font-display font-semibold text-slate-700 dark:text-slate-200">
                          Instructor
                        </th>
                        <th className="px-4 py-3 font-display font-semibold text-slate-700 dark:text-slate-200">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayMeetingRows.map((row) => (
                        <tr
                          key={`${row.chatId}-${row.slot.weekday}-${row.slot.start}-${row.slot.end}-${row.slot.label ?? ''}`}
                          className="border-b border-slate-100 transition hover:bg-cyan-50/50 dark:border-slate-700/90 dark:hover:bg-cyan-950/25"
                        >
                          <td className="px-4 py-3">
                            <Link
                              to={`/classroom/${row.chatId}`}
                              className="font-display font-semibold text-cyan-800 hover:underline dark:text-cyan-300"
                            >
                              {row.courseName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {scheduleDateLabel}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                            {row.slot.label?.trim()
                              ? row.slot.label.trim()
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-lg bg-slate-900/5 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600">
                              {row.slot.start}–{row.slot.end}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="space-y-3 md:hidden">
                  {todayMeetingRows.map((row) => (
                    <li
                      key={`m-${row.chatId}-${row.slot.weekday}-${row.slot.start}-${row.slot.end}-${row.slot.label ?? ''}`}
                    >
                      <Link
                        to={`/classroom/${row.chatId}`}
                        className="block rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm transition hover:border-cyan-300/70 hover:shadow-md dark:border-slate-600 dark:from-slate-900 dark:to-slate-900/70 dark:hover:border-cyan-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                              {row.courseName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {scheduleDateLabel}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-cyan-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-200">
                            {row.slot.start}–{row.slot.end}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <span className="text-slate-400 dark:text-slate-500">
                            Instructor{' '}
                          </span>
                          {row.slot.label?.trim() ? row.slot.label.trim() : '—'}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-end pt-1">
                  <Link
                    to="/classroom"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
                  >
                    Open classrooms
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
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
