import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import Attempt from '../models/Attempt.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import { processExamInBatches } from '../services/batchService.js';
import { emitExamProcessingFailed } from '../services/examProcessingEvents.js';
import { extractExamDocumentContent } from '../services/examDocumentService.js';
import { extractImagesFromPDF, hashContent } from '../services/pdfService.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import {
  EXAM_PAPER_TYPES,
  validateExamPdfCatalogMeta,
} from '../utils/examCatalogMeta.js';
import { formatExamForClient } from '../utils/examJson.js';
import { stripExamImportExtension } from '../utils/examImportFormats.js';
import {
  loadUserGeminiCredentials,
  userLikeFromCredentials,
} from '../utils/geminiUserCredentials.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

/**
 * Prefer JSON errors for API clients; Express 5 may invoke handlers without `next`.
 */
function controllerError(res, next, error, label = 'examController') {
  console.error(`[${label}]`, error);
  const statusRaw = error.status ?? error.statusCode ?? 500;
  const status =
    typeof statusRaw === 'number' && Number.isFinite(statusRaw) && statusRaw >= 400
      ? statusRaw
      : 500;
  const message = error.message || 'Request failed';
  if (!res.headersSent) {
    return res.status(status).json({ message });
  }
  if (typeof next === 'function') {
    return next(error);
  }
  return undefined;
}

function getUploadedExamFile(req) {
  return req.file ?? (Array.isArray(req.files) ? req.files[0] : null);
}

function originalNameFromFileKey(fileKey) {
  const base = String(fileKey || '').split('/').pop() || '';
  const dash = base.indexOf('-');
  return dash >= 0 ? base.slice(dash + 1) : base;
}

async function runExamBackgroundProcessing(examId, buffer, meta, userId, opts = {}) {
  const credentials = await loadUserGeminiCredentials(userId);
  const userLike = userLikeFromCredentials(credentials);
  const uid = String(userId);

  try {
    const { textContent, isImageBased } = await extractExamDocumentContent(
      buffer,
      meta,
    );
    let content;
    if (isImageBased) {
      content = await extractImagesFromPDF(buffer);
    } else {
      content = textContent;
    }
    await processExamInBatches(examId, content, userLike, {
      userId: uid,
      extractionMode: opts.extractionMode || 'standard',
      filename: opts.filename || '',
    });
  } catch (err) {
    console.error(`Background processing failed for exam ${examId}:`, err);
    const message = err.message || 'Processing failed';
    await Exam.findByIdAndUpdate(examId, {
      processingStatus: 'failed',
      processingError: message,
    }).catch(() => {});
    emitExamProcessingFailed({ examId, userId: uid, error: message });
  }
}

// ── Upload & Process ──────────────────────────────────────────────────────────

async function uploadExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const file = getUploadedExamFile(req);
    if (!file)
      return res.status(400).json({ message: 'No file uploaded.' });

    // Upload raw file to S3
    const s3Result = await uploadFileToS3(file, `${userId}/exams`);

    let textContent = '';
    try {
      const extracted = await extractExamDocumentContent(file.buffer, {
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
      textContent = extracted.textContent;
    } catch (pdfErr) {
      if (pdfErr.status === 400) {
        return res.status(400).json({ message: pdfErr.message });
      }
      console.warn(
        'Document analysis failed — will process without text:',
        pdfErr.message,
      );
    }

    const contentHash = textContent ? hashContent(textContent) : null;

    // Deduplication: check for an existing complete exam with the same content
    let existingExam = null;
    if (contentHash) {
      existingExam = await Exam.findOne({
        contentHash,
        processingStatus: 'complete',
      });
    }

    const visibilityArg = req.body?.visibility;
    const visibility = visibilityArg === 'public' ? 'public' : 'private';

    const catalogErr = validateExamPdfCatalogMeta(req.body ?? {});
    if (catalogErr) return res.status(400).json({ message: catalogErr });

    const displayTitle = String(req.body?.displayTitle || '').trim();
    const titleForRecord =
      displayTitle ||
      stripExamImportExtension(file.originalname) ||
      file.originalname ||
      'Untitled exam';

    const extractionModeRaw = String(req.body?.extractionMode || 'standard')
      .trim()
      .toLowerCase();
    const extractionMode =
      extractionModeRaw === 'thorough' ? 'thorough' : 'standard';

    const catalogFields = {
      academicTrack: String(req.body?.academicTrack || '')
        .trim()
        .toLowerCase(),
      department: String(req.body?.department || '').trim(),
      courseSubject: String(req.body?.courseSubject || '').trim(),
      paperType: String(req.body?.paperType || '').trim() || 'other',
    };

    if (existingExam) {
      // Create a lightweight duplicate record pointing to original's questions
      const dupExam = await Exam.create({
        uploadedBy: userId,
        examKind: 'pdf',
        filename: titleForRecord,
        fileSize: file.size,
        fileUrl: s3Result.location,
        fileKey: s3Result.key,
        contentHash,
        textContent: '',
        totalQuestions: existingExam.totalQuestions,
        processingStatus: 'complete',
        isDuplicate: true,
        originalExamId: existingExam._id,
        visibility,
        ...catalogFields,
      });

      const dupPopulated = await Exam.findById(dupExam._id).populate(
        'uploadedBy',
        'username name avatar subscribers',
      );
      return res.status(201).json(formatExamForClient(req, dupPopulated));
    }

    // Create a new exam record (status: pending)
    const exam = await Exam.create({
      uploadedBy: userId,
      examKind: 'pdf',
      filename: titleForRecord,
      fileSize: file.size,
      fileUrl: s3Result.location,
      fileKey: s3Result.key,
      contentHash,
      textContent,
      processingStatus: 'pending',
      visibility,
      extractionMode,
      ...catalogFields,
    });

    const fileBuffer = file.buffer;
    const fileMeta = {
      mimetype: file.mimetype,
      originalname: file.originalname,
    };
    void runExamBackgroundProcessing(
      exam._id.toString(),
      fileBuffer,
      fileMeta,
      userId,
      { extractionMode, filename: titleForRecord },
    );

    const populatedNew = await Exam.findById(exam._id).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );
    return res.status(201).json(formatExamForClient(req, populatedNew));
  } catch (error) {
    return controllerError(res, next, error, 'uploadExam');
  }
}

