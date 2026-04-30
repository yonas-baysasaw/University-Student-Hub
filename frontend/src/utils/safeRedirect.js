/** Same-origin relative path only; blocks protocol-relative and external URLs. */
export function safeInternalPath(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  return t;
}
