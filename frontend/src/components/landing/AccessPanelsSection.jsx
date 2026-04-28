import { Building2, UserRound } from 'lucide-react';

function AccessPanelsSection() {
  return (
    <section
      id="access"
      className="scroll-mt-24 border-y border-slate-200 bg-slate-50/80 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/35 md:px-6 md:py-16"
      aria-labelledby="access-heading"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="access-heading"
          className="text-center font-display text-xl font-bold text-slate-900 dark:text-slate-50 md:text-2xl"
        >
          Role-based access
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600 dark:text-slate-400">
          Same platform—permissions tailored to how you work.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="panel-card rounded-2xl border-cyan-200/60 bg-gradient-to-br from-white to-cyan-50/40 p-6 dark:border-cyan-900/40 dark:from-slate-900 dark:to-slate-900/80">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
                <UserRound className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  Student access
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex gap-2">
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      ·
                    </span>
                    Personalized dashboard after sign-in
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      ·
                    </span>
                    Track schedules and announcements in one timeline
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">
                      ·
                    </span>
                    Library and classroom shortcuts from home
                  </li>
                </ul>
              </div>
            </div>
          </article>

          <article className="panel-card rounded-2xl border-violet-200/50 bg-gradient-to-br from-white to-violet-50/35 p-6 dark:border-violet-900/35 dark:from-slate-900 dark:to-slate-900/85">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                <Building2 className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  Admin / Instructor access
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex gap-2">
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      ·
                    </span>
                    Publish verified announcements to cohorts and courses
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      ·
                    </span>
                    Manage academic content and classroom resources
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-violet-600 dark:text-violet-400">
                      ·
                    </span>
                    Coordinate schedules alongside department tools
                  </li>
                </ul>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default AccessPanelsSection;