// ── List Exams ────────────────────────────────────────────────────────────────

async function listExamsController(req, res, next) {
  try {
    const userId = req.user._id;
    const { subject, status, search, page = 1, limit = 20 } = req.query;

    /** `browse` (default): your papers + community public. `mine`: only uploads you own. */
    const scope = String(req.query.scope ?? 'browse')
      .trim()
      .toLowerCase();
    /** `all` | `private` | `public` — narrows visibility within scope. */
    const visibility = String(req.query.visibility ?? 'all')
      .trim()
      .toLowerCase();

    const andParts = [];

    if (scope === 'mine') {
      andParts.push({ uploadedBy: userId });
      if (visibility === 'private') andParts.push({ visibility: 'private' });
      else if (visibility === 'public') andParts.push({ visibility: 'public' });
    } else if (visibility === 'private') {
      andParts.push({ uploadedBy: userId, visibility: 'private' });
    } else if (visibility === 'public') {
      andParts.push({ visibility: 'public' });
    } else {
      andParts.push({
        $or: [{ uploadedBy: userId }, { visibility: 'public' }],
      });
    }

    if (search) {
      const q = String(search).trim();
      if (q) {
        andParts.push({
          $or: [
            { filename: new RegExp(q, 'i') },
            { topic: new RegExp(q, 'i') },
            { subject: new RegExp(q, 'i') },
            { department: new RegExp(q, 'i') },
            { courseSubject: new RegExp(q, 'i') },
          ],
        });
      }
    }

    const filter =
      andParts.length === 0
        ? {}
        : andParts.length === 1
          ? { ...andParts[0] }
          : { $and: andParts };

    if (status) filter.processingStatus = status;
    if (subject) filter.subject = new RegExp(subject, 'i');

    const skip = (Number(page) - 1) * Number(limit);
    const [exams, total] = await Promise.all([
      Exam.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('uploadedBy', 'username name avatar subscribers'),
      Exam.countDocuments(filter),
    ]);

    return res.json({
      exams: exams.map((ex) => formatExamForClient(req, ex)),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return controllerError(res, next, error, 'listExams');
  }
}

// ── Get Single Exam ───────────────────────────────────────────────────────────

async function getExamController(req, res, next) {
  try {
    const userId = req.user._id;
    const exam = await Exam.findById(req.params.examId).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );

    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (!canAccessExam(exam, userId)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    return res.json(formatExamForClient(req, exam));
  } catch (error) {
    return controllerError(res, next, error, 'getExam');
  }
}

// ── Get Questions ─────────────────────────────────────────────────────────────

async function getQuestionsController(req, res, next) {
  try {
    const userId = req.user._id;
    const { examId } = req.params;

    // For duplicates, redirect to original exam's questions
    let resolvedExamId = examId;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (!canAccessExam(exam, userId)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (exam.isDuplicate && exam.originalExamId) {
      resolvedExamId = exam.originalExamId.toString();
    }

    const questions = await Question.find({ examId: resolvedExamId }).sort({
      questionIndex: 1,
    });

    return res.json({
      questions: questions.map(formatQuestion),
      total: questions.length,
    });
  } catch (error) {
    return controllerError(res, next, error, 'getQuestions');
  }
}

// ── Attempts ──────────────────────────────────────────────────────────────────

async function submitAttemptController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const { examId } = req.params;
    const { answers, flaggedQuestions = [] } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (!canAccessExam(exam, userId)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Resolve original exam id for duplicates
    const resolvedExamId =
      exam.isDuplicate && exam.originalExamId
        ? exam.originalExamId.toString()
        : examId;

    const questions = await Question.find({ examId: resolvedExamId }).sort({
      questionIndex: 1,
    });

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'answers must be an array.' });
    }

    // Score the attempt
    let correctCount = 0;
    const details = questions.map((q, i) => {
      const userAnswer = answers[i] ?? null;
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        questionId: q._id,
        question: q.question,
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        userAnswerText:
          userAnswer != null ? q.options[userAnswer] : 'No answer',
        correctAnswerText: q.options[q.correctAnswer],
        explanation: q.explanation,
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);

    const attempt = await Attempt.create({
      userId,
      examId,
      answers,
      flaggedQuestions,
      score,
      totalQuestions: questions.length,
      completedAt: new Date(),
    });

    return res.status(201).json({
      attemptId: attempt._id,
      score,
      correctCount,
      totalQuestions: questions.length,
      percentage: score,
      details,
    });
  } catch (error) {
    return controllerError(res, next, error, 'submitAttempt');
  }
}

