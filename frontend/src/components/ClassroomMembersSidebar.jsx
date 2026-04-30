import {
  BarChart3,
  ChevronRight,
  Copy,
  ImageIcon,
  Link2,
  LogOut,
  MoreVertical,
  Pencil,
  UserPlus,
  Users,
  FileText,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import defaultProfile from '../assets/profile.png';
import {
  getMemberName,
  isUserClassAdmin,
  isUserClassOwner,
} from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

function ClassroomMembersSidebar({
  chatName,
  chatId,
  members,
  creator,
  admins,
  membersError,
  user,
  viewerCanManageRoster,
  invitationCode,
  viewerCanManageClassroom = false,
  viewerIsClassroomCreator = false,
  onOpenEditClassroom,
  onRequestLeave,
  leaveBusy = false,
  onRefreshMeta,
  onCloseDrawer,
  className = '',
}) {
  const [openMenuUserId, setOpenMenuUserId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenMenuUserId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const chatRef = { creator, admins };

  const initial =
    chatName.trim().length > 0
      ? chatName.trim().charAt(0).toUpperCase()
      : '?';

  const runMemberPatch = async (targetUserId, action) => {
    if (!chatId || actionBusy) return;
    setActionBusy(true);
    try {
      const response = await fetch(
        `/api/chats/${chatId}/members/${targetUserId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      await readJsonOrThrow(response, 'Unable to update member');
      if (action === 'promote_admin') {
        toast.success('Student is now a class admin');
      } else if (action === 'demote_admin') {
        toast.success('Admin role removed');
      } else {
        toast.success('Member removed from classroom');
      }
      setOpenMenuUserId(null);
      await onRefreshMeta?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyInviteOrClassLink = async () => {
    const origin = window.location.origin;
    try {
      let url;
      let message;
      const code = invitationCode?.trim();
      if (code) {
        url = `${origin}/classroom?invite=${encodeURIComponent(code)}`;
        message =
          'Invite link copied — classmates open it, confirm the code, then join.';
      } else if (chatId) {
        url = `${origin}/classroom/${chatId}`;
        message = 'Classroom link copied (you must already be a member).';
      } else {
        toast.error('Nothing to copy yet.');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(message);
    } catch {
      toast.error(
        'Could not copy automatically — copy from the address bar or share the code manually.',
      );
    }
  };

  const classroomControls = (
    <>
      <button
        type="button"
        onClick={handleCopyInviteOrClassLink}
        disabled={!chatId}
        title={
          invitationCode?.trim()
            ? 'Copy link that opens Join with code'
            : 'Copy link to this classroom (members only)'
        }
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/90 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-cyan-600 dark:hover:bg-slate-800"
      >
        <Copy className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        Copy link
      </button>
      <button
        type="button"
        onClick={() => onOpenEditClassroom?.()}
        disabled={!viewerCanManageClassroom}
        title={
          viewerCanManageClassroom
            ? 'Rename this classroom'
            : 'Only classroom admins can edit'
        }
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/90 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-cyan-600 dark:hover:bg-slate-800"
      >
        <Pencil className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        Edit
      </button>
      <button
        type="button"
        onClick={() => onRequestLeave?.()}
        disabled={viewerIsClassroomCreator || leaveBusy || !chatId}
        title={
          viewerIsClassroomCreator
            ? 'Owners archive or delete the classroom instead'
            : 'Leave this classroom'
        }
        className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50/90 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-rose-700 dark:hover:bg-rose-950/40"
      >
        <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        {leaveBusy ? '…' : 'Leave'}
      </button>
    </>
  );

  return (
    <aside
      className={`relative h-fit overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_40px_-16px_rgba(15,23,42,0.12)] lg:sticky lg:top-24 dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-black/35 ${className}`}
    >
      <div className="relative bg-slate-100/95 px-4 pb-6 pt-2 dark:bg-slate-800/80">
        {onCloseDrawer ? (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpenMenuUserId(null);
                onCloseDrawer();
              }}
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="mb-2" aria-hidden />
        )}
        <div className="flex flex-col items-center px-2 text-center">
          <div
            className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 text-3xl font-bold text-white shadow-lg ring-[3px] ring-white dark:ring-slate-900"
            aria-hidden
          >
            {initial}
          </div>
          <h3 className="mt-4 max-w-[16rem] font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {chatName || 'Course'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {members.length}{' '}
            {members.length === 1 ? 'member' : 'members'}
          </p>

          <div className="mt-5 grid w-full max-w-[14rem] grid-cols-3 gap-2">
            {classroomControls}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700/90">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
          <ImageIcon className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.5} aria-hidden />
          <span className="text-sm text-slate-600 dark:text-slate-400">Coming soon · shared photos</span>
        </div>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
          <FileText className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.5} aria-hidden />
          <span className="text-sm text-slate-600 dark:text-slate-400">Coming soon · files</span>
        </div>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
          <Link2 className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.5} aria-hidden />
          <span className="text-sm text-slate-600 dark:text-slate-400">Coming soon · shared links</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <BarChart3 className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.5} aria-hidden />
          <span className="text-sm text-slate-600 dark:text-slate-400">Coming soon · polls</span>
        </div>
      </div>

      <div className="border-t border-slate-200/90 px-3 pb-4 pt-2 dark:border-slate-700/90">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Users className="h-4 w-4 text-slate-500" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
              {members.length} members
            </span>
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded-lg p-1 text-slate-300 dark:text-slate-600"
            aria-hidden
          >
            <UserPlus className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {membersError && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {membersError}
          </p>
        )}

        {openMenuUserId ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpenMenuUserId(null)}
          />
        ) : null}

        <div className="max-h-[42vh] space-y-0 overflow-y-auto pr-0 classroom-chat-scroll">
          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
              Members load here once connected.
            </p>
          ) : (
            members.map((member) => {
              const name = getMemberName(member);
              const stableId = member?._id ?? member?.id;
              const idStr = stableId != null ? String(stableId) : '';
              const rowKey = idStr || name;
              const isYou =
                stableId &&
                (stableId === user?._id || stableId === user?.id);
              const avatar = member?.avatar || member?.photo || defaultProfile;
              const owner = isUserClassOwner(chatRef, stableId);
              const delegatedAdmin = isUserClassAdmin(chatRef, stableId);
              const showMakeAdmin =
                viewerCanManageRoster && !owner && !delegatedAdmin && idStr;
              const showRemoveAdmin =
                viewerCanManageRoster && delegatedAdmin && !owner;
              const showRemoveMember =
                viewerCanManageRoster &&
                !owner &&
                !isYou &&
                idStr;
              const profileTo = isYou ? '/profile' : `/users/${idStr}`;
              const canOpenProfile = Boolean(idStr);

              const profileBody = (
                <>
                  <span className="relative shrink-0">
                    <span
                      className={`absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/0 to-indigo-400/0 opacity-0 blur-md transition duration-300 group-hover/profile:from-cyan-400/25 group-hover/profile:to-indigo-400/15 group-hover/profile:opacity-100 ${canOpenProfile ? '' : 'hidden'}`}
                      aria-hidden
                    />
                    <img
                      src={avatar}
                      alt=""
                      className={`relative z-[1] h-10 w-10 rounded-full object-cover ring-2 ring-transparent transition duration-200 ${canOpenProfile ? 'group-hover/profile:scale-[1.04] group-hover/profile:ring-cyan-400/45 dark:group-hover/profile:ring-cyan-500/35' : ''}`}
                    />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-bold text-slate-900 transition group-hover/profile:text-cyan-800 dark:text-white dark:group-hover/profile:text-cyan-200">
                      {name}
                      {isYou ? (
                        <span className="ml-1.5 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="flex items-center gap-0.5 text-xs text-slate-500 transition dark:text-slate-400">
                      <span
                        className={
                          canOpenProfile
                            ? 'group-hover/profile:text-cyan-600 dark:group-hover/profile:text-cyan-400'
                            : ''
                        }
                      >
                        {canOpenProfile
                          ? 'Profile & shared books'
                          : 'Member'}
                      </span>
                      {canOpenProfile ? (
                        <ChevronRight
                          strokeWidth={2}
                          className="h-3.5 w-3.5 shrink-0 translate-x-0 opacity-60 transition duration-200 group-hover/profile:translate-x-0.5 group-hover/profile:text-cyan-600 group-hover/profile:opacity-100 dark:group-hover/profile:text-cyan-400"
                          aria-hidden
                        />
                      ) : null}
                    </p>
                  </div>
                </>
              );

              return (
                <article
                  key={rowKey}
                  className="group/member flex items-center gap-1.5 border-b border-slate-100 py-1.5 pr-0.5 transition-colors last:border-b-0 hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                >
                  {canOpenProfile ? (
                    <Link
                      to={profileTo}
                      onClick={() => onCloseDrawer?.()}
                      className="group/profile flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                      aria-label={`View ${name}'s profile and shared books`}
                    >
                      {profileBody}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1.5">
                      {profileBody}
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1.5 pr-0.5">
                    {owner ? (
                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-950/70 dark:text-violet-200">
                        Owner
                      </span>
                    ) : delegatedAdmin ? (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
                        Admin
                      </span>
                    ) : null}
                    {viewerCanManageRoster &&
                    (showMakeAdmin || showRemoveAdmin || showRemoveMember) ? (
                      <div className="relative z-50">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuUserId((cur) =>
                              cur === idStr ? null : idStr,
                            );
                          }}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          aria-label={`Options for ${name}`}
                          aria-expanded={openMenuUserId === idStr}
                        >
                          <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </button>
                        {openMenuUserId === idStr ? (
                          <ul
                            role="menu"
                            className="absolute right-0 top-full mt-1 min-w-[11.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-900"
                          >
                            {showMakeAdmin ? (
                              <li>
                                <button
                                  role="menuitem"
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                  onClick={() => runMemberPatch(idStr, 'promote_admin')}
                                >
                                  Make class admin
                                </button>
                              </li>
                            ) : null}
                            {showRemoveAdmin ? (
                              <li>
                                <button
                                  role="menuitem"
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                  onClick={() => runMemberPatch(idStr, 'demote_admin')}
                                >
                                  Remove admin
                                </button>
                              </li>
                            ) : null}
                            {showRemoveMember ? (
                              <li>
                                <button
                                  role="menuitem"
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                  onClick={() => runMemberPatch(idStr, 'remove')}
                                >
                                  Remove from class
                                </button>
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
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
