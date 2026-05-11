/**
 * RAG-specific text splitting for embedding (separate from exam `batchService` chunking).
 * Uses a sliding window with overlap; when not at end of text, prefers breaking at
 * paragraph, then sentence-like boundaries near the max size.
 *
 * @typedef {object} RagChunkerOptions
 * @property {number} [maxChunkChars=1800]
 * @property {number} [overlapChars=200]
 * @property {number} [maxChunks=350]
 */

const DEFAULT_MAX = 1800;
const DEFAULT_OVERLAP = 200;
const DEFAULT_MAX_CHUNKS = 350;

function cleanRagText(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/^.*copyright.*$/gim, '')
    .replace(/^.*all rights reserved.*$/gim, '')
    .replace(/^.*isbn[^a-z0-9].*$/gim, '')
    .replace(/^.*packt publishing.*$/gim, '')
    .replace(/^.*publisher.*$/gim, '')
    .replace(/^.*table of contents.*$/gim, '')
    .replace(/^.*contributors?.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} raw
 */
function normalizeText(raw) {
  return cleanRagText(raw)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * If `end` is before string end, try to move `end` left to a nicer break (within `lookback` chars).
 * @param {string} t full text
 * @param {number} start
 * @param {number} end
 * @param {number} lookback
 * @returns {number}
 */
function preferBoundaryBefore(t, start, end, lookback) {
  if (end >= t.length) return end;
  const from = Math.max(start, end - lookback);
  const slice = t.slice(from, end);
  const candidates = [
    slice.lastIndexOf('\n\n'),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  ].filter((i) => i > 20);
  if (candidates.length === 0) return end;
  const best = Math.max(...candidates);
  return from + best + 2;
}

/**
 * @param {string} rawText
 * @param {RagChunkerOptions} [options]
 * @returns {string[]}
 */
export function splitTextForRagEmbedding(rawText, options = {}) {
  const maxChunkChars = options.maxChunkChars ?? DEFAULT_MAX;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP;
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;

  const t = normalizeText(rawText);
  if (!t) return [];

  const chunks = [];
  let start = 0;

  while (start < t.length && chunks.length < maxChunks) {
    let end = Math.min(start + maxChunkChars, t.length);
    if (end < t.length) {
      end = preferBoundaryBefore(t, start, end, 400);
    }
    let endAt = end;
    if (endAt <= start) {
      endAt = Math.min(start + 1, t.length);
    }
    const piece = t.slice(start, endAt).trim();
    if (piece.length) {
      chunks.push(piece);
    } else {
      start = endAt;
      continue;
    }
    if (endAt >= t.length) break;
    let next = endAt - overlapChars;
    if (next < 0) next = 0;
    if (next >= endAt) next = endAt;
    start = next;
  }

  return chunks;
}

function isLikelyHeading(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (/^(chapter|unit|part)\s+\d+/i.test(s)) return true;
  if (/^\d+(\.\d+){0,3}\s+[A-Z]/.test(s)) return true;
  if (s.length <= 90 && /^[A-Z][A-Za-z0-9,:()\-/ ]+$/.test(s)) return true;
  return false;
}

/**
 * Split by heading blocks, then soft-chunk long blocks.
 * Returns chunk records with chapter/section metadata.
 */
export function splitTextForRagWithMetadata(rawText, options = {}) {
  const t = normalizeText(rawText);
  if (!t) return [];

  const lines = t.split('\n');
  const blocks = [];
  let current = { heading: '', lines: [] };
  let activeChapter = '';

  for (const line of lines) {
    if (isLikelyHeading(line)) {
      if (current.lines.length > 0) blocks.push(current);
      const heading = String(line).trim();
      if (/^(chapter|unit|part)\s+\d+/i.test(heading)) activeChapter = heading;
      current = { heading, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  if (current.lines.length > 0) blocks.push(current);

  const out = [];
  let chunkIndex = 0;
  for (const b of blocks) {
    const blockText = b.lines.join('\n').trim();
    if (!blockText) continue;
    const pieces = splitTextForRagEmbedding(blockText, options);
    for (const piece of pieces) {
      out.push({
        chunkIndex,
        text: piece,
        chapter: /^(chapter|unit|part)\s+\d+/i.test(b.heading)
          ? b.heading
          : activeChapter,
        section: b.heading || '',
      });
      chunkIndex += 1;
    }
  }
  return out;
}