async function getAttemptsController(req, res, next) {
  try {
    const userId = req.user._id;
    const { examId } = req.params;

    const attempts = await Attempt.find({ userId, examId })
      .sort({ createdAt: -1 })
      .limit(10);
    return res.json({ attempts });
  } catch (error) {
    return controllerError(res, next, error, 'getAttempts');
  }
}

// ── Update Exam Metadata ──────────────────────────────────────────────────────

async function updateExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const { examId } = req.params;
    const {
      filename,
      subject,
      topic,
      visibility,
      academicTrack,
      department,
      courseSubject,
      paperType,
    } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.uploadedBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Only the uploader can edit this exam.' });
    }

    if (filename !== undefined)
      exam.filename = filename.trim() || exam.filename;
    if (subject !== undefined) exam.subject = String(subject ?? '').trim();
    if (topic !== undefined) exam.topic = String(topic ?? '').trim();
    if (visibility !== undefined) {
      if (visibility !== 'public' && visibility !== 'private') {
        return res.status(400).json({ message: 'Invalid visibility value.' });
      }
      exam.visibility = visibility;
    }
    const PAPER_ENUM = EXAM_PAPER_TYPES;
    if (academicTrack !== undefined) {
      exam.academicTrack = String(academicTrack ?? '').trim().toLowerCase();
    }
    if (department !== undefined) {
      exam.department = String(department ?? '').trim();
    }
    if (courseSubject !== undefined) {
      exam.courseSubject = String(courseSubject ?? '').trim();
    }
    if (paperType !== undefined) {
      const pt = String(paperType ?? '').trim();
      if (!PAPER_ENUM.includes(pt)) {
        return res.status(400).json({ message: 'Invalid paper type.' });
      }
      exam.paperType = pt;
    }
    await exam.save();

    const refreshed = await Exam.findById(examId).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );
    return res.json(formatExamForClient(req, refreshed));
  } catch (error) {
    return controllerError(res, next, error, 'updateExam');
  }
}

// ── Reprocess failed PDF (retry extraction) ───────────────────────────────────

async function reprocessFailedExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.uploadedBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Only the uploader can retry processing.' });
    }
    if (exam.examKind === 'vault_compiled') {
      return res
        .status(400)
        .json({ message: 'Vault papers cannot be reprocessed.' });
    }
    if (exam.isDuplicate) {
      return res.status(400).json({
        message: 'Linked duplicate exams cannot be reprocessed.',
      });
    }
    if (exam.processingStatus !== 'failed') {
      return res.status(400).json({
        message: 'Only failed exams can be retried.',
      });
    }
    if (!exam.fileKey?.trim()) {
      return res.status(400).json({ message: 'No file on record for this exam.' });
    }

    let s3Response;
    try {
      s3Response = await s3Client.send(
        new GetObjectCommand({
          Bucket: ENV.AWS_BUCKET_NAME,
          Key: exam.fileKey.trim(),
        }),
      );
    } catch (s3Err) {
      console.error('[reprocessFailedExam] S3 get failed:', s3Err);
      return res.status(502).json({
        message:
          'Could not load the file from storage. Try uploading it again.',
      });
    }

    const bytes = await s3Response.Body.transformToByteArray();
    const fileBuffer = Buffer.from(bytes);
    const storedName = originalNameFromFileKey(exam.fileKey);

    let textContent = '';
    try {
      const extracted = await extractExamDocumentContent(fileBuffer, {
        mimetype: s3Response.ContentType || '',
        originalname: storedName,
      });
      textContent = extracted.textContent;
    } catch (docErr) {
      if (docErr.status === 400) {
        return res.status(400).json({ message: docErr.message });
      }
      console.warn(
        'Document analysis on reprocess — continuing without text:',
        docErr.message,
      );
    }

    const contentHash = textContent ? hashContent(textContent) : null;

    await Promise.all([
      Question.deleteMany({ examId }),
      Attempt.deleteMany({ examId }),
    ]);

    await Exam.findByIdAndUpdate(examId, {
      textContent,
      contentHash,
      processingStatus: 'pending',
      processingError: '',
      totalQuestions: 0,
      processingBatchCurrent: 0,
      processingBatchTotal: 0,
    });

    void runExamBackgroundProcessing(
      examId,
      fileBuffer,
      {
        mimetype: s3Response.ContentType || '',
        originalname: storedName,
      },
      userId,
      {
        extractionMode: exam.extractionMode || 'standard',
        filename: exam.filename || storedName,
      },
    );

    const populated = await Exam.findById(examId).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );
    return res.json(formatExamForClient(req, populated));
  } catch (error) {
    return controllerError(res, next, error, 'reprocessFailedExam');
  }
}

