import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import {
  emitExamBatchComplete,
  emitExamProcessingComplete,
  emitExamProcessingFailed,
  emitExamProcessingStarted,
} from './examProcessingEvents.js';
import { resolveGeminiCredentialsForUser } from './geminiService.js';

const STANDARD_CHUNK_WORDS = 700;
const STANDARD_CHUNK_OVERLAP = 120;
const STANDARD_MAX_PER_CHUNK = 12;

const THOROUGH_CHUNK_WORDS = 500;
const THOROUGH_CHUNK_OVERLAP = 100;
const THOROUGH_MAX_PER_CHUNK = 15;

function isFatalAIError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('api key') ||
    message.includes('permission') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
}

function chunkWords(words, chunkSize, overlap) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const safeChunkSize = Math.max(100, Number(chunkSize) || STANDARD_CHUNK_WORDS);
  const safeOverlap = Math.max(
    0,
    Math.min(safeChunkSize - 1, Number(overlap) || STANDARD_CHUNK_OVERLAP),
  );

  const out = [];
  let i = 0;
  let n = 1;
  while (i < words.length) {
    const end = Math.min(words.length, i + safeChunkSize);
    const slice = words.slice(i, end);
    out.push({
      content: slice.join(' '),
      batchNumber: n,
      wordsCount: slice.length,
    });
    if (end >= words.length) break;
    i = Math.max(0, end - safeOverlap);
    n += 1;
  }
  return out;
}

function getChunkConfig(extractionMode) {
  if (extractionMode === 'thorough') {
    return {
      chunkWords: THOROUGH_CHUNK_WORDS,
      chunkOverlap: THOROUGH_CHUNK_OVERLAP,
      maxPerChunk: THOROUGH_MAX_PER_CHUNK,
    };
  }
  return {
    chunkWords: STANDARD_CHUNK_WORDS,
    chunkOverlap: STANDARD_CHUNK_OVERLAP,
    maxPerChunk: STANDARD_MAX_PER_CHUNK,
  };
}

function createTextChunks(textContent, extractionMode = 'standard') {
  const content = typeof textContent === 'string' ? textContent : '';
  const words = content.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  const { chunkWords: size, chunkOverlap: overlap } =
    getChunkConfig(extractionMode);
  return chunkWords(words, size, overlap);
}

function stripCodeFences(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('```')) return t;
  return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function normalizeStemKey(stem) {
  return String(stem || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuestion(raw, index, batchNumber) {
  const question = String(raw?.question || '').trim();
  const optionsRaw = Array.isArray(raw?.options) ? raw.options : [];
  const options = optionsRaw
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!question || options.length < 2) return null;

  let correctAnswer = Number(raw?.correctAnswer);
  if (!Number.isFinite(correctAnswer)) correctAnswer = 0;
  correctAnswer = Math.max(
    0,
    Math.min(options.length - 1, Math.floor(correctAnswer)),
  );

  return {
    questionIndex: index,
    question,
    options,
    correctAnswer,
    explanation: String(raw?.explanation || '').trim(),
    batchNumber,
    source: 'ai',
  };
}

async function generateQuestionsFromChunk(chunkText, userLike) {
  const { apiKey, modelId } = resolveGeminiCredentialsForUser(userLike);
  if (!apiKey) {
    throw new Error(
      'No Gemini API key. Add your key in Profile (Liqu AI Settings) or set GEMINI_API_KEY on the server.',
    );
  }
  const prompt =
    `You are an exam-question extraction assistant.\n` +
    `From the given exam text, extract multiple-choice questions if present.\n` +
    `Return ONLY strict JSON with this shape:\n` +
    `{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]}\n` +
    `Rules:\n` +
    `- If no MCQ can be extracted, return {"questions":[]}\n` +
    `- options length must be 2-5\n` +
    `- correctAnswer must be zero-based index\n` +
    `- Do not include markdown or extra text.\n\n` +
    `Exam text:\n${chunkText}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Gemini request failed with ${res.status}`,
    );
  }
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim() || '';
  if (!text) return [];

  let parsed = {};
  try {
    parsed = JSON.parse(stripCodeFences(text));
  } catch {
    return [];
  }
  return Array.isArray(parsed?.questions) ? parsed.questions : [];
}

