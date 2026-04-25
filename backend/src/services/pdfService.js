import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// canvas is an optional native dependency required only for scanned/image-based PDFs.
// It is loaded lazily so the server starts without it when only text-based PDFs are used.
let createCanvas = null;

async function loadCanvas() {
  if (createCanvas) return createCanvas;
  try {
    const mod = await import('canvas');
    createCanvas = mod.createCanvas;
    return createCanvas;
  } catch {
    throw new Error(
      'Image extraction requires the "canvas" package. Install system dependencies (pixman, cairo, pango) then run: npm install canvas',
    );
  }
}

// pdfjs-dist legacy build required for Node.js environments.
// The worker must be pointed at the bundled worker file — an empty string causes
// "Setting up fake worker failed" because pdfjs-dist v5 no longer accepts '' as
// a way to disable the worker.
let pdfjsLib = null;

// Cached options passed to every getDocument() call
let pdfjsOptions = null;

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib = mod;

  // Resolve the worker and standard-font paths relative to pdfjs-dist in node_modules
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;

  // Pre-build the options object used for every getDocument() call
  let standardFontDataUrl;
  try {
    const fontsDir = require
      .resolve('pdfjs-dist/standard_fonts/')
      .replace(/\/[^/]+$/, '/');
    standardFontDataUrl = `file://${fontsDir}`;
  } catch {
    // Not critical — only affects font rendering warnings
  }

  pdfjsOptions = {
    verbosity: 0, // suppress "Indexing all PDF objects" noise
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  };

  return pdfjsLib;
}

function getPdfjsOptions(extra = {}) {
  return { ...(pdfjsOptions ?? {}), ...extra };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Determine if a PDF buffer is primarily image-based (scanned).
 * Returns { isImageBased: boolean, textContent?: string }
 * Ported from did-exit/js/pdf-processor.js processFile() detection logic.
 */
async function analyzePDF(buffer) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument(getPdfjsOptions({ data })).promise;

  // Sample first page
  const firstPage = await pdf.getPage(1);
  const firstTextContent = await firstPage.getTextContent();

  if (!firstTextContent.items.length) {
    return { pdf, isImageBased: true };
  }

  // Count pages with meaningful text
  const pageLengths = [
    firstTextContent.items.map((i) => i.str).join('').length,
  ];
  for (let p = 2; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    pageLengths.push(tc.items.map((i) => i.str).join('').length);
  }

  const pagesWithText = pageLengths.filter((len) => len > 50).length;
  const isImageBased = pagesWithText / pdf.numPages < 0.2;

  return { pdf, isImageBased };
}

/**
 * Extract full text from a PDF buffer.
 * Returns the cleaned text string.
 * Ported from did-exit/js/pdf-processor.js extractTextFromPDF.
 */
async function extractTextFromPDF(buffer) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument(getPdfjsOptions({ data })).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = processPageText(textContent);
      fullText += `${pageText}\n\n`;
      console.log(`Page ${pageNum} processed: ${pageText.trim().length} chars`);
    } catch (err) {
      console.warn(`Error processing page ${pageNum}:`, err);
    }
  }

  return cleanExtractedText(fullText);
}

/**
 * Render each PDF page to a PNG base64 string (for scanned/image-based PDFs).
 * Requires the `canvas` npm package.
 * Returns an array of { base64: string, mimeType: 'image/png' } objects.
 * Ported from did-exit/js/pdf-processor.js extractImagesFromPDF.
 */
async function extractImagesFromPDF(buffer) {
  const canvasCreate = await loadCanvas();
  const canvasFactory = createCanvasFactory(canvasCreate);

  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);
  const pdf = await pdfjs.getDocument(getPdfjsOptions({ data, canvasFactory }))
    .promise;
  const images = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasCreate(
      Math.floor(viewport.width),
      Math.floor(viewport.height),
    );
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    images.push({ base64, mimeType: 'image/png' });
    console.log(
      `extractImagesFromPDF: page ${pageNum}/${pdf.numPages} rendered`,
    );
  }

  return images;
}

/**
 * Generate SHA-256 hash of text content for deduplication.
 */
function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ── Internal helpers (ported verbatim from did-exit) ─────────────────────────

function processPageText(textContent) {
  let pageText = '';
  let lastY = null;

  for (const item of textContent.items) {
    const currentY = item.transform[5];
    if (lastY !== null && Math.abs(currentY - lastY) > 5) {
      pageText += '\n';
    }
    pageText += `${item.str} `;
    lastY = currentY;
  }

  return pageText.trim();
}

function cleanExtractedText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d+\s*$/gm, '')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
    .replace(/(.{100,}?)(\s)/g, '$1\n');
}

function createCanvasFactory(canvasCreate) {
  return {
    create(width, height) {
      const canvas = canvasCreate(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    },
  };
}

export { analyzePDF, extractImagesFromPDF, extractTextFromPDF, hashContent };