// ── Delete Exam ───────────────────────────────────────────────────────────────

async function deleteExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (exam.uploadedBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: 'Only the uploader can delete this exam.' });
    }

    // Delete S3 object (PDF uploads only; composed papers have no file)
    if ((!exam.examKind || exam.examKind === 'pdf') && exam.fileKey?.trim()) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: ENV.AWS_BUCKET_NAME,
            Key: exam.fileKey,
          }),
        );
      } catch (s3Err) {
        console.warn(
          `Failed to delete S3 object ${exam.fileKey}:`,
          s3Err.message,
        );
      }
    }

    // For non-duplicate exams, remove their questions and attempts too
    if (!exam.isDuplicate) {
      await Promise.all([
        Question.deleteMany({ examId }),
        Attempt.deleteMany({ examId }),
      ]);
    }

    await Exam.findByIdAndDelete(examId);

    return res.json({ message: 'Exam deleted.' });
  } catch (error) {
    return controllerError(res, next, error, 'deleteExam');
  }
}

// ── Social: reactions & saved shelf (parity with Library) ───────────────────────

async function reactToExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const { examId } = req.params;
    const { reaction } = req.body ?? {};

    if (!['like', 'dislike', null, 'none'].includes(reaction)) {
      return res.status(400).json({
        message: 'reaction must be like, dislike, or none',
      });
    }

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (!canAccessExam(exam, userId)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const uid = String(userId);
    exam.likedBy = (exam.likedBy || []).filter((id) => String(id) !== uid);
    exam.dislikedBy = (exam.dislikedBy || []).filter(
      (id) => String(id) !== uid,
    );

    if (reaction === 'like') exam.likedBy.push(userId);
    else if (reaction === 'dislike') exam.dislikedBy.push(userId);

    exam.likesCount = exam.likedBy.length;
    exam.dislikesCount = exam.dislikedBy.length;
    await exam.save();

    const refreshed = await Exam.findById(examId).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );
    return res.json(formatExamForClient(req, refreshed));
  } catch (err) {
    return controllerError(res, next, err, 'reactToExam');
  }
}

async function toggleSaveExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    if (!canAccessExam(exam, userId)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const uid = String(userId);
    const savedBy = Array.isArray(exam.savedBy) ? exam.savedBy : [];
    const hasSaved = savedBy.some((id) => String(id) === uid);

    if (hasSaved) {
      exam.savedBy = savedBy.filter((id) => String(id) !== uid);
    } else {
      exam.savedBy = [...savedBy, userId];
    }

    exam.savesCount = exam.savedBy.length;
    await exam.save();

    const refreshed = await Exam.findById(examId).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );
    return res.json(formatExamForClient(req, refreshed));
  } catch (err) {
    return controllerError(res, next, err, 'toggleSaveExam');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function canAccessExam(exam, userId) {
  const ownerId =
    exam.uploadedBy?._id != null
      ? exam.uploadedBy._id.toString()
      : (exam.uploadedBy?.toString?.() ?? String(exam.uploadedBy));
  return exam.visibility === 'public' || ownerId === userId.toString();
}

function formatQuestion(q) {
  return {
    id: q._id,
    questionIndex: q.questionIndex,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  };
}

export {
  deleteExamController,
  getAttemptsController,
  getExamController,
  getQuestionsController,
  listExamsController,
  reactToExamController,
  reprocessFailedExamController,
  submitAttemptController,
  toggleSaveExamController,
  updateExamController,
  uploadExamController,
};
