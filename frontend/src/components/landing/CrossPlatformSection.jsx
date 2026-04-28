function CrossPlatformSection() {
  return (
    <section
      className="scroll-mt-24 border-t border-slate-200 bg-slate-50/90 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/45 md:px-6 md:py-16"
      aria-labelledby="platform-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2
              id="platform-heading"
              className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
            >
              Accessible anytime, anywhere
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
              The interface adapts to your device—readable layouts,
              touch-friendly targets, and consistent navigation on phone and
              desktop.
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-center gap-8 lg:justify-end">
            <div
              className="relative w-[7.5rem] rounded-[1.75rem] border-4 border-slate-800 bg-slate-100 shadow-xl dark:border-slate-600 dark:bg-slate-800"
              aria-hidden
            >
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
              <div className="m-2 mt-3 min-h-[11rem] rounded-xl bg-white p-2 shadow-inner dark:bg-slate-900">
                <div className="h-2 w-8 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 space-y-1.5">
                  <div className="h-2 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-2 w-[80%] rounded bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1">
                  <div className="h-8 rounded bg-cyan-500/20" />
                  <div className="h-8 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            </div>
            <div
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-900"
              aria-hidden
            >
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1.5 dark:bg-slate-800">
                <div className="h-2 flex-1 rounded bg-white dark:bg-slate-700" />
                <div className="h-2 w-12 rounded bg-slate-200 dark:bg-slate-600" />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 p-2">
                <div className="col-span-2 min-h-[5rem] rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80" />
                <div className="min-h-[5rem] rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80" />
                <div className="col-span-3 h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CrossPlatformSection;
