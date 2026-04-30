import crypto from 'node:crypto';
import Exam from '../models/Exam.js';
import PersonalMcq from '../models/PersonalMcq.js';
import Question from '../models/Question.js';
import { EXAM_PAPER_TYPES } from '../utils/examCatalogMeta.js';
import { formatExamForClient } from '../utils/examJson.js';
import { assertCanWrite } from '../utils/userWriteAccess.js';

const MAX_PUBLISH_QUESTIONS = 100;
const MIN_PUBLISH_QUESTIONS = 1;
const MAX_PRACTICE_BATCH = 50;
const MAX_TAGS_PER_MCQ = 20;

function normalizeStem(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function stemHash(stem) {
  return crypto.createHash('sha256').update(normalizeStem(stem)).digest('hex');
}

function formatPersonalMcq(doc) {
  return {
    id: doc._id,
    question: doc.question,
    options: doc.options,
    correctAnswer: doc.correctAnswer,
    explanation: doc.explanation ?? '',
    subject: doc.subject ?? '',
    topic: doc.topic ?? '',
    tags: doc.tags ?? [],
    difficulty: doc.difficulty ?? 3,
    revisionNote: doc.revisionNote ?? '',
    clonedFromExamId: doc.clonedFromExamId,
    clonedFromQuestionId: doc.clonedFromQuestionId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function listVaultQuestions(req, res, next) {
  try {
    const userId = req.user._id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const subject = String(req.query.subject || '').trim();

    const filter = { owner: userId };
    if (subject) filter.subject = new RegExp(subject, 'i');
    if (search) {
      filter.$or = [
        { question: new RegExp(search, 'i') },
        { topic: new RegExp(search, 'i') },
        { tags: new RegExp(search, 'i') },
      ];
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      PersonalMcq.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PersonalMcq.countDocuments(filter),
    ]);

    return res.json({
      questions: rows.map((r) => formatPersonalMcq(r)),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
}

async function createVaultQuestion(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const {
      question,
      options,
      correctAnswer,
      explanation,
      subject,
      topic,
      tags,
      difficulty,
      revisionNote,
      clonedFromExamId,
      clonedFromQuestionId,
    } = req.body;

    const opts = options.map((o) => String(o ?? '').trim()).filter(Boolean);
    if (opts.length < 2 || opts.length > 5) {
      return res.status(400).json({
        message: 'Between 2 and 5 non-empty options required.',
      });
    }

    const doc = await PersonalMcq.create({
      owner: userId,
      question: question.trim(),
      options: opts,
      correctAnswer: Number(correctAnswer),
      explanation: explanation != null ? String(explanation).trim() : '',
      subject: subject != null ? String(subject).trim() : '',
      topic: topic != null ? String(topic).trim() : '',
      tags: Array.isArray(tags) ? tags.slice(0, MAX_TAGS_PER_MCQ) : [],
      difficulty:
        difficulty >= 1 && difficulty <= 5 ? Number(difficulty) : undefined,
      revisionNote: revisionNote != null ? String(revisionNote).trim() : '',
      clonedFromExamId: clonedFromExamId || null,
      clonedFromQuestionId: clonedFromQuestionId || null,
    });

    const fresh = await PersonalMcq.findById(doc._id).lean();
    return res.status(201).json(formatPersonalMcq(fresh));
  } catch (err) {
    next(err);
  }
}

async function updateVaultQuestion(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const doc = await PersonalMcq.findOne({
      _id: req.params.id,
      owner: userId,
    });
    if (!doc) return res.status(404).json({ message: 'Not found' });

    const {
      question,
      options,
      correctAnswer,
      explanation,
      subject,
      topic,
      tags,
      difficulty,
      revisionNote,
    } = req.body;

    if (question !== undefined) doc.question = String(question).trim();
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2) {
        return res
          .status(400)
          .json({ message: 'At least two options required' });
      }
      doc.options = options.map((o) => String(o ?? '').trim()).filter(Boolean);
    }
    if (correctAnswer !== undefined) doc.correctAnswer = Number(correctAnswer);
    if (explanation !== undefined) doc.explanation = String(explanation ?? '');
    if (subject !== undefined) doc.subject = String(subject ?? '').trim();
    if (topic !== undefined) doc.topic = String(topic ?? '').trim();
    if (tags !== undefined)
      doc.tags = Array.isArray(tags) ? tags.slice(0, MAX_TAGS_PER_MCQ) : [];
    if (difficulty !== undefined) {
      const d = Number(difficulty);
      if (d >= 1 && d <= 5) doc.difficulty = d;
    }
    if (revisionNote !== undefined)
      doc.revisionNote = String(revisionNote ?? '').trim();

    await doc.save();
    return res.json(formatPersonalMcq(doc.toObject()));
  } catch (err) {
    next(err);
  }
}

async function deleteVaultQuestion(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;
    const r = await PersonalMcq.deleteOne({
      _id: req.params.id,
      owner: userId,
    });
    if (r.deletedCount === 0)
      return res.status(404).json({ message: 'Not found' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns overlap ratio (0–1) of stems against recently published vault_compiled questions.
 */
async function computePublishStemOverlapWarning(questionStems) {
  const hashes = new Set(
    questionStems.map(normalizeStem).filter(Boolean).map(stemHash),
  );
  if (hashes.size === 0) return { overlapRatio: 0, similarCount: 0 };

  const recentExamIds = await Exam.find({
    examKind: 'vault_compiled',
    visibility: 'public',
    processingStatus: 'complete',
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .select('_id')
    .lean();

  const ids = recentExamIds.map((e) => e._id);
  if (!ids.length) return { overlapRatio: 0, similarCount: 0 };

  const qs = await Question.find({ examId: { $in: ids } })
    .select('question')
    .limit(500)
    .lean();

  let matchCount = 0;
  const checked = hashes.size;
  for (const q of qs) {
    const h = stemHash(q.question);
    if (hashes.has(h)) matchCount++;
  }

  const overlapRatio = checked ? Math.min(1, matchCount / checked) : 0;
  return {
    overlapRatio,
    similarCount: matchCount,
    message:
      matchCount >= 3
        ? `${matchCount}+ items may closely match stems others recently shared. Your paper will still publish; double-check originality.`
        : matchCount > 0
          ? `Some similarity with recent shared papers (${matchCount} stem overlap).`
          : null,
  };
}

async function publishVaultToBank(req, res, next) {
  try {
    assertCanWrite(req.user);
    const userId = req.user._id;

    const {
      title,
      subject,
      topic,
      questionIds,
      academicTrack,
      department,
      courseSubject,
      paperType,
    } = req.body;
    const ids = Array.isArray(questionIds) ? questionIds : [];

    if (!title?.trim())
      return res.status(400).json({ message: 'title is required' });
    if (ids.length < MIN_PUBLISH_QUESTIONS)
      return res.status(400).json({
        message: `Select at least ${MIN_PUBLISH_QUESTIONS} question(s).`,
      });
    if (ids.length > MAX_PUBLISH_QUESTIONS) {
      return res.status(400).json({
        message: `At most ${MAX_PUBLISH_QUESTIONS} questions per publication.`,
      });
    }

    const vaultRows = await PersonalMcq.find({
      _id: { $in: ids },
      owner: userId,
    }).lean();

    const byId = new Map(vaultRows.map((r) => [r._id.toString(), r]));
    const ordered = [];
    for (const id of ids) {
      const row = byId.get(String(id));
      if (!row) {
        return res
          .status(400)
          .json({ message: 'Invalid or foreign question id' });
      }
      ordered.push(row);
    }

    const stemWarning = await computePublishStemOverlapWarning(
      ordered.map((r) => r.question),
    );

    let pt = String(paperType || 'other').trim();
    if (!EXAM_PAPER_TYPES.includes(pt)) pt = 'other';

    const exam = await Exam.create({
      uploadedBy: userId,
      examKind: 'vault_compiled',
      filename: title.trim(),
      fileSize: 0,
      fileUrl: '',
      fileKey: '',
      totalQuestions: ordered.length,
      processingStatus: 'complete',
      subject: subject != null ? String(subject).trim() : '',
      topic: topic != null ? String(topic).trim() : '',
      visibility: 'public',
      textContent: '',
      academicTrack:
        academicTrack != null
          ? String(academicTrack).trim().toLowerCase()
          : '',
      department: department != null ? String(department).trim() : '',
      courseSubject:
        courseSubject != null ? String(courseSubject).trim() : '',
      paperType: pt,
    });

    const examId = exam._id;
    const qDocs = ordered.map((r, idx) => ({
      examId,
      questionIndex: idx,
      question: r.question,
      options: r.options,
      correctAnswer: r.correctAnswer,
      explanation: r.explanation || '',
      source: 'manual',
    }));
    await Question.insertMany(qDocs, { ordered: true });

    const populated = await Exam.findById(examId)
      .populate('uploadedBy', 'username name avatar subscribers')
      .lean();

    return res.status(201).json({
      exam: formatExamForClient(req, populated),
      warnings: stemWarning.message
        ? [{ code: 'stem_overlap', ...stemWarning }]
        : [],
    });
  } catch (err) {
    next(err);
  }
}

async function practiceBatch(req, res, next) {
  try {
    const userId = req.user._id;
    const count = Math.min(
      MAX_PRACTICE_BATCH,
      Math.max(1, Number(req.body?.count) || 10),
    );
    const subject = String(req.body?.subject || '').trim();

    const filter = { owner: userId };
    if (subject) filter.subject = new RegExp(subject, 'i');

    const total = await PersonalMcq.countDocuments(filter);
    if (total === 0) {
      return res.json({ questions: [], total: 0 });
    }

    const sampleSize = Math.min(count, total);
    const rows = await PersonalMcq.aggregate([
      { $match: filter },
      { $sample: { size: sampleSize } },
    ]);

    const questions = rows.map((r, i) => ({
      id: r._id,
      questionIndex: i,
      question: r.question,
      options: r.options,
      correctAnswer: r.correctAnswer,
      explanation: r.explanation ?? '',
    }));

    return res.json({ questions, total });
  } catch (err) {
    next(err);
  }
}

export {
  createVaultQuestion,
  deleteVaultQuestion,
  listVaultQuestions,
  practiceBatch,
  publishVaultToBank,
  updateVaultQuestion,
};
