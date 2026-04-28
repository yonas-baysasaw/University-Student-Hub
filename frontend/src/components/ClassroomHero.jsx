/**
 * Shared header strip for classroom detail routes (discussion, announcements, resources).
 */
function ClassroomHero({ title, eyebrow, meta = null, actions = null }) {
  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-cyan-50/35 px-4 py-4 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.12)] dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95 sm:px-5">
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-cyan-400/25 to-indigo-400/15 blur-2xl dark:from-cyan-500/15 dark:to-indigo-500/10"
        aria-hidden
      />
      <div className="pointer-events-none absolute -bottom-8 left-1/4 h-24 w-48 rounded-full bg-cyan-500/5 blur-xl dark:bg-cyan-400/10" aria-hidden />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            {eyebrow}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {title}
            </h2>
            {meta}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export default ClassroomHero;
