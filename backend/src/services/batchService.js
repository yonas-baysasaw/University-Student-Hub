import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import { getIo } from '../socket/index.js';
import { geminiService } from './geminiService.js';

// Ported and adapted from did-exit/js/batch-processor.js
// Key changes: MongoDB/Mongoose instead of IndexedDB, async background processing via Promise chain

const RATE_LIMIT_DELAY_MS = 5000; // 5s between background batches
const BATCH_TIMEOUT_MS = 120_000; // 120s per batch

// ── Fatal error detection (ported verbatim) ───────────────────────────────────

function isFatalAIError(error) {
  const m = (error?.message || String(error)).toLowerCase();
  return (
    /\b429\b/.test(m) ||
    (m.includes('quota') && (m.includes('exceed') || m.includes('exceeded'))) ||
    /\b403\b/.test(m) ||
    /\b401\b/.test(m) ||
    m.includes('invalid api key') ||
    m.includes('api_key_invalid') ||
    m.includes('permission denied') ||
    m.includes('billing')
  );
}

// ── Text chunking (ported verbatim from did-exit) ─────────────────────────────

function estimateQuestionCount(textContent) {
  const questionPatterns = [
    /\d+[.)]\s+[A-Z]/g,
    /Question\s+\d+/gi,
    /^\s*\d+\.\s+/gm,
    /\?\s*$/gm,
  ];

  let maxCount = 0;
  for (const pattern of questionPatterns) {
    const matches = textContent.match(pattern) || [];
    maxCount = Math.max(maxCount, matches.length);
  }

  const mcMarkers = [/^\s*[A-Ea-e][.)]/gm, /^\s*\([A-Ea-e]\)/gm];
  let optionCount = 0;
  for (const pattern of mcMarkers) {
    optionCount += (textContent.match(pattern) || []).length;
  }

  const mcEstimate = Math.floor(optionCount / 4);
  return Math.min(150, Math.max(10, maxCount, mcEstimate));
}

function createMultipleBatches(textContent, estimatedQuestions) {
  const questionsPerBatch = 20;
  const targetBatches = Math.min(
    5,
    Math.max(2, Math.ceil(estimatedQuestions / questionsPerBatch)),
  );
  console.log(
    `📊 Creating ${targetBatches} batches for ~${estimatedQuestions} questions`,
  );

  const words = textContent.split(/\s+/);
  const wordsPerChunk = Math.floor(words.length / targetBatches);
  const chunks = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const remainingWords = words.length - (i + wordsPerChunk);
    const isNearEnd =
      remainingWords < wordsPerChunk * 0.3 && remainingWords > 0;

    if (isNearEnd) {
      const allRemaining = words.slice(i);
      chunks.push({
        content: allRemaining.join(' '),
        batchNumber: chunks.length + 1,
        wordsCount: allRemaining.length,
      });
      break;
    }

    const chunkWords = words.slice(i, i + wordsPerChunk);
    chunks.push({
      content: chunkWords.join(' '),
      batchNumber: chunks.length + 1,
      wordsCount: chunkWords.length,
    });

    if (chunks.length >= targetBatches) {
      if (i + wordsPerChunk < words.length) {
        const rest = words.slice(i + wordsPerChunk);
        chunks[chunks.length - 1].content += ` ${rest.join(' ')}`;
        chunks[chunks.length - 1].wordsCount += rest.length;
      }
      break;
    }
  }

  return chunks;
}

function createTextChunks(textContent) {
  const estimated = estimateQuestionCount(textContent);
  console.log(`📊 Estimated ${estimated} questions in document`);

  if (estimated > 20 || textContent.length > 20000) {
    return createMultipleBatches(textContent, estimated);
  }

  if (textContent.length < 20000 && estimated <= 10) {
    return [
      {
        content: textContent,
        batchNumber: 1,
        wordsCount: textContent.split(/\s+/).length,
      },
    ];
  }

  return createMultipleBatches(textContent, estimated);
}

