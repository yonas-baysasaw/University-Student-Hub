/** Supported exam import formats (PDF, DOCX, PPTX, TXT). */

export const EXAM_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export const EXAM_IMPORT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

export const EXAM_IMPORT_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.txt']);

const LEGACY_OFFICE_EXTENSIONS = new Set(['.doc', '.ppt']);

const EXT_TO_KIND = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.txt': 'txt',
};

const MIME_TO_KIND = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'text/plain': 'txt',
};

function extensionOf(name) {
  const n = String(name || '').trim().toLowerCase();
  const dot = n.lastIndexOf('.');
  if (dot < 0) return '';
  return n.slice(dot);
}

export function isLegacyOfficeFile(originalname, mimetype = '') {
  const ext = extensionOf(originalname);
  if (LEGACY_OFFICE_EXTENSIONS.has(ext)) return true;
  const m = String(mimetype || '').trim().toLowerCase();
  return (
    m === 'application/msword' ||
    m === 'application/vnd.ms-powerpoint'
  );
}

export function legacyOfficeRejectionMessage() {
  return 'Legacy Word (.doc) and PowerPoint (.ppt) files are not supported. Save as .docx or .pptx and try again.';
}

export function isAllowedExamImportFile(originalname, mimetype = '') {
  if (isLegacyOfficeFile(originalname, mimetype)) return false;
  const ext = extensionOf(originalname);
  const m = String(mimetype || '').trim().toLowerCase();
  if (EXAM_IMPORT_EXTENSIONS.has(ext)) return true;
  if (EXAM_IMPORT_MIME_TYPES.has(m)) return true;
  return false;
}

export function examImportRejectionMessage() {
  return 'Only PDF, Word (.docx), PowerPoint (.pptx), and plain text (.txt) files are allowed.';
}

/**
 * @param {Buffer} buffer
 * @param {string} [mimetype]
 * @param {string} [originalname]
 * @returns {'pdf'|'docx'|'pptx'|'txt'|'unknown'}
 */
export function inferExamImportKind(buffer, mimetype = '', originalname = '') {
  if (isLegacyOfficeFile(originalname, mimetype)) return 'unknown';

  const ext = extensionOf(originalname);
  if (EXT_TO_KIND[ext]) return EXT_TO_KIND[ext];

  const m = String(mimetype || '').trim().toLowerCase();
  if (MIME_TO_KIND[m]) return MIME_TO_KIND[m];

  if (Buffer.isBuffer(buffer) && buffer.length >= 4) {
    if (buffer[0] === 0x25 && buffer[1] === 0x50) return 'pdf';
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      // ZIP-based OOXML — default to docx when extension missing
      return ext === '.pptx' ? 'pptx' : 'docx';
    }
  }

  return 'unknown';
}

/** Strip common import extensions from a display title. */
export function stripExamImportExtension(name) {
  return String(name || '')
    .replace(/\.(pdf|docx|pptx|txt)$/i, '')
    .trim();
}
