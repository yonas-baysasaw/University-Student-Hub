import { Bell, CalendarRange, Library, Search } from 'lucide-react';

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
      Verified
    </span>
  );
}

function CoreFeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-24 px-4 py-12 md:px-6 md:py-16"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2
            id="features-heading"
            className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            Core modules
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Structured tools you use daily—organized for clarity.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 md:gap-5">
          <article
            id="announcements"
            className="panel-card scroll-mt-24 flex flex-col rounded-2xl p-6 transition hover:shadow-md dark:hover:border-cyan-900/60"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
              <Bell className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Verified announcements
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Official posts from instructors and departments. Prioritize what
              matters with trusted, labeled updates.
            </p>
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-700">
              <li className="flex items-start justify-between gap-2">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  Exam timetable released
                </span>
                <VerifiedBadge />
              </li>
              <li className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Registration window</span>
                <span className="font-mono text-[11px]">Apr 28</span>
              </li>
              <li className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Lab safety briefing</span>
                <span className="font-mono text-[11px]">Apr 29</span>
              </li>
            </ul>
          </article>

          <article
            id="schedule"
            className="panel-card scroll-mt-24 flex flex-col rounded-2xl p-6 transition hover:shadow-md dark:hover:border-cyan-900/60"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
              <CalendarRange className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Dynamic schedule viewer
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              See weekly patterns and today&apos;s slots at a glance—with
              clear time blocks and reminders.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-900/50">
              <p className="font-display text-[11px] font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                Today&apos;s classes
              </p>
              <div className="mt-3 space-y-2">
                {[
                  { t: '09:00–10:30', dot: true },
                  { t: '11:00–12:30', dot: false },
                  { t: '14:00–15:30', dot: true },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-[11px] dark:bg-slate-800"
                  >
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      {row.dot ? (
                        <span
                          className="h-2 w-2 rounded-full bg-cyan-500"
                          aria-label="Reminder"
                        />
                      ) : (
                        <span className="w-2" aria-hidden />
                      )}
                      Section {String.fromCharCode(65 + i)}
                    </span>
                    <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
                      {row.t}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article
            id="library"
            className="panel-card scroll-mt-24 flex flex-col rounded-2xl p-6 transition hover:shadow-md dark:hover:border-cyan-900/60"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
              <Library className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Structured digital library
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Search and filter materials by type—notes, books, and
              assignment bundles in one place.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] dark:border-slate-600 dark:bg-slate-800/80">
                <Search
                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  aria-hidden
                />
                <span className="text-slate-500">Search courses, titles…</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Notes', 'Books', 'Assignments'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled
                    className="cursor-default rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default CoreFeaturesSection;
