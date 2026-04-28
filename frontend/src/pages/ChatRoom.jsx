import {
  ArrowDown,
  Loader2,
  MessageSquare,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomHero from '../components/ClassroomHero';
import ClassroomMembersSidebar from '../components/ClassroomMembersSidebar';
import ClassroomTabs from '../components/ClassroomTabs';
import { useAuth } from '../contexts/AuthContext';
import { fetchClassroomMeta, getMemberName } from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

const NEAR_BOTTOM_PX = 96;

function ChatRoom() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
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

  const scrollRef = useRef(null);
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

  const handleChatScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(gap < NEAR_BOTTOM_PX);
  }, []);

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
    let intervalId = null;

    const loadMessages = async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const response = await fetch(
          `/api/chats/${chatId}/messages?limit=100`,
          {
            credentials: 'include',
            signal: controller.signal,
          },
        );
        const payload = await readJsonOrThrow(
          response,
          'Unable to load discussion',
        );
        setMessages(payload?.messages ?? []);
      } catch (loadError) {
        if (loadError.name !== 'AbortError' && !silent) {
          setError(loadError.message);
        }
      } finally {
        if (!silent) setLoading(false);
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
      } catch (metaError) {
        if (metaError.name !== 'AbortError' && !silent) {
          setMembersError(metaError.message);
        }
      } finally {
        if (!silent) setMetaLoading(false);
      }
    };

    loadMessages();
    loadMeta();
    intervalId = setInterval(() => {
      loadMessages({ silent: true });
      loadMeta({ silent: true });
    }, 5000);

    return () => {
      controller.abort();
      if (intervalId) clearInterval(intervalId);
    };
  }, [chatId]);

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
      setMessages((prev) => [...prev, payload?.message ?? payload]);
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
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/50 lg:hidden"
      >
        <Users className="h-3.5 w-3.5" aria-hidden />
        People
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

          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="relative min-h-0">
              <div
                ref={scrollRef}
                onScroll={handleChatScroll}
                className="classroom-chat-scroll relative h-[min(56vh,520px)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/40 to-white px-4 py-4 shadow-inner dark:border-slate-700 dark:from-slate-950/80 dark:via-slate-900/40 dark:to-slate-950/90 md:px-5"
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
                  <div className="space-y-3 pb-2">
                    {messages.map((message, index) => {
                      const sender = message?.sender;
                      const senderId =
                        typeof sender === 'string'
                          ? sender
                          : (sender?._id ?? sender?.id);
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
                      return (
                        <div
                          key={
                            message?._id ?? message?.id ?? `${senderId}-${index}`
                          }
                          className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[92%] rounded-2xl border px-4 py-2.5 text-sm shadow-sm transition sm:max-w-[82%] ${
                              isSelf
                                ? 'border-cyan-300/80 bg-gradient-to-br from-cyan-50 to-cyan-100/90 text-cyan-950 dark:border-cyan-700 dark:from-cyan-950/80 dark:to-slate-900 dark:text-cyan-50'
                                : 'border-slate-200/90 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100'
                            }`}
                          >
                            {!isSelf && (
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {senderName}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {message?.content ?? ''}
                            </p>
                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {time}
                            </p>
                          </div>
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

            <ClassroomMembersSidebar
              members={members}
              membersError={membersError}
              user={user}
              className="hidden lg:block"
            />
          </div>
        </div>
      </div>

      {showMembersDrawer && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <button
            type="button"
            aria-label="Close participants drawer"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setShowMembersDrawer(false)}
          />
          <div className="fade-in-up absolute right-0 top-0 h-full w-[86vw] max-w-sm overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                Participants
              </p>
              <button
                type="button"
                onClick={() => setShowMembersDrawer(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Close
              </button>
            </div>
            <ClassroomMembersSidebar
              members={members}
              membersError={membersError}
              user={user}
              className="h-full rounded-xl border-none shadow-none ring-1 ring-slate-200 dark:ring-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;
