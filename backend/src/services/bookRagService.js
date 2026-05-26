import mongoose from 'mongoose';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import BookChunk from '../models/BookChunk.js';
import Book from '../models/Books.js';
import {
  RAG_PREP_VERSION,
  MODE_RULES,
  buildContextPrefix,
  mapRagErrorToUserMessage,
  isChapterOutlineQuery,
  formatChapterOutlineReply,
  sortChapterMap,
} from '../constants/studyBuddyPrompts.js';
import {
  buildChapterMapFromChunks,
  buildChapterSummaryChunks,
  splitPagesForRagWithMetadata,
  splitTextForRagWithMetadata,
} from '../utils/bookRagChunker.js';
import {
  loadUserGeminiCredentials,
  userLikeFromCredentials,
} from '../utils/geminiUserCredentials.js';
import { ocrPdfToPages } from './bookOcrService.js';
import { extractTextFromPDF, extractTextPagesFromPDF } from './pdfService.js';
import {
  cosineSimilarity,
  embedText,
  embedTexts,
  rewriteQueryForSearch,
} from './embeddingService.js';

const CANDIDATE_K = 15;
const TOP_K_FINAL = 7;
const MIN_FUSED_SCORE = 0.25;
const MAX_CONTEXT_CHARS = 10000;
const MIN_TEXT_TO_INDEX = 200;
const INSERT_BATCH = 50;
/** Large PDFs over slow links can look “stuck” without a timeout. */
const BOOK_DOWNLOAD_TIMEOUT_MS = 120_000;
/** Log every N ms while a download (HTTP + body) is in flight — helps see “stuck on Step 1”. */
const RAG_DOWNLOAD_HEARTBEAT_MS = 20_000;

/**
 * Correlates RAG index logs: ISO time + book id + phase. Search the terminal for `[bookRag]`.
 * @param {string} bookId
 * @param {string} phase
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
function ragLog(bookId, phase, message, data) {
  const ts = new Date().toISOString();
  const line = `[bookRag] ${ts} bookId=${bookId || '—'} phase=${phase} — ${message}`;
  if (data && Object.keys(data).length) {
    console.log(line, data);
  } else {
    console.log(line);
  }
}

/**
 * @param {string} bookUrl
 * @param {number} [maxLen]
 */
