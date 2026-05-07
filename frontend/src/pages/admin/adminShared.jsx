import { Search } from 'lucide-react';

export function AdminCard({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm ring-1 ring-slate-200/80 dark:border-slate-700 dark:bg-slate-900/90 dark:ring-slate-700 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminPageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function AdminSearch({ value, onChange, placeholder = 'Search' }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field w-full pl-9 text-sm"
      />
    </label>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }) {
  const placeholders = Array.from(
    { length: rows },
    (_, index) => `row-${index}`,
  );
  return (
    <div className="space-y-2 p-4">
      {placeholders.map((key) => (
        <div
          key={key}
          className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
