import { readJsonOrThrow } from './http';

export function isInstructor(user) {
  const role = `${user?.role ?? ''}`.toLowerCase();
  return role === 'instructor' || role === 'teacher' || role === 'lecturer' || role === 'admin';
}

export function getMemberName(member) {
  return member?.username ?? member?.displayName ?? 'Member';
}

export async function fetchClassroomMeta(chatId, signal) {
  const response = await fetch('/api/chats?limit=100', {
    credentials: 'include',
    signal
  });
  const payload = await readJsonOrThrow(response, 'Unable to load classroom details');
  const chat = (payload?.chats ?? []).find((item) => item._id === chatId);
  if (!chat) {
    throw new Error('Classroom not found');
  }
  return chat;
}
