import {
  ArrowDown,
  BookOpen,
  ChevronDown,
  Cloud,
  Copy,
  Image,
  Menu,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  SquarePen,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { readJsonOrThrow } from '../utils/http';

const GEMINI_TXT_ATTACH_MAX = 12000;
/** Distance from scroll bottom below which we keep "follow stream" on for Gemini. */
const GEMINI_SCROLL_STICK_THRESHOLD_PX = 96;

/** Accent rings for Study Buddy quick-start tiles (cycles by index). */
const STUDY_QUICK_PILL_ACCENTS = [
  'border-amber-400/55 bg-amber-500/[0.07] text-slate-800 shadow-[0_0_20px_-10px_rgba(245,158,11,0.4)] hover:bg-amber-500/[0.14] dark:border-amber-400/45 dark:bg-amber-950/45 dark:text-amber-50 dark:shadow-[0_0_28px_-12px_rgba(251,191,36,0.22)] dark:hover:bg-amber-900/40',
  'border-cyan-400/50 bg-cyan-500/[0.07] text-slate-800 shadow-[0_0_20px_-10px_rgba(34,211,238,0.35)] hover:bg-cyan-500/[0.14] dark:border-cyan-400/40 dark:bg-cyan-950/45 dark:text-cyan-50 dark:shadow-[0_0_28px_-12px_rgba(34,211,238,0.2)] dark:hover:bg-cyan-900/35',
  'border-violet-400/50 bg-violet-500/[0.07] text-slate-800 shadow-[0_0_20px_-10px_rgba(167,139,250,0.35)] hover:bg-violet-500/[0.14] dark:border-violet-400/40 dark:bg-violet-950/45 dark:text-violet-50 dark:shadow-[0_0_28px_-12px_rgba(167,139,250,0.2)] dark:hover:bg-violet-900/35',
  'border-emerald-400/50 bg-emerald-500/[0.07] text-slate-800 shadow-[0_0_20px_-10px_rgba(52,211,153,0.35)] hover:bg-emerald-500/[0.14] dark:border-emerald-400/45 dark:bg-emerald-950/45 dark:text-emerald-50 dark:shadow-[0_0_28px_-12px_rgba(52,211,153,0.2)] dark:hover:bg-emerald-900/35',
];

function useIsMinWidth(px) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(min-width:${px}px)`).matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${px}px)`);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [px]);
  return matches;
}

const BASE_WELCOME =
  "Hi! I'm Liqu AI, powered by Google Gemini. I can help you study, explain concepts, answer questions, or discuss topics from your coursework. How can I help you today?";

function makeWelcome(bookTitle, contextBlurb = '') {
  let content = bookTitle
    ? `${BASE_WELCOME}\n\nYou're working with: **${bookTitle}** — ask about this book, your notes, or anything else.`
    : BASE_WELCOME;
  if (contextBlurb?.trim()) {
    content = `${content}\n\n${contextBlurb.trim()}`;
  }
  return { id: 'welcome', role: 'assistant', content };
}

function formatSessionUpdatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Gemini chat with sessions, socket streaming, and REST fallback — for Study buddy.
 * When `bookId` changes, the panel clears the active session and `session` URL param.
 * `bookTitle` tunes the welcome message. `contextBlurb` adds extra context (e.g. classroom material) below that line.
 * `starterPrompts` + optional `onQuickPrompt`: quick prompts below the welcome bubble (prefill elsewhere). Study Buddy omits `onQuickPrompt`; starters submit the message inline.
 * @param {'default' | 'gemini'} [variant] — `gemini` is a Gemini-style layout (light-first with `dark:` parity); default keeps card styling.
 * @param {null|'studyBuddy'} [workspacePresentation] — Study Buddy: Copilot-like greeting, pills, hero prompts + optional inline sidebar.
 * @param {'overlay'|'inline'|'rail'} [sessionSidebarMode] — `rail`: desktop floating menu opens a translucent slide-over history on the chat area; `inline`: wide list beside chat.
 */
