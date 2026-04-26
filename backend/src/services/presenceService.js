const onlineCounters = new Map();
const onlineSet = new Set();

export const markOnline = async (userId) => {
  const existing = onlineCounters.get(userId) || 0;
  const next = existing + 1;
  onlineCounters.set(userId, next);
  if (next === 1) {
    onlineSet.add(userId);
  }
  return next;
};

export const markOffline = async (userId) => {
  const existing = onlineCounters.get(userId) || 0;
  const next = Math.max(existing - 1, 0);
  if (next === 0) {
    onlineCounters.delete(userId);
    onlineSet.delete(userId);
  } else {
    onlineCounters.set(userId, next);
  }
  return next;
};

export const getOnlineUsers = () => Array.from(onlineSet);
