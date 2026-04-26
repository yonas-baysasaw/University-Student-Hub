import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { readJsonOrThrow } from '../utils/http';

const BASE_WELCOME =
  "Hi! I'm Liqu AI, powered by Google Gemini. I can help you study, explain concepts, answer questions, or discuss topics from your coursework. How can I help you today?";

function makeWelcome(bookTitle) {
  const content = bookTitle
    ? `${BASE_WELCOME}\n\nYou're working with: **${bookTitle}** — ask about this book, your notes, or anything else.`
    : BASE_WELCOME;
  return { id: 'welcome', role: 'assistant', content };
}

/**
 * Gemini chat with sessions, socket streaming, and REST fallback — for Study buddy.
 * `remountKey` (e.g. selected book id) resets the chat; `bookTitle` tunes the welcome message.
 */
function LiquAiChatPanel({ className = '', remountKey = 'default', bookTitle = '' }) {
  const { user } = useAuth();
  const socket = useSocket();
  const location = useLocation();
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

  const [streamingContent, setStreamingContent] = useState('');
  const streamingRef = useRef('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs when draft changes
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 72;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), 200)}px`;
  }, [draft]);

  useEffect(() => {
    setMessages([makeWelcome(bookTitle)]);
    setActiveSessionId(null);
  }, [remountKey, bookTitle]);

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
      setMessages(msgs.length ? msgs : [makeWelcome(bookTitle)]);
    } catch (err) {
      toast.error(err.message);
    }
    setSidebarOpen(false);
  }

  function startNewChat() {
    setActiveSessionId(null);
    setMessages([makeWelcome(bookTitle)]);
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

  async function sendMessage(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = '72px';
    setError('');
    setLoading(true);
    streamingRef.current = '';
    setStreamingContent('');

    const history = [...messages.filter((m) => m.id !== 'welcome'), userMsg].map(
      ({ role, content }) => ({ role, content }),
    );

    try {
      if (socket?.connected) {
        await sendViaSocket(history);
      } else {
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
    <div
      className={`flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 ${className}`}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-48 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 md:flex lg:w-56">
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onNew={startNewChat}
            onLoad={loadSession}
            onDelete={deleteSession}
          />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-[120] flex md:hidden">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-black/40"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            />
            <div className="relative z-10 flex h-full w-64 flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <h3 className="font-display text-sm text-slate-900">History</h3>
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

        <div className="flex min-h-[20rem] flex-1 flex-col p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                aria-label="Chat history"
              >
                ☰
              </button>
              <p className="text-xs text-slate-500">Gemini · {name}</p>
            </div>
            <button
              type="button"
              onClick={startNewChat}
              className="rounded-full px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {loading && streamingContent && (
                <div className="flex items-start gap-2">
                  <AiAvatar />
                  <div className="max-w-[80%] rounded-2xl rounded-tl-none border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    <MessageContent content={streamingContent} isUser={false} />
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-400" />
                  </div>
                </div>
              )}

              {loading && !streamingContent && (
                <div className="flex items-start gap-2">
                  <AiAvatar />
                  <div className="rounded-2xl rounded-tl-none border border-slate-200 bg-white px-3 py-2">
                    <TypingDots />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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

          <form onSubmit={sendMessage} className="mt-2">
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
                className="input-field max-h-40 flex-1 resize-none overflow-y-auto py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!draft.trim() || loading}
                className="btn-primary shrink-0 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              AI-generated — verify important facts.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function SessionSidebar({ sessions, activeSessionId, onNew, onLoad, onDelete }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="p-2">
        <button
          type="button"
          onClick={onNew}
          className="btn-primary w-full py-1.5 text-xs"
        >
          + New chat
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {sessions.length === 0 ? (
          <p className="px-2 py-3 text-center text-[10px] text-slate-400">
            No previous chats
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s._id} className="group relative">
                <button
                  type="button"
                  onClick={() => onLoad(s._id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition ${
                    s._id === activeSessionId
                      ? 'bg-cyan-50 font-semibold text-cyan-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <p className="truncate">{s.title || 'Untitled'}</p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s._id);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
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

function AiAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-700 to-slate-900 text-[10px] font-bold text-white">
      AI
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isUser
            ? 'bg-slate-200 text-slate-700'
            : 'bg-gradient-to-br from-cyan-700 to-slate-900 text-white'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-none bg-gradient-to-br from-cyan-700 to-slate-900 text-white'
            : 'rounded-tl-none border border-slate-200 bg-slate-50 text-slate-800'
        }`}
      >
        <MessageContent content={message.content} isUser={isUser} />
      </div>
    </div>
  );
}

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

export default LiquAiChatPanel;
