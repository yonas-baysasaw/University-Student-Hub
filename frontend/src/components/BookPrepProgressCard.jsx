import { BookOpen, Check } from 'lucide-react';
import {
  prepFooterNote,
  prepStepIndex,
  prepWritingSubtitle,
  ragPhaseLabel,
  PREP_STEPS,
} from '../constants/studyBuddyCopy.js';

function ProgressRing({ percent, size = 88, stroke = 6 }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-slate-200/80 dark:stroke-slate-700/80"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-cyan-500 transition-[stroke-dashoffset] duration-500 ease-out dark:stroke-cyan-400"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {Math.round(p)}%
      </span>
    </div>
  );
}

function PrepStepper({ activeIndex, compact = false }) {
  return (
    <ol
      className={`grid w-full gap-1 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}
      aria-label="Book preparation progress"
    >
      {PREP_STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li
            key={step.id}
            className={`flex items-start gap-1.5 rounded-lg px-1.5 py-1 text-[10px] leading-snug sm:text-[11px] ${
              active
                ? 'bg-cyan-500/10 ring-1 ring-cyan-400/40 dark:bg-cyan-950/40 dark:ring-cyan-500/30'
                : done
                  ? 'text-slate-600 dark:text-slate-400'
                  : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                done
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : active
                    ? 'bg-cyan-500/20 text-cyan-700 animate-pulse dark:text-cyan-300'
                    : 'bg-slate-200/80 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
              }`}
            >
              {done ? (
                <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className="text-[9px] font-bold">{step.id}</span>
              )}
            </span>
            <span className={`min-w-0 ${active ? 'font-semibold text-slate-800 dark:text-slate-100' : ''}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Hero or compact card showing book preparation progress.
 */
function BookPrepProgressCard({
  bookTitle = '',
  phase = '',
  progressPercent = 0,
  doneChunks = 0,
  totalChunks = 0,
  variant = 'hero',
  failed = false,
  errorMessage = '',
  onRetry,
}) {
  const activeIndex = prepStepIndex(phase);
  const phaseLabel = ragPhaseLabel(phase);
  const writingSub = prepWritingSubtitle(doneChunks, totalChunks);
  const isHero = variant === 'hero';

  if (failed) {
    return (
      <div
        className={`rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 via-white/80 to-slate-50/60 p-4 shadow-sm dark:border-rose-500/30 dark:from-rose-950/40 dark:via-slate-900/50 dark:to-slate-950/40 ${
          isHero ? 'mx-auto w-full max-w-lg' : ''
        }`}
      >
        <p className="font-display text-sm font-semibold text-rose-900 dark:text-rose-200">
          Couldn&apos;t read this book
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-rose-800/90 dark:text-rose-300/90">
          {errorMessage || "I couldn't read this file. Try a text-based PDF."}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-cyan-200/50 bg-cyan-50/50 px-3 py-2 dark:border-cyan-800/40 dark:bg-cyan-950/25">
        <ProgressRing percent={progressPercent} size={44} stroke={4} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
            {phaseLabel}
          </p>
          {writingSub ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{writingSub}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-200/55 bg-gradient-to-br from-cyan-50/90 via-white/85 to-indigo-50/70 p-4 shadow-[0_8px_32px_-12px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/10 dark:border-cyan-800/40 dark:from-cyan-950/35 dark:via-slate-900/60 dark:to-indigo-950/30 dark:shadow-cyan-950/20 dark:ring-cyan-500/15 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <ProgressRing percent={progressPercent} size={96} stroke={7} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BookOpen
              className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-800/80 dark:text-cyan-300/90">
              Getting your book ready
            </p>
          </div>
          {bookTitle ? (
            <p className="mt-1 truncate font-display text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
              {bookTitle}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {phaseLabel}
          </p>
          {writingSub ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{writingSub}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <PrepStepper activeIndex={activeIndex} />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        {prepFooterNote()}
      </p>
    </div>
  );
}

export default BookPrepProgressCard;
