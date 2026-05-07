import { readJsonOrThrow } from './http';

export async function submitContentReport({
  targetType,
  targetId,
  reasonCode,
  description,
}) {
  const res = await fetch('/api/reports', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetType,
      targetId,
      reasonCode,
      description: description ?? '',
    }),
  });
  return readJsonOrThrow(res, 'Could not submit report');
}