async function markExamFailed(examId, userId, message) {
  await Exam.findByIdAndUpdate(examId, {
    processingStatus: 'failed',
    processingError: message,
    totalQuestions: 0,
  });
  emitExamProcessingFailed({ examId, userId, error: message });
}

/**
 * @param {string} examId
 * @param {string} content
 * @param {object} userLike
 * @param {{ userId?: string, extractionMode?: string, filename?: string }} [meta]
 */
async function processExamInBatches(examId, content, userLike, meta = {}) {
  const userId = meta.userId ? String(meta.userId) : null;
  const extractionMode =
    meta.extractionMode === 'thorough' ? 'thorough' : 'standard';
  const filename = meta.filename || '';
  const { maxPerChunk } = getChunkConfig(extractionMode);

  const rawText =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? ''
        : String(content || '');

  if (!rawText.trim()) {
    await markExamFailed(
      examId,
      userId,
      'Could not extract text from this file. Try a text-based PDF, Word, PowerPoint, or plain text file.',
    );
    return;
  }

  const chunks = createTextChunks(rawText, extractionMode);
  if (chunks.length === 0) {
    await markExamFailed(
      examId,
      userId,
      'No extractable exam text was found.',
    );
    return;
  }

  await Question.deleteMany({ examId });
  await Exam.findByIdAndUpdate(examId, {
    processingStatus: 'processing',
    processingError: '',
    totalQuestions: 0,
    processingBatchCurrent: 0,
    processingBatchTotal: chunks.length,
    extractionMode,
  });

  emitExamProcessingStarted({
    examId,
    userId,
    totalBatches: chunks.length,
    filename,
  });

  const seen = new Set();
  let totalSaved = 0;

  for (const chunk of chunks) {
    try {
      const extracted = await generateQuestionsFromChunk(chunk.content, userLike);
      const trimmed = extracted.slice(0, maxPerChunk);
      const batchDocs = [];

      for (const q of trimmed) {
        const normalized = normalizeQuestion(
          q,
          totalSaved + batchDocs.length,
          chunk.batchNumber,
        );
        if (!normalized) continue;
        const key = normalizeStemKey(normalized.question);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        batchDocs.push({
          examId,
          ...normalized,
          questionIndex: totalSaved + batchDocs.length,
        });
      }

      if (batchDocs.length > 0) {
        await Question.insertMany(batchDocs, { ordered: true });
        totalSaved += batchDocs.length;
      }

      await Exam.findByIdAndUpdate(examId, {
        totalQuestions: totalSaved,
        processingBatchCurrent: chunk.batchNumber,
      });

      emitExamBatchComplete({
        examId,
        userId,
        batchNumber: chunk.batchNumber,
        totalBatches: chunks.length,
        newQuestionCount: batchDocs.length,
        totalQuestions: totalSaved,
      });
    } catch (err) {
      console.error(
        `[batchService] chunk ${chunk.batchNumber}/${chunks.length} failed for exam ${examId}:`,
        err,
      );
      if (isFatalAIError(err)) {
        await markExamFailed(examId, userId, err.message);
        return;
      }
      await Exam.findByIdAndUpdate(examId, {
        processingBatchCurrent: chunk.batchNumber,
      });
    }
  }

  if (totalSaved === 0) {
    await markExamFailed(
      examId,
      userId,
      'No multiple-choice questions were detected in the uploaded exam.',
    );
    return;
  }

  await Exam.findByIdAndUpdate(examId, {
    processingStatus: 'complete',
    processingError: '',
    totalQuestions: totalSaved,
    processingBatchCurrent: chunks.length,
    processingBatchTotal: chunks.length,
  });

  emitExamProcessingComplete({
    examId,
    userId,
    totalQuestions: totalSaved,
    totalBatches: chunks.length,
  });
}

export { createTextChunks, isFatalAIError, processExamInBatches };
