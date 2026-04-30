import {
  ArrowDown,
  ChevronRight,
  Loader2,
  Menu,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ClassroomHero from '../components/ClassroomHero';
import ClassroomMembersSidebar from '../components/ClassroomMembersSidebar';
import ClassroomTabs from '../components/ClassroomTabs';
import { CLASSROOM_LIST_CHANGED_EVENT } from '../constants/dashboardEvents.js';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import {
  canManageClassroom,
  fetchClassroomMeta,
  getMemberName,
  isClassroomCreator,
  isUserClassAdmin,
  isUserClassOwner,
} from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';
import defaultProfile from '../assets/profile.png';

function notifyClassroomsChanged() {
  window.dispatchEvent(new CustomEvent(CLASSROOM_LIST_CHANGED_EVENT));
}

const NEAR_BOTTOM_PX = 96;
const MESSAGE_PAGE_LIMIT = 80;

function mergeMessagesById(prev, incoming) {
  const map = new Map(
    prev.map((m) => [String(m._id ?? m.id), { ...m }]),
  );
  for (const m of incoming) {
    const id = String(m._id ?? m.id);
    const existing = map.get(id);
    map.set(id, existing ? { ...existing, ...m } : { ...m });
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/** Stable accent classes per sender (readable on bubble fills). */
const SENDER_NAME_TONES = [
  'text-pink-700 dark:text-pink-300',
  'text-sky-700 dark:text-sky-300',
  'text-amber-800 dark:text-amber-300',
  'text-violet-700 dark:text-violet-300',
  'text-emerald-800 dark:text-emerald-300',
  'text-orange-800 dark:text-orange-300',
  'text-fuchsia-700 dark:text-fuchsia-300',
  'text-cyan-800 dark:text-cyan-300',
];

function senderNameToneClass(userIdStr) {
  if (!userIdStr) return 'text-slate-700 dark:text-slate-200';
  let acc = 0;
  for (let i = 0; i < userIdStr.length; i += 1) {
    acc = (acc * 31 + userIdStr.charCodeAt(i)) >>> 0;
  }
  return SENDER_NAME_TONES[acc % SENDER_NAME_TONES.length];
}

function ChatRoom() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [creator, setCreator] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [chatName, setChatName] = useState('Course Discussion');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [membersError, setMembersError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);
  const [invitationCode, setInvitationCode] = useState('');
  const [showEditClassroom, setShowEditClassroom] = useState(false);
  const [editNameDraft, setEditNameDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [menuOpenMessageId, setMenuOpenMessageId] = useState(null);
  const [editMessageModalId, setEditMessageModalId] = useState(null);
  const [editMessageDraft, setEditMessageDraft] = useState('');
  const [editMessageSaving, setEditMessageSaving] = useState(false);
  const [deleteMessageBusyId, setDeleteMessageBusyId] = useState(null);

  const socket = useSocket();
  const scrollRef = useRef(null);
  const messagesRef = useRef([]);
  const hasMoreOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlder;
  }, [hasMoreOlder]);
  const viewerIsCreator = isClassroomCreator(user, { creator });
  const viewerCanManageClassroom = canManageClassroom(user, {
    creator,
    admins,
  });

  const chatRef = { creator, admins };

  const refreshChatMetaAfterMutation = useCallback(async () => {
    if (!chatId) return;
    try {
      const chat = await fetchClassroomMeta(chatId);
      setChatName(chat?.name ?? 'Course Discussion');
      setMembers(chat?.members ?? []);
      setCreator(chat?.creator ?? null);
      setAdmins(chat?.admins ?? []);
      setInvitationCode(
        typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
      );
    } catch (_) {
      /* poll will retry */
    }
  }, [chatId]);

  const membersById = new Map(
    members
      .map((m) => {
        const id = m?._id ?? m?.id;
        return id ? [String(id), m] : null;
      })
      .filter(Boolean),
  );

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!chatId || loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const oldestId = messagesRef.current[0]?._id;
    if (!oldestId) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    try {
      const res = await fetch(
        `/api/chats/${chatId}/messages?limit=${MESSAGE_PAGE_LIMIT}&before=${encodeURIComponent(String(oldestId))}`,
        { credentials: 'include' },
      );
      const payload = await readJsonOrThrow(res, 'Unable to load older messages');
      const older = payload?.messages ?? [];
      setHasMoreOlder(Boolean(payload?.hasMoreOlder));
      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }
      setMessages((prev) => [...older, ...prev]);
      requestAnimationFrame(() => {
        const wrap = scrollRef.current;
        if (!wrap) return;
        wrap.scrollTop = wrap.scrollHeight - prevScrollHeight + prevScrollTop;
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [chatId]);

  const handleChatScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(gap < NEAR_BOTTOM_PX);
    if (
      el.scrollTop < 72 &&
      hasMoreOlderRef.current &&
      !loadingOlderRef.current
    ) {
      void loadOlderMessages();
    }
  }, [loadOlderMessages]);

  useLayoutEffect(() => {
    if (!stickToBottom) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, stickToBottom]);

  useEffect(() => {
    if (!chatId) {
      setError('Classroom not found');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchInitialMessages = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/chats/${chatId}/messages?limit=${MESSAGE_PAGE_LIMIT}`,
          { credentials: 'include', signal: controller.signal },
        );
        const payload = await readJsonOrThrow(
          response,
          'Unable to load discussion',
        );
        setMessages(payload?.messages ?? []);
        setHasMoreOlder(Boolean(payload?.hasMoreOlder));
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message);
        }
      } finally {
        setLoading(false);
      }
    };

    const pollNewMessages = async () => {
      try {
        const list = messagesRef.current;
        const newestId = list[list.length - 1]?._id;
        if (!newestId) {
          const response = await fetch(
            `/api/chats/${chatId}/messages?limit=${MESSAGE_PAGE_LIMIT}`,
            { credentials: 'include', signal: controller.signal },
          );
          const payload = await readJsonOrThrow(
            response,
            'Unable to refresh discussion',
          );
          setMessages(payload?.messages ?? []);
          setHasMoreOlder(Boolean(payload?.hasMoreOlder));
          return;
        }
        const response = await fetch(
          `/api/chats/${chatId}/messages?limit=80&after=${encodeURIComponent(String(newestId))}`,
          { credentials: 'include', signal: controller.signal },
        );
        const payload = await readJsonOrThrow(
          response,
          'Unable to refresh discussion',
        );
        const incoming = payload?.messages ?? [];
        if (incoming.length === 0) return;
        setMessages((prev) => mergeMessagesById(prev, incoming));
      } catch (pollErr) {
        if (pollErr.name !== 'AbortError') {
          /* silent */
        }
      }
    };

    const loadMeta = async ({ silent = false } = {}) => {
      if (!silent) {
        setMembersError('');
        setMetaLoading(true);
      }
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chat?.name ?? 'Course Discussion');
        setMembers(chat?.members ?? []);
        setCreator(chat?.creator ?? null);
        setAdmins(chat?.admins ?? []);
        setInvitationCode(
          typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
        );
      } catch (metaError) {
        if (metaError.name !== 'AbortError' && !silent) {
          setMembersError(metaError.message);
        }
      } finally {
        if (!silent) setMetaLoading(false);
      }
    };

    fetchInitialMessages();
    loadMeta();
    const intervalId = setInterval(() => {
      pollNewMessages();
      loadMeta({ silent: true });
    }, 6000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [chatId]);

  useEffect(() => {
    if (!socket || !chatId) return undefined;
    socket.emit('joinChat', { chatId });
    const onMessage = (payload) => {
      const raw = payload?.message ?? payload;
      if (!raw) return;
      const id = raw._id ?? raw.id;
      if (!id) return;
      setMessages((prev) => mergeMessagesById(prev, [raw]));
    };
    const onUpdated = (payload) => {
      const raw = payload?.message;
      if (!raw) return;
      setMessages((prev) => mergeMessagesById(prev, [raw]));
    };
    socket.on('message', onMessage);
    socket.on('messageUpdated', onUpdated);
    return () => {
      socket.emit('leaveChat', { chatId });
      socket.off('message', onMessage);
      socket.off('messageUpdated', onUpdated);
    };
  }, [socket, chatId]);

  useEffect(() => {
    if (!menuOpenMessageId) return undefined;
    const onDocDown = () => setMenuOpenMessageId(null);
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocDown);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [menuOpenMessageId]);

  useEffect(() => {
    if (showEditClassroom) setEditNameDraft(chatName);
  }, [showEditClassroom, chatName]);

  const submitEditClassroom = async () => {
    const trimmed = editNameDraft.trim();
    if (!trimmed || !chatId) {
      toast.error('Name cannot be empty.');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      await readJsonOrThrow(res, 'Could not update classroom');
      toast.success('Classroom updated.');
      setShowEditClassroom(false);
      setChatName(trimmed);
      await refreshChatMetaAfterMutation();
      notifyClassroomsChanged();
    } catch (e) {
      toast.error(e?.message || 'Could not update.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmLeaveClassroom = async () => {
    if (!chatId || leaveBusy) return;
    setLeaveBusy(true);
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/leave`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      await readJsonOrThrow(res, 'Could not leave classroom');
      toast.success('You left the classroom.');
      setShowLeaveConfirm(false);
      setShowMembersDrawer(false);
      notifyClassroomsChanged();
      navigate('/classroom');
    } catch (e) {
      toast.error(e?.message || 'Could not leave.');
    } finally {
      setLeaveBusy(false);
    }
  };

  const submitEditMessageContent = async () => {
    const trimmed = editMessageDraft.trim();
    if (!trimmed || !chatId || !editMessageModalId) {
      toast.error('Message cannot be empty.');
      return;
    }
    setEditMessageSaving(true);
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(editMessageModalId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        },
      );
      const data = await readJsonOrThrow(res, 'Could not update message');
      const updated = data?.message;
      if (updated) {
        setMessages((prev) => mergeMessagesById(prev, [updated]));
      }
      setEditMessageModalId(null);
      toast.success('Message updated.');
    } catch (e) {
      toast.error(e?.message || 'Could not update.');
    } finally {
      setEditMessageSaving(false);
    }
  };

  const deleteMessageById = async (messageId) => {
    const mid = messageId != null ? String(messageId) : '';
    if (!chatId || !mid) return;
    setDeleteMessageBusyId(mid);
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(mid)}/delete`,
        { method: 'POST', credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Could not delete message');
      const tomb = data?.message;
      if (tomb) {
        setMessages((prev) => mergeMessagesById(prev, [tomb]));
      }
      toast.success('Message removed.');
    } catch (e) {
      toast.error(e?.message || 'Could not delete.');
    } finally {
      setDeleteMessageBusyId(null);
    }
  };

  const promptDeleteMessage = (msg) => {
    setMenuOpenMessageId(null);
    const mid = msg?._id ?? msg?.id;
    if (
      !window.confirm(
        'Remove this message from the discussion for everyone?',
      )
    ) {
      return;
    }
    void deleteMessageById(mid);
  };

  const submitMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSending(true);
    setSendError('');
    setStickToBottom(true);
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, messageType: 'text' }),
      });
      const payload = await readJsonOrThrow(response, 'Unable to send message');
      const created = payload?.message ?? payload;
      if (created) {
        setMessages((prev) => mergeMessagesById(prev, [created]));
      }
      setDraft('');
      requestAnimationFrame(() => scrollToBottom('smooth'));
    } catch (submitError) {
      setSendError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  const handleSend = (event) => {
    event.preventDefault();
    submitMessage();
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  if (loading) {
    return (
      <div className="classroom-ambient relative page-surface flex justify-center px-4 py-10">
        <div className="relative z-[2] w-full max-w-6xl">
          <div className="panel-card rounded-3xl p-10">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-600" aria-hidden />
              Loading discussion…
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="classroom-ambient relative page-surface flex justify-center px-4 py-10">
        <div className="relative z-[2] w-full max-w-6xl">
          <div className="panel-card rounded-3xl p-8">
            <p className="font-medium text-rose-600">{error}</p>
            <Link
              to="/classroom"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 underline dark:text-cyan-400"
            >
              ← Back to classrooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const liveBadge = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
      <span
        className="classroom-live-dot h-2 w-2 rounded-full bg-emerald-500"
        aria-hidden
      />
      Live sync
    </span>
  );

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => setShowMembersDrawer(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/50"
        aria-label="Open participants"
        title="Participants"
      >
        <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
      <Link
        to="/classroom"
        className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide"
      >
        All classrooms
      </Link>
    </>
  );

  return (
    <div className="classroom-ambient relative page-surface flex justify-center px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(260px,34vh)] workspace-hero-mesh opacity-85 dark:opacity-55" />

      <div className="relative z-[2] w-full max-w-6xl">
        <div className="panel-card rounded-3xl p-4 sm:p-5 md:p-7">
          <ClassroomHero
            title={chatName}
            eyebrow="Discussion"
            meta={
              <>
                {liveBadge}
                {metaLoading ? (
                  <span className="text-xs font-medium text-slate-400">
                    Updating roster…
                  </span>
                ) : null}
              </>
            }
            actions={headerActions}
          />

          <ClassroomTabs />

          <div className="relative min-h-0">
            <div
              ref={scrollRef}
              onScroll={handleChatScroll}
              className="classroom-chat-thread-pane classroom-chat-scroll relative h-[min(56vh,520px)] overflow-y-auto rounded-2xl border border-slate-200/90 px-3 py-4 shadow-inner dark:border-slate-700 md:px-4"
            >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 text-cyan-700 dark:text-cyan-300">
                      <MessageSquare className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                    </span>
                    <p className="mt-4 max-w-sm text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Start the thread—questions, reminders, or links welcome.
                    </p>
                    <p className="mt-2 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                      Messages refresh automatically every few seconds so everyone
                      stays loosely in sync without reloading.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 pb-2">
                    {loadingOlder ? (
                      <div className="flex justify-center py-2" aria-live="polite">
                        <Loader2
                          className="h-5 w-5 animate-spin text-cyan-600 dark:text-cyan-400"
                          aria-hidden
                        />
                      </div>
                    ) : null}
                    {messages.map((message, index) => {
                      const sender = message?.sender;
                      const senderId =
                        typeof sender === 'string'
                          ? sender
                          : (sender?._id ?? sender?.id);
                      const senderIdStr =
                        senderId != null ? String(senderId) : '';
                      const senderFromMembers = senderId
                        ? membersById.get(String(senderId))
                        : null;
                      const senderProfile =
                        typeof sender === 'object' && sender !== null
                          ? sender
                          : senderFromMembers;
                      const senderName = getMemberName(senderProfile);
                      const isSelf =
                        senderId &&
                        (String(senderId) === String(user?._id) ||
                          String(senderId) === String(user?.id));
                      const time = new Date(
                        message?.createdAt ?? Date.now(),
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const senderProfileHref = isSelf
                        ? '/profile'
                        : senderId
                          ? `/users/${senderId}`
                          : null;
                      const avatarSrc = isSelf
                        ? user?.photo || defaultProfile
                        : senderProfile?.photo ||
                          senderProfile?.avatar ||
                          defaultProfile;
                      let roleChip = null;
                      if (senderIdStr && !isSelf) {
                        if (isUserClassOwner(chatRef, senderIdStr)) {
                          roleChip = 'Owner';
                        } else if (isUserClassAdmin(chatRef, senderIdStr)) {
                          roleChip = 'Admin';
                        }
                      }
                      const nameTone = isSelf
                        ? 'text-cyan-900 dark:text-cyan-100'
                        : senderNameToneClass(senderIdStr);

                      const msgKey = String(
                        message?._id ??
                          message?.id ??
                          `${senderId}-${index}`,
                      );
                      const isDeleted = Boolean(message?.deletedAt);
                      const canEdit = isSelf && !isDeleted;
                      const canDeleteOwn = isSelf && !isDeleted;
                      const canModDelete =
                        viewerCanManageClassroom && !isSelf && !isDeleted;
                      const showActionsMenu =
                        canEdit || canDeleteOwn || canModDelete;
                      const deleteBusy = deleteMessageBusyId === msgKey;

                      const bubbleInner = (
                        <>
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                            {isSelf ? (
                              senderProfileHref ? (
                                <Link
                                  to={senderProfileHref}
                                  className={`inline-flex max-w-full items-center gap-0.5 rounded font-bold outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-[13px] leading-tight ${nameTone}`}
                                  aria-label="Open your profile"
                                >
                                  You
                                  <ChevronRight
                                    strokeWidth={2.5}
                                    className="h-3 w-3 shrink-0 opacity-70"
                                    aria-hidden
                                  />
                                </Link>
                              ) : (
                                <span
                                  className={`text-[13px] font-bold leading-tight ${nameTone}`}
                                >
                                  You
                                </span>
                              )
                            ) : senderProfileHref ? (
                              <Link
                                to={senderProfileHref}
                                className={`inline-flex max-w-full min-w-0 items-center gap-0.5 truncate rounded font-bold outline-none transition hover:underline focus-visible:ring-2 focus-visible:ring-cyan-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-[13px] leading-tight ${nameTone}`}
                                aria-label={`View ${senderName}'s profile and shared books`}
                              >
                                <span className="truncate">{senderName}</span>
                                <ChevronRight
                                  strokeWidth={2.5}
                                  className="h-3 w-3 shrink-0 opacity-60"
                                  aria-hidden
                                />
                              </Link>
                            ) : (
                              <span
                                className={`truncate text-[13px] font-bold leading-tight ${nameTone}`}
                              >
                                {senderName}
                              </span>
                            )}
                            {roleChip ? (
                              <span className="rounded-md bg-slate-900/[0.07] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[var(--classroom-bubble-meta)] dark:bg-white/[0.08]">
                                {roleChip}
                              </span>
                            ) : null}
                          </div>
                          {isDeleted ? (
                            <p className="mt-1 text-[13px] italic leading-relaxed text-[var(--classroom-bubble-meta)]">
                              This message was removed.
                            </p>
                          ) : (
                            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--classroom-bubble-text)]">
                              {message?.content ?? ''}
                            </p>
                          )}
                          <div className="mt-1 flex items-center justify-end gap-2">
                            {message?.editedAt && !isDeleted ? (
                              <span className="text-[10px] font-medium text-[var(--classroom-bubble-meta)]">
                                (edited)
                              </span>
                            ) : null}
                            <span className="classroom-bubble-meta">{time}</span>
                          </div>
                        </>
                      );

                      return (
                        <div
                          key={msgKey}
                          className={`flex items-end gap-2 ${
                            isSelf ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {!isSelf ? (
                            <img
                              src={avatarSrc}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-slate-950"
                            />
                          ) : null}
                          <div
                            className={`relative max-w-[min(92%,28rem)] pr-1 pt-1 ${
                              isSelf ? 'ml-auto' : ''
                            }`}
                          >
                            {showActionsMenu ? (
                              <div className="absolute right-0 top-0 z-10">
                                <button
                                  type="button"
                                  aria-label="Message actions"
                                  aria-expanded={
                                    menuOpenMessageId === msgKey
                                  }
                                  aria-haspopup="menu"
                                  disabled={deleteBusy}
                                  className="rounded-lg p-1 text-[var(--classroom-bubble-meta)] outline-none transition hover:bg-slate-900/10 focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:hover:bg-white/10"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenMessageId((open) =>
                                      open === msgKey ? null : msgKey,
                                    );
                                  }}
                                >
                                  <MoreVertical
                                    className="h-4 w-4"
                                    aria-hidden
                                  />
                                </button>
                                {menuOpenMessageId === msgKey ? (
                                  <div
                                    role="menu"
                                    className="absolute right-0 mt-0.5 min-w-[10.5rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900"
                                    onMouseDown={(e) =>
                                      e.stopPropagation()
                                    }
                                  >
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          setMenuOpenMessageId(null);
                                          setEditMessageModalId(msgKey);
                                          setEditMessageDraft(
                                            message?.content ?? '',
                                          );
                                        }}
                                      >
                                        <Pencil
                                          className="h-4 w-4 shrink-0 opacity-70"
                                          aria-hidden
                                        />
                                        Edit
                                      </button>
                                    ) : null}
                                    {canDeleteOwn || canModDelete ? (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={deleteBusy}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                        onClick={() =>
                                          promptDeleteMessage(message)
                                        }
                                      >
                                        <Trash2
                                          className="h-4 w-4 shrink-0 opacity-70"
                                          aria-hidden
                                        />
                                        {deleteBusy ? 'Removing…' : 'Remove'}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            <div
                              className={`classroom-bubble-shell ${
                                isSelf
                                  ? 'classroom-bubble-shell--out'
                                  : 'classroom-bubble-shell--in'
                              }`}
                            >
                              {bubbleInner}
                            </div>
                          </div>
                          {isSelf ? (
                            <img
                              src={avatarSrc}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm dark:ring-slate-950"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!stickToBottom && messages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setStickToBottom(true);
                    scrollToBottom('smooth');
                  }}
                  className="absolute bottom-[7.25rem] left-1/2 z-[5] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-lg ring-1 ring-slate-900/5 backdrop-blur-md transition hover:border-cyan-300 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-cyan-500"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  New messages
                </button>
              ) : null}

              <form
                onSubmit={handleSend}
                className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
              >
                <label htmlFor="classroom-chat-input" className="sr-only">
                  Message
                </label>
                <textarea
                  id="classroom-chat-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Write a message… (Enter to send, Shift+Enter for line break)"
                  rows={draft.length > 120 ? 4 : 2}
                  disabled={sending}
                  className="w-full resize-y rounded-xl border border-transparent bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/80">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {draft.trim().length > 0
                      ? `${draft.trim().length} character${draft.trim().length === 1 ? '' : 's'}`
                      : 'Be respectful and on-topic.'}
                  </p>
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="btn-primary px-6 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
              {sendError && (
                <p className="mt-2 text-sm font-medium text-rose-600">{sendError}</p>
              )}
          </div>
        </div>
      </div>

      {showMembersDrawer && (
        <div className="fixed inset-0 z-[1200]">
          <button
            type="button"
            aria-label="Close participants drawer"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setShowMembersDrawer(false)}
          />
          <div className="fade-in-up absolute right-0 top-0 h-full w-[min(92vw,24rem)] max-w-md overflow-y-auto bg-slate-50 p-3 shadow-2xl dark:bg-slate-950/95 sm:w-[min(86vw,22rem)] md:p-4 lg:w-[min(400px,32vw)]">
            <ClassroomMembersSidebar
              chatId={chatId}
              chatName={chatName}
              members={members}
              creator={creator}
              admins={admins}
              membersError={membersError}
              user={user}
              viewerCanManageRoster={viewerIsCreator}
              invitationCode={invitationCode}
              viewerCanManageClassroom={viewerCanManageClassroom}
              viewerIsClassroomCreator={viewerIsCreator}
              onOpenEditClassroom={() => setShowEditClassroom(true)}
              onRequestLeave={() => setShowLeaveConfirm(true)}
              leaveBusy={leaveBusy}
              onRefreshMeta={refreshChatMetaAfterMutation}
              onCloseDrawer={() => setShowMembersDrawer(false)}
              className="h-full min-h-0 rounded-2xl border-slate-200/90 shadow-md dark:border-slate-700"
            />
          </div>
        </div>
      )}

      {showEditClassroom ? (
        <div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() => !editSaving && setShowEditClassroom(false)}
          onKeyDown={(e) =>
            e.key === 'Escape' && !editSaving && setShowEditClassroom(false)
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="chatroom-edit-title"
            className="fade-in-up relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="chatroom-edit-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Edit classroom name
            </h3>
            <input
              type="text"
              value={editNameDraft}
              onChange={(e) => setEditNameDraft(e.target.value)}
              className="input-field mt-4 text-sm"
              maxLength={120}
              disabled={editSaving}
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setShowEditClassroom(false)}
                className="btn-secondary px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={submitEditClassroom}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editMessageModalId ? (
        <div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() =>
            !editMessageSaving && setEditMessageModalId(null)
          }
          onKeyDown={(e) =>
            e.key === 'Escape' &&
            !editMessageSaving &&
            setEditMessageModalId(null)
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="chatroom-edit-message-title"
            className="fade-in-up relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="chatroom-edit-message-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Edit message
            </h3>
            <textarea
              value={editMessageDraft}
              onChange={(e) => setEditMessageDraft(e.target.value)}
              rows={5}
              disabled={editMessageSaving}
              className="input-field mt-4 min-h-[8rem] w-full resize-y text-sm"
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={editMessageSaving}
                onClick={() => setEditMessageModalId(null)}
                className="btn-secondary px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  editMessageSaving || !editMessageDraft.trim()
                }
                onClick={submitEditMessageContent}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {editMessageSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLeaveConfirm ? (
        <div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() => !leaveBusy && setShowLeaveConfirm(false)}
        >
          <div
            role="dialog"
            aria-labelledby="chatroom-leave-title"
            className="relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="chatroom-leave-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Leave this classroom?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You will need an invitation link or code to join again. Classroom
              owners cannot leave — archive or delete the classroom instead.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={leaveBusy}
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={leaveBusy}
                onClick={confirmLeaveClassroom}
                className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-rose-700 disabled:opacity-60 dark:bg-rose-700 dark:hover:bg-rose-600"
              >
                {leaveBusy ? 'Leaving…' : 'Leave classroom'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ChatRoom;
