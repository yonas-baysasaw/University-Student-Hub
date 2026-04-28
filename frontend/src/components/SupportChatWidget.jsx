import { MessageCircle, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SUPPORT_QUICK_PROMPTS } from '../constants/supportPrompts';
import { readJsonOrThrow } from '../utils/http';

const WELCOME_CONTENT =
  "Hi — I'm your **USH Support** assistant. I can look at your real classrooms, announcements, resources, and more. Ask anything, or try a quick prompt below.";

const markdownComponents = {
  a: ({ href, children, ...rest }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-cyan-700 underline decoration-cyan-700/50 underline-offset-2 transition hover:text-cyan-800 dark:text-cyan-300 dark:decoration-cyan-400/50 dark:hover:text-cyan-200"
      {...rest}
    >
      {children}
    </a>
  ),
};

/** Chat + sparkles — USH Support visual mark */
function SupportBrandIcon({ className = '', size = 'md' }) {
  const main =
    size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const sparkle =
    size === 'lg' ? 'h-3.5 w-3.5' : size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  return (
    <span className={`relative inline-flex ${className}`} aria-hidden>
      <MessageCircle className={main} strokeWidth={2} />
      <Sparkles
        className={`absolute -bottom-1 -right-1 ${sparkle}`}
        strokeWidth={2.25}
      />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div
      className="support-msg-enter flex items-center gap-3 self-start"
      role="status"
      aria-label="Assistant is typing"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 ring-1 ring-cyan-500/25 dark:from-cyan-400/20 dark:to-indigo-400/12 dark:ring-cyan-400/25"
        aria-hidden
      >
        <SupportBrandIcon
          size="sm"
          className="text-cyan-700 dark:text-cyan-300"
        />
      </div>
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="support-typing-dot h-2 w-2 rounded-full bg-cyan-500/70 dark:bg-cyan-400/80"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_CONTENT,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const hasUserMessage = messages.some((m) => m.role === 'user');
  const showQuickPrompts = !hasUserMessage;
  const canClear = messages.length > 1;

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: WELCOME_CONTENT,
      },
    ]);
    setSessionId(null);
    setDraft('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — depend on message count
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length, loading]);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setDraft('');
      setLoading(true);
      try {
        const toSend = [...messagesRef.current, userMsg].map(
          ({ role, content }) => ({ role, content }),
        );
        const res = await fetch('/api/support/chat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: toSend,
            sessionId: sessionId ?? undefined,
          }),
        });
        const data = await readJsonOrThrow(res, 'Support request failed');
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.response || '',
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: e?.message
              ? `Sorry—${e.message}`
              : 'Something went wrong. Please try again.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionId],
  );

  return (
    <>
      <div
        className={`support-fab-float fixed bottom-5 right-5 z-[20000] max-md:right-4 max-md:bottom-4 ${open ? 'support-fab-float--paused' : ''}`}
      >
        <div
          className={`support-fab-ring ${open ? 'support-fab-ring--quiet' : ''}`}
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-gradient-to-br from-cyan-600 via-cyan-700 to-slate-900 text-white shadow-[0_14px_36px_rgba(8,92,116,0.45)] transition duration-300 hover:scale-105 hover:shadow-[0_18px_44px_rgba(8,92,116,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:border-cyan-400/20 dark:from-cyan-500 dark:via-cyan-600 dark:to-slate-900"
            aria-expanded={open}
            aria-label={
              open
                ? 'Close USH Support assistant'
                : 'Open USH Support assistant'
            }
          >
            {open ? (
              <span className="text-2xl font-light leading-none" aria-hidden>
                ×
              </span>
            ) : (
              <span className="text-white">
                <SupportBrandIcon size="lg" />
              </span>
            )}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="support-chat-backdrop fixed inset-0 z-[19998] cursor-default border-0 bg-slate-900/25 p-0 backdrop-blur-[2px] dark:bg-slate-950/45"
            aria-label="Close support panel"
            onClick={() => setOpen(false)}
          />

          <div
            className="support-chat-panel fixed bottom-[5.25rem] right-5 z-[20000] flex w-[min(100vw-1.25rem,26rem)] max-h-[min(78vh,36rem)] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_28px_64px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-slate-600/60 dark:bg-slate-900/95 dark:shadow-[0_28px_64px_rgba(0,0,0,0.5)] sm:w-[min(100vw-2rem,24rem)]"
            role="dialog"
            aria-modal="true"
            aria-label="USH Support assistant"
          >
            <header className="relative shrink-0 overflow-hidden border-b border-slate-100/90 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 px-4 py-3.5 dark:border-slate-700/80 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30">
              <div
                className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-cyan-400/15 blur-2xl dark:bg-cyan-400/10"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-indigo-400/10 blur-2xl dark:bg-indigo-400/8"
                aria-hidden
              />

              <div className="relative flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-slate-800 text-white shadow-lg shadow-cyan-900/25 dark:from-cyan-500 dark:to-slate-900">
                    <span className="text-white">
                      <SupportBrandIcon />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
                        USH Support
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-400/30">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                        Live
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      AI assistant — answers from your hub data
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {canClear ? (
                    <button
                      type="button"
                      onClick={resetChat}
                      className="rounded-xl px-2.5 py-1.5 text-[0.7rem] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      title="Start a new conversation"
                    >
                      New chat
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="Close"
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      ×
                    </span>
                  </button>
                </div>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white px-3 py-3 dark:from-slate-950/40 dark:to-slate-900/80">
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`support-msg-enter flex max-w-[94%] gap-2.5 ${m.role === 'user' ? 'flex-row-reverse self-end' : 'self-start'}`}
                  >
                    {m.role === 'assistant' ? (
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 ring-1 ring-cyan-500/20 dark:from-cyan-400/15 dark:to-indigo-400/10 dark:ring-cyan-400/25"
                        aria-hidden
                      >
                        <SupportBrandIcon
                          size="sm"
                          className="text-cyan-700 dark:text-cyan-300"
                        />
                      </div>
                    ) : (
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200/90 text-[0.65rem] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        aria-hidden
                      >
                        You
                      </div>
                    )}
                    <div
                      className={`min-w-0 rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        m.role === 'user'
                          ? 'border border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-sky-50/90 text-slate-900 dark:border-cyan-500/25 dark:from-cyan-950/50 dark:to-sky-950/30 dark:text-slate-100'
                          : 'border border-slate-200/90 bg-white/95 text-slate-800 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-100'
                      }`}
                    >
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                          {m.content}
                        </p>
                      ) : (
                        <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-100 prose-p:my-1.5 prose-p:text-slate-800 dark:prose-p:text-slate-100 prose-li:text-slate-800 dark:prose-li:text-slate-100 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:rounded prose-code:bg-slate-200 prose-code:text-slate-900 dark:prose-code:bg-slate-700 dark:prose-code:text-slate-100 prose-strong:text-slate-900 dark:prose-strong:text-slate-50 prose-headings:my-2 prose-headings:text-slate-900 dark:prose-headings:text-slate-50 prose-a:text-cyan-700 dark:prose-a:text-cyan-300 dark:prose-pre:bg-slate-950">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading ? <TypingIndicator /> : null}
                <div ref={bottomRef} className="h-px shrink-0" />
              </div>
            </div>

            {showQuickPrompts ? (
              <div className="shrink-0 border-t border-slate-100/90 bg-white/90 px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-900/90">
                <p className="mb-1.5 px-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Quick start
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORT_QUICK_PROMPTS.map((p) => (
                    <button
                      type="button"
                      key={p.text}
                      onClick={() => {
                        if (!loading) send(p.text);
                      }}
                      disabled={loading}
                      className={`max-w-full rounded-xl border px-2.5 py-1.5 text-left text-[0.7rem] font-semibold leading-snug shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 ${p.chipClass}`}
                    >
                      {p.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <form
              className="shrink-0 border-t border-slate-100/90 bg-white/95 p-3 dark:border-slate-700/80 dark:bg-slate-900/95"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <label htmlFor="support-chat-input" className="sr-only">
                Message to USH Support
              </label>
              <textarea
                ref={textareaRef}
                id="support-chat-input"
                className="mb-2 min-h-[3.25rem] w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-900 shadow-inner transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-900"
                rows={2}
                placeholder="Ask about classes, files, deadlines…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey) return;
                  e.preventDefault();
                  if (!loading && draft.trim()) {
                    void send(draft);
                  }
                }}
                disabled={loading}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.65rem] text-slate-600 dark:text-slate-400">
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-sans text-[0.6rem] text-slate-800 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    Enter
                  </kbd>{' '}
                  send ·{' '}
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1 font-sans text-[0.6rem] text-slate-800 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
                    Shift+Enter
                  </kbd>{' '}
                  line
                </p>
                <button
                  type="submit"
                  className="btn-primary inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm disabled:opacity-45"
                  disabled={loading || !draft.trim()}
                >
                  Send
                  <span aria-hidden className="text-base leading-none">
                    →
                  </span>
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}

export default SupportChatWidget;
