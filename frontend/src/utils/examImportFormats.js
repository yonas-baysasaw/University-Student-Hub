/** Client-side exam import format checks (mirrors backend allowlist). */

export const EXAM_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export const EXAM_IMPORT_ACCEPT =
  '.pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain';

const LEGACY_EXT = /\.(doc|ppt)$/i;
const ALLOWED_EXT = /\.(pdf|docx|pptx|txt)$/i;

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

export function validateExamImportFile(file) {
  if (!file) return 'No file selected.';
  const name = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();

  if (LEGACY_EXT.test(name)) {
    return 'Legacy Word (.doc) and PowerPoint (.ppt) are not supported. Save as .docx or .pptx.';
  }

  const extOk = ALLOWED_EXT.test(name);
  const mimeOk = ALLOWED_MIMES.has(mime);
  if (!extOk && !mimeOk) {
    return 'Only PDF, Word (.docx), PowerPoint (.pptx), and plain text (.txt) are allowed.';
  }

  if (file.size > EXAM_IMPORT_MAX_BYTES) {
    return 'File must be smaller than 10 MB.';
  }

  return null;
}