function createBatchPrompt(chunk) {
  return `Extract ALL multiple choice questions from this content. Focus on creating high-quality educational questions.

IMPORTANT INSTRUCTIONS:
- Extract ALL existing questions if they're already in the content
- LOOK FOR CORRECT ANSWERS: Many exam PDFs have the correct answer right after the question (e.g., "Answer: A", "Correct Answer: B", "Ans: C")
- If a correct answer is provided in the text, USE THAT as the correctAnswer index
- If no answer is provided, use your knowledge to determine the most likely correct answer
- Handle 4 OR 5 options dynamically
- Provide the correct answer index where 0=A, 1=B, 2=C, 3=D, 4=E
- Include brief explanations

FORMAT AS JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}

ANSWER DETECTION PATTERNS:
- Look for: "Answer: A", "Ans: B", "Correct Answer: C"
- Convert A=0, B=1, C=2, D=3, E=4 for the correctAnswer field

Batch ${chunk.batchNumber} content:
${chunk.content}`;
}

// ── Core batch processing ─────────────────────────────────────────────────────

async function processChunkWithAI(chunk) {
  try {
    let questions;
    if (chunk.isImage) {
      console.log(`🤖 Processing image batch ${chunk.batchNumber} with AI`);
      questions = await geminiService.generateQuestionsFromImage(
        chunk.content,
        chunk.mimeType,
      );
    } else {
      console.log(
        `🤖 Processing text batch ${chunk.batchNumber} (${chunk.wordsCount || '?'} words)`,
      );
      const prompt = createBatchPrompt(chunk);
      questions = await geminiService.generateQuestionsFromText(
        chunk.content,
        prompt,
      );
    }

    console.log(
      `✅ Batch ${chunk.batchNumber}: ${questions?.length ?? 0} questions`,
    );
    return questions ?? [];
  } catch (error) {
    console.error(`❌ Error on batch ${chunk.batchNumber}:`, error);
    if (isFatalAIError(error)) throw error;
    return [];
  }
}

async function storeQuestions(examId, questions, batchNumber, totalBatches) {
  if (!questions || questions.length === 0) return 0;

  // Determine the current max questionIndex for this exam to append correctly
  const existing = await Question.countDocuments({ examId });
  const startIndex = existing;

  const docs = questions.map((q, i) => ({
    examId,
    questionIndex: startIndex + i,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || '',
    batchNumber,
    source: 'ai',
  }));

  // Use ordered:false so duplicate-key errors don't abort the whole insert
  try {
    await Question.insertMany(docs, { ordered: false });
  } catch (err) {
    // Ignore duplicate key errors (E11000) — can occur on retry
    if (err.code !== 11000 && !err.message?.includes('E11000')) throw err;
  }

  const total = await Question.countDocuments({ examId });
  await Exam.findByIdAndUpdate(examId, { totalQuestions: total });

  // Emit socket event so connected clients can append new questions
  try {
    const io = getIo();
    if (io) {
      io.to(`exam:${examId}`).emit('exam:batchComplete', {
        examId,
        batchNumber,
        totalBatches: totalBatches ?? batchNumber,
        newQuestionCount: questions.length,
        totalQuestions: total,
      });
    }
  } catch (_) {}

  return total;
}

/**
 * Main entry point — called after PDF is uploaded and text extracted.
 * Processes the PDF in background batches, updating the Exam record as it goes.
 *
 * @param {string} examId  - MongoDB ObjectId string of the Exam document
 * @param {string|Array} content - Extracted text OR array of { base64, mimeType } image objects
 */
