import { Shield } from 'lucide-react';
import defaultProfile from '../assets/profile.png';
import { getMemberName } from '../utils/classroom';

function ClassroomMembersSidebar({
  members,
  membersError,
  user,
  className = '',
}) {
  return (
    <aside
      className={`h-fit rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_40px_-16px_rgba(15,23,42,0.12)] lg:sticky lg:top-24 dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-black/35 ${className}`}
    >
      <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 px-4 py-4 text-white">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-cyan-400/25 blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Shield className="h-5 w-5 text-cyan-200" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/95">
              Roster
            </p>
            <h3 className="mt-0.5 font-display text-xl font-bold tracking-tight">
              Participants
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-300">
              {members.length}{' '}
              {members.length === 1 ? 'person in this space' : 'people in this space'}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 p-3 dark:border-slate-700/90">
        {membersError && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {membersError}
          </p>
        )}

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1 classroom-chat-scroll">
          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
              Members load here once connected.
            </p>
          ) : (
            members.map((member) => {
              const name = getMemberName(member);
              const id = member?._id ?? member?.id ?? name;
              const isYou = id && (id === user?._id || id === user?.id);
              const avatar = member?.avatar || member?.photo || defaultProfile;

              return (
                <article
                  key={id}
                  className="rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/90 p-2.5 transition hover:border-cyan-200/80 hover:shadow-sm dark:border-slate-700/90 dark:from-slate-900 dark:to-slate-950/90 dark:hover:border-cyan-800"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={avatar}
                      alt={`${name} avatar`}
                      className="h-10 w-10 shrink-0 rounded-full border-2 border-white object-cover shadow-md ring-2 ring-cyan-500/15 dark:border-slate-800 dark:ring-cyan-400/20"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {name}
                        {isYou ? (
                          <span className="ml-1.5 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                            You
                          </span>
                        ) : null}
                      </p>
                      <span className="mt-0.5 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-800 ring-1 ring-cyan-200/70 dark:bg-cyan-950/60 dark:text-cyan-200 dark:ring-cyan-800/60">
                        Member
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}

export default ClassroomMembersSidebar;
