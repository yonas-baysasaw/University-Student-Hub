import {
  CalendarPlus,
  ChevronRight,
  Clock,
  Heart,
  Loader2,
  MapPin,
  Plus,
  ThumbsDown,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';

function formatEventWhen(startsAt, endsAt) {
  try {
    const s = new Date(startsAt);
    if (Number.isNaN(s.getTime())) return '';
    const opts = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    let line = s.toLocaleString(undefined, opts);
    if (endsAt) {
      const e = new Date(endsAt);
      if (!Number.isNaN(e.getTime())) {
        line += ` — ${e.toLocaleString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })}`;
      }
    }
    return line;
  } catch {
    return '';
  }
}

/** Compact 3-col preview grid for list cards (library-adjacent). */
function EventCardMediaMini({ urls }) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (list.length === 0) return null;
  const show = list.slice(0, 6);
  const extra = list.length - show.length;
  return (
    <div className="mt-2 grid grid-cols-3 gap-1 sm:max-w-md">
      {show.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="relative aspect-square overflow-hidden rounded-lg bg-slate-200/90 ring-1 ring-cyan-500/10 dark:bg-slate-800"
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
          {i === show.length - 1 && extra > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-xs font-bold text-white backdrop-blur-[2px]">
              +{extra}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EventEngagementRow({ event, onUpdated }) {
  const vs = event.viewerState ?? {};
  const userReaction = vs.liked ? 'like' : vs.disliked ? 'dislike' : null;
  const [busy, setBusy] = useState(null);

  const toggleReaction = async (kind) => {
    const nextReaction = kind === userReaction ? 'none' : kind;
    setBusy(kind);
    try {
      const res = await fetch(`/api/events/${event._id}/react`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: nextReaction }),
      });
      const data = await readJsonOrThrow(res, 'Could not update reaction');
      onUpdated?.(data.data);
      toast.success(
        nextReaction === 'none'
          ? 'Reaction cleared'
          : nextReaction === 'like'
            ? 'Liked'
            : 'Dislike saved',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy != null && busy !== 'like'}
        onClick={() => toggleReaction('like')}
        title="Like"
        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
          vs.liked
            ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
            : 'border-slate-200/90 text-slate-600 hover:border-cyan-300/70 dark:border-slate-600 dark:text-slate-400'
        }`}
      >
        <Heart
          className={`h-3.5 w-3.5 ${vs.liked ? 'fill-current' : ''}`}
          aria-hidden
        />
        {event.likesCount ?? 0}
      </button>
      <button
        type="button"
        disabled={busy != null && busy !== 'dislike'}
        onClick={() => toggleReaction('dislike')}
        title="Dislike"
        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
          vs.disliked
            ? 'border-slate-400 bg-slate-800 text-white dark:bg-slate-700'
            : 'border-slate-200/90 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-400'
        }`}
      >
        <ThumbsDown
          className={`h-3.5 w-3.5 ${vs.disliked ? 'fill-current' : ''}`}
          aria-hidden
        />
        {event.dislikesCount ?? 0}
      </button>
    </div>
  );
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [capacity, setCapacity] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events', { credentials: 'include' });
      const data = await readJsonOrThrow(res, 'Could not load events');
      const list = Array.isArray(data.events) ? data.events : [];
      setEvents(list);
    } catch (e) {
      setError(e.message || 'Could not load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mergeEvent = useCallback((updated) => {
    if (!updated?._id) return;
    setEvents((prev) =>
      prev.map((e) =>
        String(e._id) === String(updated._id) ? { ...e, ...updated } : e,
      ),
    );
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast.error('Title is required.');
      return;
    }
    if (!startsAt) {
      toast.error('Start date and time are required.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: t,
        description: description.trim(),
        startsAt: new Date(startsAt).toISOString(),
        location: location.trim(),
        meetingUrl: meetingUrl.trim(),
      };
      if (endsAt) body.endsAt = new Date(endsAt).toISOString();
      const cap = capacity.trim();
      if (cap) body.capacity = Number(cap);

      const res = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJsonOrThrow(res, 'Could not create event');
      if (data.data) {
        setEvents((prev) =>
          [data.data, ...prev].sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          ),
        );
      }
      toast.success('Event posted');
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setStartsAt('');
      setEndsAt('');
      setLocation('');
      setMeetingUrl('');
      setCapacity('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev) => {
    if (
      !window.confirm(
        `Delete “${ev.title}”? Reviews and comments will be removed.`,
      )
    ) {
      return;
    }
    setDeleteBusy(ev._id);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(ev._id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await readJsonOrThrow(res, 'Could not delete event');
      setEvents((prev) => prev.filter((x) => String(x._id) !== String(ev._id)));
      toast.success('Event removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(null);
    }
  };

  return (
    <div className="page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
              Campus life
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Events
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Create gatherings, workshops, and club activities. Like or pass
              on posts and open details to reserve a seat or join the
              conversation.
            </p>
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New event
            </button>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="panel-card rounded-3xl border border-dashed border-slate-200/90 p-10 text-center dark:border-slate-700">
            <CalendarPlus
              className="mx-auto h-10 w-10 text-slate-400"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="mt-4 font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
              No events yet
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Be the first to post an event for your campus.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {events.map((ev, index) => {
              const ownerId = ev.organizer?.id;
              const isOrganizer =
                user &&
                ownerId &&
                String(user._id || user.id) === String(ownerId);
              return (
                <li
                  key={ev._id}
                  style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
                  className="fade-in-up panel-card rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-br from-white via-white to-cyan-50/20 p-4 shadow-sm dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        {ev.title}
                      </h2>
                      <EventCardMediaMini urls={ev.mediaUrls} />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {formatEventWhen(ev.startsAt, ev.endsAt)}
                        </span>
                        {ev.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden
                            />
                            {ev.location}
                          </span>
                        ) : null}
                      </div>
                      {ev.description ? (
                        <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {ev.description}
                        </p>
                      ) : null}
                      {ev.organizer ? (
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          Hosted by{' '}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {ev.organizer.name}
                          </span>
                        </p>
                      ) : null}
                      {user ? (
                        <EventEngagementRow
                          event={ev}
                          onUpdated={mergeEvent}
                        />
                      ) : (
                        <p className="text-xs text-slate-500">
                          Sign in to like or dislike events.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-stretch">
                      <Link
                        to={`/events/${ev._id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-md sm:flex-none"
                      >
                        Details
                        <ChevronRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
                      </Link>
                      {isOrganizer ? (
                        <button
                          type="button"
                          disabled={deleteBusy === ev._id}
                          onClick={() => handleDelete(ev)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-slate-600 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {createOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close"
              onClick={() => !saving && setCreateOpen(false)}
            />
            <div
              role="dialog"
              aria-labelledby="event-create-title"
              className="relative z-[201] flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <h2
                  id="event-create-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  New event
                </h2>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" aria-hidden />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <form
                onSubmit={handleCreate}
                className="flex-1 space-y-3 overflow-y-auto p-4"
              >
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Title
                  </span>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    maxLength={200}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Description
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Starts
                    </span>
                    <input
                      type="datetime-local"
                      required
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Ends (optional)
                    </span>
                    <input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Location
                  </span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    maxLength={300}
                    placeholder="Room, building, or address"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Meeting link (optional)
                  </span>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    placeholder="https://…"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Capacity (optional, 0 = unlimited)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
                >
                  {saving ? 'Posting…' : 'Post event'}
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
