function AuthShell({ title, subtitle, children, variant = "default" }) {
  const badgeClass =
    variant === "admin"
      ? "bg-gradient-to-br from-rose-800 to-slate-950 text-rose-50 shadow-md ring-1 ring-rose-400/25"
      : "bg-gradient-to-br from-cyan-700 to-slate-900 text-cyan-100 shadow-md";

  const badgeLabel = variant === "admin" ? "ADM" : "USH";

  return (
    <div className="page-surface flex items-center justify-center px-3 py-6 md:px-6 md:py-10">
      <div className="panel-card fade-in-up w-full max-w-md rounded-2xl p-4 sm:rounded-3xl sm:p-8">
        <div className="text-center">
          <div
            className={`mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold sm:mb-3 sm:h-12 sm:w-12 sm:rounded-2xl sm:text-sm ${badgeClass}`}
          >
            {badgeLabel}
          </div>
          <h1 className="font-display text-xl text-slate-900 dark:text-slate-100 sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            {subtitle}
          </p>
        </div>
        <div className="mt-5 sm:mt-6">{children}</div>
      </div>
    </div>
  );
}

export default AuthShell;
