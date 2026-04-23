import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm Liqu AI, powered by Google Gemini. I can help you study, explain concepts, answer questions, or discuss topics from your coursework. How can I help you today?",
};

function LiquAI() {
  const { user } = useAuth();
  const name = user?.displayName ?? user?.username ?? 'Student';
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only needs to trigger on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setError('');
    setLoading(true);

    try {
      // Build the conversation array (exclude the static welcome id for API calls)
      const history = [
        ...messages.filter((m) => m.id !== 'welcome'),
        userMsg,
      ].map(({ role, content }) => ({ role, content }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const data = await readJsonOrThrow(res, 'AI request failed');
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([WELCOME_MESSAGE]);
    setError('');
    inputRef.current?.focus();
  }

  return (
    <div className="page-surface flex flex-col px-4 pb-6 pt-8 md:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {/* Header */}
        <section className="panel-card fade-in-up mb-4 rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                AI Assistant
              </p>
              <h1 className="mt-1 font-display text-2xl text-slate-900 md:text-3xl">
                Liqu AI
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Powered by Google Gemini · Hi, {name}
              </p>
            </div>
            <button
              type="button"
              onClick={clearChat}
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

            {loading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-700 to-slate-900 text-xs font-bold text-white">
                  AI
                </div>
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
              rows={2}
              disabled={loading}
              className="input-field flex-1 resize-none py-2.5 text-sm leading-relaxed"
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
        <MessageContent content={message.content} />
      </div>
    </div>
  );
}

function MessageContent({ content }) {
  // Render newlines and basic markdown-ish formatting without a heavy dependency
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static render of message lines
        <p key={i} className={line === '' ? 'my-1' : ''}>
          {line || '\u00A0'}
        </p>
      ))}
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
