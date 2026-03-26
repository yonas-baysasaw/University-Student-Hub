import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ChatRoom() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    if (!chatId) {
      setError('Chat not found');
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/chats/${chatId}/messages?limit=100`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load messages (${response.status})`);
        }
        const payload = await response.json();
        setMessages(payload.messages ?? []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    return () => controller.abort();
  }, [chatId]);

  const senderLabel = useMemo(() => sender => sender?.username ?? sender?.displayName ?? 'Unknown', []);

  const handleSend = async event => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: trimmed,
          messageType: 'text',
        }),
      });
      if (!response.ok) {
        throw new Error(`Unable to send message (${response.status})`);
      }
      const data = await response.json();
      const newMessage = data.message ?? data;
      setMessages(prev => [newMessage, ...prev]);
      setDraft('');
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center px-4 py-8">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg p-6">
          <p>Loading chat messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center px-4 py-8">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg p-6 space-y-3">
          <p className="text-red-600">Error: {error}</p>
          <Link to="/classroom" className="text-sm text-blue-600 underline">
            &larr; Back to classes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center px-4 py-8">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Chat room</h2>
          <Link to="/classroom" className="text-sm text-blue-600 underline">
            View other classrooms
          </Link>
        </div>

        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <div className="space-y-4">
            {messages.map(message => {
              const isSelf = message.sender?._id === user?._id;
              const avatar =
                message.sender?.avatar ||
                'https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg';
              const headerTime = new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const statusLabel = isSelf ? 'Delivered' : 'Seen';

              return (
                <div
                  key={message._id ?? message.id}
                  className={`chat ${isSelf ? 'chat-end' : 'chat-start'}`}
                >
                  <div className="chat-image avatar">
                    <div className="w-10 rounded-full overflow-hidden">
                      <img src={avatar} alt={`${senderLabel(message.sender)} avatar`} />
                    </div>
                  </div>
                  <div className="chat-header text-sm">
                    <span className="font-medium">{senderLabel(message.sender)}</span>
                    <time className="ml-2 text-xs opacity-50">{headerTime}</time>
                  </div>
                  <div className="chat-bubble text-sm">{message.content ?? '<no content>'}</div>
                  <div className="chat-footer opacity-50 text-xs">{statusLabel}</div>
                </div>
              );
            })}
          </div>
        )}

        <form className="flex gap-2" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Type your message"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>

        {sendError && <p className="text-sm text-red-600">{sendError}</p>}
      </div>
    </div>
  );
}

export default ChatRoom;
