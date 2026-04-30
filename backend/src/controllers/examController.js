import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.js';
import { s3Client } from '../config/s3Client.js';
import Attempt from '../models/Attempt.js';
import Exam from '../models/Exam.js';
import Question from '../models/Question.js';
import { processExamInBatches } from '../services/batchService.js';
import {
  analyzePDF,
  extractImagesFromPDF,
  extractTextFromPDF,
  hashContent,
} from '../services/pdfService.js';
import { uploadFileToS3 } from '../services/uploadService.js';
import {
  EXAM_PAPER_TYPES,
  validateExamPdfCatalogMeta,
} from '../utils/examCatalogMeta.js';
import { formatExamForClient } from '../utils/examJson.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

// ── Upload & Process ──────────────────────────────────────────────────────────

async function uploadExamController(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const file = req.file ?? (Array.isArray(req.files) ? req.files[0] : null);
    if (!file)
      return res.status(400).json({ message: 'No PDF file uploaded.' });

    // Upload raw PDF to S3
    const s3Result = await uploadFileToS3(file, `${userId}/exams`);

    // Extract text to build content hash for deduplication
    let textContent = '';
    let isImageBased = false;
    try {
      const analysis = await analyzePDF(file.buffer);
      isImageBased = analysis.isImageBased;
      if (!isImageBased) {
        textContent = await extractTextFromPDF(file.buffer);
      }
    } catch (pdfErr) {
      console.warn(
        'PDF analysis failed — will process without text:',
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
      String(file.originalname || 'exam.pdf').replace(/\.pdf$/i, '').trim() ||
      file.originalname ||
      'Untitled exam';

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
      ...catalogFields,
    });

    const pdfBuffer = file.buffer;
    (async () => {
      try {
        let content;
        if (isImageBased) {
          content = await extractImagesFromPDF(pdfBuffer);
        } else {
          content = textContent;
        }
        await processExamInBatches(exam._id.toString(), content, userId);
      } catch (err) {
        console.error(
          `Background processing failed for exam ${exam._id}:`,
          err,
        );
        await Exam.findByIdAndUpdate(exam._id, {
          processingStatus: 'failed',
          processingError: err.message,
        }).catch(() => {});
      }
    })();

    const populatedNew = await Exam.findById(exam._id).populate(
      'uploadedBy',
      'username name avatar subscribers',
    );
    return res.status(201).json(formatExamForClient(req, populatedNew));
  } catch (error) {
    return next(error);
  }
}

// ── List Exams ────────────────────────────────────────────────────────────────

async function listExamsController(req, res, next) {
  try {
    const userId = req.user._id;
    const { subject, status, search, page = 1, limit = 20 } = req.query;

    const filter = {
      $or: [{ uploadedBy: userId }, { visibility: 'public' }],
    };

    if (status) filter.processingStatus = status;
    if (subject) filter.subject = new RegExp(subject, 'i');
    if (search) {
      filter.$and = [
        filter.$and ?? [],
        {
          $or: [
            { filename: new RegExp(search, 'i') },
            { topic: new RegExp(search, 'i') },
            { subject: new RegExp(search, 'i') },
            { department: new RegExp(search, 'i') },
            { courseSubject: new RegExp(search, 'i') },
          ],
        },
      ].flat();
    }

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
    return next(error);
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
    return next(error);
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
    return next(error);
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
    return next(error);
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
    return next(error);
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
    return next(error);
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
    return next(error);
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
    next(err);
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
    next(err);
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
  submitAttemptController,
  toggleSaveExamController,
  updateExamController,
  uploadExamController,
};
