import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { readJsonOrThrow } from '../utils/http';

const NotificationsContext = createContext({
  unreadCount: 0,
  hasUnread: false,
  refreshUnread: () => Promise.resolve(),
  markSeen: () => Promise.resolve(),
});

const POLL_MS = 60_000;

export function NotificationsProvider({ children, enabled = true }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/notifications/unread-count', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await readJsonOrThrow(res, 'Could not load unread count');
      setUnreadCount(typeof data.count === 'number' ? data.count : 0);
    } catch {
      /* ignore — badge is non-critical */
    }
  }, [enabled]);

  const markSeen = useCallback(async () => {
    if (!enabled) return;
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/mark-seen', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      refreshUnread();
    }
  }, [enabled, refreshUnread]);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return undefined;
    }

    refreshUnread();
    const intervalId = window.setInterval(refreshUnread, POLL_MS);

    const onFocus = () => {
      refreshUnread();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refreshUnread]);

  const value = useMemo(
    () => ({
      unreadCount,
      hasUnread: unreadCount > 0,
      refreshUnread,
      markSeen,
    }),
    [unreadCount, refreshUnread, markSeen],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
