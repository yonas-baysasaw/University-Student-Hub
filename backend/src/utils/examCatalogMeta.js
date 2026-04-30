const TRACKS = ['engineering', 'social', 'natural'];

export const EXAM_PAPER_TYPES = [
  'exit_exam',
  'mock_exit_exam',
  'model_exit_exam',
  'final_exam',
  'midterm',
  'other',
];

/**
 * Validates academic catalog for PDF exam imports (multipart body fields).
 * @returns {string|null} Error message or null when valid.
 */
export function validateExamPdfCatalogMeta(body) {
  const track = String(body?.academicTrack || '').trim().toLowerCase();
  if (!TRACKS.includes(track)) {
    return 'Choose a field: Engineering, Social sciences, or Natural sciences.';
  }

  const dept = String(body?.department || '').trim();
  if (!dept || dept.length > 160) {
    return 'Department or discipline is required.';
  }
  if (dept === 'Other') {
    return 'Specify your department when selecting Other.';
  }

  if (!String(body?.courseSubject || '').trim()) {
    return 'Course or subject is required (e.g. Operating Systems).';
  }

  const pt = String(body?.paperType || '').trim();
  if (!EXAM_PAPER_TYPES.includes(pt)) {
    return 'Select a paper type (exit exam, mock, model, final, midterm, etc.).';
  }

  const displayTitle = String(body?.displayTitle || '').trim();
  if (displayTitle.length > 200) {
    return 'Paper title is too long (max 200 characters).';
  }

  return null;
}
