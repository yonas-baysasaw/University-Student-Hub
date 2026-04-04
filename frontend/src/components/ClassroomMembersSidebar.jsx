import { getMemberName } from '../utils/classroom';

function ClassroomMembersSidebar({ members, membersError, user }) {
  return (
    <aside className="h-fit rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm lg:sticky lg:top-24">
      <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Class Members</p>
        <h3 className="mt-1 font-display text-xl">Participants</h3>
        <p className="mt-1 text-xs text-slate-200">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>
      </div>

      {membersError && <p className="mt-3 text-xs text-rose-600">{membersError}</p>}

      <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {members.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-3 text-xs text-slate-500">
            No members loaded yet.
          </p>
        ) : (
          members.map((member) => {
            const name = getMemberName(member);
            const id = member?._id ?? member?.id ?? name;
            const isYou = id && (id === user?._id || id === user?.id);
            const avatar =
              member?.avatar ||
              member?.photo ||
              'https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg';

            return (
              <article key={id} className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="flex items-center gap-2">
                  <img
                    src={avatar}
                    alt={`${name} avatar`}
                    className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {name} {isYou ? '(You)' : ''}
                    </p>
                    <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                      Active member
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default ClassroomMembersSidebar;
