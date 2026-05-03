const TRACKS = ['engineering', 'social', 'natural'];

/**
 * Shared validation for library catalog fields (upload + PATCH metadata).
 * @returns {string|null} Error message or null when valid.
 */
export function validateBookCatalogMeta({
  academicTrack,
  department,
  title,
  publishYear,
  courseSubject,
}) {
  const track = String(academicTrack || '').trim().toLowerCase();
  if (!TRACKS.includes(track)) {
    return 'Choose a field: Engineering, Social sciences, or Natural sciences.';
  }

  const dept = String(department || '').trim();
  if (!dept || dept.length > 160) {
    return 'Department or discipline is required.';
  }
  if (dept === 'Other') {
    return 'Specify your department when selecting Other.';
  }

  const tit = String(title || '').trim();
  if (!tit || tit.length > 120) {
    return 'Book name is required (max 120 characters).';
  }

  const py =
    publishYear === '' ||
    publishYear === undefined ||
    publishYear === null ||
    Number.isNaN(publishYear)
      ? NaN
      : Number(publishYear);
  if (!Number.isFinite(py) || py < 1950 || py > 2035) {
    return 'Enter a valid publish year (1950–2035).';
  }

  if (!String(courseSubject || '').trim()) {
    return 'Course or subject is required (e.g. Operating Systems, Java).';
  }

  return null;
}

/**
 * Catalog validation for events (same rules as books, without title).
 * @returns {string|null} Error message or null when valid.
 */
export function validateEventCatalogMeta({
  academicTrack,
  department,
  publishYear,
  courseSubject,
}) {
  const track = String(academicTrack || '').trim().toLowerCase();
  if (!TRACKS.includes(track)) {
    return 'Choose a field: Engineering, Social sciences, or Natural sciences.';
  }

  const dept = String(department || '').trim();
  if (!dept || dept.length > 160) {
    return 'Department or discipline is required.';
  }
  if (dept === 'Other') {
    return 'Specify your department when selecting Other.';
  }

  const py =
    publishYear === '' ||
    publishYear === undefined ||
    publishYear === null ||
    Number.isNaN(publishYear)
      ? NaN
      : Number(publishYear);
  if (!Number.isFinite(py) || py < 1950 || py > 2035) {
    return 'Enter a valid year (1950–2035).';
  }

  if (!String(courseSubject || '').trim()) {
    return 'Course or subject is required (e.g. Operating Systems, Java).';
  }

  return null;
}

export function parsePublishYear(raw) {
  if (raw === '' || raw === undefined || raw === null) return NaN;
  return Number.parseInt(String(raw).trim(), 10);
}
