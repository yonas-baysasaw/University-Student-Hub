import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { readJsonOrThrow } from '../utils/http';

const WELCOME_CONTENT =
  "Hi! I'm Liqu AI, powered by Google Gemini. I can help you study, explain concepts, answer questions, or discuss topics from your coursework. How can I help you today?";

function makeWelcome() {
  return { id: 'welcome', role: 'assistant', content: WELCOME_CONTENT };
}

function LiquAI() {
  const { user } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const name = user?.displayName ?? user?.username ?? 'Student';

  // ── Session state ──────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([makeWelcome()]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef('');

  // Auto-resize textarea — grows with content, never collapses below initial rows height
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs when draft changes to resize the textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 72; // ~3 rows at text-sm line-height
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), 200)}px`;
  }, [draft]);

  // Prefill from navigation state (e.g. from ExamPractice "Explain further")
  useEffect(() => {
    const prefill = location.state?.prefill;
    if (prefill) {
      setDraft(prefill);
      inputRef.current?.focus();
    }
  }, [location.state?.prefill]);

  // ── Load sessions list ─────────────────────────────────────────────────────
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

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only triggers on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ── Load a past session ────────────────────────────────────────────────────
  async function loadSession(sessionId) {
    try {
      const res = await fetch(`/api/ai/sessions/${sessionId}`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Failed to load session');
      setActiveSessionId(data._id);
      const msgs = data.messages.map((m, i) => ({
        id: `${data._id}-${i}`,
        role: m.role,
        content: m.content,
      }));
      setMessages(msgs.length ? msgs : [makeWelcome()]);
    } catch (err) {
      toast.error(err.message);
    }
    setSidebarOpen(false);
  }

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([makeWelcome()]);
    setError('');
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function deleteSession(sessionId) {
    try {
      await fetch(`/api/ai/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (activeSessionId === sessionId) startNewChat();
    } catch (_) {
      toast.error('Failed to delete session');
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    // Reset textarea to minimum height after clearing
    if (inputRef.current) inputRef.current.style.height = '72px';
    setError('');
    setLoading(true);
    streamingRef.current = '';
    setStreamingContent('');

    const history = [
      ...messages.filter((m) => m.id !== 'welcome'),
      userMsg,
    ].map(({ role, content }) => ({ role, content }));

    try {
      if (socket?.connected) {
        // Use socket streaming
        await sendViaSocket(history);
      } else {
        // Fallback to REST
        await sendViaRest(history);
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

  function sendViaSocket(history) {
    return new Promise((resolve, reject) => {
      socket.emit('ai:chat', { messages: history, sessionId: activeSessionId });

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

  async function sendViaRest(history) {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, sessionId: activeSessionId }),
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
      fetchSessions();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="page-surface flex" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* ── Session sidebar — desktop always visible ──────────────────────── */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white/70 backdrop-blur-sm lg:flex xl:w-72">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNew={startNewChat}
          onLoad={loadSession}
          onDelete={deleteSession}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[9999] flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <div className="relative z-10 flex h-full w-72 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-display text-base text-slate-900">
                Chat History
              </h3>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <SessionSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onNew={startNewChat}
              onLoad={loadSession}
              onDelete={deleteSession}
            />
          </div>
        </div>
      )}

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4 pt-6 md:px-6">
        {/* Header */}
        <section className="panel-card fade-in-up mb-4 rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Mobile sidebar toggle */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                aria-label="Chat history"
              >
                ☰
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  AI Assistant
                </p>
                <h1 className="font-display text-xl text-slate-900 md:text-2xl">
                  Liqu AI
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Powered by Google Gemini · Hi, {name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              New chat
            </button>
          </div>
        </section>

        {/* Message list */}
        <div className="panel-card flex-1 overflow-y-auto rounded-3xl p-4 md:p-6">
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming indicator */}
            {loading && streamingContent && (
              <div className="flex items-start gap-3">
                <AiAvatar />
                <div className="max-w-[80%] rounded-2xl rounded-tl-none border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800">
                  <MessageContent content={streamingContent} isUser={false} />
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400" />
                </div>
              </div>
            )}

            {/* Loading dots (before first chunk arrives) */}
            {loading && !streamingContent && (
              <div className="flex items-start gap-3">
                <AiAvatar />
                <div className="rounded-2xl rounded-tl-none border border-slate-200 bg-white px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="panel-card mt-4 rounded-3xl p-3 md:p-4"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Liqu AI anything… (Enter to send, Shift+Enter for newline)"
              rows={3}
              disabled={loading}
              style={{ maxHeight: '200px' }}
              className="input-field flex-1 resize-none overflow-y-auto py-2.5 text-sm leading-relaxed"
            />
            <button
              type="submit"
              disabled={!draft.trim() || loading}
              className="btn-primary shrink-0 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Responses are AI-generated and may contain errors. Always verify
            important information.
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Session Sidebar ───────────────────────────────────────────────────────────

function SessionSidebar({
  sessions,
  activeSessionId,
  onNew,
  onLoad,
  onDelete,
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="btn-primary w-full py-2 text-sm"
        >
          + New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {sessions.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">
            No previous chats
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s._id} className="group relative">
                <button
                  type="button"
                  onClick={() => onLoad(s._id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    s._id === activeSessionId
                      ? 'bg-cyan-50 font-semibold text-cyan-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <p className="truncate">{s.title || 'Untitled'}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s._id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 transition"
                  aria-label="Delete session"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function AiAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-700 to-slate-900 text-xs font-bold text-white">
      AI
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? 'bg-slate-200 text-slate-700'
            : 'bg-gradient-to-br from-cyan-700 to-slate-900 text-white'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-none bg-gradient-to-br from-cyan-700 to-slate-900 text-white'
            : 'rounded-tl-none border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <MessageContent content={message.content} isUser={isUser} />
      </div>
    </div>
  );
}

// ── Message Content with Markdown ─────────────────────────────────────────────

function MessageContent({ content, isUser }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
  return (
    <div className="prose prose-sm max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-headings:text-slate-900 prose-a:text-cyan-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
    </div>
  );
}

export default LiquAI;