async function processExamInBatches(examId, content) {
  try {
    console.log(`🚀 Starting batch processing for exam ${examId}`);

    // Guard: reject empty or trivially short text content up front
    if (typeof content === 'string' && content.trim().length < 50) {
      await Exam.findByIdAndUpdate(examId, {
        processingStatus: 'failed',
        processingError:
          'PDF text extraction produced no usable content. The file may be scanned/image-based or password-protected.',
      });
      console.warn(
        `⚠️ Exam ${examId} aborted — extracted text too short to process.`,
      );
      return;
    }

    await Exam.findByIdAndUpdate(examId, { processingStatus: 'processing' });

    // Build chunks
    let chunks;
    if (Array.isArray(content)) {
      chunks = content.map((img, idx) => ({
        content: img.base64,
        mimeType: img.mimeType,
        batchNumber: idx + 1,
        isImage: true,
      }));
    } else {
      chunks = createTextChunks(content);
    }

    console.log(`📋 Processing ${chunks.length} batch(es)`);

    // Process first batch immediately
    const firstQuestions = await Promise.race([
      processChunkWithAI(chunks[0]),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Batch 1 timeout')),
          BATCH_TIMEOUT_MS,
        ),
      ),
    ]);

    if (!firstQuestions || firstQuestions.length === 0) {
      await Exam.findByIdAndUpdate(examId, {
        processingStatus: 'failed',
        processingError: 'First batch generated no questions.',
      });
      return;
    }

    const totalBatches = chunks.length;
    await storeQuestions(examId, firstQuestions, 1, totalBatches);
    console.log(`✅ First batch stored: ${firstQuestions.length} questions`);

    // Process remaining batches sequentially in the background
    if (chunks.length > 1) {
      processRemainingBatches(examId, chunks.slice(1), totalBatches).catch((err) => {
        console.error(
          `Background batch processing failed for exam ${examId}:`,
          err,
        );
        Exam.findByIdAndUpdate(examId, {
          processingStatus: 'failed',
          processingError: err.message,
        }).catch(() => {});
        try {
          const io = getIo();
          if (io) io.to(`exam:${examId}`).emit('exam:processingFailed', { examId, error: err.message });
        } catch (_) {}
      });
    } else {
      await Exam.findByIdAndUpdate(examId, { processingStatus: 'complete' });
      try {
        const io = getIo();
        const total = await Question.countDocuments({ examId });
        if (io) io.to(`exam:${examId}`).emit('exam:processingComplete', { examId, totalQuestions: total });
      } catch (_) {}
    }
  } catch (error) {
    console.error(`processExamInBatches error for ${examId}:`, error);
    const statusUpdate = isFatalAIError(error)
      ? {
          processingStatus: 'failed',
          processingError: `Fatal AI error: ${error.message}`,
        }
      : { processingStatus: 'failed', processingError: error.message };
    await Exam.findByIdAndUpdate(examId, statusUpdate).catch(() => {});
    try {
      const io = getIo();
      if (io) io.to(`exam:${examId}`).emit('exam:processingFailed', { examId, error: error.message });
    } catch (_) {}
    throw error;
  }
}

async function processRemainingBatches(examId, chunks, totalBatches) {
  for (const chunk of chunks) {
    // Rate limit between background batches
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));

    const questions = await Promise.race([
      processChunkWithAI(chunk),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Batch ${chunk.batchNumber} timeout`)),
          BATCH_TIMEOUT_MS,
        ),
      ),
    ]);

    if (questions && questions.length > 0) {
      const total = await storeQuestions(examId, questions, chunk.batchNumber, totalBatches);
      console.log(
        `✅ Batch ${chunk.batchNumber} stored: ${questions.length} new, ${total} total`,
      );
    }
  }

  await Exam.findByIdAndUpdate(examId, { processingStatus: 'complete' });
  console.log(`🏁 All batches complete for exam ${examId}`);
  try {
    const io = getIo();
    const total = await Question.countDocuments({ examId });
    if (io) io.to(`exam:${examId}`).emit('exam:processingComplete', { examId, totalQuestions: total });
  } catch (_) {}
}

export { createTextChunks, isFatalAIError, processExamInBatches };
