export function mapBookToResource(book, index = 0) {
  return {
    id: book?._id ?? book?.id ?? `book-${index}`,
    bookId: book?._id ?? book?.id ?? null,
    title: book?.title ?? 'Untitled',
    category: book?.format ?? book?.category ?? book?.genre ?? 'General',
    type: book?.format ?? book?.type ?? 'Book',
    level: book?.visibility ?? book?.level ?? 'public',
    description: book?.description ?? '',
    bookUrl: book?.bookUrl ?? '',
    thumbnailUrl: book?.thumbnailUrl ?? '',
    likesCount: Number.isFinite(book?.likesCount) ? book.likesCount : 0,
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

export async function fetchLibraryBooks(signal) {
  const res = await fetch('/api/books', { credentials: 'include', signal });
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
