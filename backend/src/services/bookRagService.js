import mongoose from 'mongoose';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import BookChunk from '../models/BookChunk.js';
import Book from '../models/Books.js';
import { splitTextForRagWithMetadata } from '../utils/bookRagChunker.js';
import { extractTextFromPDF, extractTextPagesFromPDF } from './pdfService.js';
import {
  cosineSimilarity,
  embedText,
  rewriteQueryForSearch,
} from './embeddingService.js';

const TOP_K = 5;
const MAX_CONTEXT_CHARS = 10000;
const MIN_TEXT_TO_INDEX = 200;
const CONTEXT_ONLY_RULES = `Answer the user's question using ONLY the provided context.

Rules:
- Give concise answers
- Understand grammar mistakes and typos in the question
- Mention chapter names if available
- Do not include copyright or publisher text
- Recommend related books if relevant
- If answer is not found, say exactly:
"The information was not found in the available books."`;
const MODE_RULES = {
  chat: 'Provide a direct helpful answer in 3-6 sentences.',
  study_notes:
    'Create structured study notes with headings: Topic, Explanation, Key Points, Example, Important Notes.',
  summary: 'Give a short summary in 4-6 bullet points.',
  exam_prep:
    'Provide exam-prep notes: key concepts and 3 short practice questions with answers.',
  beginner:
    'Explain in simple language with short sentences and one easy example.',
};
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
    const extracted = await textFromBuffer(bytes, bookDoc.bookUrl);
    const text = extracted?.text || '';
    ragLog(String(bookId), 'extracting', 'textFromBuffer finished', {
      ms: Date.now() - tExtract,
      textChars: text?.length ?? 0,
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
        ragIndexError:
          'Not enough extractable text (scanned PDFs or unsupported format).',
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
    const pieces = splitTextForRagWithMetadata(text);
    ragLog(String(bookId), 'chunking', 'splitTextForRagEmbedding done', {
      pieces: pieces.length,
      ms: Date.now() - tChunk,
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
      'loop start (DB insert per chunk)',
      {
        totalChunks: pieces.length,
        logEachApprox: logEvery,
      },
    );

    for (let i = 0; i < pieces.length; i += 1) {
      if (i === 0 || (i + 1) % logEvery === 0 || i + 1 === pieces.length) {
        ragLog(String(bookId), 'writing', 'writing chunk', {
          at: i + 1,
          of: pieces.length,
          elapsedSec: Math.round((Date.now() - tEmb) / 1000),
        });
      }
      const piece = pieces[i];
      let embedding = [];
      try {
        embedding = (await embedText(piece.text)) || [];
      } catch (e) {
        if (i === 0) {
          console.warn('[bookRag] embedding disabled/fallback during indexing:', e?.message || e);
        }
      }
      const pageHits = Array.isArray(extracted?.pages)
        ? extracted.pages
            .filter((p) => piece.text.includes(String(p.text || '').slice(0, 120)))
            .map((p) => p.pageNumber)
        : [];
      await BookChunk.create({
        book: bid,
        chunkIndex: i,
        text: piece.text.slice(0, 20000),
        chapter: piece.chapter || '',
        section: piece.section || '',
        pageStart: pageHits.length ? Math.min(...pageHits) : null,
        pageEnd: pageHits.length ? Math.max(...pageHits) : null,
        embedding,
      });
      await patchBookRagFields(bid, {
        ragIndexDoneChunks: i + 1,
        ragIndexProgressPercent: computeRagProgressPercent('writing', {
          done: i + 1,
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
      ragIndexError: msg,
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
    { new: true, select: 'title' },
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

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {string} query
 */
export async function buildRagContextForQuery(bookId, userId, query) {
  const rewrittenQuery = await rewriteQueryForSearch(query);
  let queryEmbedding = null;
  try {
    queryEmbedding = await embedText(rewrittenQuery);
  } catch {
    queryEmbedding = null;
  }

  const book = await findAccessibleBookLean(bookId, userId);
  if (!book) {
    return {
      context: null,
      bookTitle: null,
      reason: 'no_access',
      references: [],
    };
  }

  const rows = await BookChunk.find({ book: bookId })
    .select('text chunkIndex chapter section pageStart pageEnd embedding')
    .lean();
  if (rows.length === 0) {
    return {
      context: null,
      bookTitle: book.title,
      reason: 'not_indexed',
      references: [],
    };
  }

  const scoredBase = rows
    .map((r) => ({
      text: r.text,
      score: semanticOrKeywordScore(queryEmbedding, rewrittenQuery, r.text, r.embedding),
      chunkIndex: r.chunkIndex,
      chapter: r.chapter || '',
      section: r.section || '',
      pageStart: r.pageStart ?? null,
      pageEnd: r.pageEnd ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  const picked = new Set(scoredBase.map((s) => s.chunkIndex));
  const scored = [...scoredBase];
  for (const base of scoredBase) {
    const near = rows.filter(
      (r) =>
        !picked.has(r.chunkIndex) &&
        Math.abs((r.chunkIndex ?? 0) - (base.chunkIndex ?? 0)) <= 1,
    );
    for (const n of near) {
      picked.add(n.chunkIndex);
      scored.push({
        text: n.text,
        score: Math.max(
          0.01,
          semanticOrKeywordScore(queryEmbedding, rewrittenQuery, n.text, n.embedding) * 0.8,
        ),
        chunkIndex: n.chunkIndex,
        chapter: n.chapter || '',
        section: n.section || '',
        pageStart: n.pageStart ?? null,
        pageEnd: n.pageEnd ?? null,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const selectedForLog = scored.filter((s) => s.score > 0);
  if (selectedForLog.length > 0) {
    console.log(
      `[bookRag] retrieval bookId=${String(bookId)} top=${selectedForLog.length} query="${previewText(query, 120)}"`,
    );
    for (const s of selectedForLog) {
      console.log(
        `[bookRag] chunk #${(s.chunkIndex ?? 0) + 1} score=${s.score.toFixed(3)} text="${previewText(s.text)}"`,
      );
    }
  } else {
    console.log(
      `[bookRag] retrieval bookId=${String(bookId)} no keyword-matched chunks query="${previewText(query, 120)}"`,
    );
  }

  let combined = '';
  for (const s of scored) {
    const pageLabel =
      s.pageStart && s.pageEnd
        ? s.pageStart === s.pageEnd
          ? ` | Page ${s.pageStart}`
          : ` | Pages ${s.pageStart}-${s.pageEnd}`
        : '';
    const chapterLabel = s.chapter ? ` | Chapter: ${s.chapter}` : '';
    const sectionLabel = s.section ? ` | Section: ${s.section}` : '';
    const block = `[Excerpt #${(s.chunkIndex ?? 0) + 1}${pageLabel}${chapterLabel}${sectionLabel}]\n${s.text}`;
    if (combined.length + block.length + 2 > MAX_CONTEXT_CHARS) break;
    combined = combined ? `${combined}\n\n${block}` : block;
  }
  if (!combined) {
    return {
      context: null,
      bookTitle: book.title,
      reason: 'empty',
      references: [],
    };
  }
  const references = scored.map((s) => ({
    bookId: String(bookId),
    bookTitle: book.title || 'Untitled',
    chunkIndex: s.chunkIndex ?? 0,
    excerptNumber: (s.chunkIndex ?? 0) + 1,
    score: s.score,
    chapter: s.chapter || '',
    section: s.section || '',
    pageStart: s.pageStart ?? null,
    pageEnd: s.pageEnd ?? null,
  }));
  return {
    context: combined,
    bookTitle: book.title,
    reason: 'ok',
    references,
  };
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {string} query
 */
export async function buildGeneralRagContextForQuery(userId, query) {
  const rewrittenQuery = await rewriteQueryForSearch(query);
  let queryEmbedding = null;
  try {
    queryEmbedding = await embedText(rewrittenQuery);
  } catch {
    queryEmbedding = null;
  }

  const books = await Book.find(canReadBookFilter(userId))
    .select('_id title')
    .lean();
  if (books.length === 0) {
    return { context: null, reason: 'no_books', references: [] };
  }

  const bookIds = books.map((b) => b._id);
  const titleById = new Map(books.map((b) => [String(b._id), b.title || 'Untitled']));

  const rows = await BookChunk.find({ book: { $in: bookIds } })
    .select('text chunkIndex book chapter section pageStart pageEnd embedding')
    .lean();
  if (rows.length === 0) {
    return { context: null, reason: 'not_indexed', references: [] };
  }

  const scoredBase = rows
    .map((r) => ({
      book: String(r.book),
      text: r.text,
      score: semanticOrKeywordScore(queryEmbedding, rewrittenQuery, r.text, r.embedding),
      chunkIndex: r.chunkIndex,
      chapter: r.chapter || '',
      section: r.section || '',
      pageStart: r.pageStart ?? null,
      pageEnd: r.pageEnd ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  const scored = [...scoredBase];

  const selectedForLog = scored.filter((s) => s.score > 0);
  if (selectedForLog.length > 0) {
    console.log(
      `[bookRag] retrieval-general top=${selectedForLog.length} query="${previewText(query, 120)}"`,
    );
    for (const s of selectedForLog) {
      console.log(
        `[bookRag] book="${titleById.get(s.book) || s.book}" chunk #${(s.chunkIndex ?? 0) + 1} score=${s.score.toFixed(3)} text="${previewText(s.text)}"`,
      );
    }
  } else {
    console.log(
      `[bookRag] retrieval-general no keyword-matched chunks query="${previewText(query, 120)}"`,
    );
  }

  let combined = '';
  for (const s of scored) {
    const bookTitle = titleById.get(s.book) || 'Untitled';
    const pageLabel =
      s.pageStart && s.pageEnd
        ? s.pageStart === s.pageEnd
          ? ` | Page ${s.pageStart}`
          : ` | Pages ${s.pageStart}-${s.pageEnd}`
        : '';
    const chapterLabel = s.chapter ? ` | Chapter: ${s.chapter}` : '';
    const sectionLabel = s.section ? ` | Section: ${s.section}` : '';
    const block = `[Book: ${bookTitle} | Excerpt #${(s.chunkIndex ?? 0) + 1}${pageLabel}${chapterLabel}${sectionLabel}]\n${s.text}`;
    if (combined.length + block.length + 2 > MAX_CONTEXT_CHARS) break;
    combined = combined ? `${combined}\n\n${block}` : block;
  }
  if (!combined) {
    return { context: null, reason: 'empty', references: [] };
  }
  const references = scored.map((s) => ({
    bookId: s.book,
    bookTitle: titleById.get(s.book) || 'Untitled',
    chunkIndex: s.chunkIndex ?? 0,
    excerptNumber: (s.chunkIndex ?? 0) + 1,
    score: s.score,
    chapter: s.chapter || '',
    section: s.section || '',
    pageStart: s.pageStart ?? null,
    pageEnd: s.pageEnd ?? null,
  }));
  return { context: combined, reason: 'ok', references };
}

/**
 * @param { Array<{ role: string, content: string }> } messages
 * @param {string} [bookId]
 * @param {import('mongoose').Types.ObjectId} userId
 */
export async function augmentMessagesWithBookRag(
  messages,
  bookId,
  userId,
  mode = 'chat',
) {
  if (
    !bookId ||
    !String(bookId).trim() ||
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return { messages, ragUsed: false, ragNote: null, references: [] };
  }

  const last = messages.at(-1);
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    return { messages, ragUsed: false, ragNote: null, references: [] };
  }

  const { context, bookTitle, reason, references } = await buildRagContextForQuery(
    String(bookId),
    userId,
    last.content,
  );

  if (reason === 'not_indexed') {
    return {
      messages: [...messages],
      ragUsed: false,
      ragNote: 'index_required',
      references: [],
    };
  }
  if (!context) {
    return {
      messages: [...messages],
      ragUsed: false,
      ragNote: reason,
      references: [],
    };
  }

  const modeKey = String(mode || 'chat').toLowerCase();
  const modeRule = MODE_RULES[modeKey] || MODE_RULES.chat;
  const prefix = `The student is asking about the book **${bookTitle || 'this book'}**.\n${CONTEXT_ONLY_RULES}\n- Output mode: ${modeKey}\n- Mode behavior: ${modeRule}\n\nProvided context:\n\n${context}\n\n---\n\nStudent question:\n`;
  const out = messages.slice(0, -1).map((m) => ({ ...m }));
  out.push({ role: 'user', content: `${prefix}${last.content}` });
  return {
    messages: out,
    ragUsed: true,
    ragNote: 'ok',
    references,
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
      'title ragIndexStatus ragIndexPhase ragIndexTotalChunks ragIndexDoneChunks ragIndexError ragIndexedAt ragIndexProgressPercent',
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
    ragIndexError: book.ragIndexError || '',
    ragIndexedAt: book.ragIndexedAt
      ? new Date(book.ragIndexedAt).toISOString()
      : null,
  };
}
