import {
  ArrowDown,
  ChevronRight,
  Flag,
  Forward,
  Link2,
  Loader2,
  Menu,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  Reply,
  Search,
  Send,
  Settings2,
  Smile,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ClassroomHero from '../components/ClassroomHero';
import ClassroomParticipantsDrawer from '../components/ClassroomParticipantsDrawer';
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

function discussionLastSeenStorageKey(chatId) {
  return `discussion:lastSeenTailMessageId:${String(chatId)}`;
}

/** Active @mention fragment ending at caret; aligns with backend parseMentionUserIds token chars. */
function extractMentionAtCaret(text, caret) {
  const before = text.slice(0, caret);
  const match = before.match(/@([a-zA-Z0-9._-]*)$/);
  if (!match) return null;
  return {
    start: caret - match[0].length,
    query: match[1],
    end: caret,
  };
}

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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escaped HTML + limited **bold** + newlines (safe subset). */
function formatChatRichText(text) {
  const esc = escapeHtml(text);
  const bold = esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return bold.replace(/\n/g, '<br />');
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏'];

function discussionMetaFromChat(chat) {
  const md = chat?.metadata;
  const slow = Number(md?.slowModeSeconds);
  return {
    slowModeSeconds:
      Number.isFinite(slow) && slow >= 0 && slow <= 3600 ? slow : 0,
    pinnedMessageIds: Array.isArray(md?.pinnedMessageIds)
      ? md.pinnedMessageIds.map(String)
      : [],
  };
}

function ChatRoom() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [messageSearch, setMessageSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [discussionMeta, setDiscussionMeta] = useState({
    slowModeSeconds: 0,
    pinnedMessageIds: [],
  });
  const [typingHint, setTypingHint] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [showDiscussionSettings, setShowDiscussionSettings] = useState(false);
  const [slowDraft, setSlowDraft] = useState('0');
  const [discussionSaving, setDiscussionSaving] = useState(false);
  const [openReactionPickerMsgId, setOpenReactionPickerMsgId] =
    useState(null);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(null);
  const [mentionPopoverRect, setMentionPopoverRect] = useState(null);

  const socket = useSocket();
  const fileInputRef = useRef(null);
  const composerTextareaRef = useRef(null);
  const messageSearchInputRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const typingPeersRef = useRef(new Map());
  const scrollRef = useRef(null);
  const messagesRef = useRef([]);
  const hasMoreOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const mentionOpenRef = useRef(null);
  const mentionCandidatesRef = useRef([]);

  mentionOpenRef.current = mentionOpen;

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
      setDiscussionMeta(discussionMetaFromChat(chat));
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

  const filteredMessages = useMemo(() => {
    const q = messageSearch.trim().toLowerCase();
    if (q.length < 2) return messages;
    return messages.filter((m) =>
      String(m.content ?? '').toLowerCase().includes(q),
    );
  }, [messages, messageSearch]);

  const pinnedPreview = useMemo(() => {
    const ids = discussionMeta.pinnedMessageIds ?? [];
    return ids
      .map((id) => messages.find((m) => String(m._id ?? m.id) === String(id)))
      .filter(Boolean);
  }, [discussionMeta.pinnedMessageIds, messages]);

  const rosterForMentions = useMemo(() => {
    const map = new Map();
    const add = (u) => {
      if (!u || typeof u !== 'object') return;
      const id = String(u._id ?? u.id ?? '');
      const username =
        typeof u.username === 'string' ? u.username.trim() : '';
      if (!id || username.length < 2) return;
      if (!map.has(id))
        map.set(id, {
          id,
          username,
          label: getMemberName(u),
        });
    };
    for (const m of members) add(m);
    add(creator);
    for (const a of admins ?? []) add(a);
    return [...map.values()].sort((a, b) =>
      a.username.localeCompare(b.username, undefined, {
        sensitivity: 'base',
      }),
    );
  }, [members, creator, admins]);

  const mentionCandidates = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionOpen.query.toLowerCase();
    const filtered = rosterForMentions.filter((r) =>
      r.username.toLowerCase().startsWith(q),
    );
    return filtered.slice(0, 8);
  }, [mentionOpen, rosterForMentions]);

  useEffect(() => {
    mentionCandidatesRef.current = mentionCandidates;
  }, [mentionCandidates]);

  useEffect(() => {
    setMentionOpen((m) => {
      if (!m || mentionCandidates.length === 0) return m;
      const max = mentionCandidates.length - 1;
      if (m.selectedIndex <= max) return m;
      return { ...m, selectedIndex: Math.max(0, max) };
    });
  }, [mentionCandidates]);

  const newDividerBeforeMessageKey = useMemo(() => {
    if (!chatId || filteredMessages.length < 2) return null;
    let tailStored = '';
    try {
      tailStored =
        localStorage.getItem(discussionLastSeenStorageKey(chatId)) || '';
    } catch {
      return null;
    }
    if (!tailStored) return null;
    const idx = filteredMessages.findIndex(
      (m) => String(m._id ?? m.id) === tailStored,
    );
    if (idx < 0) {
      try {
        localStorage.removeItem(discussionLastSeenStorageKey(chatId));
      } catch {
        /* ignore */
      }
      return null;
    }
    if (idx >= filteredMessages.length - 1) return null;
    const next = filteredMessages[idx + 1];
    return String(next._id ?? next.id ?? '');
  }, [chatId, filteredMessages, stickToBottom, messages]);

  useEffect(() => {
    if (!chatId || !stickToBottom || messages.length === 0) return;
    const tail = messages[messages.length - 1];
    const tailId = String(tail._id ?? tail.id ?? '');
    if (!tailId) return;
    try {
      localStorage.setItem(
        discussionLastSeenStorageKey(chatId),
        tailId,
      );
    } catch {
      /* ignore */
    }
  }, [chatId, stickToBottom, messages]);

  useEffect(() => {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw.startsWith('chat-message-')) return undefined;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 48;
    const attempt = () => {
      if (cancelled || attempts >= maxAttempts) return;
      attempts += 1;
      const el = document.getElementById(raw);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      requestAnimationFrame(attempt);
    };
    attempt();
    const t = window.setTimeout(attempt, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [location.hash, filteredMessages.length, messages.length]);

  useEffect(() => {
    const onSlash = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const ae = document.activeElement;
      const tag = ae?.tagName;
      if (
        tag === 'TEXTAREA' ||
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        ae?.isContentEditable
      )
        return;
      e.preventDefault();
      messageSearchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onSlash);
    return () => window.removeEventListener('keydown', onSlash);
  }, []);

  useLayoutEffect(() => {
    if (!mentionOpen || mentionCandidates.length === 0) {
      setMentionPopoverRect(null);
      return;
    }
    const ta = composerTextareaRef.current;
    if (!ta) return;
    const r = ta.getBoundingClientRect();
    setMentionPopoverRect({
      left: Math.min(r.left, window.innerWidth - 280),
      top: r.top,
      width: Math.min(280, window.innerWidth - 24),
    });
  }, [mentionOpen, mentionCandidates.length, draft]);

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

  const scrollToPinnedMessageId = useCallback(
    (msgKey) => {
      const domId = `chat-message-${msgKey}`;
      const el = document.getElementById(domId);
      if (el) {
        navigate(
          {
            pathname: location.pathname,
            search: location.search,
            hash: domId,
          },
          { replace: true },
        );
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      toast.info('Scroll up to load older messages.');
      void loadOlderMessages();
    },
    [loadOlderMessages, location.pathname, location.search, navigate],
  );

  const copyMessageLink = useCallback(
    async (msgKey) => {
      const url = `${window.location.origin}${location.pathname}${location.search || ''}#chat-message-${msgKey}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied.');
      } catch {
        toast.error('Could not copy link.');
      }
      setMenuOpenMessageId(null);
    },
    [location.pathname, location.search],
  );

  const syncComposerMentionFromInput = useCallback((text, caret) => {
    const ext = extractMentionAtCaret(text, caret);
    if (!ext) {
      setMentionOpen(null);
      return;
    }
    setMentionOpen((prev) => {
      const same =
        prev &&
        prev.start === ext.start &&
        prev.query === ext.query &&
        prev.caret === ext.end;
      return {
        start: ext.start,
        query: ext.query,
        caret: ext.end,
        selectedIndex: same ? prev.selectedIndex : 0,
      };
    });
  }, []);

  const applyMentionPick = useCallback((pick) => {
    const ta = composerTextareaRef.current;
    const men = mentionOpenRef.current;
    if (!ta || !men || !pick?.username) return;
    const end = Math.max(men.caret, ta.selectionEnd);
    const before = ta.value.slice(0, men.start);
    const after = ta.value.slice(end);
    const insert = `@${pick.username} `;
    const next = before + insert + after;
    const pos = men.start + insert.length;
    setDraft(next);
    setMentionOpen(null);
    notifyTyping();
    window.requestAnimationFrame(() => {
      const t = composerTextareaRef.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(pos, pos);
    });
  }, []);

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
      return undefined;
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

    const loadMeta = async () => {
      setMembersError('');
      setMetaLoading(true);
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chat?.name ?? 'Course Discussion');
        setMembers(chat?.members ?? []);
        setCreator(chat?.creator ?? null);
        setAdmins(chat?.admins ?? []);
        setInvitationCode(
          typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
        );
        const dm = discussionMetaFromChat(chat);
        setDiscussionMeta(dm);
        setSlowDraft(String(dm.slowModeSeconds));
      } catch (metaError) {
        if (metaError.name !== 'AbortError') {
          setMembersError(metaError.message);
        }
      } finally {
        setMetaLoading(false);
      }
    };

    fetchInitialMessages();
    loadMeta();

    return () => {
      controller.abort();
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return undefined;

    const pollNewMessages = async () => {
      try {
        const list = messagesRef.current;
        const newestId = list[list.length - 1]?._id;
        if (!newestId) {
          const response = await fetch(
            `/api/chats/${chatId}/messages?limit=${MESSAGE_PAGE_LIMIT}`,
            { credentials: 'include' },
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
          { credentials: 'include' },
        );
        const payload = await readJsonOrThrow(
          response,
          'Unable to refresh discussion',
        );
        const incoming = payload?.messages ?? [];
        if (incoming.length === 0) return;
        setMessages((prev) => mergeMessagesById(prev, incoming));
      } catch {
        /* silent poll failure */
      }
    };

    const loadMetaSilent = async () => {
      try {
        const chat = await fetchClassroomMeta(chatId);
        setChatName(chat?.name ?? 'Course Discussion');
        setMembers(chat?.members ?? []);
        setCreator(chat?.creator ?? null);
        setAdmins(chat?.admins ?? []);
        setInvitationCode(
          typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
        );
        setDiscussionMeta(discussionMetaFromChat(chat));
      } catch {
        /* silent */
      }
    };

    const pollMs = socket?.connected ? 42000 : 7500;
    const intervalId = window.setInterval(() => {
      pollNewMessages();
      loadMetaSilent();
    }, pollMs);

    return () => clearInterval(intervalId);
  }, [chatId, socket?.connected]);

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
    const onReaction = (payload) => {
      const raw = payload?.message;
      if (!raw) return;
      setMessages((prev) => mergeMessagesById(prev, [raw]));
    };
    socket.on('message', onMessage);
    socket.on('messageUpdated', onUpdated);
    socket.on('messageReaction', onReaction);
    return () => {
      socket.emit('leaveChat', { chatId });
      socket.off('message', onMessage);
      socket.off('messageUpdated', onUpdated);
      socket.off('messageReaction', onReaction);
    };
  }, [socket, chatId]);

  useEffect(() => {
    if (!socket?.connected || !chatId) return undefined;
    socket.emit('markAsRead', { chatId });
    return undefined;
  }, [socket, socket?.connected, chatId, messages.length]);

  useEffect(() => {
    if (!socket || !chatId) return undefined;
    const onTyping = ({ chatId: cid, user: u }) => {
      if (String(cid) !== String(chatId) || !u?.id) return;
      if (String(u.id) === String(user?._id ?? user?.id)) return;
      typingPeersRef.current.set(String(u.id), u.username || 'Someone');
      const names = [...typingPeersRef.current.values()].slice(0, 3);
      setTypingHint(names.length ? `${names.join(', ')} typing…` : '');
    };
    const onStop = ({ chatId: cid, userId }) => {
      if (String(cid) !== String(chatId)) return;
      typingPeersRef.current.delete(String(userId));
      const names = [...typingPeersRef.current.values()].slice(0, 3);
      setTypingHint(names.length ? `${names.join(', ')} typing…` : '');
    };
    socket.on('typing', onTyping);
    socket.on('stopTyping', onStop);
    return () => {
      socket.off('typing', onTyping);
      socket.off('stopTyping', onStop);
      typingPeersRef.current.clear();
      setTypingHint('');
    };
  }, [socket, chatId, user?._id, user?.id]);

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
    if (!openReactionPickerMsgId) return undefined;
    const onDocDown = (e) => {
      const el = e.target;
      if (
        typeof el?.closest === 'function' &&
        el.closest(
          `[data-reaction-picker-root="${openReactionPickerMsgId}"]`,
        )
      ) {
        return;
      }
      setOpenReactionPickerMsgId(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocDown);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [openReactionPickerMsgId]);

  useEffect(() => {
    if (!composerEmojiOpen) return undefined;
    const onDocDown = (e) => {
      const el = e.target;
      if (
        typeof el?.closest === 'function' &&
        el.closest('[data-composer-emoji-root]')
      ) {
        return;
      }
      setComposerEmojiOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocDown);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [composerEmojiOpen]);

  const syncComposerHeight = useCallback(() => {
    const el = composerTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxPx = 120;
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, []);

  useLayoutEffect(() => {
    syncComposerHeight();
  }, [draft, syncComposerHeight]);

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

  const notifyTyping = () => {
    if (!socket?.connected || !chatId) return;
    socket.emit('typing', { chatId });
    window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => {
      socket.emit('stopTyping', { chatId });
    }, 2200);
  };

  const toggleReactionOnMessage = async (messageId, emoji) => {
    if (!chatId || !messageId) return;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        },
      );
      const data = await readJsonOrThrow(res, 'Could not update reaction');
      if (data?.message) {
        setMessages((prev) => mergeMessagesById(prev, [data.message]));
      }
    } catch (e) {
      toast.error(e?.message || 'Could not react.');
    }
  };

  const reportRemoteMessage = async (msg) => {
    const mid = msg?._id ?? msg?.id;
    if (!chatId || !mid) return;
    setMenuOpenMessageId(null);
    if (!window.confirm('Report this message to moderators?')) return;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(mid)}/report`,
        { method: 'POST', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Could not submit report');
      toast.success('Thanks — moderators can review reports.');
    } catch (e) {
      toast.error(e?.message || 'Could not report.');
    }
  };

  const togglePinMessage = async (msg) => {
    const mid = String(msg?._id ?? msg?.id ?? '');
    if (!chatId || !mid || !viewerCanManageClassroom) return;
    setMenuOpenMessageId(null);
    const cur = [...(discussionMeta.pinnedMessageIds ?? [])];
    const next = cur.includes(mid)
      ? cur.filter((x) => x !== mid)
      : [...cur, mid].slice(-12);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedMessageIds: next }),
      });
      await readJsonOrThrow(res, 'Could not update pins');
      setDiscussionMeta((prev) => ({ ...prev, pinnedMessageIds: next }));
      toast.success(cur.includes(mid) ? 'Unpinned.' : 'Pinned for everyone.');
    } catch (e) {
      toast.error(e?.message || 'Could not pin.');
    }
  };

  const forwardMessageIntoComposer = (msg) => {
    setMenuOpenMessageId(null);
    const name = getMemberName(msg?.sender);
    const body = String(msg?.content ?? '').slice(0, 600);
    const line = `---------- Forwarded from ${name} ----------\n${body}`;
    setDraft((d) => (d.trim() ? `${d.trim()}\n\n${line}` : line));
    toast.info('Forwarded text added to your composer.');
  };

  const submitDiscussionSettings = async () => {
    if (!chatId || !viewerCanManageClassroom) return;
    const n = Number.parseInt(String(slowDraft), 10);
    const sec = Number.isFinite(n) ? Math.min(3600, Math.max(0, n)) : 0;
    setDiscussionSaving(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slowModeSeconds: sec }),
      });
      await readJsonOrThrow(res, 'Could not save settings');
      setDiscussionMeta((prev) => ({ ...prev, slowModeSeconds: sec }));
      setSlowDraft(String(sec));
      setShowDiscussionSettings(false);
      toast.success('Discussion settings saved.');
    } catch (e) {
      toast.error(e?.message || 'Could not save.');
    } finally {
      setDiscussionSaving(false);
    }
  };

  const handleAttachmentSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !chatId) return;
    setAttachBusy(true);
    setStickToBottom(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/messages/upload`,
        { method: 'POST', credentials: 'include', body: fd },
      );
      const uploaded = await readJsonOrThrow(up, 'Upload failed');
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: file.name || 'Attachment',
          messageType: uploaded.messageType ?? 'file',
          fileUrl: uploaded.fileUrl,
          replyTo: replyingTo?._id ?? replyingTo?.id,
        }),
      });
      const payload = await readJsonOrThrow(response, 'Unable to send file');
      const created = payload?.message ?? payload;
      if (created) {
        setMessages((prev) => mergeMessagesById(prev, [created]));
      }
      setReplyingTo(null);
      requestAnimationFrame(() => scrollToBottom('smooth'));
      toast.success('Attachment sent.');
    } catch (e) {
      toast.error(e?.message || 'Could not attach file.');
    } finally {
      setAttachBusy(false);
    }
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
        body: JSON.stringify({
          content: trimmed,
          messageType: 'text',
          replyTo: replyingTo?._id ?? replyingTo?.id,
        }),
      });
      const payload = await readJsonOrThrow(response, 'Unable to send message');
      const created = payload?.message ?? payload;
      if (created) {
        setMessages((prev) => mergeMessagesById(prev, [created]));
      }
      setDraft('');
      setReplyingTo(null);
      if (socket?.connected && chatId) {
        socket.emit('stopTyping', { chatId });
      }
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

  const insertEmojiInDraft = useCallback((emoji) => {
    const ta = composerTextareaRef.current;
    const value = ta?.value ?? draft;
    const start = ta != null ? ta.selectionStart : value.length;
    const end = ta != null ? ta.selectionEnd : value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    setDraft(next);
    setComposerEmojiOpen(false);
    setMentionOpen(null);
    notifyTyping();
    window.requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      const pos = start + [...emoji].length;
      ta.setSelectionRange(pos, pos);
    });
  }, [draft]);

  const handleComposerKeyDown = (e) => {
    const men = mentionOpenRef.current;
    const cands = mentionCandidatesRef.current;
    if (men && cands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const len = mentionCandidatesRef.current.length;
        setMentionOpen((m) =>
          m
            ? {
                ...m,
                selectedIndex: Math.min(
                  m.selectedIndex + 1,
                  Math.max(0, len - 1),
                ),
              }
            : m,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionOpen((m) =>
          m
            ? { ...m, selectedIndex: Math.max(m.selectedIndex - 1, 0) }
            : m,
        );
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const pick = cands[men.selectedIndex];
        if (pick) applyMentionPick(pick);
        return;
      }
    }
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
      {socket?.connected ? 'Socket live' : 'Polling fallback'}
    </span>
  );

  const headerActions = (
    <Link
      to="/classroom"
      className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide"
    >
      All classrooms
    </Link>
  );

  const tabsTrailingParticipants = (
    <button
      type="button"
      onClick={() => setShowMembersDrawer(true)}
      className="inline-flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/95 bg-white text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-cyan-400 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-white hover:text-cyan-900 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/[0.06] dark:hover:border-cyan-500/70 dark:hover:from-slate-800 dark:hover:to-cyan-950/40 dark:hover:text-cyan-50"
      aria-label="Participants & classroom actions"
      title="Participants"
    >
      <Menu className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
    </button>
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

          <ClassroomTabs trailing={tabsTrailingParticipants} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[min(100%,14rem)] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                ref={messageSearchInputRef}
                type="search"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Filter loaded messages… (/ to focus)"
                className="input-field w-full py-2 pl-9 text-sm"
              />
            </div>
            {viewerCanManageClassroom ? (
              <button
                type="button"
                onClick={() => {
                  setSlowDraft(String(discussionMeta.slowModeSeconds ?? 0));
                  setShowDiscussionSettings(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <Settings2 className="h-4 w-4" aria-hidden />
                Discussion
              </button>
            ) : null}
          </div>
          {typingHint ? (
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {typingHint}
            </p>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentSelected}
          />

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
                      Socket sync when online; polling stays active as a fallback.
                      Use @username to notify classmates when they are mentioned.
                    </p>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No messages match your filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMessageSearch('')}
                      className="mt-3 text-xs font-bold uppercase tracking-wide text-cyan-700 underline dark:text-cyan-400"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 pb-2">
                    {pinnedPreview.length > 0 ? (
                      <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/35">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                          <Pin className="h-3 w-3" aria-hidden />
                          Pinned
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {pinnedPreview.map((pm) => {
                            const pk = String(pm._id ?? pm.id);
                            return (
                              <li key={pk}>
                                <button
                                  type="button"
                                  className="w-full truncate rounded-lg px-1 py-0.5 text-left text-[12px] text-slate-700 underline-offset-2 transition hover:bg-amber-100/80 hover:underline dark:text-slate-300 dark:hover:bg-amber-950/50"
                                  onClick={() => scrollToPinnedMessageId(pk)}
                                >
                                  {String(pm.content ?? '').slice(0, 140)}
                                  {(pm.content ?? '').length > 140 ? '…' : ''}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {loadingOlder ? (
                      <div className="flex justify-center py-2" aria-live="polite">
                        <Loader2
                          className="h-5 w-5 animate-spin text-cyan-600 dark:text-cyan-400"
                          aria-hidden
                        />
                      </div>
                    ) : null}
                    {filteredMessages.flatMap((message, index) => {
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
                      const showActionsMenu = !isDeleted;
                      const deleteBusy = deleteMessageBusyId === msgKey;

                      const replyRef = message?.replyTo;
                      const replySnippet =
                        replyRef && typeof replyRef === 'object'
                          ? {
                              name: getMemberName(replyRef.sender),
                              text: replyRef.deletedAt
                                ? 'Removed'
                                : String(replyRef.content ?? '').slice(0, 160),
                            }
                          : null;

                      const reactionBuckets = {};
                      for (const r of message.reactions ?? []) {
                        const em = r.emoji;
                        if (!em) continue;
                        if (!reactionBuckets[em])
                          reactionBuckets[em] = { count: 0, self: false };
                        reactionBuckets[em].count += 1;
                        const uid = String(r.user?._id ?? r.user ?? '');
                        if (uid && uid === String(user?._id ?? user?.id)) {
                          reactionBuckets[em].self = true;
                        }
                      }

                      const isPinned = (
                        discussionMeta.pinnedMessageIds ?? []
                      ).includes(msgKey);

                      const bubbleInner = (
                        <>
                          {replySnippet ? (
                            <div className="mb-2 border-l-2 border-cyan-500/50 pl-2 text-[11px] leading-snug text-[var(--classroom-bubble-meta)]">
                              <span className="font-semibold">
                                ↩ {replySnippet.name}
                              </span>
                              <span className="block truncate opacity-90">
                                {replySnippet.text}
                              </span>
                            </div>
                          ) : null}
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
                          ) : message?.messageType === 'image' &&
                            message?.fileUrl ? (
                            <a
                              href={message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block"
                            >
                              <img
                                src={message.fileUrl}
                                alt=""
                                className="max-h-52 max-w-full rounded-lg object-contain"
                              />
                            </a>
                          ) : message?.messageType === 'file' &&
                            message?.fileUrl ? (
                            <a
                              href={message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex text-[13px] font-semibold text-cyan-700 underline dark:text-cyan-400"
                            >
                              Download attachment
                            </a>
                          ) : (
                            <div
                              className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--classroom-bubble-text)]"
                              dangerouslySetInnerHTML={{
                                __html: formatChatRichText(
                                  message?.content ?? '',
                                ),
                              }}
                            />
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

                      const bubbleRow = (
                        <div
                          key={msgKey}
                          id={`chat-message-${msgKey}`}
                          className={`scroll-mt-24 flex items-end gap-2 ${
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
                                    setOpenReactionPickerMsgId(null);
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
                                    className="absolute right-0 mt-0.5 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900"
                                    onMouseDown={(e) =>
                                      e.stopPropagation()
                                    }
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                      onClick={() => {
                                        setMenuOpenMessageId(null);
                                        setReplyingTo(message);
                                      }}
                                    >
                                      <Reply
                                        className="h-4 w-4 shrink-0 opacity-70"
                                        aria-hidden
                                      />
                                      Reply
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                      onClick={() =>
                                        forwardMessageIntoComposer(message)
                                      }
                                    >
                                      <Forward
                                        className="h-4 w-4 shrink-0 opacity-70"
                                        aria-hidden
                                      />
                                      Forward
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                      onClick={() => copyMessageLink(msgKey)}
                                    >
                                      <Link2
                                        className="h-4 w-4 shrink-0 opacity-70"
                                        aria-hidden
                                      />
                                      Copy message link
                                    </button>
                                    {viewerCanManageClassroom ? (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                        onClick={() =>
                                          togglePinMessage(message)
                                        }
                                      >
                                        <Pin
                                          className="h-4 w-4 shrink-0 opacity-70"
                                          aria-hidden
                                        />
                                        {isPinned ? 'Unpin' : 'Pin'}
                                      </button>
                                    ) : null}
                                    {!isSelf ? (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                                        onClick={() =>
                                          reportRemoteMessage(message)
                                        }
                                      >
                                        <Flag
                                          className="h-4 w-4 shrink-0 opacity-70"
                                          aria-hidden
                                        />
                                        Report
                                      </button>
                                    ) : null}
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
                            {!isDeleted ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1 pl-0.5">
                                {Object.entries(reactionBuckets).map(
                                  ([emoji, info]) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      title="Toggle reaction"
                                      onClick={() =>
                                        toggleReactionOnMessage(msgKey, emoji)
                                      }
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:border-cyan-400 ${
                                        info.self
                                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100'
                                          : 'border-slate-200/90 bg-white/80 dark:border-slate-600 dark:bg-slate-900/80'
                                      }`}
                                    >
                                      {emoji}{' '}
                                      <span className="opacity-80">
                                        {info.count}
                                      </span>
                                    </button>
                                  ),
                                )}
                                <div
                                  className={`group relative inline-flex pb-1 ${
                                    isSelf ? 'ml-auto' : ''
                                  }`}
                                  data-reaction-picker-root={msgKey}
                                >
                                  <button
                                    type="button"
                                    aria-label="Add reaction"
                                    aria-haspopup="menu"
                                    aria-expanded={
                                      openReactionPickerMsgId === msgKey
                                    }
                                    title="Add reaction"
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--classroom-bubble-meta)] outline-none transition hover:bg-slate-900/10 focus-visible:ring-2 focus-visible:ring-cyan-500/60 dark:hover:bg-white/10"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuOpenMessageId(null);
                                      setOpenReactionPickerMsgId((id) =>
                                        id === msgKey ? null : msgKey,
                                      );
                                    }}
                                  >
                                    <Smile
                                      className="h-4 w-4"
                                      aria-hidden
                                      strokeWidth={2}
                                    />
                                  </button>
                                  <div
                                    role="menu"
                                    aria-label="Quick reactions"
                                    className={`absolute bottom-full z-20 mb-1 flex items-center gap-0.5 rounded-full border border-slate-200/95 bg-white px-2 py-1 shadow-lg ring-1 ring-slate-900/[0.06] transition duration-150 ease-out dark:border-slate-600 dark:bg-slate-900 dark:ring-white/[0.06] ${
                                      isSelf ? 'right-0' : 'left-0'
                                    } ${
                                      openReactionPickerMsgId === msgKey
                                        ? 'pointer-events-auto visible scale-100 opacity-100'
                                        : 'pointer-events-none invisible scale-95 opacity-0 group-hover:pointer-events-auto group-hover:visible group-hover:scale-100 group-hover:opacity-100'
                                    }`}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {QUICK_REACTIONS.map((em) => (
                                      <button
                                        key={em}
                                        type="button"
                                        role="menuitem"
                                        className="rounded-full px-1.5 py-1 text-[15px] transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={() => {
                                          toggleReactionOnMessage(msgKey, em);
                                          setOpenReactionPickerMsgId(null);
                                        }}
                                      >
                                        {em}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}
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

                      if (newDividerBeforeMessageKey === msgKey) {
                        return [
                          <div
                            key={`discussion-new-${msgKey}`}
                            role="separator"
                            aria-label="New messages since last visit"
                            className="flex items-center gap-3 py-1"
                          >
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              New messages
                            </span>
                            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
                          </div>,
                          bubbleRow,
                        ];
                      }
                      return bubbleRow;
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

              <form onSubmit={handleSend} className="mt-4">
                <label htmlFor="classroom-chat-input" className="sr-only">
                  Message
                </label>
                {replyingTo ? (
                  <div className="mb-2 flex items-start justify-between gap-2 rounded-xl bg-slate-100/90 px-3 py-2 text-xs dark:bg-slate-800/90">
                    <div className="min-w-0">
                      <span className="font-bold text-cyan-800 dark:text-cyan-200">
                        Replying to {getMemberName(replyingTo.sender)}
                      </span>
                      <p className="truncate text-slate-600 dark:text-slate-400">
                        {String(replyingTo.content ?? '').slice(0, 120)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                <div className="relative">
                  {mentionOpen &&
                  mentionCandidates.length > 0 &&
                  mentionPopoverRect ? (
                    <ul
                      role="listbox"
                      aria-label="Mention a classmate"
                      aria-activedescendant={
                        mentionCandidates[mentionOpen.selectedIndex]
                          ? `mention-opt-${mentionCandidates[mentionOpen.selectedIndex].id}`
                          : undefined
                      }
                      className="fixed z-[140] max-h-52 overflow-y-auto rounded-xl border border-slate-200/95 bg-white py-1 shadow-xl ring-1 ring-slate-900/[0.08] dark:border-slate-600 dark:bg-slate-900 dark:ring-white/[0.08]"
                      style={{
                        left: mentionPopoverRect.left,
                        width: mentionPopoverRect.width,
                        top: mentionPopoverRect.top - 8,
                        transform: 'translateY(-100%)',
                      }}
                    >
                      {mentionCandidates.map((c, i) => (
                        <li key={c.id} role="presentation">
                          <button
                            id={`mention-opt-${c.id}`}
                            type="button"
                            role="option"
                            aria-selected={i === mentionOpen.selectedIndex}
                            className={`flex w-full flex-col gap-0 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              i === mentionOpen.selectedIndex
                                ? 'bg-slate-100 dark:bg-slate-800'
                                : ''
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() =>
                              setMentionOpen((m) =>
                                m ? { ...m, selectedIndex: i } : m,
                              )
                            }
                            onClick={() => applyMentionPick(c)}
                          >
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              @{c.username}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {c.label}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex min-h-[52px] items-end gap-1 rounded-full border border-slate-200/90 bg-white px-2 py-1.5 shadow-md shadow-slate-900/[0.07] ring-1 ring-slate-900/[0.03] transition focus-within:border-cyan-400/70 focus-within:shadow-lg focus-within:shadow-cyan-500/10 focus-within:ring-2 focus-within:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-900 dark:shadow-lg dark:shadow-black/25 dark:ring-white/[0.06] dark:focus-within:border-cyan-600/55 dark:focus-within:ring-cyan-400/25">
                  <button
                    type="button"
                    disabled={attachBusy || sending}
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 outline-none transition hover:bg-slate-100 hover:text-cyan-800 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-cyan-200"
                    aria-label="Attach file"
                    title="Attach file"
                  >
                    {attachBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <Paperclip className="h-5 w-5" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                  <textarea
                    ref={composerTextareaRef}
                    id="classroom-chat-input"
                    value={draft}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft(v);
                      notifyTyping();
                      syncComposerMentionFromInput(
                        v,
                        e.target.selectionStart ?? v.length,
                      );
                    }}
                    onSelect={(e) =>
                      syncComposerMentionFromInput(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length,
                      )
                    }
                    onClick={(e) =>
                      syncComposerMentionFromInput(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length,
                      )
                    }
                    onKeyUp={(e) =>
                      syncComposerMentionFromInput(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length,
                      )
                    }
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Message"
                    rows={1}
                    disabled={sending}
                    className="min-h-[44px] max-h-[120px] flex-1 resize-none bg-transparent py-2.5 text-sm leading-snug text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <div
                    className="group relative mb-0.5 inline-flex shrink-0 pb-1"
                    data-composer-emoji-root
                  >
                    <button
                      type="button"
                      disabled={sending}
                      aria-label="Insert emoji"
                      aria-expanded={composerEmojiOpen}
                      aria-haspopup="true"
                      title="Emoji"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 outline-none transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        setComposerEmojiOpen((open) => !open)
                      }
                    >
                      <Smile
                        className="h-[22px] w-[22px]"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </button>
                    <div
                      role="group"
                      aria-label="Quick emoji"
                      className={`absolute bottom-[calc(100%+6px)] right-0 z-30 flex items-center gap-0.5 rounded-full border border-slate-200/95 bg-white px-2 py-1 shadow-lg ring-1 ring-slate-900/[0.06] transition duration-150 ease-out dark:border-slate-600 dark:bg-slate-900 dark:ring-white/[0.06] ${
                        composerEmojiOpen
                          ? 'pointer-events-auto visible scale-100 opacity-100'
                          : 'pointer-events-none invisible scale-95 opacity-0 group-hover:pointer-events-auto group-hover:visible group-hover:scale-100 group-hover:opacity-100'
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {QUICK_REACTIONS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          className="rounded-full px-1.5 py-1 text-[15px] transition hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => insertEmojiInDraft(em)}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md shadow-cyan-600/25 outline-none ring-2 ring-white/20 transition hover:from-cyan-400 hover:to-cyan-600 hover:shadow-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none dark:ring-white/10"
                    aria-label={sending ? 'Sending…' : 'Send message'}
                    title={sending ? 'Sending…' : 'Send message'}
                  >
                    {sending ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-5 w-5 translate-x-px" strokeWidth={2.25} aria-hidden />
                    )}
                  </button>
                </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {discussionMeta.slowModeSeconds > 0 ? (
                    <span className="mr-2 inline-flex items-center rounded-md bg-amber-500/12 px-1.5 py-px font-semibold text-amber-800 dark:text-amber-200">
                      Slow {discussionMeta.slowModeSeconds}s
                    </span>
                  ) : null}
                  {draft.trim().length > 0
                    ? `${draft.trim().length} character${draft.trim().length === 1 ? '' : 's'} · `
                    : null}
                  Be respectful and on-topic.
                </p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <strong className="font-semibold text-slate-500 dark:text-slate-400">
                    **
                  </strong>
                  bold
                  <strong className="font-semibold text-slate-500 dark:text-slate-400">
                    **
                  </strong>
                  , @username mentions, Enter to send, Shift+Enter newline.
                </p>
              </form>
              {sendError && (
                <p className="mt-2 text-sm font-medium text-rose-600">{sendError}</p>
              )}
          </div>
        </div>
      </div>

      <ClassroomParticipantsDrawer
        open={showMembersDrawer}
        onClose={() => setShowMembersDrawer(false)}
        chatId={chatId}
        chatName={chatName}
        members={members}
        creator={creator}
        admins={admins}
        membersError={membersError}
        invitationCode={invitationCode}
        user={user}
        viewerCanManageRoster={viewerIsCreator}
        viewerCanManageClassroom={viewerCanManageClassroom}
        viewerIsClassroomCreator={viewerIsCreator}
        onOpenEditClassroom={() => setShowEditClassroom(true)}
        onRequestLeave={() => setShowLeaveConfirm(true)}
        leaveBusy={leaveBusy}
        onRefreshMeta={refreshChatMetaAfterMutation}
      />

      {showDiscussionSettings ? (
        <div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() =>
            !discussionSaving && setShowDiscussionSettings(false)
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discussion-settings-title"
            className="fade-in-up relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="discussion-settings-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Discussion pace
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Minimum seconds between messages from the same person in this
              classroom (0 disables slow mode). Helps reduce spam during live
              sessions.
            </p>
            <label htmlFor="slow-mode-input" className="sr-only">
              Slow mode seconds
            </label>
            <input
              id="slow-mode-input"
              type="number"
              min={0}
              max={3600}
              value={slowDraft}
              onChange={(e) => setSlowDraft(e.target.value)}
              disabled={discussionSaving}
              className="input-field mt-4 text-sm"
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={discussionSaving}
                onClick={() => setShowDiscussionSettings(false)}
                className="btn-secondary px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={discussionSaving}
                onClick={submitDiscussionSettings}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {discussionSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
