import {
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Link2,
  LogOut,
  MoreVertical,
  Pencil,
  Search,
  UserPlus,
  Users,
  FileText,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import defaultProfile from '../assets/profile.png';
import {
  fetchClassroomMeta,
  getMemberName,
  isUserClassAdmin,
  isUserClassOwner,
} from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

function isImageResource(resource) {
  const mime = String(resource?.fileMimeType ?? '').toLowerCase();
  const name = String(resource?.fileName ?? '').toLowerCase();
  return (
    mime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/.test(name)
  );
}

function formatResourceSize(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatResourceDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

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
  showEditClassroomButton = true,
  showLeaveButton = true,
}) {
  const [openMenuUserId, setOpenMenuUserId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [resources, setResources] = useState([]);
  const [classContact, setClassContact] = useState({
    instructorName: '',
    instructorEmail: '',
    meetingUrl: '',
  });
  const [contactDrafts, setContactDrafts] = useState({
    instructorName: '',
    instructorEmail: '',
    meetingUrl: '',
  });
  const [editingContactField, setEditingContactField] = useState(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState('members');
  const [infoQuery, setInfoQuery] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpenMenuUserId(null);
        setMenuPosition(null);
        setEditingContactField(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!chatId) return undefined;
    let cancelled = false;
    const loadSidebarData = async () => {
      try {
        const [meta, resourcesRes] = await Promise.all([
          fetchClassroomMeta(chatId),
          fetch(`/api/chats/${encodeURIComponent(chatId)}/resources`, {
            credentials: 'include',
          }),
        ]);
        const resourcesPayload = await readJsonOrThrow(
          resourcesRes,
          'Unable to load classroom resources',
        );
        if (cancelled) return;
        const nextContact =
          meta?.metadata?.classContact &&
          typeof meta.metadata.classContact === 'object'
            ? meta.metadata.classContact
            : { instructorName: '', instructorEmail: '', meetingUrl: '' };
        setClassContact(nextContact);
        setContactDrafts({
          instructorName:
            typeof nextContact.instructorName === 'string'
              ? nextContact.instructorName
              : '',
          instructorEmail:
            typeof nextContact.instructorEmail === 'string'
              ? nextContact.instructorEmail
              : '',
          meetingUrl:
            typeof nextContact.meetingUrl === 'string'
              ? nextContact.meetingUrl
              : '',
        });
        setResources(
          Array.isArray(resourcesPayload?.resources)
            ? resourcesPayload.resources
            : [],
        );
      } catch (_) {
        if (!cancelled) setResources([]);
      }
    };
    loadSidebarData();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const chatRef = { creator, admins };

  const initial =
    chatName.trim().length > 0
      ? chatName.trim().charAt(0).toUpperCase()
      : '?';

  const photos = useMemo(
    () => resources.filter((resource) => resource?.fileUrl && isImageResource(resource)),
    [resources],
  );
  const files = useMemo(
    () =>
      resources.filter(
        (resource) => resource?.fileUrl && !isImageResource(resource),
      ),
    [resources],
  );
  const sharedLinks = useMemo(
    () => resources.filter((resource) => resource?.link),
    [resources],
  );

  const instructorName =
    typeof classContact?.instructorName === 'string' &&
    classContact.instructorName.trim()
      ? classContact.instructorName.trim()
      : getMemberName(creator);
  const instructorEmail =
    typeof classContact?.instructorEmail === 'string' &&
    classContact.instructorEmail.trim()
      ? classContact.instructorEmail.trim()
      : typeof creator?.email === 'string'
        ? creator.email
        : '';
  const meetingUrl =
    typeof classContact?.meetingUrl === 'string'
      ? classContact.meetingUrl.trim()
      : '';

  const q = infoQuery.trim().toLowerCase();
  const filteredMembers = useMemo(() => {
    if (!q) return members;
    return members.filter((member) =>
      `${getMemberName(member)} ${member?.email ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [members, q]);
  const filteredFiles = useMemo(() => {
    if (!q) return files;
    return files.filter((file) =>
      `${file.title ?? ''} ${file.fileName ?? ''}`.toLowerCase().includes(q),
    );
  }, [files, q]);
  const filteredLinks = useMemo(() => {
    if (!q) return sharedLinks;
    return sharedLinks.filter((link) =>
      `${link.title ?? ''} ${link.link ?? ''}`.toLowerCase().includes(q),
    );
  }, [sharedLinks, q]);

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
      setMenuPosition(null);
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

  const saveClassContact = async (field) => {
    if (!chatId || contactSaving) return;
    setContactSaving(true);
    try {
      const nextDrafts = {
        instructorName: contactDrafts.instructorName.trim(),
        instructorEmail: contactDrafts.instructorEmail.trim(),
        meetingUrl: contactDrafts.meetingUrl.trim(),
      };
      const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classContact: nextDrafts,
        }),
      });
      const updated = await readJsonOrThrow(
        response,
        'Unable to save class contact link',
      );
      const nextContact =
        updated?.metadata?.classContact &&
        typeof updated.metadata.classContact === 'object'
          ? updated.metadata.classContact
          : nextDrafts;
      setClassContact(nextContact);
      setContactDrafts({
        instructorName:
          typeof nextContact.instructorName === 'string'
            ? nextContact.instructorName
            : '',
        instructorEmail:
          typeof nextContact.instructorEmail === 'string'
            ? nextContact.instructorEmail
            : '',
        meetingUrl:
          typeof nextContact.meetingUrl === 'string'
            ? nextContact.meetingUrl
            : '',
      });
      setEditingContactField(null);
      toast.success(`${field === 'meetingUrl' ? 'Zoom link' : 'Class contact'} updated.`);
      await onRefreshMeta?.();
    } catch (err) {
      toast.error(err?.message || 'Unable to save class contact link.');
    } finally {
      setContactSaving(false);
    }
  };

  const controlCount =
    (showEditClassroomButton ? 1 : 0) + (showLeaveButton ? 1 : 0);
  const controlsGridClass =
    controlCount <= 1
      ? 'grid w-full max-w-[14rem] grid-cols-1 gap-2'
      : controlCount === 2
        ? 'grid w-full max-w-[14rem] grid-cols-2 gap-2'
        : 'grid w-full max-w-[14rem] grid-cols-3 gap-2';

  const classroomControls = (
    <>
      {showEditClassroomButton ? (
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
      ) : null}
      {showLeaveButton ? (
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
      ) : null}
    </>
  );

  const contactRows = [
    {
      id: 'instructorName',
      label: 'Instructor',
      value: instructorName,
      placeholder: 'Instructor name',
      type: 'text',
    },
    {
      id: 'instructorEmail',
      label: 'Email',
      value: instructorEmail || 'No email added',
      placeholder: 'instructor@email.com',
      type: 'email',
    },
    {
      id: 'meetingUrl',
      label: 'Zoom',
      value: meetingUrl || 'No class link added',
      placeholder: 'https://zoom.us/...',
      type: 'url',
    },
  ];

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
                  setMenuPosition(null);
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

          <div className="mt-3 w-full max-w-[18rem] space-y-1 text-left">
            {contactRows.map((row) => {
              const editing = editingContactField === row.id;
              return (
                <div key={row.id}>
                  <p className="mb-px text-[8px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {row.label}
                  </p>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/85 px-2 py-1 shadow-sm dark:border-slate-600 dark:bg-slate-900/70">
                    {editing ? (
                      <input
                        type={row.type}
                        value={contactDrafts[row.id] ?? ''}
                        onChange={(event) =>
                          setContactDrafts((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                        placeholder={row.placeholder}
                        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                      />
                    ) : row.id === 'instructorEmail' && instructorEmail ? (
                      <a
                        href={`mailto:${instructorEmail}`}
                        className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900 transition hover:text-cyan-700 dark:text-white dark:hover:text-cyan-300"
                      >
                        {row.value}
                      </a>
                    ) : row.id === 'meetingUrl' && meetingUrl ? (
                      <a
                        href={meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900 transition hover:text-cyan-700 dark:text-white dark:hover:text-cyan-300"
                      >
                        {row.value}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                        {row.value}
                      </span>
                    )}
                    {viewerIsClassroomCreator ? (
                      editing ? (
                        <button
                          type="button"
                          onClick={() => saveClassContact(row.id)}
                          disabled={contactSaving}
                          className="rounded-md p-0.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                          aria-label={`Save ${row.label}`}
                        >
                          <Check className="h-3 w-3" aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingContactField(row.id)}
                          className="rounded-md p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          aria-label={`Edit ${row.label}`}
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyInviteOrClassLink}
                disabled={!chatId}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                <Copy className="h-2.5 w-2.5" aria-hidden />
                Copy link
              </button>
            </div>
          </div>

          {controlCount > 0 ? (
            <div className={`mt-2 ${controlsGridClass}`}>{classroomControls}</div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-200/90 px-3 pb-4 pt-3 dark:border-slate-700/90">
        <div className="mb-2 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
          {[
            ['members', 'Members'],
            ['media', 'Media'],
            ['files', 'Files'],
            ['links', 'Links'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveInfoTab(id);
                setInfoQuery('');
              }}
              className={`rounded-lg px-2 py-2 text-xs font-bold transition ${
                activeInfoTab === id
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200'
                  : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeInfoTab !== 'media' ? (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <input
              type="search"
              value={infoQuery}
              onChange={(event) => setInfoQuery(event.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
            />
          </div>
        ) : null}
        {activeInfoTab === 'members' ? (
          <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Users className="h-4 w-4 text-slate-500" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
              {filteredMembers.length} members
            </span>
          </div>
          <button
            type="button"
            disabled
            className="rounded-lg p-1 text-slate-300 dark:text-slate-600"
            aria-hidden
          >
            <UserPlus className="h-5 w-5" strokeWidth={1.5} />
          </button>
          </div>
        ) : null}

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
            onClick={() => {
              setOpenMenuUserId(null);
              setMenuPosition(null);
            }}
          />
        ) : null}

        {activeInfoTab === 'members' ? (
        <div className="max-h-[42vh] space-y-0 overflow-y-auto pr-0 classroom-chat-scroll">
          {filteredMembers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
              Members load here once connected.
            </p>
          ) : (
            filteredMembers.map((member) => {
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
                            if (openMenuUserId === idStr) {
                              setOpenMenuUserId(null);
                              setMenuPosition(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPosition({
                              top: Math.min(rect.bottom + 6, window.innerHeight - 150),
                              right: Math.max(window.innerWidth - rect.right, 12),
                            });
                            setOpenMenuUserId(idStr);
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
                            style={
                              menuPosition
                                ? {
                                    top: `${menuPosition.top}px`,
                                    right: `${menuPosition.right}px`,
                                  }
                                : undefined
                            }
                            className="fixed z-[1301] min-w-[11.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-900"
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
        ) : activeInfoTab === 'media' ? (
          <div className="max-h-[42vh] overflow-y-auto classroom-chat-scroll">
            {photos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
                No shared photos yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                    title={photo.title || photo.fileName}
                  >
                    <img
                      src={photo.fileUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : activeInfoTab === 'files' ? (
          <div className="max-h-[42vh] space-y-2 overflow-y-auto classroom-chat-scroll">
            {filteredFiles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
                No shared files yet.
              </p>
            ) : (
              filteredFiles.map((file, index) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl bg-slate-100/85 px-3 py-2.5 text-left transition hover:bg-slate-200/80 dark:bg-slate-800/70 dark:hover:bg-slate-700/70"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${
                      index % 3 === 0
                        ? 'bg-violet-500'
                        : index % 3 === 1
                          ? 'bg-rose-500'
                          : 'bg-orange-500'
                    }`}
                  >
                    <FileText className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {file.title || file.fileName || 'Class file'}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {[formatResourceSize(file.fileSize), formatResourceDate(file.createdAt)]
                        .filter(Boolean)
                        .join(' — ') || 'File'}
                    </span>
                  </span>
                  <Download className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="max-h-[42vh] space-y-2 overflow-y-auto classroom-chat-scroll">
            {filteredLinks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-center text-xs font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
                No shared links yet.
              </p>
            ) : (
              filteredLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl bg-slate-100/85 px-3 py-2.5 transition hover:bg-slate-200/80 dark:bg-slate-800/70 dark:hover:bg-slate-700/70"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Link2 className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {link.title || 'Shared link'}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {link.link}
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </a>
              ))
            )}
          </div>
        )}
      </div>
      {previewPhoto ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close photo preview"
            onClick={() => setPreviewPhoto(null)}
          />
          <div className="relative max-h-full max-w-3xl overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/65"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <img
              src={previewPhoto.fileUrl}
              alt=""
              className="max-h-[86vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default ClassroomMembersSidebar;
