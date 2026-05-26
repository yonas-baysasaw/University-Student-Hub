import mongoose from 'mongoose';
import { Agent, fetch as undiciFetch } from 'undici';
import { ENV } from '../config/env.js';
import BookChunk from '../models/BookChunk.js';
import Book from '../models/Books.js';
import { splitTextForRagEmbedding } from '../utils/bookRagChunker.js';
import { resolveGeminiCredentialsForUser } from './geminiService.js';
import { extractTextFromPDF } from './pdfService.js';

/** @see https://ai.google.dev/gemini-api/docs/embeddings */
function getEmbeddingModelId() {
  const m =
    ENV.GEMINI_EMBEDDING_MODEL && String(ENV.GEMINI_EMBEDDING_MODEL).trim();
  return m || 'gemini-embedding-001';
}

const TOP_K = 5;
const EMBED_DELAY_MS = 60;
const MAX_CONTEXT_CHARS = 10000;
const MIN_TEXT_TO_INDEX = 200;
/** Large PDFs over slow links can look “stuck” without a timeout. */
const BOOK_DOWNLOAD_TIMEOUT_MS = 120_000;
/** Log every N ms while a download (HTTP + body) is in flight — helps see “stuck on Step 1”. */
const RAG_DOWNLOAD_HEARTBEAT_MS = 20_000;
/** `embedText` — retries on Undici `UND_ERR_CONNECT_TIMEOUT` (default 10s connect) only. */
const GEMINI_EMBED_RETRIES = 4;

/** @type {import('undici').Agent} */
const geminiEmbedHttpAgent = new Agent({
  connect: { timeout: ENV.GEMINI_HTTP_CONNECT_TIMEOUT_MS },
});

/**
 * @param {unknown} e
 */
function isGeminiConnectTimeoutError(e) {
  const c = e?.cause;
  if (c && typeof c === 'object') {
    if (c.code === 'UND_ERR_CONNECT_TIMEOUT') return true;
    if (c.name === 'ConnectTimeoutError') return true;
  }
  if (e?.name === 'ConnectTimeoutError') return true;
  return false;
}

/**
 * @param {number} ms
 */
function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
 * Map pipeline position to 0–100% (download/extract/chunk = fixed bands; most work = embedding).
 * @param {'downloading' | 'downloaded' | 'extracting' | 'chunking' | 'embedding'} step
 * @param {{ done?: number, total?: number }} [embed]
 */
