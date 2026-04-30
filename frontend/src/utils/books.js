export function mapBookToResource(book, index = 0) {
  const pyRaw = book?.publishYear;
  const publishYear =
    pyRaw === null || pyRaw === undefined || pyRaw === ''
      ? null
      : Number.isFinite(Number(pyRaw))
        ? Number(pyRaw)
        : null;

  return {
    id: book?._id ?? book?.id ?? `book-${index}`,
    bookId: book?._id ?? book?.id ?? null,
    title: book?.title ?? 'Untitled',
    category: book?.format ?? book?.category ?? book?.genre ?? 'General',
    type: book?.format ?? book?.type ?? 'Book',
    level: book?.visibility ?? book?.level ?? 'public',
    academicTrack: book?.academicTrack ?? '',
    department: book?.department ?? '',
    publishYear,
    courseSubject: book?.courseSubject ?? '',
    description: book?.description ?? '',
    bookUrl: book?.bookUrl ?? '',
    thumbnailUrl: book?.thumbnailUrl ?? '',
    likesCount: Number.isFinite(book?.likesCount) ? book.likesCount : 0,
    ragIndexStatus: book?.ragIndexStatus ?? 'idle',
    downloadsCount: Number.isFinite(book?.downloadsCount)
      ? book.downloadsCount
      : Number.isFinite(book?.downloadCount)
        ? book.downloadCount
        : Number.isFinite(book?.downloads)
          ? book.downloads
          : Number.isFinite(book?.views)
            ? book.views
            : 0,
    uploader: {
      id:
        book?.uploader?.id || book?.uploader?._id || book?.userId?._id || null,
      name:
        book?.uploader?.name ||
        book?.userId?.name ||
        book?.uploader?.username ||
        book?.userId?.username ||
        'Unknown user',
      username: book?.uploader?.username || book?.userId?.username || '',
      avatar: book?.uploader?.avatar || book?.userId?.avatar || '',
    },
    createdAt: book?.createdAt ?? '',
    saved: Boolean(book?.viewerState?.saved),
  };
}

export async function fetchLibraryBooks(signal, queryParams) {
  const qs = new URLSearchParams();
  if (queryParams && typeof queryParams === 'object') {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        qs.set(k, String(v));
      }
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`/api/books${suffix}`, {
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    throw new Error('Failed to fetch books.');
  }

  const data = await res.json();
  const books = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];
  return books.map((book, index) => mapBookToResource(book, index));
}
