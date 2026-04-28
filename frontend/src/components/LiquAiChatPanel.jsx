import {
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
  SlidersHorizontal,
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

const BASE_WELCOME =
  "Hi! I'm Liqu AI, powered by Google Gemini. I can help you study, explain concepts, answer questions, or discuss topics from your coursework. How can I help you today?";

function makeWelcome(bookTitle) {
  const content = bookTitle
    ? `${BASE_WELCOME}\n\nYou're working with: **${bookTitle}** — ask about this book, your notes, or anything else.`
    : BASE_WELCOME;
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
 * `bookTitle` tunes the welcome message. `starterPrompts` + `onQuickPrompt`: quick prompts below the welcome bubble.
 * @param {'default' | 'gemini'} [variant] — `gemini` is a Gemini-style layout (light-first with `dark:` parity); default keeps card styling.
 */
function LiquAiChatPanel({
  className = '',
  variant = 'default',
  bookTitle = '',
  /** When set (e.g. Study buddy), server augments Liqu AI with RAG from this book if indexed. */
  bookId = '',
  starterPrompts,
  onQuickPrompt,
  showQuickPromptsEmptyState = true,
}) {
  const isGemini = variant === 'gemini';
  const { user } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get('session');
  const name = user?.displayName ?? user?.username ?? 'Student';

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([makeWelcome(bookTitle)]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
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
    const minHeight = isGemini ? 52 : 72;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), 200)}px`;
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
    setMessages([makeWelcome(bookTitle)]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('session');
        return next;
      },
      { replace: true },
    );
  }, [bookId, bookTitle, setSearchParams]);

  useEffect(() => {
    setMessages((prev) => {
      if (activeSessionId) return prev;
      if (prev.length === 1 && prev[0]?.id === 'welcome') {
        return [makeWelcome(bookTitle)];
      }
      return prev;
    });
  }, [bookTitle, activeSessionId]);

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
        setMessages(msgs.length ? msgs : [makeWelcome(bookTitle)]);
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
    [bookTitle, replaceSessionInUrl, setSearchParams],
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  function startNewChat() {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    const qs = next.toString();
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : '' },
      { replace: false },
    );
    setActiveSessionId(null);
    setMessages([makeWelcome(bookTitle)]);
    setError('');
    setSidebarOpen(false);
    setAttachmentChipNames([]);
    setAttachMenuOpen(false);
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
        setMessages([makeWelcome(bookTitle)]);
      }
    } catch (_) {
      toast.error('Failed to delete session');
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setAttachmentChipNames([]);
    if (inputRef.current)
      inputRef.current.style.height = isGemini ? '52px' : '72px';
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
    typeof onQuickPrompt === 'function';

  const isStarterState =
    !loading && messages.length === 1 && messages[0]?.id === 'welcome';

  return (
    <div
      className={
        isGemini
          ? `flex min-h-[22rem] flex-1 flex-col overflow-hidden bg-transparent ${className}`
          : `flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 dark:border-slate-600 dark:bg-slate-900/60 ${className}`
      }
    >
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <div className="fixed inset-0 z-[130] flex">
            <button
              type="button"
              className={
                isGemini
                  ? 'absolute inset-0 cursor-default bg-slate-900/30 backdrop-blur-[2px] dark:bg-black/60'
                  : 'absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px] transition-opacity dark:bg-black/50'
              }
              onClick={() => setSidebarOpen(false)}
              aria-label="Close chat history"
            />
            <div
              className={
                isGemini
                  ? 'relative z-10 flex h-full w-full max-w-[min(100%,20rem)] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-none sm:w-72'
                  : 'relative z-10 flex h-full w-full max-w-[min(100%,20rem)] flex-col border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] shadow-2xl dark:border-slate-700/90 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.99)_0%,rgba(15,23,42,0.97)_100%)] sm:max-w-none sm:w-72'
              }
            >
              <div
                className={
                  isGemini
                    ? 'shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700'
                    : 'shrink-0 border-b border-slate-200/90 px-4 py-3 dark:border-slate-700/80'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className={
                        isGemini
                          ? 'font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100'
                          : 'font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50'
                      }
                    >
                      Conversations
                    </h3>
                    <p
                      className={
                        isGemini
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
                      isGemini
                        ? 'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        : 'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800'
                    }
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onNew={startNewChat}
                onLoad={loadSession}
                onDelete={deleteSession}
                variant={variant}
              />
            </div>
          </div>
        )}

        <div
          className={
            isGemini
              ? 'flex min-h-[20rem] w-full min-w-0 flex-1 flex-col px-0 pb-0 pt-1 md:px-1'
              : 'flex min-h-[20rem] w-full min-w-0 flex-1 flex-col p-3 md:p-4'
          }
        >
          <div
            className={
              isGemini
                ? 'mb-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900'
                : 'mb-3 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-slate-100/55 px-2 py-1.5 dark:border-slate-600/80 dark:bg-slate-800/60'
            }
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={
                  isGemini
                    ? 'rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    : 'rounded-xl border border-transparent p-2 text-slate-600 transition hover:border-slate-200/80 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/80'
                }
                aria-label="Chat history"
              >
                <Menu className="h-4 w-4" strokeWidth={2} />
              </button>
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
          </div>
          {bookId ? (
            <div
              className={
                isGemini
                  ? 'mb-2 flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  : 'mb-3 flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/95 to-cyan-50/30 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:from-slate-800/80 dark:to-cyan-950/20 dark:text-slate-300'
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {ragIsIndexing
                    ? 'Indexing in progress for AI context.'
                    : ragStatus?.ragIndexStatus === 'failed' &&
                        ragStatus?.ragIndexError
                      ? 'Last index failed — you can try again.'
                      : ragStatus && (ragStatus.chunkCount ?? 0) > 0
                        ? `Book indexed — ${ragStatus.chunkCount} passages (answers use this text).`
                        : 'Ground answers in this book: index it once (text-based PDF or .txt).'}
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
                    ? 'Indexing…'
                    : (ragStatus?.chunkCount ?? 0) > 0
                      ? 'Re-index'
                      : 'Index book'}
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
                    aria-label="Indexing progress"
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
                ? 'min-h-0 flex-1 overflow-y-auto p-2 md:p-1'
                : 'min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.85)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-slate-600 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.65)_0%,rgba(15,23,42,0.45)_100%)]'
            }
          >
            <div className={isGemini ? 'space-y-6' : 'space-y-3'}>
              {isStarterState && hasQuickPrompts ? (
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

          <form onSubmit={sendMessage} className={isGemini ? 'mt-4' : 'mt-3'}>
            {isGemini ? (
              <div
                ref={attachMenuContainerRef}
                className="relative rounded-[28px] border border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {attachmentChipNames.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {attachmentChipNames.map((n) => (
                      <span
                        key={n}
                        className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        title={n}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-start gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Liqu AI…"
                    rows={2}
                    disabled={loading}
                    style={{ maxHeight: '180px' }}
                    className="input-field min-h-[52px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-2 text-base leading-snug text-slate-900 placeholder:text-slate-400 focus:border-0 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  {!loading && !error ? (
                    <span
                      className="mt-3 h-2 w-2 shrink-0 rounded-full bg-teal-500 dark:bg-emerald-400"
                      title="Ready"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="*/*"
                  onChange={handleGeminiFiles}
                />
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-2.5 dark:border-slate-700">
                  <div className="flex min-w-0 flex-1 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setAttachMenuOpen((o) => !o)}
                      className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      aria-expanded={attachMenuOpen}
                      aria-haspopup="menu"
                      aria-label="Add to prompt"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} />
                    </button>
                    {attachMenuOpen ? (
                      <div
                        className="absolute bottom-[3.25rem] left-3 z-30 w-[min(calc(100vw-2.5rem),14rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
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
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="ml-0.5 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 opacity-70 dark:text-slate-500"
                    >
                      <SlidersHorizontal
                        className="h-4 w-4"
                        strokeWidth={2}
                        aria-hidden
                      />
                      Tools
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      className="hidden cursor-not-allowed items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs text-slate-400 opacity-70 sm:inline-flex dark:text-slate-500"
                    >
                      Fast
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Coming soon"
                      aria-label="Voice input"
                      className="cursor-not-allowed rounded-full p-2 text-slate-400 opacity-70 dark:text-slate-500"
                    >
                      <Mic className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button
                      type="submit"
                      disabled={!draft.trim() || loading}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" strokeWidth={2} />
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
              <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
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
}) {
  const isGemini = variant === 'gemini';
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={
          isGemini
            ? 'shrink-0 border-b border-slate-200 px-3 pb-3 pt-1 dark:border-slate-700'
            : 'shrink-0 border-b border-slate-100 px-3 pb-3 pt-1 dark:border-slate-800/80'
        }
      >
        <button
          type="button"
          onClick={onNew}
          className={
            isGemini
              ? 'flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-blue-500'
              : 'btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-md'
          }
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New chat
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <MessageSquare
              className={
                isGemini
                  ? 'h-8 w-8 text-slate-400 dark:text-slate-600'
                  : 'h-8 w-8 text-slate-300 dark:text-slate-600'
              }
              strokeWidth={1.25}
              aria-hidden
            />
            <p
              className={
                isGemini
                  ? 'text-xs font-medium text-slate-600 dark:text-slate-400'
                  : 'text-xs font-medium text-slate-600 dark:text-slate-400'
              }
            >
              No conversations yet
            </p>
            <p
              className={
                isGemini
                  ? 'text-[11px] leading-relaxed text-slate-500 dark:text-slate-500'
                  : 'text-[11px] leading-relaxed text-slate-400 dark:text-slate-500'
              }
            >
              Start typing below—your chats will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const isActive = String(s._id) === String(activeSessionId ?? '');
              return (
                <li key={s._id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onLoad(s._id)}
                    className={
                      isGemini
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
                        isGemini
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
                        isGemini
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
                      isGemini
                        ? 'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/15 dark:hover:text-rose-300'
                        : 'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400'
                    }
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ul>
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

function MessageBubble({ message, variant = 'default' }) {
  const isUser = message.role === 'user';
  const isGemini = variant === 'gemini';
  const showActions =
    isGemini && message.role === 'assistant' && message.id !== 'welcome';

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

function MessageContent({ content, isUser, variant = 'default' }) {
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
      <div className="prose prose-sm max-w-none text-slate-800 prose-p:leading-relaxed prose-headings:text-slate-900 prose-a:text-blue-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-pre:bg-slate-900/90 prose-pre:text-slate-100 dark:prose-invert dark:text-slate-200 dark:prose-headings:text-slate-100 dark:prose-a:text-blue-400 dark:prose-code:bg-slate-800 dark:prose-pre:bg-slate-950/90">
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
