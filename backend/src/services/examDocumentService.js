import officeParser from 'officeparser';
import {
  examImportRejectionMessage,
  inferExamImportKind,
  isLegacyOfficeFile,
  legacyOfficeRejectionMessage,
} from '../utils/examImportFormats.js';
import {
  analyzePDF,
  extractTextFromPDF,
} from './pdfService.js';

function cleanPlainText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function extractOfficeText(buffer, fileType) {
  const ast = await officeParser.parseOffice(buffer, { fileType });
  const result = await ast.to('text');
  return cleanPlainText(result?.value ?? ast.toText?.() ?? '');
}

/**
 * @param {Buffer} buffer
 * @param {{ mimetype?: string, originalname?: string }} meta
 * @returns {Promise<{ textContent: string, isImageBased: boolean }>}
 */
export async function extractExamDocumentContent(buffer, meta = {}) {
  const mimetype = String(meta.mimetype || '').trim();
  const originalname = String(meta.originalname || '').trim();

  if (isLegacyOfficeFile(originalname, mimetype)) {
    const err = new Error(legacyOfficeRejectionMessage());
    err.status = 400;
    throw err;
  }

  const kind = inferExamImportKind(buffer, mimetype, originalname);
  if (kind === 'unknown') {
    const err = new Error(examImportRejectionMessage());
    err.status = 400;
    throw err;
  }

  if (kind === 'txt') {
    return {
      textContent: cleanPlainText(buffer.toString('utf8')),
      isImageBased: false,
    };
  }

  if (kind === 'docx' || kind === 'pptx') {
    const textContent = await extractOfficeText(buffer, kind);
    return { textContent, isImageBased: false };
  }

  // PDF
  let isImageBased = false;
  let textContent = '';
  try {
    const analysis = await analyzePDF(buffer);
    isImageBased = analysis.isImageBased;
    if (!isImageBased) {
      textContent = await extractTextFromPDF(buffer);
    }
  } catch (pdfErr) {
    console.warn(
      'PDF analysis failed — will process without text:',
      pdfErr.message,
    );
  }

  return { textContent, isImageBased };
}
