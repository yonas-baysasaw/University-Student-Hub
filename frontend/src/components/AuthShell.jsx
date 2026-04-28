function AuthShell({ title, subtitle, children }) {
  return (
    <div className="page-surface flex items-center justify-center px-4 py-10">
      <div className="panel-card fade-in-up w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-700 to-slate-900 text-sm font-bold text-cyan-100 shadow-md">
            USH
          </div>
          <h1 className="font-display text-2xl text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export default AuthShell;
