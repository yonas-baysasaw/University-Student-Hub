import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import { resolveGeminiCredentialsForUser } from './geminiService.js';

const CHUNK_WORDS = 700;
const CHUNK_OVERLAP_WORDS = 120;
const MAX_QUESTIONS_PER_CHUNK = 12;

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
  const safeChunkSize = Math.max(100, Number(chunkSize) || CHUNK_WORDS);
  const safeOverlap = Math.max(
    0,
    Math.min(safeChunkSize - 1, Number(overlap) || CHUNK_OVERLAP_WORDS),
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

function createTextChunks(textContent) {
  const content = typeof textContent === 'string' ? textContent : '';
  const words = content.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  return chunkWords(words, CHUNK_WORDS, CHUNK_OVERLAP_WORDS);
}

function stripCodeFences(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('```')) return t;
  return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
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
  correctAnswer = Math.max(0, Math.min(options.length - 1, Math.floor(correctAnswer)));

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

async function processExamInBatches(examId, content, userLike) {
  const rawText =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? ''
        : String(content || '');

  if (!rawText.trim()) {
    await Exam.findByIdAndUpdate(examId, {
      processingStatus: 'failed',
      processingError:
        'Could not extract text from this file. Try a text-based PDF, Word, PowerPoint, or plain text file.',
      totalQuestions: 0,
    });
    return;
  }

  await Exam.findByIdAndUpdate(examId, {
    processingStatus: 'processing',
    processingError: '',
  });

  const chunks = createTextChunks(rawText);
  if (chunks.length === 0) {
    await Exam.findByIdAndUpdate(examId, {
      processingStatus: 'failed',
      processingError: 'No extractable exam text was found.',
      totalQuestions: 0,
    });
    return;
  }

  const all = [];
  for (const chunk of chunks) {
    const extracted = await generateQuestionsFromChunk(chunk.content, userLike);
    const trimmed = extracted.slice(0, MAX_QUESTIONS_PER_CHUNK);
    for (const q of trimmed) {
      const normalized = normalizeQuestion(q, all.length, chunk.batchNumber);
      if (normalized) all.push(normalized);
    }
  }

  // Deduplicate by normalized question text.
  const seen = new Set();
  const unique = [];
  for (const q of all) {
    const key = q.question.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...q, questionIndex: unique.length });
  }

  if (unique.length === 0) {
    await Exam.findByIdAndUpdate(examId, {
      processingStatus: 'failed',
      processingError:
        'No multiple-choice questions were detected in the uploaded exam.',
      totalQuestions: 0,
    });
    return;
  }

  await Question.deleteMany({ examId });
  await Question.insertMany(
    unique.map((q) => ({
      examId,
      ...q,
    })),
    { ordered: true },
  );

  await Exam.findByIdAndUpdate(examId, {
    processingStatus: 'complete',
    processingError: '',
    totalQuestions: unique.length,
  });
}

export { createTextChunks, isFatalAIError, processExamInBatches };
