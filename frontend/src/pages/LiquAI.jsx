import { BookOpen, ClipboardList, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const options = [
  {
    title: 'Study buddy',
    path: '/liqu-ai/study-buddy',
    description:
      'Bring books from Library, open the book, and study side-by-side with AI explanations and guided reading prompts.',
    cta: 'Open Study buddy',
    icon: BookOpen,
    glow: 'from-cyan-400/30 to-indigo-500/25 dark:from-cyan-500/20 dark:to-indigo-600/25',
    iconSurface:
      'from-cyan-400/20 via-cyan-500/12 to-indigo-500/10 ring-cyan-500/25 dark:from-cyan-500/15 dark:via-cyan-600/10 dark:to-indigo-600/15 dark:ring-cyan-500/30',
    chip: 'Reading workspace',
  },
  {
    title: 'Exams',
    path: '/exams',
    description:
      'Open the Exams area for practice questions, exit-exam style prep, and course assessments.',
    cta: 'Open Exams',
    icon: ClipboardList,
    glow: 'from-slate-400/25 to-violet-500/25 dark:from-slate-500/20 dark:to-violet-600/25',
    iconSurface:
      'from-slate-400/15 via-indigo-400/12 to-violet-500/12 ring-indigo-500/20 dark:from-slate-500/15 dark:via-indigo-500/12 dark:to-violet-600/12 dark:ring-indigo-500/30',
    chip: 'Assessment mode',
  },
];

function LiquAI() {
  return (
    <div className="liqu-ai-ambient page-surface px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="panel-card relative overflow-hidden rounded-3xl p-6 md:p-10">
          <div
            className="workspace-hero-mesh pointer-events-none absolute inset-0 rounded-3xl opacity-80"
            aria-hidden
          />
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-cyan-400/25 to-indigo-500/20 blur-3xl dark:from-cyan-500/15 dark:to-indigo-600/20" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/70 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-800 shadow-sm backdrop-blur-sm dark:border-cyan-800/50 dark:bg-slate-900/50 dark:text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Liqu AI
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl md:text-[2.25rem] md:leading-tight">
              Choose your AI learning mode
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
              Use AI as a study companion for reading books, or go to Exams for
              practice and high-stakes prep—clear options, focused layout.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <article
                key={option.title}
                className="group panel-card relative flex flex-col overflow-hidden rounded-2xl p-6 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/90 hover:shadow-lg dark:hover:border-cyan-800/40 md:p-7"
              >
                <div
                  className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${option.glow} opacity-70 blur-2xl`}
                  aria-hidden
                />
                <span className="relative inline-flex w-fit rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
                  {option.chip}
                </span>
                <div
                  className={`relative mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1 ring-inset ${option.iconSurface} text-slate-800 dark:text-slate-100`}
                >
                  <Icon className="h-7 w-7" aria-hidden strokeWidth={1.6} />
                </div>
                <h2 className="relative mt-4 font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                  {option.title}
                </h2>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {option.description}
                </p>
                <Link
                  to={option.path}
                  className="btn-primary relative mt-8 inline-flex w-fit items-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-md transition group-hover:shadow-lg"
                >
                  {option.cta}
                  <span
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default LiquAI;
