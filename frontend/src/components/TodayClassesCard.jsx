import {
  ArrowRight,
  CalendarDays,
  Clock,
  Copy,
  GraduationCap,
  Timer,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

/** @param {string} t */
function slotTimeToMinutes(t) {
  const m = String(t).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function rowStatusKey(row) {
  return `${row.chatId}-${row.slot.weekday}-${row.slot.start}-${row.slot.end}-${row.slot.label ?? ''}`;
}

/** @param {number} nowM */
function slotPhase(nowM, row) {
  const startM = slotTimeToMinutes(row.slot.start);
  const endM = slotTimeToMinutes(row.slot.end);
  if (endM <= startM) return 'upcoming';
  if (nowM >= endM) return 'past';
  if (nowM >= startM && nowM < endM) return 'live';
  return 'upcoming';
}

function minutesNowFromDate(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/** @param {number} totalMin */
function formatStartsInMinutes(totalMin) {
  if (totalMin <= 0) return 'Starting now';
  if (totalMin < 60) return `Starts in ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `Starts in ${h}h`;
  return `Starts in ${h}h ${m} min`;
}

/** @param {number} totalMin */
function formatEndsInMinutes(totalMin) {
  if (totalMin <= 0) return 'Wrapping up';
  if (totalMin < 60) return `${totalMin} min left`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h left`;
  return `${h}h ${m} min left`;
}

/**
 * @param {{
 *   now: Date;
 *   dashLoading: boolean;
 *   dashError: string;
 *   todayMeetingRows: Array<{ chatId: string; courseName: string; slot: { start: string; end: string; label?: string; weekday?: number } }>;
 *   scheduleInsights: { currentKey: string | null; nextKey: string | null };
 *   insightBanner: { chatId: string; courseName: string; slot: { start: string; end: string; label?: string } } | null | undefined;
 *   nextBanner: { chatId: string; courseName: string; slot: { start: string; end: string; label?: string } } | null | undefined;
 *   scheduleDateLabel: string;
 *   timeShort: string;
 * }} props
 */
export default function TodayClassesCard({
  now,
  dashLoading,
  dashError,
  todayMeetingRows,
  scheduleInsights,
  insightBanner,
  nextBanner,
  scheduleDateLabel,
  timeShort,
}) {
  const copyClassroomLink = useCallback((chatId) => {
    const url = `${window.location.origin}/classroom/${chatId}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Class link copied'))
      .catch(() => toast.error('Could not copy link'));
  }, []);

  const localTimeZoneLabel = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz ? String(tz).replace(/_/g, ' ') : '';
    } catch {
      return '';
    }
  }, []);

  const scheduleDayDigest = useMemo(() => {
    const nowM = minutesNowFromDate(now);
    if (todayMeetingRows.length === 0) return { allSessionsDone: false };
    const allSessionsDone = todayMeetingRows.every(
      (r) => slotPhase(nowM, r) === 'past',
    );
    return { allSessionsDone };
  }, [todayMeetingRows, now]);

  const sessionAfterLive = useMemo(() => {
    if (!scheduleInsights.currentKey) return null;
    const liveRow = todayMeetingRows.find(
      (r) => rowStatusKey(r) === scheduleInsights.currentKey,
    );
    if (!liveRow) return null;
    const liveEnd = slotTimeToMinutes(liveRow.slot.end);
    const liveStart = slotTimeToMinutes(liveRow.slot.start);
    if (liveEnd <= liveStart) return null;
    let best = null;
    let bestStart = Infinity;
    for (const row of todayMeetingRows) {
      const s = slotTimeToMinutes(row.slot.start);
      if (s >= liveEnd && s < bestStart) {
        best = row;
        bestStart = s;
      }
    }
    return best;
  }, [scheduleInsights.currentKey, todayMeetingRows]);

  const liveProgressFraction = useMemo(() => {
    if (!insightBanner) return 0;
    const startM = slotTimeToMinutes(insightBanner.slot.start);
    const endM = slotTimeToMinutes(insightBanner.slot.end);
    const nowM = minutesNowFromDate(now);
    if (endM <= startM) return 0;
    return Math.min(
      100,
      Math.max(0, ((nowM - startM) / (endM - startM)) * 100),
    );
  }, [insightBanner, now]);

  return (
    <article className="panel-card flex flex-col overflow-hidden rounded-[1.35rem] border border-slate-200/90 shadow-[0_22px_50px_-22px_rgba(15,23,42,0.14)] dark:border-slate-700/90 dark:shadow-[0_26px_56px_-22px_rgba(0,0,0,0.55)]">
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50/70 to-cyan-50/35 px-5 py-6 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/22 md:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/22 to-indigo-500/14 text-cyan-700 shadow-lg shadow-cyan-900/10 ring-1 ring-cyan-500/25 dark:from-cyan-400/14 dark:to-indigo-400/10 dark:text-cyan-300 dark:shadow-black/40 dark:ring-cyan-400/30">
              <CalendarDays
                className="h-7 w-7"
                strokeWidth={1.65}
                aria-hidden
              />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400">
                Today&apos;s schedule
              </p>
              <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
                Classes and meetings
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {dashLoading ? (
                  <span className="inline-block h-4 w-52 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                ) : (
                  <>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {todayMeetingRows.length}{' '}
                      {todayMeetingRows.length === 1 ? 'session' : 'sessions'}
                    </span>
                    {' · '}
                    {scheduleDateLabel}
                    {localTimeZoneLabel ? (
                      <>
                        {' · '}
                        <span className="text-slate-500 dark:text-slate-500">
                          {localTimeZoneLabel}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </p>
            </div>
          </div>
          {!dashLoading && !dashError && todayMeetingRows.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-100 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:ring-slate-600">
              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              <span className="font-mono tabular-nums tracking-tight">
                {timeShort}
              </span>
            </div>
          ) : null}
        </div>

        {!dashLoading && !dashError && todayMeetingRows.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50/98 via-white to-emerald-50/45 p-4 shadow-inner dark:border-slate-600 dark:from-slate-900/92 dark:via-slate-900 dark:to-emerald-950/28">
            {insightBanner ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-400/30">
                      <Timer className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
                        In session now
                      </p>
                      <p className="font-display text-[17px] font-semibold leading-snug text-slate-900 dark:text-white">
                        {insightBanner.courseName}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-semibold tabular-nums text-emerald-900 ring-1 ring-emerald-500/25 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-500/35">
                    {insightBanner.slot.start}–{insightBanner.slot.end}
                  </span>
                </div>
                <p className="mt-3 text-sm text-emerald-950/95 dark:text-emerald-50/95">
                  {formatEndsInMinutes(
                    slotTimeToMinutes(insightBanner.slot.end) -
                      minutesNowFromDate(now),
                  )}
                  {' · '}
                  Stay through the block or leave chat anytime—your progress
                  saves as you go.
                </p>
                {slotTimeToMinutes(insightBanner.slot.end) >
                slotTimeToMinutes(insightBanner.slot.start) ? (
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-emerald-900/85 dark:text-emerald-200/85">
                      <span>Session progress</span>
                      <span>{Math.round(liveProgressFraction)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-emerald-900/10 dark:bg-emerald-950/55">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-[width] duration-700 ease-out dark:from-emerald-400 dark:via-teal-500 dark:to-cyan-400"
                        style={{ width: `${liveProgressFraction}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {sessionAfterLive ? (
                  <p className="mt-4 rounded-xl bg-white/75 px-3 py-2 text-xs font-medium text-emerald-950 ring-1 ring-emerald-500/18 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-500/28">
                    <span className="font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      Then ·{' '}
                    </span>
                    {sessionAfterLive.courseName}
                    <span className="ml-2 font-mono tabular-nums text-emerald-900 dark:text-emerald-200">
                      {sessionAfterLive.slot.start}–{sessionAfterLive.slot.end}
                    </span>
                  </p>
                ) : null}
              </>
            ) : nextBanner ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-800 ring-1 ring-cyan-500/25 dark:bg-cyan-500/12 dark:text-cyan-200 dark:ring-cyan-400/35">
                    <Timer className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300">
                      Next up
                    </p>
                    <p className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">
                      {nextBanner.courseName}
                    </p>
                    <p className="mt-1 text-sm text-cyan-950/95 dark:text-cyan-100/95">
                      {formatStartsInMinutes(
                        slotTimeToMinutes(nextBanner.slot.start) -
                          minutesNowFromDate(now),
                      )}
                      {' · '}
                      Preview announcements or open materials before it begins.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-cyan-500/10 px-3 py-1.5 font-mono text-sm font-semibold tabular-nums text-cyan-900 ring-1 ring-cyan-500/25 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-500/35">
                  {nextBanner.slot.start}–{nextBanner.slot.end}
                </span>
              </div>
            ) : scheduleDayDigest.allSessionsDone ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/5 text-slate-600 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-slate-600">
                  <GraduationCap className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">
                    All sessions wrapped for today
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Review announcements or browse the library—tomorrow&apos;s
                    slots appear here automatically.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="px-5 pb-6 pt-5 md:px-7 md:pb-7 md:pt-6">
        {dashLoading ? (
          <div className="space-y-3">
            <div className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100/90 dark:bg-slate-800/90" />
          </div>
        ) : dashError ? (
          <p className="text-sm text-rose-600">{dashError}</p>
        ) : todayMeetingRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/95 to-white px-5 py-12 text-center dark:border-slate-600 dark:from-slate-900/55 dark:to-slate-900/35">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nothing on your timetable for this weekday yet.
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              When instructors add weekly class slots—or you save your own in a
              classroom—they show up here with countdowns and quick links.
            </p>
            <Link
              to="/classroom"
              className="btn-primary mt-6 inline-flex items-center gap-2 px-6 py-2.5 text-sm"
            >
              Open classrooms
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todayMeetingRows.map((row, index) => {
              const rk = rowStatusKey(row);
              const nowM = minutesNowFromDate(now);
              const phase = slotPhase(nowM, row);
              const startM = slotTimeToMinutes(row.slot.start);
              const endM = slotTimeToMinutes(row.slot.end);
              const isNext =
                rk === scheduleInsights.nextKey && phase === 'upcoming';
              const instructor = row.slot.label?.trim() || 'Not specified';

              let accentBar =
                'border-l-[5px] border-slate-300 bg-white/98 dark:border-slate-600 dark:bg-slate-900/55';
              if (phase === 'live') {
                accentBar =
                  'border-l-[5px] border-emerald-500 bg-gradient-to-r from-emerald-50/95 via-white to-white dark:border-emerald-400 dark:from-emerald-950/45 dark:via-slate-900 dark:to-slate-900/98';
              } else if (isNext) {
                accentBar =
                  'border-l-[5px] border-cyan-500 bg-gradient-to-r from-cyan-50/90 via-white to-white dark:border-cyan-400 dark:from-cyan-950/35 dark:via-slate-900 dark:to-slate-900/98';
              } else if (phase === 'past') {
                accentBar =
                  'border-l-[5px] border-slate-300/90 bg-slate-50/65 dark:border-slate-600 dark:bg-slate-900/42';
              }

              let hintLine = '';
              if (phase === 'live') {
                hintLine = `${formatEndsInMinutes(endM - nowM)} · Live session`;
              } else if (phase === 'past') {
                hintLine =
                  'Ended · reopen anytime for chat threads and saved resources';
              } else {
                hintLine = formatStartsInMinutes(startM - nowM);
              }

              const slotProgressPct =
                phase === 'live' && endM > startM
                  ? Math.min(
                      100,
                      Math.max(0, ((nowM - startM) / (endM - startM)) * 100),
                    )
                  : null;

              return (
                <div
                  key={rk}
                  style={{
                    animationDelay: `${Math.min(index * 42, 380)}ms`,
                  }}
                  className={`fade-in-up rounded-2xl border border-slate-200/90 shadow-sm ring-1 ring-slate-900/[0.03] transition hover:shadow-md dark:border-slate-600/90 dark:ring-white/[0.04] ${accentBar}`}
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900/[0.06] px-2.5 py-1 font-mono text-xs font-bold tabular-nums tracking-tight text-slate-800 ring-1 ring-slate-200/90 dark:bg-white/10 dark:text-slate-100 dark:ring-slate-600">
                          {row.slot.start}–{row.slot.end}
                        </span>
                        {phase === 'live' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-500/25 dark:text-emerald-100 dark:ring-emerald-400/35">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            Live
                          </span>
                        ) : null}
                        {isNext && phase !== 'live' ? (
                          <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-900 ring-1 ring-cyan-500/25 dark:text-cyan-100 dark:ring-cyan-400/35">
                            Next
                          </span>
                        ) : null}
                        {phase === 'past' ? (
                          <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-400/25 dark:text-slate-400 dark:ring-slate-500/35">
                            Done
                          </span>
                        ) : null}
                      </div>
                      <Link
                        to={`/classroom/${row.chatId}`}
                        className="block font-display text-lg font-semibold leading-snug text-slate-900 transition hover:text-cyan-700 dark:text-white dark:hover:text-cyan-300"
                      >
                        {row.courseName}
                      </Link>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-500 dark:text-slate-500">
                          Instructor ·{' '}
                        </span>
                        {instructor}
                      </p>
                      <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        {hintLine}
                      </p>
                      {slotProgressPct != null ? (
                        <div className="max-w-md pt-1">
                          <div className="h-1.5 overflow-hidden rounded-full bg-emerald-900/10 dark:bg-emerald-950/45">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-[width] duration-700 ease-out dark:from-emerald-400 dark:to-teal-500"
                              style={{ width: `${slotProgressPct}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                      <button
                        type="button"
                        onClick={() => copyClassroomLink(row.chatId)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300/60 hover:bg-cyan-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Copy link
                      </button>
                      <Link
                        to={`/classroom/${row.chatId}`}
                        className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-xs"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!dashLoading && !dashError && todayMeetingRows.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-700">
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
              Tip: share a copied link with study partners—the room stays
              permission-aware.
            </p>
            <Link
              to="/classroom"
              className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
            >
              All classrooms
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
