import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomMembersSidebar from '../components/ClassroomMembersSidebar';
import ClassroomTabs from '../components/ClassroomTabs';
import { useAuth } from '../contexts/AuthContext';
import { fetchClassroomMeta, getMemberName } from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

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
  const membersById = useMemo(() => {
    const lookup = new Map();
    for (const member of members) {
      const id = member?._id ?? member?.id;
      if (id) lookup.set(String(id), member);
    }
    return lookup;
  }, [members]);

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
        const response = await fetch(`/api/chats/${chatId}/messages?limit=100`, {
          credentials: 'include',
          signal: controller.signal
        });
        const payload = await readJsonOrThrow(response, 'Unable to load discussion');
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
      if (!silent) setMembersError('');
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chat?.name ?? 'Course Discussion');
        setMembers(chat?.members ?? []);
      } catch (metaError) {
        if (metaError.name !== 'AbortError' && !silent) {
          setMembersError(metaError.message);
        }
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

  const handleSend = async (event) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    setSending(true);
    setSendError('');
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, messageType: 'text' })
      });
      const payload = await readJsonOrThrow(response, 'Unable to send message');
      setMessages((prev) => [...prev, payload?.message ?? payload]);
      setDraft('');
    } catch (submitError) {
      setSendError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="page-surface flex justify-center px-4 py-8">
        <div className="panel-card w-full max-w-6xl rounded-3xl p-8">
          <p className="text-sm font-medium text-slate-600">Loading discussion room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-surface flex justify-center px-4 py-8">
        <div className="panel-card w-full max-w-6xl rounded-3xl p-8">
          <p className="text-rose-600">Error: {error}</p>
          <Link to="/classroom" className="mt-3 inline-block text-sm font-semibold text-cyan-700 underline">
            &larr; Back to classrooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-surface flex justify-center px-4 py-8">
      <div className="panel-card w-full max-w-6xl rounded-3xl p-4 sm:p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">{chatName}</h2>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Discussion room</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMembersDrawer(true)}
              className="btn-secondary px-4 py-2 text-xs uppercase tracking-wide lg:hidden"
            >
              Participants
            </button>
            <Link to="/classroom" className="btn-secondary px-4 py-2 text-xs uppercase tracking-wide">
              View classrooms
            </Link>
          </div>
        </div>

        <ClassroomTabs />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <div className="h-[56vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet. Start the discussion.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((message, index) => {
                    const sender = message?.sender;
                    const senderId = typeof sender === 'string' ? sender : sender?._id ?? sender?.id;
                    const senderFromMembers = senderId ? membersById.get(String(senderId)) : null;
                    const senderProfile = typeof sender === 'object' && sender !== null ? sender : senderFromMembers;
                    const senderName = getMemberName(senderProfile);
                    const isSelf =
                      senderId &&
                      (String(senderId) === String(user?._id) || String(senderId) === String(user?.id));
                    const time = new Date(message?.createdAt ?? Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div key={message?._id ?? message?.id ?? `${senderId}-${index}`} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] rounded-2xl border px-4 py-2 text-sm shadow-sm sm:max-w-[80%] ${isSelf ? 'border-cyan-200 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                          {!isSelf && <p className="mb-0.5 text-[11px] font-semibold text-slate-500">{senderName}</p>}
                          <p>{message?.content ?? '<no content>'}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:flex-row">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="input-field h-10 text-sm"
                disabled={sending}
              />
              <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
            {sendError && <p className="mt-2 text-sm text-rose-600">{sendError}</p>}
          </div>

          <ClassroomMembersSidebar
            members={members}
            membersError={membersError}
            user={user}
            className="hidden lg:block"
          />
        </div>
      </div>

      {showMembersDrawer && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <button
            type="button"
            aria-label="Close participants drawer"
            className="absolute inset-0 bg-slate-950/55"
            onClick={() => setShowMembersDrawer(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[86vw] max-w-sm overflow-y-auto bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Participants</p>
              <button
                type="button"
                onClick={() => setShowMembersDrawer(false)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
            <ClassroomMembersSidebar
              members={members}
              membersError={membersError}
              user={user}
              className="h-full rounded-xl border-slate-200 shadow-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;
