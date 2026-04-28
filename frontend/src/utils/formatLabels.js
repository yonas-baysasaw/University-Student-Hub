/** Human-readable file type from MIME types or loose strings. */
export function humanizeFormat(raw) {
  if (raw == null || raw === '') return 'Unknown';
  const v = String(raw).trim().toLowerCase();

  const MIME_MAP = {
    'application/pdf': 'PDF',
    'application/epub+zip': 'EPUB',
    'application/x-mobipocket-ebook': 'MOBI',
    'text/plain': 'Plain text',
    'text/html': 'HTML',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'Word',
    'application/vnd.ms-powerpoint': 'PowerPoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'PowerPoint',
  };

  if (MIME_MAP[v]) return MIME_MAP[v];
  if (v.includes('pdf')) return 'PDF';
  if (v.includes('epub')) return 'EPUB';
  if (v.includes('html')) return 'HTML';

  if (v.includes('/')) {
    const sub = v.split('/').pop();
    if (sub && sub.length <= 14) {
      const cleaned = sub.replace(/[^a-z0-9]+/gi, ' ').trim();
      return cleaned ? cleaned.slice(0, 1).toUpperCase() + cleaned.slice(1) : raw;
    }
  }

  const s = String(raw);
  return s.length > 28 ? `${s.slice(0, 26)}…` : s;
}

/** When category duplicates MIME/format, hide redundant row in UI. */
export function topicIfDistinct(category, formatField) {
  const cat = String(category ?? '').trim().toLowerCase();
  const fmt = String(formatField ?? '').trim().toLowerCase();
  if (!cat || cat === fmt) return null;
  return String(category).trim();
}

export function visibilityLabel(raw) {
  const v = String(raw ?? 'public').trim().toLowerCase();
  if (v === 'public') return 'Public';
  if (v === 'private') return 'Private';
  if (v === 'unlisted') return 'Unlisted';
  return String(raw || 'public');
}

/** Badge Tailwind ring/bg/text classes for visibility pills */
export function visibilityTone(raw) {
  const v = String(raw ?? 'public').trim().toLowerCase();
  if (v === 'public') {
    return 'bg-emerald-500/12 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/25';
  }
  if (v === 'private') {
    return 'bg-slate-500/12 text-slate-800 ring-slate-400/25 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-400/25';
  }
  return 'bg-amber-500/12 text-amber-900 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/25';
}

export function formatLibraryDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatLibraryDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
