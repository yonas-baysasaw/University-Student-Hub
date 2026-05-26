import {
  AlarmClock,
  ArrowRight,
  ClipboardList,
  GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

function parseTime(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatDateTime(iso) {
  const t = parseTime(iso);
  if (t === null) return 'Date not set';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(t));
}

function formatDistance(iso, now) {
  const t = parseTime(iso);
  if (t === null) return '';
  const diffMin = Math.round((t - now.getTime()) / 60000);
  const absMin = Math.abs(diffMin);
  const prefix = diffMin < 0 ? 'Overdue by' : 'Due in';

  if (absMin < 1) return diffMin < 0 ? 'Due now' : 'Due now';
  if (absMin < 60) return `${prefix} ${absMin} min`;

  const hours = Math.floor(absMin / 60);
  const minutes = absMin % 60;
  if (hours < 24) {
    return `${prefix} ${hours}h${minutes ? ` ${minutes}m` : ''}`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${prefix} ${days}d${remHours ? ` ${remHours}h` : ''}`;
}

function assignmentBadge(item) {
  if (item.source === 'announcement') {
    return {
      label: 'Announcement',
      cls: 'bg-violet-500/10 text-violet-800 ring-violet-500/25 dark:text-violet-200 dark:ring-violet-400/30',
    };
  }
  if (item.status === 'graded') {
    return {
      label: 'Graded',
      cls: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/30',
    };
  }
  if (item.status === 'submitted') {
    return {
      label: 'Submitted',
      cls: 'bg-cyan-500/10 text-cyan-800 ring-cyan-500/25 dark:text-cyan-200 dark:ring-cyan-400/30',
    };
  }
  if (item.status === 'overdue') {
    return {
      label: 'Overdue',
      cls: 'bg-rose-500/10 text-rose-800 ring-rose-500/25 dark:text-rose-200 dark:ring-rose-400/30',
    };
  }
  return {
    label: 'Not submitted',
    cls: 'bg-amber-500/10 text-amber-900 ring-amber-500/25 dark:text-amber-100 dark:ring-amber-400/30',
  };
}

function ExamBadge({ importance }) {
  const urgent = Number(importance) >= 2;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        urgent
          ? 'bg-rose-500/10 text-rose-800 ring-rose-500/25 dark:text-rose-200 dark:ring-rose-400/30'
          : 'bg-red-500/10 text-red-800 ring-red-500/25 dark:text-red-200 dark:ring-red-400/30'
      }`}
    >
      {urgent ? 'Urgent exam' : 'Exam'}
    </span>
  );
}

function EmptyState({ icon: Icon, children }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center dark:border-slate-600 dark:bg-slate-800/35">
      <Icon className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
      <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600 dark:text-slate-400">
        {children}
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="mt-5 space-y-3">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export function AssignmentsDueCard({
  assignments,
  dashLoading,
  dashError,
  now,
}) {
  const rows = Array.isArray(assignments) ? assignments : [];

  return (
    <article className="panel-card rounded-[1.35rem] p-5 shadow-[0_18px_44px_-20px_rgba(15,23,42,0.18)] dark:shadow-[0_22px_50px_-18px_rgba(0,0,0,0.45)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            Assignments
          </p>
          <h2 className="mt-1 font-display text-xl text-slate-900 dark:text-slate-50">
            Assignments due
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Open overdue work and upcoming deadlines.
          </p>
        </div>
        {!dashLoading && !dashError ? (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/25 dark:text-amber-100">
            {rows.length}
          </span>
        ) : null}
      </div>

      {dashLoading ? (
        <LoadingRows />
      ) : dashError ? (
        <p className="mt-6 text-sm text-rose-600">{dashError}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardList}>
          No assignments due &mdash; you&rsquo;re caught up for now.
        </EmptyState>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((item, index) => {
            const badge = assignmentBadge(item);
            const link =
              item.source === 'announcement'
                ? `/classroom/${item.chatId}/announcements`
                : `/classroom/${item.chatId}/resources?tab=assignments`;
            const submittedAt = item.mySubmission?.submittedAt;
            return (
              <li
                key={`${item.source}-${item.id}`}
                style={{ animationDelay: `${Math.min(index * 45, 420)}ms` }}
                className="fade-in-up"
              >
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-600 dark:bg-slate-900/35">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                      {item.classroomName}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                    {item.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {formatDateTime(item.dueAt)}
                    </span>
                    <span className="rounded-lg bg-amber-500/10 px-2 py-1 font-semibold text-amber-900 dark:text-amber-100">
                      {formatDistance(item.dueAt, now)}
                    </span>
                    {item.points != null ? (
                      <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                        {item.points} pts
                      </span>
                    ) : null}
                    {item.allowLateUntil ? (
                      <span className="rounded-lg bg-rose-500/10 px-2 py-1 text-rose-800 dark:text-rose-200">
                        Late until {formatDateTime(item.allowLateUntil)}
                      </span>
                    ) : null}
                    {submittedAt ? (
                      <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-200">
                        Submitted {formatDateTime(submittedAt)}
                      </span>
                    ) : null}
                  </div>
                  {item.bodyPreview ? (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {item.bodyPreview}
                    </p>
                  ) : null}
                  <Link
                    to={link}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
                  >
                    {item.canSubmit ? 'Submit assignment' : 'Open'}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

export function UpcomingExamsCard({ exams, dashLoading, dashError, now }) {
  const rows = Array.isArray(exams) ? exams : [];

  return (
    <article className="panel-card rounded-[1.35rem] p-5 shadow-[0_18px_44px_-20px_rgba(15,23,42,0.18)] dark:shadow-[0_22px_50px_-18px_rgba(0,0,0,0.45)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
            Exams
          </p>
          <h2 className="mt-1 font-display text-xl text-slate-900 dark:text-slate-50">
            Upcoming exams
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Exam-dated announcements across your classrooms.
          </p>
        </div>
        {!dashLoading && !dashError ? (
          <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-900 ring-1 ring-red-500/25 dark:text-red-100">
            {rows.length}
          </span>
        ) : null}
      </div>

      {dashLoading ? (
        <LoadingRows />
      ) : dashError ? (
        <p className="mt-6 text-sm text-rose-600">{dashError}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={GraduationCap}>No exams on the horizon.</EmptyState>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((item, index) => (
            <li
              key={item.id}
              style={{ animationDelay: `${Math.min(index * 45, 420)}ms` }}
              className="fade-in-up"
            >
              <Link
                to={`/classroom/${item.chatId}/announcements`}
                className="group block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-red-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-900/35 dark:hover:border-red-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                    {item.classroomName}
                  </span>
                  <ExamBadge importance={item.importance} />
                </div>
                <h3 className="mt-2 font-display text-[15px] font-semibold text-slate-900 group-hover:text-red-800 dark:text-slate-50 dark:group-hover:text-red-200">
                  {item.title}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <AlarmClock className="h-3.5 w-3.5" aria-hidden />
                    {formatDateTime(item.expiresAt)}
                  </span>
                  <span className="rounded-lg bg-red-500/10 px-2 py-1 font-semibold text-red-900 dark:text-red-100">
                    {formatDistance(item.expiresAt, now).replace(
                      'Due in',
                      'In',
                    )}
                  </span>
                </div>
                {item.bodyPreview ? (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                    {item.bodyPreview}
                  </p>
                ) : null}
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-red-700 dark:text-red-300">
                  View announcement
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
