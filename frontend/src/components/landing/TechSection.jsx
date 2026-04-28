function TechSection() {
  return (
    <section
      className="scroll-mt-24 border-t border-slate-200 px-4 py-10 dark:border-slate-800 md:px-6 md:py-12"
      aria-labelledby="tech-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-slate-200/90 bg-white/60 px-5 py-6 dark:border-slate-700 dark:bg-slate-900/40 md:px-8 md:py-8">
          <h2 id="tech-heading" className="sr-only">
            Technology
          </h2>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Built for reliability
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            The frontend is implemented with{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              React
            </span>{' '}
            for a modular, maintainable UI with fast renders and scalable
            structure—focused on usability and consistent patterns across the
            hub.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {['Fast', 'Scalable', 'Modular', 'High usability'].map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default TechSection;