function shortUrlForLog(bookUrl, maxLen = 180) {
  const s = String(bookUrl);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

/**
 * @param {URL} url
 */
function extractBucketKeyFromS3Url(url) {
  const bucket = String(ENV.AWS_BUCKET_NAME || '').trim();
  const region = String(ENV.AWS_REGION || '').trim();
  if (!bucket || !region) return null;
  const expectedHost = `${bucket}.s3.${region}.amazonaws.com`;
  if (url.hostname !== expectedHost) return null;
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (!key) return null;
  return { bucket, key };
}

/**
 * @param {string} bookUrl
 * @param {string} [logBookId]
 */
async function fetchBookBytesFromS3Url(bookUrl, logBookId = '') {
  let parsed;
  try {
    parsed = new URL(String(bookUrl));
  } catch {
    return null;
  }
  const hit = extractBucketKeyFromS3Url(parsed);
  if (!hit) return null;

  if (logBookId) {
    ragLog(logBookId, 'download', 'S3 direct read starting', {
      bucket: hit.bucket,
      keyPreview: hit.key.slice(0, 120),
    });
  }

  const obj = await s3Client.send(
    new GetObjectCommand({
      Bucket: hit.bucket,
      Key: hit.key,
    }),
  );
  let bytes = null;
  if (typeof obj.Body?.transformToByteArray === 'function') {
    bytes = await obj.Body.transformToByteArray();
  } else if (obj.Body && Symbol.asyncIterator in obj.Body) {
    const chunks = [];
    for await (const chunk of obj.Body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    bytes = Buffer.concat(chunks);
  }
  if (!bytes || bytes.length === 0) {
    throw new Error('S3 object is empty or unreadable');
  }
  if (logBookId) {
    ragLog(logBookId, 'download', 'S3 direct read complete', {
      bytes: bytes.length,
    });
  }
  return Buffer.from(bytes);
}


/**
 * Map pipeline position to 0–100%.
 * @param {'downloading' | 'downloaded' | 'extracting' | 'chunking' | 'writing'} step
 * @param {{ done?: number, total?: number }} [embed]
 */
function computeRagProgressPercent(step, embed = {}) {
  if (step === 'downloading') return 4;
  if (step === 'downloaded') return 10;
  if (step === 'extracting') return 14;
  if (step === 'chunking') return 24;
  if (step === 'writing') {
    const total = Math.max(1, Number(embed.total) || 1);
    const done = Math.min(Math.max(0, Number(embed.done) || 0), total);
    return Math.min(99, 28 + Math.floor((70 * done) / total));
  }
  return 0;
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 */
function canReadBookFilter(userId) {
  return {
    $or: [{ visibility: 'public' }, { userId }],
  };
}

function normalizeWords(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function keywordScore(query, text) {
  const qWords = normalizeWords(query);
  if (!qWords.length) return 0;
  const hay = String(text || '').toLowerCase();
  let score = 0;
  for (const w of qWords) {
    if (hay.includes(w)) score += 1;
  }
  return score / qWords.length;
}

function semanticOrKeywordScore(queryEmbedding, queryText, rowText, rowEmbedding) {
  if (
    Array.isArray(queryEmbedding) &&
    queryEmbedding.length > 0 &&
    Array.isArray(rowEmbedding) &&
    rowEmbedding.length > 0
  ) {
    return cosineSimilarity(queryEmbedding, rowEmbedding);
  }
  return keywordScore(queryText, rowText);
}

function normalizeScoredChunkRow(row) {
  return {
    text: row.text,
    score:
      typeof row.score === 'number'
        ? row.score
        : Number(row.vectorScore || row.searchScore || 0),
    chunkIndex: row.chunkIndex,
    chapter: row.chapter || '',
    section: row.section || '',
    pageStart: row.pageStart ?? null,
    pageEnd: row.pageEnd ?? null,
    book: row.book ? String(row.book) : undefined,
  };
}

function normalizeFusedScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

function selectedTextOverlapScore(selectedText, chunkText) {
  const sel = String(selectedText || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
  if (sel.length < 12) return 0;
  const hay = String(chunkText || '').toLowerCase();
  if (hay.includes(sel)) return 1;
  const words = sel.split(' ').filter((w) => w.length >= 4);
  if (!words.length) return 0;
  let hits = 0;
  for (const w of words) {
    if (hay.includes(w)) hits += 1;
  }
  return hits / words.length;
}

function applyContextBoosts(row, { pageNumber, selectedText, chapterFilter }) {
  let boost = 0;
  const chFilter = String(chapterFilter || '').trim().toLowerCase();
  if (chFilter && String(row.chapter || '').toLowerCase().includes(chFilter)) {
    boost += 0.15;
  }
  const pn = Number(pageNumber);
  if (Number.isFinite(pn) && pn > 0) {
    const ps = row.pageStart ?? null;
    const pe = row.pageEnd ?? ps;
    if (ps != null && pe != null && pn >= ps - 2 && pn <= pe + 2) {
      boost += 0.2;
    }
  }
  boost += 0.25 * selectedTextOverlapScore(selectedText, row.text);
  return boost;
}

/**
 * @param {Record<string, unknown>} filter
 * @param {string} query
 * @param {number} limit
 */
async function searchChunksByText(filter, query, limit = CANDIDATE_K) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const rows = await BookChunk.find(
      { ...filter, $text: { $search: q } },
      { score: { $meta: 'textScore' } },
    )
      .select('text chunkIndex book chapter section pageStart pageEnd embedding')
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();
    const maxText = Math.max(
      1,
      ...rows.map((r) => Number(r.score) || 0),
    );
    return rows.map((r) => ({
      book: r.book ? String(r.book) : undefined,
      text: r.text,
      chunkIndex: r.chunkIndex,
      chapter: r.chapter || '',
      section: r.section || '',
      pageStart: r.pageStart ?? null,
      pageEnd: r.pageEnd ?? null,
      embedding: r.embedding,
      textScore: normalizeFusedScore((Number(r.score) || 0) / maxText),
      vectorScore: 0,
    }));
  } catch {
    return [];
  }
}

function fuseCandidateRows(vectorRows, textRows) {
  const byKey = new Map();
  const add = (row, source) => {
    const bookPart = row.book ? String(row.book) : '';
    const key = `${bookPart}::${row.chunkIndex ?? 0}`;
    const existing = byKey.get(key) || {
      ...row,
      vectorScore: 0,
      textScore: 0,
    };
    if (source === 'vector') {
      existing.vectorScore = Math.max(
        existing.vectorScore,
        normalizeFusedScore(row.score ?? row.vectorScore ?? 0),
      );
    } else {
      existing.textScore = Math.max(existing.textScore, row.textScore ?? 0);
    }
    existing.text = row.text;
    existing.chapter = row.chapter || existing.chapter || '';
    existing.section = row.section || existing.section || '';
    existing.pageStart = row.pageStart ?? existing.pageStart ?? null;
    existing.pageEnd = row.pageEnd ?? existing.pageEnd ?? null;
    existing.embedding = row.embedding ?? existing.embedding;
    byKey.set(key, existing);
  };
  for (const r of vectorRows || []) add(r, 'vector');
  for (const r of textRows || []) add(r, 'text');
  return [...byKey.values()].map((r) => ({
    ...r,
    score: normalizeFusedScore(0.6 * r.vectorScore + 0.4 * r.textScore),
  }));
}

function selectWithMMR(candidates, limit, lambda = 0.7) {
  const pool = [...candidates].sort((a, b) => b.score - a.score);
  if (pool.length <= limit) return pool;
  const selected = [];
  const used = new Set();
  while (selected.length < limit && selected.length < pool.length) {
    let best = null;
    let bestVal = -Infinity;
    for (const c of pool) {
      const key = `${c.book || ''}::${c.chunkIndex}`;
      if (used.has(key)) continue;
      let simToSelected = 0;
      for (const s of selected) {
        simToSelected = Math.max(
          simToSelected,
          keywordScore(c.text, s.text),
        );
      }
      const val = lambda * c.score - (1 - lambda) * simToSelected;
      if (val > bestVal) {
        bestVal = val;
        best = c;
      }
    }
    if (!best) break;
    used.add(`${best.book || ''}::${best.chunkIndex}`);
    selected.push(best);
  }
  return selected;
}

function formatContextBlock(s, bookTitle) {
  const pageLabel =
    s.pageStart && s.pageEnd
      ? s.pageStart === s.pageEnd
        ? ` | Page ${s.pageStart}`
        : ` | Pages ${s.pageStart}-${s.pageEnd}`
      : '';
  const chapterLabel = s.chapter ? ` | Chapter: ${s.chapter}` : '';
  const sectionLabel = s.section ? ` | Section: ${s.section}` : '';
  const bookLabel = bookTitle ? `Book: ${bookTitle} | ` : '';
  return `[${bookLabel}Excerpt #${(s.chunkIndex ?? 0) + 1}${pageLabel}${chapterLabel}${sectionLabel}]\n${s.text}`;
}

function buildContextFromSelected(selected, bookTitle) {
  let combined = '';
  const included = [];
  for (const s of selected) {
    const block = formatContextBlock(s, bookTitle);
    if (combined.length + block.length + 2 > MAX_CONTEXT_CHARS) break;
    combined = combined ? `${combined}\n\n${block}` : block;
    included.push(s);
  }
  return { combined, included };
}

/**
 * @param {object} opts
 */
async function hybridRetrieveChunks(opts) {
  const {
    filter,
    query,
    messages = [],
    embedCredentials = null,
    pageNumber = null,
    selectedText = '',
    chapterFilter = '',
    bookTitle = '',
    bookId = '',
    bookUrl = '',
    titleById = null,
    urlById = null,
  } = opts;

  const rewrittenQuery = await rewriteQueryForSearch(query, messages);
  let queryEmbedding = null;
  try {
    queryEmbedding = await embedText(rewrittenQuery, embedCredentials);
  } catch {
    queryEmbedding = null;
  }

  const vectorRows = await searchChunksByVector({
    filter,
    queryEmbedding,
    limit: CANDIDATE_K,
  });

  let fallbackRows = [];
  if (!Array.isArray(vectorRows)) {
    const mongoFilter = { ...filter };
    fallbackRows = await BookChunk.find(mongoFilter)
      .select('text chunkIndex book chapter section pageStart pageEnd embedding')
      .lean();
    fallbackRows = fallbackRows
      .map((r) => ({
        book: r.book ? String(r.book) : undefined,
        text: r.text,
        score: semanticOrKeywordScore(
          queryEmbedding,
          rewrittenQuery,
          r.text,
          r.embedding,
        ),
        chunkIndex: r.chunkIndex,
        chapter: r.chapter || '',
        section: r.section || '',
        pageStart: r.pageStart ?? null,
        pageEnd: r.pageEnd ?? null,
        embedding: r.embedding,
        vectorScore: semanticOrKeywordScore(
          queryEmbedding,
          rewrittenQuery,
          r.text,
          r.embedding,
        ),
        textScore: 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATE_K);
  }

  const textRows = await searchChunksByText(filter, rewrittenQuery, CANDIDATE_K);
  const fused = fuseCandidateRows(
    Array.isArray(vectorRows) ? vectorRows : fallbackRows,
    textRows,
  );

  const boosted = fused.map((r) => ({
    ...r,
    score: normalizeFusedScore(
      r.score + applyContextBoosts(r, { pageNumber, selectedText, chapterFilter }),
    ),
  }));

  const chFilter = String(chapterFilter || '').trim().toLowerCase();
  const filtered = chFilter
    ? boosted.filter(
        (r) =>
          String(r.chapter || '').toLowerCase().includes(chFilter) ||
          String(r.section || '').toLowerCase().includes(chFilter) ||
          String(r.text || '').toLowerCase().includes(chFilter.slice(0, 24)),
      )
    : boosted;

  filtered.sort((a, b) => b.score - a.score);
  const pool = filtered.length ? filtered : boosted;
  if (pool.length && pool[0].score < MIN_FUSED_SCORE) {
    return {
      context: null,
      reason: 'low_confidence',
      references: [],
      bookTitle,
    };
  }

  const selected = selectWithMMR(pool, TOP_K_FINAL);
  const { combined, included } = buildContextFromSelected(
    selected,
    titleById ? null : bookTitle,
  );

  if (!combined) {
    return { context: null, reason: 'empty', references: [], bookTitle };
  }

  console.log(
    `[bookRag] hybrid top=${included.length} best=${included[0]?.score?.toFixed(3) ?? '0'} query="${previewText(query, 120)}"`,
  );

  const references = included.map((s) => {
    const bid = s.book || bookId;
    return {
      bookId: String(bid),
      bookTitle: titleById?.get(String(bid)) || bookTitle || 'Untitled',
      bookUrl: urlById?.get(String(bid)) || bookUrl || '',
      chunkIndex: s.chunkIndex ?? 0,
      excerptNumber: (s.chunkIndex ?? 0) + 1,
      score: s.score,
      chapter: s.chapter || '',
      section: s.section || '',
      pageStart: s.pageStart ?? null,
      pageEnd: s.pageEnd ?? null,
    };
  });

  return {
    context: combined,
    reason: 'ok',
    references,
    bookTitle,
  };
}

async function searchChunksByVector({
  filter = {},
  queryEmbedding,
  limit = CANDIDATE_K,
}) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return null;
  const indexName = String(ENV.RAG_VECTOR_INDEX_NAME || '').trim();
  if (!indexName) return null;
  try {
    const rows = await BookChunk.aggregate([
      {
        $vectorSearch: {
          index: indexName,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.max(50, limit * 10),
          limit,
          filter,
        },
      },
      {
        $project: {
          _id: 0,
          book: 1,
          chunkIndex: 1,
          text: 1,
          chapter: 1,
          section: 1,
          pageStart: 1,
          pageEnd: 1,
          vectorScore: { $meta: 'vectorSearchScore' },
        },
      },
    ]);
    return Array.isArray(rows) ? rows.map(normalizeScoredChunkRow) : [];
  } catch (err) {
    const msg = String(err?.message || '');
    if (
      msg.includes('$vectorSearch') ||
      msg.toLowerCase().includes('atlas') ||
      msg.toLowerCase().includes('index')
    ) {
      console.warn('[bookRag] vector search unavailable; falling back:', msg);
      return null;
    }
    throw err;
  }
}

function previewText(text, max = 180) {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}...`;
}

function removeRepeatedHeaderFooter(linesByPage) {
  if (!Array.isArray(linesByPage) || linesByPage.length < 3) return linesByPage;
  const headFreq = new Map();
  const footFreq = new Map();
  for (const p of linesByPage) {
    const first = String(p?.lines?.[0] || '').trim();
    const last = String(p?.lines?.[p.lines.length - 1] || '').trim();
    if (first) headFreq.set(first, (headFreq.get(first) || 0) + 1);
    if (last) footFreq.set(last, (footFreq.get(last) || 0) + 1);
  }
  const minRepeat = Math.ceil(linesByPage.length * 0.4);
  const badHeads = new Set(
    [...headFreq.entries()].filter(([, c]) => c >= minRepeat).map(([k]) => k),
  );
  const badFeet = new Set(
    [...footFreq.entries()].filter(([, c]) => c >= minRepeat).map(([k]) => k),
  );
  return linesByPage.map((p) => {
    const lines = [...p.lines];
    if (lines.length && badHeads.has(String(lines[0]).trim())) lines.shift();
    if (lines.length && badFeet.has(String(lines[lines.length - 1]).trim())) {
      lines.pop();
    }
    return { ...p, lines };
  });
}

function cleanPageTextForRag(t) {
  return String(t || '')
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
 * @param {Buffer} buffer
 * @param {string} [hintUrl]
 */
async function textFromBuffer(buffer, hintUrl = '') {
  const u = (hintUrl || '').toLowerCase();
  if (u.endsWith('.pdf') || u.includes('application/pdf')) {
    const pages = await extractTextPagesFromPDF(buffer);
    const linesByPage = pages.map((p) => ({
      pageNumber: p.pageNumber,
      lines: String(p.text || '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
    }));
    const stripped = removeRepeatedHeaderFooter(linesByPage);
    const cleanedPages = stripped
      .map((p) => ({
        pageNumber: p.pageNumber,
        text: cleanPageTextForRag(p.lines.join('\n')),
      }))
      .filter((p) => p.text.length > 0);
    const text = cleanedPages.map((p) => p.text).join('\n\n');
    return { text, pages: cleanedPages };
  }
  if (u.endsWith('.txt') || u.includes('text/plain')) {
    const text = cleanPageTextForRag(buffer.toString('utf8'));
    return { text, pages: [] };
  }
  if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50) {
    const text = await extractTextFromPDF(buffer);
    return { text: cleanPageTextForRag(text), pages: [] };
  }
  return { text: cleanPageTextForRag(buffer.toString('utf8')), pages: [] };
}

/**
 * @param {string} bookUrl
 * @param {number} [timeoutMs]
 * @param {string} [logBookId] — when set, adds heartbeat + step timing logs
 */
export async function fetchBookBytes(
  bookUrl,
  timeoutMs = BOOK_DOWNLOAD_TIMEOUT_MS,
  logBookId = '',
) {
  const s3Bytes = await fetchBookBytesFromS3Url(bookUrl, logBookId);
  if (s3Bytes) return s3Bytes;

  const tAll = Date.now();
  const u = String(bookUrl);
  if (logBookId) {
    ragLog(logBookId, 'download', 'HTTP GET (fetch) starting', {
      url: shortUrlForLog(u),
      timeoutSec: Math.round(timeoutMs / 1000),
    });
  }
  const heart =
    logBookId &&
    setInterval(() => {
      ragLog(
        logBookId,
        'download',
        'still waiting (TCP / HTTP headers / response body)…',
        {
          elapsedSec: Math.round((Date.now() - tAll) / 1000),
          hint: 'Stuck here usually = slow network, huge file, or server not reading body from storage.',
        },
      );
    }, RAG_DOWNLOAD_HEARTBEAT_MS);
  const controller = new AbortController();
  const abortT = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    try {
      res = await fetch(u, {
        redirect: 'follow',
        headers: { 'User-Agent': 'University-Student-Hub/1.0' },
        signal: controller.signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error(
          `Book download timed out after ${Math.round(timeoutMs / 1000)}s. Check the file URL, size, or network.`,
        );
      }
      if (logBookId) {
        ragLog(logBookId, 'download', 'fetch() threw (network / DNS / TLS)', {
          name: e?.name,
          message: e?.message,
        });
      }
      throw e;
    } finally {
      clearTimeout(abortT);
    }
    const tAfterHeaders = Date.now();
    if (logBookId) {
      ragLog(
        logBookId,
        'download',
        'HTTP response received; reading body (arrayBuffer)',
        {
          status: res.status,
          ok: res.ok,
          msToHeaders: tAfterHeaders - tAll,
        },
      );
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (logBookId) {
        ragLog(logBookId, 'download', 'non-OK response', {
          status: res.status,
          bodyPreview: errText?.slice(0, 200),
        });
      }
      throw new Error(
        `Failed to download book: HTTP ${res.status} ${res.statusText || ''}`.trim(),
      );
    }
    const ab = await res.arrayBuffer();
    const tDone = Date.now();
    if (logBookId) {
      ragLog(logBookId, 'download', 'body read complete', {
        bytes: ab.byteLength,
        msToReadBody: tDone - tAfterHeaders,
        totalMs: tDone - tAll,
      });
    }
    if (!ab.byteLength) {
      throw new Error('Downloaded file is empty');
    }
    return Buffer.from(ab);
  } finally {
    if (heart) {
      clearInterval(heart);
    }
  }
}

/**
 * @param {import('mongoose').Types.ObjectId} bookObjectId
 * @param {Record<string, unknown>} patch
 */
async function patchBookRagFields(bookObjectId, patch) {
  await Book.findByIdAndUpdate(bookObjectId, { $set: patch });
}

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function findAccessibleBookDocument(bookId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return null;
  }
  return Book.findOne({
    _id: bookId,
    ...canReadBookFilter(userId),
  });
}

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function findAccessibleBookLean(bookId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return null;
  }
  return Book.findOne({
    _id: bookId,
    ...canReadBookFilter(userId),
  })
    .select('title bookUrl userId ragIndexStatus')
    .lean();
}

/**
 * Long-running: download → text → RAG chunk → embed each chunk. Updates `Book` progress fields.
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function runRagIndexPipeline(bookId, userId) {
  const bid = new mongoose.Types.ObjectId(String(bookId));
  ragLog(String(bookId), 'pipeline', 'runRagIndexPipeline entered');

  const credentials = userLikeFromCredentials(
    await loadUserGeminiCredentials(userId),
  );

  const bookDoc = await findAccessibleBookDocument(bookId, userId);
  if (!bookDoc) {
    ragLog(
      String(bookId),
      'pipeline',
      'aborted: book not found or access denied (race or invalid claim)',
    );
    return;
  }

  try {
    await patchBookRagFields(bid, {
      ragIndexPhase: 'downloading',
      ragIndexProgressPercent: computeRagProgressPercent('downloading'),
    });
    ragLog(
      String(bookId),
      'downloading',
      'DB phase=downloading; about to download bytes',
      {
        bookUrl: shortUrlForLog(String(bookDoc.bookUrl || '')),
      },
    );

    const bytes = await fetchBookBytes(
      bookDoc.bookUrl,
      BOOK_DOWNLOAD_TIMEOUT_MS,
      String(bookId),
    );
    await patchBookRagFields(bid, {
      ragIndexPhase: 'extracting',
      ragIndexProgressPercent: computeRagProgressPercent('downloaded'),
    });
    ragLog(
      String(bookId),
      'extracting',
      'bytes on disk; starting textFromBuffer (PDF/txt)',
      {
        sizeBytes: bytes.length,
      },
    );

    await patchBookRagFields(bid, {
      ragIndexProgressPercent: computeRagProgressPercent('extracting'),
    });

    const tExtract = Date.now();
    let extracted = await textFromBuffer(bytes, bookDoc.bookUrl);
    let text = extracted?.text || '';
    let pages = Array.isArray(extracted?.pages) ? extracted.pages : [];

    if (!text || text.trim().length < MIN_TEXT_TO_INDEX) {
      ragLog(String(bookId), 'extracting', 'text thin — trying OCR');
      try {
        const ocr = await ocrPdfToPages(bytes, credentials);
        if (ocr?.pages?.length) {
          pages = ocr.pages.map((p) => ({
            pageNumber: p.pageNumber,
            text: cleanPageTextForRag(p.text),
          }));
          text = pages.map((p) => p.text).join('\n\n');
          extracted = { text, pages };
        }
      } catch (ocrErr) {
        ragLog(String(bookId), 'extracting', 'OCR failed', {
          message: ocrErr?.message,
        });
      }
    }

    ragLog(String(bookId), 'extracting', 'textFromBuffer finished', {
      ms: Date.now() - tExtract,
      textChars: text?.length ?? 0,
      pageCount: pages.length,
    });
    if (!text || text.trim().length < MIN_TEXT_TO_INDEX) {
      ragLog(
        String(bookId),
        'chunking',
        'failed: text too short after extract',
        {
          minRequired: MIN_TEXT_TO_INDEX,
          got: text?.trim().length ?? 0,
        },
      );
      await patchBookRagFields(bid, {
        ragIndexStatus: 'failed',
        ragIndexPhase: '',
        ragIndexError: mapRagErrorToUserMessage(
          'Not enough extractable text (scanned PDFs or unsupported format).',
        ),
        ragIndexTotalChunks: 0,
        ragIndexDoneChunks: 0,
        ragIndexProgressPercent: 0,
      });
      return;
    }

    await patchBookRagFields(bid, {
      ragIndexPhase: 'chunking',
      ragIndexProgressPercent: computeRagProgressPercent('chunking'),
    });
    const tChunk = Date.now();
    let pieces =
      pages.length > 0
        ? splitPagesForRagWithMetadata(pages)
        : splitTextForRagWithMetadata(text);

    let chapterMap = buildChapterMapFromChunks(pieces);
    if (pieces.length >= 800 && pages.length > 0) {
      const summaries = buildChapterSummaryChunks(
        chapterMap,
        pages,
        pieces.length,
      );
      pieces = [...pieces.slice(0, 780), ...summaries];
    }

    ragLog(String(bookId), 'chunking', 'chunking done', {
      pieces: pieces.length,
      ms: Date.now() - tChunk,
      chapters: chapterMap.length,
    });
    if (pieces.length === 0) {
      await patchBookRagFields(bid, {
        ragIndexStatus: 'failed',
        ragIndexPhase: '',
        ragIndexError: 'No text chunks could be built for this file.',
        ragIndexTotalChunks: 0,
        ragIndexDoneChunks: 0,
        ragIndexProgressPercent: 0,
      });
      return;
    }

    await BookChunk.deleteMany({ book: bid });
    await patchBookRagFields(bid, {
      ragIndexPhase: 'writing',
      ragIndexTotalChunks: pieces.length,
      ragIndexDoneChunks: 0,
      ragIndexProgressPercent: computeRagProgressPercent('chunking'),
    });
    const logEvery = Math.max(1, Math.floor(pieces.length / 8));
    const tEmb = Date.now();
    ragLog(
      String(bookId),
      'writing',
      'batch embed + insert start',
      {
        totalChunks: pieces.length,
        logEachApprox: logEvery,
      },
    );

    const embeddings = await embedTexts(
      pieces.map((p) => p.text),
      credentials,
      5,
    );

    for (let batchStart = 0; batchStart < pieces.length; batchStart += INSERT_BATCH) {
      const batch = pieces.slice(batchStart, batchStart + INSERT_BATCH);
      const docs = batch.map((piece, j) => {
        const i = batchStart + j;
        return {
          book: bid,
          chunkIndex: piece.chunkIndex ?? i,
          text: piece.text.slice(0, 20000),
          chapter: piece.chapter || '',
          section: piece.section || '',
          pageStart: piece.pageStart ?? null,
          pageEnd: piece.pageEnd ?? null,
          embedding: embeddings[i] || [],
        };
      });
      await BookChunk.insertMany(docs, { ordered: false });
      const done = Math.min(batchStart + batch.length, pieces.length);
      if (done === 1 || done % logEvery === 0 || done === pieces.length) {
        ragLog(String(bookId), 'writing', 'batch written', {
          at: done,
          of: pieces.length,
          elapsedSec: Math.round((Date.now() - tEmb) / 1000),
        });
      }
      await patchBookRagFields(bid, {
        ragIndexDoneChunks: done,
        ragIndexProgressPercent: computeRagProgressPercent('writing', {
          done,
          total: pieces.length,
        }),
      });
    }

    ragLog(String(bookId), 'writing', 'all chunks written', {
      totalMs: Date.now() - tEmb,
    });
    await patchBookRagFields(bid, {
      ragIndexStatus: 'ready',
      ragIndexPhase: '',
      ragIndexError: '',
      ragIndexedAt: new Date(),
      ragIndexProgressPercent: 100,
      ragPageCount: pages.length || null,
      ragChapterMap: chapterMap,
      ragPrepVersion: RAG_PREP_VERSION,
    });
    ragLog(String(bookId), 'ready', 'ragIndexStatus=ready');
  } catch (e) {
    const msg = e?.message || 'Indexing failed';
    ragLog(String(bookId), 'error', 'caught; marking book failed', {
      message: msg,
      name: e?.name,
    });
    console.error(`[bookRag] index pipeline failed for ${bookId}:`, e);
    await patchBookRagFields(bid, {
      ragIndexStatus: 'failed',
      ragIndexPhase: '',
      ragIndexError: mapRagErrorToUserMessage(msg),
      ragIndexProgressPercent: 0,
    });
  }
}

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 * @returns {Promise<{ error?: string, code?: string, status?: object, started?: boolean, bookId?: string }>}
 */
export async function scheduleRagIndexForBook(bookId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return { error: 'Invalid book id' };
  }

  const claimed = await Book.findOneAndUpdate(
    {
      _id: bookId,
      ...canReadBookFilter(userId),
      ragIndexStatus: { $ne: 'indexing' },
    },
    {
      $set: {
        ragIndexStatus: 'indexing',
        ragIndexPhase: 'downloading',
        ragIndexError: '',
        ragIndexTotalChunks: 0,
        ragIndexDoneChunks: 0,
        ragIndexProgressPercent: 0,
      },
    },
    { returnDocument: 'after', select: 'title' },
  );

  if (!claimed) {
    const existing = await findAccessibleBookLean(bookId, userId);
    if (!existing) {
      return { error: 'Book not found or access denied' };
    }
    if (existing.ragIndexStatus === 'indexing') {
      const full = await Book.findById(bookId)
        .select(
          'ragIndexPhase ragIndexTotalChunks ragIndexDoneChunks ragIndexError ragIndexProgressPercent title',
        )
        .lean();
      return {
        error: 'This book is already being indexed. Wait for it to finish.',
        code: 'busy',
        status: {
          ragIndexStatus: 'indexing',
          ragIndexPhase: full?.ragIndexPhase,
          ragIndexTotalChunks: full?.ragIndexTotalChunks ?? 0,
          ragIndexDoneChunks: full?.ragIndexDoneChunks ?? 0,
          ragIndexProgressPercent: full?.ragIndexProgressPercent ?? 0,
          title: full?.title,
        },
      };
    }
    return {
      error: 'Could not start indexing. Try again in a moment.',
    };
  }

  setImmediate(() => {
    ragLog(
      String(bookId),
      'schedule',
      'setImmediate fired — starting runRagIndexPipeline (async after 202 response)',
    );
    void runRagIndexPipeline(String(bookId), userId);
  });

  return { started: true, bookId: String(bookId) };
}

function buildChapterOutlineFromMap(bookTitle, chapterMap, bookId, bookUrl) {
  const chapters = sortChapterMap(chapterMap).filter((ch) =>
    String(ch?.title || '').trim(),
  );
  if (!chapters.length) return null;

  const lines = chapters.map((ch, i) => {
    const title = String(ch.title).trim();
    const ps = ch.pageStart;
    const pe = ch.pageEnd;
    let pageSuffix = '';
    if (ps != null && Number.isFinite(Number(ps))) {
      if (pe != null && Number.isFinite(Number(pe)) && pe !== ps) {
        pageSuffix = ` (pages ${ps}–${pe})`;
      } else {
        pageSuffix = ` (page ${ps})`;
      }
    }
    return `${i + 1}. ${title}${pageSuffix}`;
  });

  const heading = bookTitle?.trim()
    ? `Chapter outline for **${bookTitle.trim()}**`
    : 'Chapter outline for this book';

  const firstPage = chapters.find((ch) => ch.pageStart != null)?.pageStart ?? null;
  const lastPage =
    [...chapters].reverse().find((ch) => ch.pageEnd != null)?.pageEnd ?? firstPage;

  return {
    context: `${heading}:\n\n${lines.join('\n')}`,
    directResponse: formatChapterOutlineReply(bookTitle, chapters),
    references: [
      {
        bookId: String(bookId),
        bookTitle: bookTitle || 'Untitled',
        bookUrl: String(bookUrl || ''),
        chunkIndex: 0,
        excerptNumber: 1,
        score: 1,
        chapter: '',
        section: 'Chapter outline',
        pageStart: firstPage,
        pageEnd: lastPage,
      },
    ],
  };
}

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {string} query
 * @param {object} [opts]
 */
export async function buildRagContextForQuery(bookId, userId, query, opts = {}) {
  const book = await Book.findOne({
    _id: bookId,
    ...canReadBookFilter(userId),
  })
    .select('title bookUrl ragChapterMap')
    .lean();

  if (!book) {
    return {
      context: null,
      bookTitle: null,
      reason: 'no_access',
      references: [],
    };
  }

  const chunkCount = await BookChunk.countDocuments({ book: bookId });
  if (chunkCount === 0) {
    return {
      context: null,
      bookTitle: book.title,
      reason: 'not_indexed',
      references: [],
    };
  }

  if (
    isChapterOutlineQuery(query) &&
    Array.isArray(book.ragChapterMap) &&
    book.ragChapterMap.length > 0
  ) {
    const outline = buildChapterOutlineFromMap(
      book.title,
      book.ragChapterMap,
      bookId,
      book.bookUrl,
    );
    if (outline) {
      console.log(
        `[bookRag] chapter outline from ragChapterMap (${book.ragChapterMap.length} chapters) query="${previewText(query, 120)}"`,
      );
      return {
        context: outline.context,
        bookTitle: book.title,
        reason: 'chapter_outline',
        references: outline.references,
        directResponse: outline.directResponse,
      };
    }
  }

  const credentials = userLikeFromCredentials(
    await loadUserGeminiCredentials(userId),
  );

  return hybridRetrieveChunks({
    filter: { book: new mongoose.Types.ObjectId(String(bookId)) },
    query,
    messages: opts.messages || [],
    embedCredentials: credentials,
    pageNumber: opts.pageNumber,
    selectedText: opts.selectedText,
    chapterFilter: opts.chapterFilter,
    bookTitle: book.title,
    bookId: String(bookId),
    bookUrl: String(book.bookUrl || ''),
  });
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {string} query
 * @param {object} [opts]
 */
export async function buildGeneralRagContextForQuery(userId, query, opts = {}) {
  const books = await Book.find(canReadBookFilter(userId))
    .select('_id title bookUrl')
    .lean();
  if (books.length === 0) {
    return { context: null, reason: 'no_books', references: [] };
  }

  const bookIds = books.map((b) => b._id);
  const titleById = new Map(
    books.map((b) => [String(b._id), b.title || 'Untitled']),
  );
  const urlById = new Map(
    books.map((b) => [String(b._id), String(b.bookUrl || '')]),
  );

  const chunkCount = await BookChunk.countDocuments({ book: { $in: bookIds } });
  if (chunkCount === 0) {
    return { context: null, reason: 'not_indexed', references: [] };
  }

  const credentials = userLikeFromCredentials(
    await loadUserGeminiCredentials(userId),
  );

  return hybridRetrieveChunks({
    filter: { book: { $in: bookIds } },
    query,
    messages: opts.messages || [],
    embedCredentials: credentials,
    titleById,
    urlById,
  });
}

/**
 * @param { Array<{ role: string, content: string }> } messages
 * @param {string} [bookId]
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {string} [mode]
 * @param {object} [opts]
 */
export async function augmentMessagesWithBookRag(
  messages,
  bookId,
  userId,
  mode = 'chat',
  opts = {},
) {
  if (
    !bookId ||
    !String(bookId).trim() ||
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return {
      messages,
      ragUsed: false,
      ragNote: null,
      references: [],
      grounding: 'none',
    };
  }

  const last = messages.at(-1);
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    return {
      messages,
      ragUsed: false,
      ragNote: null,
      references: [],
      grounding: 'none',
    };
  }

  const { context, bookTitle, reason, references, directResponse } =
    await buildRagContextForQuery(String(bookId), userId, last.content, {
      messages,
      pageNumber: opts.pageNumber,
      selectedText: opts.selectedText,
      chapterFilter: opts.chapterFilter,
    });

  if (reason === 'not_indexed') {
    return {
      messages: [...messages],
      ragUsed: false,
      ragNote: 'index_required',
      references: [],
      grounding: 'none',
      directResponse: null,
    };
  }

  if (directResponse) {
    return {
      messages: [...messages],
      ragUsed: true,
      ragNote: 'chapter_outline',
      references: references || [],
      grounding: 'book',
      directResponse,
    };
  }

  if (!context) {
    return {
      messages: [...messages],
      ragUsed: false,
      ragNote: reason,
      references: [],
      grounding: 'none',
      directResponse: null,
    };
  }

  const modeKey = String(mode || 'chat').toLowerCase();
  const modeRule = MODE_RULES[modeKey] || MODE_RULES.chat;
  const effectiveMode = reason === 'chapter_outline' ? 'chapter_outline' : modeKey;
  const prefix = buildContextPrefix({
    bookTitle,
    mode: effectiveMode,
    modeRule,
    context,
    indexRequired: false,
    lowConfidence: reason === 'low_confidence',
  });
  const out = messages.slice(0, -1).map((m) => ({ ...m }));
  out.push({ role: 'user', content: `${prefix}${last.content}` });
  return {
    messages: out,
    ragUsed: true,
    ragNote: reason === 'low_confidence' ? 'low_confidence' : 'ok',
    references,
    grounding: 'book',
    directResponse: null,
  };
}

/**
 * @param {{ ragIndexProgressPercent?: number, ragIndexPhase?: string, ragIndexTotalChunks?: number, ragIndexDoneChunks?: number } | null | undefined} book
 */
function legacyRagIndexPercentEstimate(book) {
  const p = book?.ragIndexProgressPercent;
  if (typeof p === 'number' && p >= 0 && p <= 100) {
    return p;
  }
  const ph = book.ragIndexPhase || '';
  const t = book.ragIndexTotalChunks ?? 0;
  const d = book.ragIndexDoneChunks ?? 0;
  if ((ph === 'embedding' || ph === 'writing') && t > 0) {
    return Math.min(99, 28 + Math.floor((70 * d) / t));
  }
  if (ph === 'downloading') return 4;
  if (ph === 'extracting') return 14;
  if (ph === 'chunking') return 24;
  return 0;
}

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function getRagIndexStatus(bookId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return { error: 'Invalid book id' };
  }
  const book = await Book.findOne({
    _id: bookId,
    ...canReadBookFilter(userId),
  })
    .select(
      'title ragIndexStatus ragIndexPhase ragIndexTotalChunks ragIndexDoneChunks ragIndexError ragIndexedAt ragIndexProgressPercent ragPageCount ragChapterMap ragPrepVersion',
    )
    .lean();
  if (!book) {
    return { error: 'Book not found or access denied' };
  }
  const n = await BookChunk.countDocuments({ book: bookId });
  let displayStatus = book.ragIndexStatus || 'idle';
  if (displayStatus === 'idle' && n > 0) {
    displayStatus = 'ready';
  }
  return {
    bookId: String(bookId),
    title: book.title,
    chunkCount: n,
    ragIndexStatus: displayStatus,
    ragIndexPhase: book.ragIndexPhase || '',
    ragIndexTotalChunks: book.ragIndexTotalChunks ?? 0,
    ragIndexDoneChunks: book.ragIndexDoneChunks ?? 0,
    ragIndexProgressPercent: legacyRagIndexPercentEstimate(book),
    ragIndexError: mapRagErrorToUserMessage(book.ragIndexError || ''),
    ragIndexedAt: book.ragIndexedAt
      ? new Date(book.ragIndexedAt).toISOString()
      : null,
    ragPageCount: book.ragPageCount ?? 0,
    ragChapterMap: Array.isArray(book.ragChapterMap) ? book.ragChapterMap : [],
    ragPrepVersion: book.ragPrepVersion ?? 0,
    needsReindex: (book.ragPrepVersion ?? 0) < RAG_PREP_VERSION,
  };
}