function LiquAiChatPanel({
  className = '',
  variant = 'default',
  bookTitle = '',
  /** Extra markdown/plain context appended to the welcome bubble (class materials, pasted assignment text, etc.). */
  contextBlurb = '',
  /** When set (e.g. Study buddy), server augments Liqu AI with RAG from this book if indexed. */
  bookId = '',
  starterPrompts,
  onQuickPrompt,
  showQuickPromptsEmptyState = true,
  workspacePresentation = null,
  sessionSidebarMode = 'overlay',
  /** When true with study workspace, tightens toolbars (e.g. reader focus mode). */
  denseStudyChrome = false,
}) {
  const isGemini = variant === 'gemini';
  const isStudyWorkspace =
    workspacePresentation === 'studyBuddy' && variant === 'gemini';
  const studyDense = Boolean(denseStudyChrome) && isStudyWorkspace;
  const isLgUp = useIsMinWidth(1024);
  const useInlineSidebar =
    sessionSidebarMode === 'inline' && isGemini && isLgUp;
  const useRailSidebar = sessionSidebarMode === 'rail' && isGemini && isLgUp;
  /** Study + rail: on small screens use header menu + slide-over only (no persistent rail strip). */
  const useStudyMobileHistory =
    sessionSidebarMode === 'rail' && isGemini && isStudyWorkspace && !isLgUp;

  const { user } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get('session');
  const name = user?.displayName ?? user?.username ?? 'Student';

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([makeWelcome(bookTitle, contextBlurb)]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  /** When true during Gemini streaming, new chunks scroll the pane to bottom. */
  const [followStream, setFollowStream] = useState(true);
  const messagesScrollRef = useRef(null);
  const inputRef = useRef(null);
  const prevBookIdRef = useRef(bookId);

  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef('');
  const [ragStatus, setRagStatus] = useState(null);
  const [ragPoll, setRagPoll] = useState(false);
  const [ragError, setRagError] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachmentChipNames, setAttachmentChipNames] = useState([]);
  const attachMenuContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const toggleRailSidebar = useCallback((event) => {
    event?.stopPropagation?.();
    setSidebarOpen((open) => !open);
  }, []);

  const scrollGeminiMessagesToBottom = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const jumpGeminiChatToLatest = useCallback(() => {
    setFollowStream(true);
    window.requestAnimationFrame(() => scrollGeminiMessagesToBottom());
  }, [scrollGeminiMessagesToBottom]);

  const handleGeminiMessagesScroll = useCallback(() => {
    if (!isGemini) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    const gap =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    if (gap <= GEMINI_SCROLL_STICK_THRESHOLD_PX) {
      setFollowStream(true);
    } else if (loading && streamingRef.current?.length > 0) {
      setFollowStream(false);
    }
  }, [isGemini, loading]);

  const replaceSessionInUrl = useCallback(
    (sessionId) => {
      if (!sessionId) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('session', String(sessionId));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs when draft changes
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = isGemini ? 34 : 72;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), isGemini ? 140 : 200)}px`;
  }, [draft, isGemini]);

  useEffect(() => {
    if (!attachMenuOpen || !isGemini) return;
    function handleMouseDown(e) {
      const el = attachMenuContainerRef.current;
      if (el && !el.contains(e.target)) setAttachMenuOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [attachMenuOpen, isGemini]);

  const handleGeminiFiles = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      setAttachMenuOpen(false);
      if (!files.length) return;
      const names = [];
      for (const file of files) {
        names.push(file.name);
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.txt')) {
          try {
            const text = await file.text();
            const capped =
              text.length > GEMINI_TXT_ATTACH_MAX
                ? text.slice(0, GEMINI_TXT_ATTACH_MAX)
                : text;
            if (text.length > GEMINI_TXT_ATTACH_MAX) {
              toast.info(
                `“${file.name}” was truncated (${GEMINI_TXT_ATTACH_MAX.toLocaleString()} character limit).`,
              );
            }
            setDraft((d) => {
              const prefix = d.trim() ? `${d.trim()}\n\n` : '';
              return `${prefix}[Attached: ${file.name}]\n${capped}`;
            });
          } catch {
            toast.error(`Could not read “${file.name}”.`);
          }
        } else {
          toast.info(
            `Liqu AI only receives text today. Add PDFs and other books via your library, or paste a summary of “${file.name}”.`,
          );
        }
      }
      setAttachmentChipNames((prev) =>
        [...new Set([...prev, ...names])].slice(-8),
      );
    },
    [],
  );

  useEffect(() => {
    if (prevBookIdRef.current === bookId) return;
    prevBookIdRef.current = bookId;
    setActiveSessionId(null);
    setMessages([makeWelcome(bookTitle, contextBlurb)]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('session');
        return next;
      },
      { replace: true },
    );
  }, [bookId, bookTitle, contextBlurb, setSearchParams]);

  useEffect(() => {
    setMessages((prev) => {
      if (activeSessionId) return prev;
      if (prev.length === 1 && prev[0]?.id === 'welcome') {
        return [makeWelcome(bookTitle, contextBlurb)];
      }
      return prev;
    });
  }, [bookTitle, contextBlurb, activeSessionId]);

  const loadSession = useCallback(
    async (sessionId, options = {}) => {
      const { closeSidebar = true, signal } = options;
      try {
        const res = await fetch(`/api/ai/sessions/${sessionId}`, {
          credentials: 'include',
          signal,
        });
        const data = await readJsonOrThrow(res, 'Failed to load session');
        if (signal?.aborted) return;
        setActiveSessionId(data._id);
        const msgs = data.messages.map((m, i) => ({
          id: `${data._id}-${i}`,
          role: m.role,
          content: m.content,
        }));
        setMessages(msgs.length ? msgs : [makeWelcome(bookTitle, contextBlurb)]);
        if (variant === 'gemini') setFollowStream(true);
        replaceSessionInUrl(String(data._id));
      } catch (err) {
        if (signal?.aborted || err?.name === 'AbortError') return;
        toast.error(err.message);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('session');
            return next;
          },
          { replace: true },
        );
      }
      if (closeSidebar && !signal?.aborted) setSidebarOpen(false);
    },
    [bookTitle, contextBlurb, replaceSessionInUrl, setSearchParams, variant],
  );

  useEffect(() => {
    if (!sessionParam || sessionParam === String(activeSessionId ?? '')) return;
    const ac = new AbortController();
    loadSession(sessionParam, { closeSidebar: false, signal: ac.signal });
    return () => ac.abort();
  }, [sessionParam, activeSessionId, loadSession]);

  const fetchRagStatus = useCallback(async () => {
    if (!bookId) return null;
    const res = await fetch(
      `/api/books/${encodeURIComponent(bookId)}/rag/status`,
      { credentials: 'include' },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Could not load index status');
    }
    return data;
  }, [bookId]);

  useEffect(() => {
    if (!bookId) {
      setRagStatus(null);
      setRagError('');
      setRagPoll(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRagStatus();
        if (!cancelled && data) {
          setRagStatus(data);
          setRagError('');
          if (data.ragIndexStatus === 'indexing') {
            setRagPoll(true);
          }
        }
      } catch (e) {
        if (!cancelled)
          setRagError(e?.message || 'Could not load index status');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, fetchRagStatus]);

  useEffect(() => {
    if (!bookId || !ragPoll) return;
    const tick = async () => {
      try {
        const data = await fetchRagStatus();
        if (data) {
          setRagStatus(data);
          if (data.ragIndexStatus !== 'indexing') {
            setRagPoll(false);
            if (data.ragIndexStatus === 'ready') {
              toast.success(
                `Book ready — ${data.chunkCount} passages for AI context`,
              );
            }
            if (data.ragIndexStatus === 'failed' && data.ragIndexError) {
              toast.error(data.ragIndexError);
            }
          }
        }
      } catch {
        /* keep polling */
      }
    };
    const id = setInterval(tick, 900);
    tick();
    return () => clearInterval(id);
  }, [bookId, ragPoll, fetchRagStatus]);

  async function indexBookForRag() {
    if (!bookId) return;
    setRagError('');
    try {
      const res = await fetch(
        `/api/books/${encodeURIComponent(bookId)}/rag/index`,
        { method: 'POST', credentials: 'include' },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setRagStatus((prev) => ({
          ...prev,
          title: data.title || prev?.title,
          ragIndexStatus: 'indexing',
          ragIndexPhase: data.ragIndexPhase,
          ragIndexTotalChunks: data.ragIndexTotalChunks ?? 0,
          ragIndexDoneChunks: data.ragIndexDoneChunks ?? 0,
          ragIndexProgressPercent: data.ragIndexProgressPercent ?? 0,
        }));
        setRagPoll(true);
        toast.info('Already indexing this book — showing progress');
        return;
      }
      if (!res.ok) {
        throw new Error(data.message || 'Index failed');
      }
      if (res.status === 202 && data.started) {
        setRagStatus((prev) => ({
          ...prev,
          ragIndexStatus: 'indexing',
          ragIndexPhase: 'downloading',
          ragIndexTotalChunks: 0,
          ragIndexDoneChunks: 0,
          ragIndexProgressPercent: 0,
        }));
        setRagPoll(true);
        toast.info('Indexing started — you can keep using the app');
      }
    } catch (e) {
      setRagError(e?.message || 'Index failed');
      toast.error(e?.message || 'Index failed');
    }
  }

  const ragIsIndexing = ragStatus?.ragIndexStatus === 'indexing';
  const phaseLabel = (() => {
    const p = ragStatus?.ragIndexPhase || '';
    if (p === 'downloading') return 'Downloading file…';
    if (p === 'extracting') return 'Extracting text from the document…';
    if (p === 'chunking') return 'Splitting into passages for search…';
    if (p === 'embedding') {
      const t = Number(ragStatus.ragIndexTotalChunks) || 0;
      const d = Number(ragStatus.ragIndexDoneChunks) || 0;
      if (t > 0) return `Embedding passages (${d} / ${t})…`;
      return 'Embedding passages…';
    }
    if (ragIsIndexing) return 'Working…';
    return '';
  })();
  const embTotal = Number(ragStatus?.ragIndexTotalChunks) || 0;
  const embDone = Number(ragStatus?.ragIndexDoneChunks) || 0;
  const serverPct = Number(ragStatus?.ragIndexProgressPercent);
  const ragIndexOverallPct = Number.isFinite(serverPct)
    ? Math.min(100, Math.max(0, serverPct))
    : embTotal > 0
      ? Math.min(100, Math.round((embDone / embTotal) * 100))
      : 0;
  const indexStepLabel = (() => {
    const p = ragStatus?.ragIndexPhase || '';
    if (p === 'downloading') return 'Step 1/4';
    if (p === 'extracting') return 'Step 2/4';
    if (p === 'chunking') return 'Step 3/4';
    if (p === 'embedding') return 'Step 4/4';
    return '';
  })();

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (prefill) {
      setDraft(prefill);
      inputRef.current?.focus();
    }
  }, [location.state?.prefill]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (isGemini) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isGemini]);

  useEffect(() => {
    if (!isGemini || !followStream) return;
    const id = window.requestAnimationFrame(() => scrollGeminiMessagesToBottom());
    return () => window.cancelAnimationFrame(id);
  }, [messages, streamingContent, isGemini, followStream, scrollGeminiMessagesToBottom]);

  function startNewChat() {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    const qs = next.toString();
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : '' },
      { replace: false },
    );
    setActiveSessionId(null);
    setMessages([makeWelcome(bookTitle, contextBlurb)]);
    setError('');
    setSidebarOpen(false);
    setAttachmentChipNames([]);
    setAttachMenuOpen(false);
    if (isGemini) setFollowStream(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function deleteSession(sessionId) {
    try {
      await fetch(`/api/ai/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (activeSessionId === sessionId) {
        const next = new URLSearchParams(searchParams);
        next.delete('session');
        const qs = next.toString();
        navigate(
          { pathname: location.pathname, search: qs ? `?${qs}` : '' },
          { replace: true },
        );
        setActiveSessionId(null);
        setMessages([makeWelcome(bookTitle, contextBlurb)]);
      }
    } catch (_) {
      toast.error('Failed to delete session');
    }
  }

  async function sendMessage(e, overrideText) {
    e?.preventDefault();
    const text = (
      overrideText != null ? String(overrideText) : draft
    ).trim();
    if (!text || loading) return;

    if (overrideText != null) {
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} },
      );
    }

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    if (isGemini) setFollowStream(true);
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setAttachmentChipNames([]);
    if (inputRef.current)
      inputRef.current.style.height = isGemini ? '34px' : '72px';
    setError('');
    setLoading(true);
    streamingRef.current = '';
    setStreamingContent('');

    const history = [
      ...messages.filter((m) => m.id !== 'welcome'),
      userMsg,
    ].map(({ role, content }) => ({ role, content }));

    const bookPayload = bookId ? { bookId: String(bookId) } : {};

    try {
      if (socket?.connected) {
        await sendViaSocket(history, bookPayload);
      } else {
        await sendViaRest(history, bookPayload);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setStreamingContent('');
      streamingRef.current = '';
      inputRef.current?.focus();
    }
  }

  function sendViaSocket(history, bookPayload) {
    return new Promise((resolve, reject) => {
      socket.emit('ai:chat', {
        messages: history,
        sessionId: activeSessionId,
        ...bookPayload,
      });

      const onSessionId = ({ sessionId }) => {
        setActiveSessionId(sessionId);
      };

      const onChunk = ({ chunk }) => {
        streamingRef.current += chunk;
        setStreamingContent(streamingRef.current);
      };

      const onDone = ({ fullResponse, sessionId }) => {
        cleanup();
        const aiMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: fullResponse,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setStreamingContent('');
        streamingRef.current = '';
        if (sessionId) {
          setActiveSessionId(sessionId);
          replaceSessionInUrl(sessionId);
          fetchSessions();
        }
        resolve();
      };

      const onError = ({ message }) => {
        cleanup();
        reject(new Error(message || 'AI error'));
      };

      function cleanup() {
        socket.off('ai:sessionId', onSessionId);
        socket.off('ai:chunk', onChunk);
        socket.off('ai:done', onDone);
        socket.off('ai:error', onError);
      }

      socket.on('ai:sessionId', onSessionId);
      socket.on('ai:chunk', onChunk);
      socket.on('ai:done', onDone);
      socket.on('ai:error', onError);
    });
  }

  async function sendViaRest(history, bookPayload) {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        sessionId: activeSessionId,
        ...bookPayload,
      }),
    });

    const data = await readJsonOrThrow(res, 'AI request failed');
    const aiMsg = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: data.response,
    };
    setMessages((prev) => [...prev, aiMsg]);
    if (data.sessionId) {
      setActiveSessionId(data.sessionId);
      replaceSessionInUrl(data.sessionId);
      fetchSessions();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasQuickPrompts =
    showQuickPromptsEmptyState &&
    Array.isArray(starterPrompts) &&
    starterPrompts.length > 0 &&
    (isStudyWorkspace || typeof onQuickPrompt === 'function');

  const isStarterState =
    !loading && messages.length === 1 && messages[0]?.id === 'welcome';

  const studyRagSubtitle = bookId
    ? ragIsIndexing
      ? 'Preparing…'
      : ragStatus?.ragIndexStatus === 'failed'
        ? 'Prep failed'
        : (ragStatus?.chunkCount ?? 0) > 0
          ? `Ready (${ragStatus.chunkCount} snippets)`
          : 'Prepare recommended'
    : '';

  const showJumpToBottomFab =
    isGemini && loading && Boolean(streamingContent) && !followStream;

  return (
    <div
      className={
        isGemini
          ? `flex ${isStudyWorkspace ? 'min-h-0 h-full' : 'min-h-[22rem]'} flex-1 flex-col overflow-hidden bg-transparent ${className}`
          : `flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 dark:border-slate-600 dark:bg-slate-900/60 ${className}`
      }
    >
      <div
        className={`flex min-h-0 flex-1 ${useRailSidebar ? 'relative isolate overflow-visible' : ''}`}
      >
        {useInlineSidebar ? (
          <aside className="hidden w-[13.5rem] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:flex">
            <div className="shrink-0 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <h3 className="font-display text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Conversations
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                {sessions.length}{' '}
                {sessions.length === 1 ? 'chat' : 'chats'} saved
              </p>
            </div>
            <SessionSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onNew={startNewChat}
              onLoad={loadSession}
              onDelete={deleteSession}
              variant={variant}
            />
          </aside>
        ) : null}

        {sidebarOpen && !useInlineSidebar && !useRailSidebar ? (
          <div className="fixed inset-0 z-[130] flex justify-start">
            <button
              type="button"
              className={
                useStudyMobileHistory
                  ? 'absolute inset-0 cursor-default bg-slate-950/30 backdrop-blur-[2px]'
                  : isGemini
                    ? 'absolute inset-0 cursor-default bg-slate-900/30 backdrop-blur-[2px] dark:bg-black/60'
                    : 'absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px] transition-opacity dark:bg-black/50'
              }
              onClick={() => setSidebarOpen(false)}
              aria-label="Close chat history"
            />
            <div
              className={
                useStudyMobileHistory
                  ? 'relative z-10 flex h-full w-[min(17.25rem,88vw)] shrink-0 flex-col overflow-hidden border border-white/10 bg-slate-950/40 shadow-[8px_0_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:bg-slate-950/45'
                  : isGemini
                    ? 'relative z-10 flex h-full w-full max-w-[min(100%,20rem)] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-none sm:w-72'
                    : 'relative z-10 flex h-full w-full max-w-[min(100%,20rem)] flex-col border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] shadow-2xl dark:border-slate-700/90 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.99)_0%,rgba(15,23,42,0.97)_100%)] sm:max-w-none sm:w-72'
              }
            >
              <div
                className={
                  useStudyMobileHistory
                    ? 'shrink-0 border-b border-white/10 px-3 py-3'
                    : isGemini
                      ? 'shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700'
                      : 'shrink-0 border-b border-slate-200/90 px-4 py-3 dark:border-slate-700/80'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className={
                        useStudyMobileHistory
                          ? 'font-display text-[15px] font-semibold tracking-tight text-slate-100'
                          : isGemini
                            ? 'font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100'
                            : 'font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50'
                      }
                    >
                      Conversations
                    </h3>
                    <p
                      className={
                        useStudyMobileHistory
                          ? 'mt-0.5 text-[11px] text-slate-400'
                          : isGemini
                            ? 'mt-0.5 text-[11px] text-slate-500 dark:text-slate-400'
                            : 'mt-0.5 text-[11px] text-slate-500 dark:text-slate-400'
                      }
                    >
                      {sessions.length}{' '}
                      {sessions.length === 1 ? 'chat' : 'chats'} saved
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className={
                      useStudyMobileHistory
                        ? 'rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-200'
                        : isGemini
                          ? 'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                          : 'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800'
                    }
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onNew={() => {
                  startNewChat();
                  if (useStudyMobileHistory) setSidebarOpen(false);
                }}
                onLoad={(sessionId, opts) => {
                  loadSession(sessionId, opts);
                  if (useStudyMobileHistory) setSidebarOpen(false);
                }}
                onDelete={deleteSession}
                variant={variant}
                layout={useStudyMobileHistory ? 'railOverlay' : 'default'}
                deleteButtonsAlwaysVisible={useStudyMobileHistory}
              />
            </div>
          </div>
        ) : null}

        <div
          className={
            isGemini
              ? `flex w-full min-w-0 flex-1 flex-col px-0 pb-0 pt-1 md:px-1 ${
                  isStudyWorkspace ? 'min-h-0' : 'min-h-[20rem]'
                } ${useRailSidebar ? 'relative min-h-0 overflow-hidden' : ''}`
              : 'flex min-h-[20rem] w-full min-w-0 flex-1 flex-col p-3 md:p-4'
          }
        >
          {useRailSidebar ? (
            <>
              <button
                type="button"
                aria-expanded={sidebarOpen}
                aria-controls="liqu-ai-rail-slide"
                id="liqu-ai-rail-trigger"
                onClick={toggleRailSidebar}
                className="pointer-events-auto absolute left-2.5 top-[max(0.25rem,env(safe-area-inset-top))] z-[112] flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-slate-900 shadow-[0_8px_32px_-6px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition hover:bg-white/25 active:scale-[0.97] dark:border-white/12 dark:bg-slate-950/25 dark:text-slate-50 dark:shadow-black/40 dark:hover:bg-slate-900/40"
                aria-label={
                  sidebarOpen ? 'Close chat history' : 'Open chat history'
                }
              >
                <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
              </button>
              {sidebarOpen ? (
                <>
                  <button
                    type="button"
                    className="absolute inset-0 z-[110] cursor-default bg-slate-950/[0.08] backdrop-blur-[2px] dark:bg-black/15"
                    aria-label="Close chat history"
                    onClick={() => setSidebarOpen(false)}
                  />
                  <aside
                    id="liqu-ai-rail-slide"
                    aria-labelledby="liqu-ai-rail-trigger"
                    className="absolute left-0 top-0 z-[111] flex h-full w-[min(19rem,calc(100%-2.5rem))] max-w-[21rem] flex-col overflow-hidden border-r border-white/12 bg-slate-950/25 shadow-[16px_0_60px_-12px_rgba(0,0,0,0.35)] backdrop-blur-3xl dark:border-white/10 dark:bg-slate-950/35 dark:shadow-black/50"
                  >
                    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
                      <div className="shrink-0 border-b border-white/10 px-3 pb-2 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-display text-[15px] font-semibold tracking-tight text-slate-50">
                              Conversations
                            </h3>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {sessions.length}{' '}
                              {sessions.length === 1 ? 'chat' : 'chats'} saved
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSidebarOpen(false)}
                            className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                            aria-label="Close"
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <SessionSidebar
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        onNew={() => {
                          startNewChat();
                          setSidebarOpen(false);
                        }}
                        onLoad={loadSession}
                        onDelete={deleteSession}
                        variant={variant}
                        layout="railOverlay"
                      />
                    </div>
                  </aside>
                </>
              ) : null}
            </>
          ) : null}
          {isGemini && isStudyWorkspace && !isLgUp && !useRailSidebar ? (
            <div className="mb-1.5 flex items-center justify-between gap-2 px-1 py-0.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Chat history"
              >
                <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">
                Liqu AI
              </span>
              <button
                type="button"
                onClick={startNewChat}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="New chat"
              >
                <SquarePen className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : null}
          {!(isGemini && useRailSidebar) &&
          !(isGemini && isStudyWorkspace && !isLgUp) ? (
            <div
              className={
                isGemini
                  ? `flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
                      studyDense ? 'mb-1 py-1' : 'mb-2 py-1.5'
                    }`
                  : 'mb-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-slate-100/55 px-2 py-1.5 dark:border-slate-600/80 dark:bg-slate-800/60'
              }
            >
              <div className="flex min-w-0 items-center gap-1.5">
                {!useInlineSidebar && !useRailSidebar ? (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className={
                      isGemini
                        ? 'rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        : 'rounded-xl border border-transparent p-2 text-slate-600 transition hover:border-slate-200/80 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/80'
                    }
                    aria-label="Chat history"
                  >
                    <Menu className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
                <p
                  className={
                    isGemini
                      ? 'truncate text-xs font-medium text-slate-600 dark:text-slate-400'
                      : 'truncate text-xs font-medium text-slate-600 dark:text-slate-300'
                  }
                >
                  Gemini · {name}
                </p>
              </div>
              {!useRailSidebar ? (
                <button
                  type="button"
                  onClick={startNewChat}
                  className={
                    isGemini
                      ? 'inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      : 'inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700/90'
                  }
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  New chat
                </button>
              ) : null}
            </div>
          ) : null}
          {bookId ? (
            <div
              className={
                isGemini
                  ? `flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${
                      studyDense ? 'mb-1 px-2 py-1.5' : 'mb-2 px-3 py-2'
                    }`
                  : 'mb-3 flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/95 to-cyan-50/30 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:from-slate-800/80 dark:to-cyan-950/20 dark:text-slate-300'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {ragIsIndexing
                    ? 'Preparing your book so answers can use it…'
                    : ragStatus?.ragIndexStatus === 'failed'
                      ? "We couldn't finish preparing this book. You can try again below."
                      : ragStatus && (ragStatus.chunkCount ?? 0) > 0
                        ? `Ready — Liqu AI can use about ${ragStatus.chunkCount} snippets from this book when you ask.`
                        : 'Prepare this book once so answers can reference the text (works best with text-based PDFs or .txt).'}
                </span>
                <button
                  type="button"
                  onClick={indexBookForRag}
                  disabled={ragIsIndexing}
                  className={
                    isGemini
                      ? 'shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                      : 'shrink-0 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-900/50'
                  }
                >
                  {ragIsIndexing
                    ? 'Preparing…'
                    : (ragStatus?.chunkCount ?? 0) > 0
                      ? 'Prepare again'
                      : 'Prepare book'}
                </button>
              </div>
              {ragIsIndexing && phaseLabel ? (
                <div className="space-y-1">
                  <div
                    className={
                      isGemini
                        ? 'flex flex-wrap items-center justify-between gap-2 text-[0.7rem] text-slate-600 dark:text-slate-300'
                        : 'flex flex-wrap items-center justify-between gap-2 text-[0.7rem] text-cyan-900 dark:text-cyan-200'
                    }
                  >
                    <p className="min-w-0 flex-1">{phaseLabel}</p>
                    {indexStepLabel ? (
                      <span
                        className={
                          isGemini
                            ? 'shrink-0 text-slate-500'
                            : 'shrink-0 text-slate-500'
                        }
                      >
                        {indexStepLabel} · {ragIndexOverallPct}%
                      </span>
                    ) : (
                      <span className="shrink-0 text-slate-500">
                        {ragIndexOverallPct}%
                      </span>
                    )}
                  </div>
                  <div
                    className={
                      isGemini
                        ? 'h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700'
                        : 'h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80'
                    }
                    role="progressbar"
                    aria-valuenow={ragIndexOverallPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Book preparation progress"
                  >
                    <div
                      className={
                        isGemini
                          ? 'h-full rounded-full bg-blue-500 transition-[width] duration-300'
                          : 'h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 transition-[width] duration-300'
                      }
                      style={{ width: `${ragIndexOverallPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {ragStatus?.ragIndexStatus === 'failed' &&
              ragStatus?.ragIndexError ? (
                <p
                  className={
                    isGemini
                      ? 'text-[0.7rem] text-rose-600 dark:text-rose-400'
                      : 'text-[0.7rem] text-rose-600'
                  }
                >
                  {ragStatus.ragIndexError}
                </p>
              ) : null}
              {ragError ? (
                <p
                  className={
                    isGemini
                      ? 'text-[0.7rem] text-rose-600 dark:text-rose-400'
                      : 'text-[0.7rem] text-rose-600'
                  }
                >
                  {ragError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div
            className={
              isGemini
                ? 'relative flex min-h-0 flex-1 flex-col'
                : 'contents'
            }
          >
          <div
            ref={isGemini ? messagesScrollRef : undefined}
            onScroll={isGemini ? handleGeminiMessagesScroll : undefined}
            className={
              isGemini
                ? `min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                    studyDense
                      ? 'p-1.5 pb-28 md:p-1 md:pb-28'
                      : `${
                          isStudyWorkspace && !isLgUp
                            ? 'p-2 pb-[calc(10rem+env(safe-area-inset-bottom))] md:p-1 md:pb-28'
                            : 'p-2 pb-28 md:p-1 md:pb-28'
                        }`
                  }${useRailSidebar ? ' pt-11' : ''}`
                : 'min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.85)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-slate-600 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.65)_0%,rgba(15,23,42,0.45)_100%)]'
            }
          >
            <div className={isGemini ? 'space-y-5' : 'space-y-3'}>
              {isStarterState && hasQuickPrompts ? (
                <>
                  {isStudyWorkspace ? (
                    <div
                      className={`mx-auto w-full max-w-lg space-y-4 px-2 sm:px-0.5 ${
                        !isLgUp && isStarterState
                          ? 'flex min-h-[min(58dvh,30rem)] flex-col justify-center py-6 sm:py-10 lg:min-h-0 lg:justify-start lg:py-0'
                          : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                            Liqu AI
                          </p>
                          <h2 className="font-display text-xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                            {(() => {
                              const first = String(name).trim().split(/\s+/)[0];
                              return first
                                ? `Hey ${first} — what should we tackle?`
                                : 'What should we tackle?';
                            })()}
                          </h2>
                        </div>
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                          <BookOpen
                            className="h-3 w-3 shrink-0 opacity-80"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="min-w-0 truncate">
                            {bookTitle.trim() ? bookTitle.trim() : 'General chat'}
                            {bookId && studyRagSubtitle
                              ? ` · ${studyRagSubtitle}`
                              : ''}
                          </span>
                        </span>
                      </div>

                      {messages[0] ? (
                        <MessageBubble
                          key={messages[0].id}
                          message={messages[0]}
                          variant={variant}
                          compactWelcome
                        />
                      ) : null}

                      <div className="rounded-2xl border border-slate-200/60 bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <p className="mb-3 flex items-center gap-1.5 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          <Sparkles
                            className="h-3 w-3 shrink-0 text-amber-500/90 dark:text-amber-400/90"
                            strokeWidth={2}
                            aria-hidden
                          />
                          Quick start
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {starterPrompts.map((prompt, i) => (
                            <button
                              key={prompt}
                              type="button"
                              disabled={loading}
                              onClick={() => void sendMessage(undefined, prompt)}
                              className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium leading-snug transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-slate-500/50 dark:focus-visible:ring-offset-transparent ${STUDY_QUICK_PILL_ACCENTS[i % STUDY_QUICK_PILL_ACCENTS.length]}`}
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!isStudyWorkspace ? (
                    <>
                      {messages[0] ? (
                        <MessageBubble
                          key={messages[0].id}
                          message={messages[0]}
                          variant={variant}
                        />
                      ) : null}
                      <div
                        className={
                          isGemini
                            ? 'rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40'
                            : 'rounded-xl border border-cyan-200/50 bg-gradient-to-br from-cyan-50/80 via-white/80 to-slate-50/60 p-2 shadow-sm dark:border-cyan-900/30 dark:from-cyan-950/25 dark:via-slate-900/40 dark:to-slate-900/30'
                        }
                      >
                        <p
                          className={
                            isGemini
                              ? 'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500'
                              : 'flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-800 dark:text-cyan-300'
                          }
                        >
                          <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                          Quick prompts
                        </p>
                        <div className="mt-2 flex flex-col gap-1.5 sm:grid sm:grid-cols-2 sm:gap-2">
                          {starterPrompts.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => onQuickPrompt(prompt)}
                              className={
                                isGemini
                                  ? 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium leading-snug text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                                  : 'w-full rounded-lg border border-cyan-200/60 bg-white/90 px-2.5 py-1.5 text-left text-xs font-medium leading-snug text-slate-800 transition hover:border-cyan-300/80 hover:bg-white dark:border-cyan-900/45 dark:bg-slate-900/60 dark:text-cyan-50/95 dark:hover:bg-cyan-950/35'
                              }
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} variant={variant} />
                ))
              )}

              {loading && streamingContent && (
                <div className="flex items-start gap-2">
                  <AiAvatar gemini={isGemini} />
                  <div
                    className={
                      isGemini
                        ? 'min-w-0 flex-1 pt-0.5 text-sm text-slate-800 dark:text-slate-200'
                        : 'max-w-[80%] rounded-2xl rounded-tl-none border border-slate-200/90 bg-white/95 px-3 py-2 text-sm text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800/75 dark:text-slate-100'
                    }
                  >
                    <MessageContent
                      content={streamingContent}
                      isUser={false}
                      variant={variant}
                    />
                    <span
                      className={
                        isGemini
                          ? 'ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400 dark:bg-slate-500'
                          : 'ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400'
                      }
                    />
                  </div>
                </div>
              )}

              {loading && !streamingContent && (
                <div className="flex items-start gap-2">
                  <AiAvatar gemini={isGemini} />
                  <div
                    className={
                      isGemini
                        ? 'pt-2'
                        : 'rounded-2xl rounded-tl-none border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-800/75'
                    }
                  >
                    <TypingDots gemini={isGemini} />
                  </div>
                </div>
              )}

              {error && (
                <div
                  className={
                    isGemini
                      ? 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200'
                      : 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
                  }
                >
                  {error}
                  <button
                    type="button"
                    onClick={() => setError('')}
                    className="ml-2 font-semibold underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <div
            className={`relative shrink-0 ${
              isGemini
                ? isStudyWorkspace && !isLgUp
                  ? 'z-10 border-t border-slate-200/25 bg-white/50 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-lg dark:border-white/[0.07] dark:bg-slate-950/45'
                  : 'z-10 px-3 pb-3 pt-1'
                : ''
            }`}
          >
          <form onSubmit={sendMessage} className={isGemini ? 'mt-0 w-full' : 'mt-3'}>
            {isGemini ? (
              <div
                className={
                  isStudyWorkspace && !isLgUp
                    ? 'mx-auto w-full max-w-none px-2 sm:px-3'
                    : 'mx-auto w-full max-w-md px-2 sm:px-3'
                }
              >
                <div
                  ref={attachMenuContainerRef}
                  className={
                    isStudyWorkspace && !isLgUp
                      ? 'relative rounded-2xl border border-slate-200/55 bg-white/70 px-2 py-2 shadow-lg shadow-slate-900/[0.08] ring-1 ring-slate-900/[0.05] backdrop-blur-md dark:border-slate-600/35 dark:bg-slate-950/50 dark:shadow-black/25 dark:ring-white/[0.06]'
                      : 'relative rounded-full border border-slate-200/50 bg-white/55 px-2 py-1.5 shadow-md shadow-slate-900/[0.07] ring-1 ring-slate-900/[0.04] backdrop-blur-md dark:border-slate-600/30 dark:bg-slate-950/40 dark:shadow-black/20 dark:ring-white/[0.05]'
                  }
                >
                  {attachmentChipNames.length > 0 ? (
                    <div className="mb-1 flex flex-wrap gap-1 border-b border-slate-200/40 pb-1.5 dark:border-white/[0.06]">
                      {attachmentChipNames.map((n) => (
                        <span
                          key={n}
                          className="max-w-full truncate rounded-full bg-slate-100/90 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
                          title={n}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="*/*"
                    onChange={handleGeminiFiles}
                  />
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <button
                      type="button"
                      onClick={() => setAttachMenuOpen((o) => !o)}
                      className="shrink-0 rounded-full p-1.5 text-slate-600 transition hover:bg-slate-900/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                      aria-expanded={attachMenuOpen}
                      aria-haspopup="menu"
                      aria-label="Add to prompt"
                    >
                      <Plus className="h-[14px] w-[14px]" strokeWidth={2} />
                    </button>
                    {attachMenuOpen ? (
                      <div
                        className="absolute bottom-full left-2 z-40 mb-2 w-[min(calc(100vw-2.5rem),14rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-800"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip
                            className="h-4 w-4 shrink-0 text-slate-500"
                            strokeWidth={2}
                          />
                          Upload files
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            toast.info(
                              'Cloud storage is not connected yet. Use Upload files from this device.',
                            );
                          }}
                        >
                          <Cloud
                            className="h-4 w-4 shrink-0 text-slate-500"
                            strokeWidth={2}
                          />
                          Add from cloud
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            toast.info(
                              'Use Upload files to attach images from your device. The AI only receives text today.',
                            );
                          }}
                        >
                          <Image
                            className="h-4 w-4 shrink-0 text-slate-500"
                            strokeWidth={2}
                          />
                          Photos
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            toast.info(
                              'Add course books from your Library, then select one here so Liqu AI can use indexed text.',
                            );
                          }}
                        >
                          <BookOpen
                            className="h-4 w-4 shrink-0 text-slate-500"
                            strokeWidth={2}
                          />
                          Library & notes
                        </button>
                      </div>
                    ) : null}
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Liqu AI…"
                      rows={1}
                      disabled={loading}
                      style={{ maxHeight: '140px' }}
                      className="input-field min-h-[34px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-1 text-[13px] leading-snug text-slate-900 placeholder:text-slate-500 focus:border-0 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-400 sm:min-w-[120px]"
                    />
                    {!loading && !error ? (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500 dark:bg-emerald-400"
                        title="Ready"
                        aria-hidden
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="hidden shrink-0 cursor-not-allowed items-center gap-0.5 rounded-full px-1.5 py-1 text-[10px] text-slate-400 opacity-70 md:inline-flex dark:text-slate-500"
                      aria-label="Model speed (coming soon)"
                    >
                      Fast
                      <ChevronDown className="h-3 w-3" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      aria-label="Voice input"
                      className="shrink-0 cursor-not-allowed rounded-full p-1.5 text-slate-400 opacity-70 dark:text-slate-500"
                    >
                      <Mic className="h-[14px] w-[14px]" strokeWidth={2} />
                    </button>
                    <button
                      type="submit"
                      disabled={!draft.trim() || loading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-900/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-600 dark:hover:bg-blue-500"
                      aria-label="Send"
                    >
                      <Send className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/85 bg-slate-50/60 p-2 dark:border-slate-600 dark:bg-slate-800/45">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this book or your course…"
                    rows={2}
                    disabled={loading}
                    style={{ maxHeight: '180px' }}
                    className="input-field max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border-slate-200/90 bg-white/95 py-2.5 text-sm shadow-sm placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900/70 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || loading}
                    className="btn-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
            {isGemini ? (
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
                Enter to send · Shift+Enter for new line · AI-generated — verify
                important facts.
              </p>
            ) : (
              <p className="mt-2 pl-1 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
                Enter to send · Shift+Enter for new line · AI-generated — verify
                important facts.
              </p>
            )}
          </form>
          {isGemini && showJumpToBottomFab ? (
            <button
              type="button"
              onClick={jumpGeminiChatToLatest}
              className="pointer-events-auto absolute -top-12 right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              aria-label="Jump to latest message"
            >
              <ArrowDown className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantMessageActions({ content }) {
  const [vote, setVote] = useState(null);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }, [content]);

  const iconBtn =
    'rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5 sm:pl-8">
      <button
        type="button"
        className={iconBtn}
        aria-label="Good response"
        aria-pressed={vote === 'up'}
        onClick={() => setVote(vote === 'up' ? null : 'up')}
      >
        <ThumbsUp
          className={`h-4 w-4 ${vote === 'up' ? 'text-blue-400' : ''}`}
          strokeWidth={vote === 'up' ? 2.5 : 1.75}
        />
      </button>
      <button
        type="button"
        className={iconBtn}
        aria-label="Bad response"
        aria-pressed={vote === 'down'}
        onClick={() => setVote(vote === 'down' ? null : 'down')}
      >
        <ThumbsDown
          className={`h-4 w-4 ${vote === 'down' ? 'text-blue-400' : ''}`}
          strokeWidth={vote === 'down' ? 2.5 : 1.75}
        />
      </button>
      <button
        type="button"
        disabled
        className="rounded-lg p-1.5 text-slate-500 opacity-40"
        aria-label="Regenerate"
        title="Coming soon"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className={iconBtn}
        aria-label="Copy response"
        onClick={copy}
      >
        <Copy className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        disabled
        className="rounded-lg p-1.5 text-slate-500 opacity-40"
        aria-label="More actions"
        title="Coming soon"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function SessionSidebar({
  sessions,
  activeSessionId,
  onNew,
  onLoad,
  onDelete,
  variant = 'default',
  layout = 'default',
  deleteButtonsAlwaysVisible = false,
}) {
  const isGemini = variant === 'gemini';
  const isRailOverlay = layout === 'railOverlay';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={
          isRailOverlay
            ? 'shrink-0 px-3 pb-2 pt-1'
            : isGemini
              ? 'shrink-0 border-b border-slate-200 px-3 pb-3 pt-1 dark:border-slate-700'
              : 'shrink-0 border-b border-slate-100 px-3 pb-3 pt-1 dark:border-slate-800/80'
        }
      >
        <button
          type="button"
          onClick={onNew}
          className={
            isRailOverlay
              ? 'flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-900/40 transition hover:bg-blue-500'
              : isGemini
                ? 'flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-blue-500'
                : 'btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-md'
          }
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New chat
        </button>
      </div>
      <div
        className={
          isRailOverlay
            ? 'min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2'
            : 'min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1'
        }
      >
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <MessageSquare
              className={
                isRailOverlay
                  ? 'h-8 w-8 text-slate-600'
                  : isGemini
                    ? 'h-8 w-8 text-slate-400 dark:text-slate-600'
                    : 'h-8 w-8 text-slate-300 dark:text-slate-600'
              }
              strokeWidth={1.25}
              aria-hidden
            />
            <p
              className={
                isRailOverlay
                  ? 'text-xs font-medium text-slate-400'
                  : isGemini
                    ? 'text-xs font-medium text-slate-600 dark:text-slate-400'
                    : 'text-xs font-medium text-slate-600 dark:text-slate-400'
              }
            >
              No conversations yet
            </p>
            <p
              className={
                isRailOverlay
                  ? 'text-[11px] leading-relaxed text-slate-500'
                  : isGemini
                    ? 'text-[11px] leading-relaxed text-slate-500 dark:text-slate-500'
                    : 'text-[11px] leading-relaxed text-slate-400 dark:text-slate-500'
              }
            >
              Start typing below—your chats will appear here.
            </p>
          </div>
        ) : (
          <>
            {isRailOverlay ? (
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Chats
              </p>
            ) : null}
            <ul className={isRailOverlay ? 'space-y-1' : 'space-y-0.5'}>
              {sessions.map((s) => {
                const isActive = String(s._id) === String(activeSessionId ?? '');
                return (
                  <li key={s._id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onLoad(s._id)}
                      className={
                        isRailOverlay
                          ? `w-full rounded-full py-2 pl-3 pr-9 text-left transition ${
                              isActive
                                ? 'bg-blue-950/90 text-slate-100 ring-1 ring-blue-500/35'
                                : 'text-slate-300 hover:bg-slate-800/90'
                            }`
                          : isGemini
                            ? `w-full rounded-lg py-2.5 pl-3 pr-9 text-left transition ${
                                isActive
                                  ? 'bg-slate-100 dark:bg-slate-800'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`
                            : `w-full rounded-xl border py-2.5 pl-3 pr-9 text-left transition ${
                                isActive
                                  ? 'border-cyan-200/70 bg-cyan-50/90 shadow-sm dark:border-cyan-800/50 dark:bg-cyan-950/40'
                                  : 'border-transparent hover:border-slate-200/80 hover:bg-slate-50/90 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                              }`
                      }
                    >
                      <span
                        className={`block truncate text-[13px] font-medium leading-tight ${
                          isRailOverlay
                            ? isActive
                              ? 'text-slate-50'
                              : 'text-slate-200'
                            : isGemini
                              ? isActive
                                ? 'text-slate-900 dark:text-slate-100'
                                : 'text-slate-700 dark:text-slate-300'
                              : isActive
                                ? 'text-cyan-950 dark:text-cyan-100'
                                : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {s.title || 'Untitled'}
                      </span>
                      <span
                        className={
                          isRailOverlay
                            ? `mt-1 block text-[10px] ${
                                isActive ? 'text-slate-400' : 'text-slate-500'
                              }`
                            : isGemini
                              ? 'mt-1 block text-[10px] text-slate-500'
                              : 'mt-1 block text-[10px] text-slate-500 dark:text-slate-400'
                        }
                      >
                        {formatSessionUpdatedAt(s.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(s._id);
                      }}
                      className={
                        isRailOverlay
                          ? `absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300 ${
                              deleteButtonsAlwaysVisible
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                            }`
                          : isGemini
                            ? `absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-300 ${
                                deleteButtonsAlwaysVisible
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`
                            : `absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 ${
                                deleteButtonsAlwaysVisible
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`
                      }
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function AiAvatar({ gemini }) {
  if (gemini) {
    return (
      <span
        className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
        title="Liqu AI"
      >
        <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-cyan-700 to-indigo-800 text-white shadow-md ring-2 ring-white/40 dark:ring-slate-700/80"
      title="Liqu AI"
    >
      <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
    </div>
  );
}

function MessageBubble({
  message,
  variant = 'default',
  compactWelcome = false,
}) {
  const isUser = message.role === 'user';
  const isGemini = variant === 'gemini';
  const showActions =
    isGemini && message.role === 'assistant' && message.id !== 'welcome';

  if (
    isGemini &&
    !isUser &&
    compactWelcome &&
    message.id === 'welcome'
  ) {
    return (
      <div className="max-w-xl rounded-xl border border-slate-200/55 bg-white/40 px-3 py-2.5 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
        <MessageContent
          content={message.content}
          isUser={false}
          variant={variant}
          compactGeminiTypography
        />
      </div>
    );
  }
  if (isGemini && isUser) {
    return (
      <div className="flex justify-end">
        <div className="inline-block max-w-[min(85%,42rem)] rounded-2xl bg-slate-200 px-4 py-2.5 text-sm leading-relaxed dark:bg-slate-700">
          <MessageContent
            content={message.content}
            isUser
            variant={variant}
          />
        </div>
      </div>
    );
  }

  if (isGemini && !isUser) {
    return (
      <div className="flex items-start gap-2">
        <AiAvatar gemini />
        <div className="min-w-0 flex-1">
          <MessageContent
            content={message.content}
            isUser={false}
            variant={variant}
          />
          {showActions ? (
            <AssistantMessageActions content={message.content} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {isUser ? (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-slate-200/95 text-slate-700 shadow-sm ring-1 ring-slate-300/50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
          title="You"
        >
          <User className="h-4 w-4" strokeWidth={2} aria-hidden />
        </div>
      ) : (
        <AiAvatar gemini={false} />
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-none bg-gradient-to-br from-cyan-700 via-cyan-800 to-indigo-900 text-white shadow-md'
            : 'rounded-tl-none border border-slate-200/90 bg-white/95 text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800/75 dark:text-slate-100'
        }`}
      >
        <MessageContent content={message.content} isUser={isUser} />
      </div>
    </div>
  );
}

function MessageContent({
  content,
  isUser,
  variant = 'default',
  compactGeminiTypography = false,
}) {
  if (isUser) {
    return (
      <p
        className={`whitespace-pre-wrap ${variant === 'gemini' ? 'text-slate-900 dark:text-slate-100' : ''}`}
      >
        {content}
      </p>
    );
  }
  if (variant === 'gemini') {
    return (
      <div
        className={`prose max-w-none text-slate-800 prose-headings:text-slate-900 prose-a:text-blue-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-pre:bg-slate-900/90 prose-pre:text-slate-100 dark:prose-invert dark:text-slate-200 dark:prose-headings:text-slate-100 dark:prose-a:text-blue-400 dark:prose-code:bg-slate-800 dark:prose-pre:bg-slate-950/90 ${
          compactGeminiTypography
            ? 'text-[13px] prose-p:my-1.5 prose-p:last:mb-0 [&_strong]:font-semibold'
            : `prose-sm prose-p:leading-relaxed`
        }`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }
  return (
    <div className="prose prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-headings:text-slate-900 prose-a:text-cyan-700 dark:prose-headings:text-slate-100 dark:prose-p:text-slate-200 dark:prose-li:text-slate-200 dark:prose-code:bg-slate-800 dark:prose-code:text-slate-100 dark:prose-a:text-cyan-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function TypingDots({ gemini }) {
  const dot = gemini
    ? 'bg-slate-400 dark:bg-slate-500'
    : 'bg-slate-400';
  return (
    <div className="flex items-center gap-1">
      <span
        className={`h-2 w-2 animate-bounce rounded-full ${dot} [animation-delay:0ms]`}
      />
      <span
        className={`h-2 w-2 animate-bounce rounded-full ${dot} [animation-delay:150ms]`}
      />
      <span
        className={`h-2 w-2 animate-bounce rounded-full ${dot} [animation-delay:300ms]`}
      />
    </div>
  );
}

export default LiquAiChatPanel;
