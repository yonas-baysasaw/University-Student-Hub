import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SUPPORT_QUICK_PROMPTS } from '../constants/supportPrompts';
import { readJsonOrThrow } from '../utils/http';

const markdownComponents = {
  a: ({ href, children, ...rest }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-cyan-700 underline decoration-cyan-700/50 underline-offset-2 hover:text-cyan-800"
      {...rest}
    >
      {children}
    </a>
  ),
};

function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm the USH support assistant. I can use your real classrooms, announcements, resources, and more—ask anything or try a quick prompt below.",
    },
  ]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const hasUserMessage = messages.some((m) => m.role === 'user');
  const showQuickPrompts = !hasUserMessage;

  // Scroll when the panel opens or the thread grows
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — depend on message count
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages.length]);

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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[20000] flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200 bg-gradient-to-br from-cyan-600 to-slate-900 text-lg font-bold text-white shadow-2xl transition hover:scale-105 hover:from-cyan-500"
        aria-expanded={open}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
      >
        {open ? '×' : '?'}
      </button>

      {open ? (
        <div
          className="fixed bottom-20 right-5 z-[20000] flex w-[min(100vw-1.5rem,22rem)] max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Support chat"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Help
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate-500 hover:bg-slate-200"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm text-slate-800">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl px-3 py-2 ${
                  m.role === 'user'
                    ? 'ml-4 border border-cyan-100 bg-cyan-50'
                    : 'mr-2 border border-slate-100 bg-slate-50'
                }`}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    {m.content}
                  </p>
                ) : (
                  <div className="prose prose-sm max-w-none text-slate-800 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:bg-slate-200 prose-code:px-1 prose-code:rounded prose-headings:my-2 prose-headings:text-slate-900 prose-a:text-cyan-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading ? (
              <p className="px-1 text-xs text-slate-500">Thinking…</p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {showQuickPrompts ? (
            <div className="border-t border-slate-100/80 bg-slate-50/50 px-1.5 py-1.5">
              <p className="px-0.5 pb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">
                Try
              </p>
              <div className="grid grid-cols-2 gap-1">
                {SUPPORT_QUICK_PROMPTS.map((p) => (
                  <button
                    type="button"
                    key={p.text}
                    onClick={() => {
                      if (!loading) send(p.text);
                    }}
                    className={`rounded-lg border px-1.5 py-1 text-left text-[0.65rem] font-medium leading-snug shadow-sm transition hover:shadow ${p.chipClass}`}
                  >
                    {p.text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <form
            className="border-t border-slate-100 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <textarea
              className="mb-1 min-h-[3rem] w-full resize-none rounded-xl border border-slate-200 p-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200"
              rows={2}
              placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
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
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary rounded-full px-4 py-1.5 text-sm disabled:opacity-50"
                disabled={loading || !draft.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export default SupportChatWidget;
