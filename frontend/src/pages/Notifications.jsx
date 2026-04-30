import { Megaphone, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { readJsonOrThrow } from '../utils/http';

/** @param {string} iso */
function localDateKeyFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayYesterdayKeys() {
  const now = new Date();
  const today = localDateKeyFromIso(now.toISOString());
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = localDateKeyFromIso(y.toISOString());
  return { today, yesterday };
}

/** @param {string} dateKey YYYY-MM-DD */
function sectionHeading(dateKey, todayKey, yesterdayKey) {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n)))
    return dateKey;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  const thisYear = new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(y !== thisYear ? { year: 'numeric' } : {}),
  });
}

/** @param {string} iso */
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

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/notifications?limit=100', {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not load notifications');
      const list = Array.isArray(data.items)
        ? data.items.filter((i) => i?.type === 'announcement')
        : [];
      setItems(list);
    } catch (e) {
      setError(e?.message || 'Could not load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { groups, sortedKeys } = useMemo(() => {
    /** @type {Map<string, typeof items>} */
    const map = new Map();
    for (const item of items) {
      const key = localDateKeyFromIso(item.createdAt);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    const sortedKeysInner = [...map.keys()].sort((a, b) =>
      b.localeCompare(a),
    );
    return { groups: map, sortedKeys: sortedKeysInner };
  }, [items]);

  const { today: todayKey, yesterday: yesterdayKey } = todayYesterdayKeys();

  return (
    <div className="dashboard-ambient page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-12 pt-6 md:px-6 md:pb-14 md:pt-8">
      <header className="mx-auto mb-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 to-indigo-500/15 text-cyan-700 ring-1 ring-cyan-500/20 dark:from-cyan-400/20 dark:to-indigo-400/10 dark:text-cyan-300 dark:ring-cyan-400/25">
              <Megaphone className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-2xl text-slate-900 dark:text-slate-50">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Announcements from all your classrooms, newest first—grouped by
                day.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-800 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-600"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl">
        {loading ? (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
            No announcements yet. When instructors post in your classrooms,
            they&apos;ll show up here.
          </p>
        ) : (
          <div className="space-y-10">
            {sortedKeys.map((dateKey) => (
              <section key={dateKey}>
                <h2 className="mb-4 border-b border-slate-200 pb-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  {sectionHeading(dateKey, todayKey, yesterdayKey)}
                </h2>
                <ul className="space-y-3">
                  {(groups.get(dateKey) ?? []).map((a, index) => (
                    <li
                      key={`${a.id}-${a.createdAt}`}
                      style={{
                        animationDelay: `${Math.min(index * 40, 320)}ms`,
                      }}
                      className="fade-in-up"
                    >
                      <Link
                        to={`/classroom/${encodeURIComponent(String(a.chatId))}/announcements`}
                        className="group block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-cyan-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-900/30 dark:hover:border-cyan-700"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
                          {a.classroomName}
                          <span className="font-normal normal-case text-slate-400 dark:text-slate-500">
                            Announcement · {formatRelativeTime(a.createdAt)}
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
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