function computeRagProgressPercent(step, embed = {}) {
  if (step === 'downloading') return 4;
  if (step === 'downloaded') return 10;
  if (step === 'extracting') return 14;
  if (step === 'chunking') return 24;
  if (step === 'embedding') {
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

/**
 * @param {Array<number>} a
 * @param {Array<number>} b
 */
function cosineSimilarity(a, b) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-12 ? 0 : dot / denom;
}

/**
 * @param {string} apiKey
 * @param {string} text
 */
export async function embedText(apiKey, text) {
  const trimmed = String(text).trim().slice(0, 20000);
  if (!trimmed) {
    throw new Error('Nothing to embed');
  }
  const modelId = getEmbeddingModelId();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    content: { parts: [{ text: trimmed }] },
  });
  let lastErr;
  for (let attempt = 0; attempt < GEMINI_EMBED_RETRIES; attempt += 1) {
    if (attempt > 0) {
      const backoff = 1_200 * 2 ** (attempt - 1);
      console.warn(
        `[bookRag] embedContent retry ${attempt + 1}/${GEMINI_EMBED_RETRIES} after connect issue (waiting ${backoff}ms)`,
      );
      await sleepMs(Math.min(backoff, 8_000));
    }
    try {
      const res = await undiciFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        dispatcher: geminiEmbedHttpAgent,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message || `Embedding request failed: ${res.status}`,
        );
      }
      const values = data.embedding?.values;
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('No embedding in response');
      }
      return values;
    } catch (e) {
      lastErr = e;
      const retry =
        isGeminiConnectTimeoutError(e) && attempt < GEMINI_EMBED_RETRIES - 1;
      if (!retry) {
        throw e;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('Embedding failed after retries');
}

/**
 * @param {Buffer} buffer
 * @param {string} [hintUrl]
 */
async function textFromBuffer(buffer, hintUrl = '') {
  const u = (hintUrl || '').toLowerCase();
  if (u.endsWith('.pdf') || u.includes('application/pdf')) {
    return extractTextFromPDF(buffer);
  }
  if (u.endsWith('.txt') || u.includes('text/plain')) {
    return buffer.toString('utf8');
  }
  if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50) {
    return extractTextFromPDF(buffer);
  }
  return buffer.toString('utf8');
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
 * @param { { geminiApiKey?: string; geminiModelId?: string } } userLike
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
 * @param { { geminiApiKey?: string; geminiModelId?: string } } userLike
 */
export async function runRagIndexPipeline(bookId, userId, userLike) {
  const bid = new mongoose.Types.ObjectId(String(bookId));
  const { apiKey } = resolveGeminiCredentialsForUser(userLike);
  ragLog(String(bookId), 'pipeline', 'runRagIndexPipeline entered');
  if (!apiKey) {
    ragLog(
      String(bookId),
      'pipeline',
      'aborted: no Gemini API key on user/env',
    );
    await patchBookRagFields(bid, {
      ragIndexStatus: 'failed',
      ragIndexPhase: '',
      ragIndexError:
        'No Gemini API key. Add one in profile or set GEMINI_API_KEY on the server.',
      ragIndexProgressPercent: 0,
    });
    return;
  }

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
    const text = await textFromBuffer(bytes, bookDoc.bookUrl);
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
    const pieces = splitTextForRagEmbedding(text);
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
      ragIndexPhase: 'embedding',
      ragIndexTotalChunks: pieces.length,
      ragIndexDoneChunks: 0,
      ragIndexProgressPercent: computeRagProgressPercent('chunking'),
    });
    const logEvery = Math.max(1, Math.floor(pieces.length / 8));
    const tEmb = Date.now();
    ragLog(
      String(bookId),
      'embedding',
      'loop start (Gemini embed + DB insert per chunk)',
      {
        totalChunks: pieces.length,
        logEachApprox: logEvery,
      },
    );

    for (let i = 0; i < pieces.length; i += 1) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, EMBED_DELAY_MS));
      }
      if (i === 0 || (i + 1) % logEvery === 0 || i + 1 === pieces.length) {
        ragLog(String(bookId), 'embedding', 'embedding chunk', {
          at: i + 1,
          of: pieces.length,
          elapsedSec: Math.round((Date.now() - tEmb) / 1000),
        });
      }
      const vector = await embedText(apiKey, pieces[i]);
      await BookChunk.create({
        book: bid,
        chunkIndex: i,
        text: pieces[i].slice(0, 20000),
        embedding: vector,
        embeddingModel: getEmbeddingModelId(),
      });
      await patchBookRagFields(bid, {
        ragIndexDoneChunks: i + 1,
        ragIndexProgressPercent: computeRagProgressPercent('embedding', {
          done: i + 1,
          total: pieces.length,
        }),
      });
    }

    ragLog(String(bookId), 'embedding', 'all chunks written', {
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
 * @param { { geminiApiKey?: string; geminiModelId?: string; _id?: unknown } } userLike
 * @returns {Promise<{ error?: string, code?: string, status?: object, started?: boolean, bookId?: string }>}
 */
export async function scheduleRagIndexForBook(bookId, userId, userLike) {
  const { apiKey } = resolveGeminiCredentialsForUser(userLike);
  if (!apiKey) {
    return {
      error:
        'No Gemini API key. Add one in profile or set GEMINI_API_KEY on the server.',
    };
  }

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

  const userRef = {
    geminiApiKey: userLike.geminiApiKey,
    geminiModelId: userLike.geminiModelId,
  };
  setImmediate(() => {
    ragLog(
      String(bookId),
      'schedule',
      'setImmediate fired — starting runRagIndexPipeline (async after 202 response)',
    );
    void runRagIndexPipeline(String(bookId), userId, userRef);
  });

  return { started: true, bookId: String(bookId) };
}

/**
 * @param {string} bookId
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {string} query
 * @param { { geminiApiKey?: string; geminiModelId?: string } } userLike
 */
export async function buildRagContextForQuery(bookId, userId, query, userLike) {
  const book = await findAccessibleBookLean(bookId, userId);
  if (!book) return { context: null, bookTitle: null, reason: 'no_access' };
  const { apiKey } = resolveGeminiCredentialsForUser(userLike);
  if (!apiKey) {
    return { context: null, bookTitle: book.title, reason: 'no_key' };
  }

  const rows = await BookChunk.find({ book: bookId })
    .select('text embedding chunkIndex')
    .lean();
  if (rows.length === 0) {
    return { context: null, bookTitle: book.title, reason: 'not_indexed' };
  }

  const qv = await embedText(apiKey, query);
  const scored = rows
    .map((r) => ({
      text: r.text,
      score: cosineSimilarity(qv, r.embedding),
      chunkIndex: r.chunkIndex,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  let combined = '';
  for (const s of scored) {
    const block = `[Excerpt #${(s.chunkIndex ?? 0) + 1}]\n${s.text}`;
    if (combined.length + block.length + 2 > MAX_CONTEXT_CHARS) break;
    combined = combined ? `${combined}\n\n${block}` : block;
  }
  if (!combined) {
    return { context: null, bookTitle: book.title, reason: 'empty' };
  }
  return { context: combined, bookTitle: book.title, reason: 'ok' };
}

/**
 * @param { Array<{ role: string, content: string }> } messages
 * @param {string} [bookId]
 * @param {import('mongoose').Types.ObjectId} userId
 * @param { { geminiApiKey?: string; geminiModelId?: string } } userLike
 */
export async function augmentMessagesWithBookRag(
  messages,
  bookId,
  userId,
  userLike,
) {
  if (
    !bookId ||
    !String(bookId).trim() ||
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return { messages, ragUsed: false, ragNote: null };
  }

  const last = messages.at(-1);
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    return { messages, ragUsed: false, ragNote: null };
  }

  const { context, bookTitle, reason } = await buildRagContextForQuery(
    String(bookId),
    userId,
    last.content,
    userLike,
  );

  if (reason === 'not_indexed') {
    return {
      messages: [...messages],
      ragUsed: false,
      ragNote: 'index_required',
    };
  }
  if (!context) {
    return { messages: [...messages], ragUsed: false, ragNote: reason };
  }

  const prefix = `The student is asking about the book **${bookTitle || 'this book'}**. Use ONLY the following excerpts as factual grounding; if something is not in the excerpts, say you do not have that in the indexed text. Excerpts:\n\n${context}\n\n---\n\nStudent question:\n`;
  const out = messages.slice(0, -1).map((m) => ({ ...m }));
  out.push({ role: 'user', content: `${prefix}${last.content}` });
  return { messages: out, ragUsed: true, ragNote: 'ok' };
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
  if (ph === 'embedding' && t > 0) {
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
