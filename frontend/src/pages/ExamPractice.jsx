import { ArrowLeft, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSocket } from '../contexts/SocketContext';
import { academicTrackLabel } from '../utils/bookUploadMeta';
import { examPaperTypeLabel } from '../utils/examPaperLabels';
import { readJsonOrThrow } from '../utils/http';

// Ported quiz logic from did-exit/js/quiz-manager.js and ai-integration.js (analyzeAnswers)

const STATUS_LABELS = {
  pending: 'Queued',
  processing: 'Extracting questions…',
  complete: 'Ready',
  failed: 'Processing failed',
};

const EXAMS_HUB_PATH = '/liqu-ai/exams';

function ExamCatalogStrip({ exam, className = '' }) {
  const uid = exam?.uploadedBy?.id ?? exam?.uploadedBy?._id;
  const chips = [];
  const ptLabel = examPaperTypeLabel(exam?.paperType);
  if (ptLabel && ptLabel !== 'Paper') {
    chips.push({ key: 'pt', label: ptLabel });
  }
  const track = academicTrackLabel(exam?.academicTrack);
  if (track) chips.push({ key: 'track', label: track });
  if (exam?.department?.trim())
    chips.push({ key: 'dept', label: exam.department.trim() });
  if (exam?.courseSubject?.trim())
    chips.push({ key: 'course', label: exam.courseSubject.trim() });

  if (
    chips.length === 0 &&
    !exam?.uploadedBy?.username &&
    !exam?.subject &&
    !exam?.topic
  )
    return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400 ${className}`}
    >
      {chips.map((c) => (
        <span
          key={c.key}
          className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {c.label}
        </span>
      ))}
      {(exam?.subject || exam?.topic) && (
        <span className="text-slate-500 dark:text-slate-400">
          {[exam.subject, exam.topic].filter(Boolean).join(' · ')}
        </span>
      )}
      {exam?.uploadedBy?.username ? (
        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <UserRound className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <span className="text-slate-400">Curated by</span>
          <Link
            to={uid ? `/users/${uid}` : EXAMS_HUB_PATH}
            className="font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
          >
            @{exam.uploadedBy.username}
          </Link>
        </span>
      ) : null}
    </div>
  );
}

function BackToExamHubLink({ variant = 'primary' }) {
  let cls =
    'inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-cyan-300/60 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-cyan-600/55 dark:hover:text-cyan-100';
  if (variant === 'muted') {
    cls =
      'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white';
  }
  return (
    <Link to={EXAMS_HUB_PATH} className={cls}>
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Exam studio
    </Link>
  );
}

// ── analyzeAnswers — ported verbatim from did-exit/js/ai-integration.js ──────

function analyzeAnswers(questions, userAnswers) {
  const totalQuestions = questions.length;
  let correctCount = 0;
  const details = questions.map((question, index) => {
    const userAnswer = userAnswers[index] ?? null;
    const isCorrect = userAnswer === question.correctAnswer;
    if (isCorrect) correctCount++;
    return {
      questionId: question.id,
      question: question.question,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      userAnswerText:
        userAnswer != null ? question.options[userAnswer] : 'No answer',
      correctAnswerText: question.options[question.correctAnswer],
      explanation: question.explanation,
    };
  });

  const incorrectCount = totalQuestions - correctCount;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  return {
    totalQuestions,
    correctCount,
    incorrectCount,
    score: `${correctCount}/${totalQuestions}`,
    percentage,
    details,
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ExamPractice() {
  const { examId } = useParams();
  const socket = useSocket();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const fetchExamData = useCallback(async () => {
    try {
      const [examRes, questionsRes] = await Promise.all([
        fetch(`/api/exams/${examId}`, { credentials: 'include' }),
        fetch(`/api/exams/${examId}/questions`, { credentials: 'include' }),
      ]);
      const examData = await readJsonOrThrow(examRes, 'Failed to load exam');
      const qData = await readJsonOrThrow(
        questionsRes,
        'Failed to load questions',
      );
      setExam(examData);
      setQuestions(qData.questions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  // Join exam socket room for real-time batch updates
  useEffect(() => {
    if (!socket) return;
    socket.emit('joinExamRoom', { examId });
    return () => socket.emit('leaveExamRoom', { examId });
  }, [socket, examId]);

  // Subscribe to batch completion to append new questions live
  useEffect(() => {
    if (!socket) return;

    function onBatchComplete({ examId: eid, newQuestionCount }) {
      if (eid !== examId) return;
      // Refresh questions from backend to get the new ones
      fetch(`/api/exams/${examId}/questions`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.questions) {
            setQuestions(d.questions);
            toast.info(`+${newQuestionCount} new questions available`);
          }
        })
        .catch(() => {});
    }

    function onProcessingComplete({ examId: eid }) {
      if (eid !== examId) return;
      setExam((prev) =>
        prev ? { ...prev, processingStatus: 'complete' } : prev,
      );
      clearInterval(pollRef.current);
    }

    function onProcessingFailed({ examId: eid }) {
      if (eid !== examId) return;
      setExam((prev) =>
        prev ? { ...prev, processingStatus: 'failed' } : prev,
      );
      clearInterval(pollRef.current);
    }

    socket.on('exam:batchComplete', onBatchComplete);
    socket.on('exam:processingComplete', onProcessingComplete);
    socket.on('exam:processingFailed', onProcessingFailed);

    return () => {
      socket.off('exam:batchComplete', onBatchComplete);
      socket.off('exam:processingComplete', onProcessingComplete);
      socket.off('exam:processingFailed', onProcessingFailed);
    };
  }, [socket, examId]);

  // Poll while still processing (fallback for when socket isn't available)
  useEffect(() => {
    if (
      exam?.processingStatus === 'processing' ||
      exam?.processingStatus === 'pending'
    ) {
      pollRef.current = setInterval(fetchExamData, 5000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [exam, fetchExamData]);

  if (loading) {
    return (
      <div className="page-surface flex items-center justify-center py-24 text-slate-500">
        <span className="loading loading-spinner mr-2" />
        Loading exam…
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-surface px-4 py-16 text-center">
        <p className="text-rose-600">{error}</p>
        <div className="mt-6 flex justify-center">
          <BackToExamHubLink />
        </div>
      </div>
    );
  }

  if (!exam) return null;

  const isFailed = exam.processingStatus === 'failed';

  // Allow practice when questions are available (even while still processing)
  if (questions.length > 0) {
    return (
      <QuizSession
        exam={exam}
        questions={questions}
        examId={examId}
        onExamUpdate={setExam}
      />
    );
  }

  // No questions yet — show waiting/failure screen
  const isProcessing =
    exam.processingStatus === 'processing' ||
    exam.processingStatus === 'pending';

  return (
    <div className="page-surface flex flex-col items-center justify-center px-4 py-16 text-center md:py-24">
      <div className="mb-8 w-full max-w-md">
        <BackToExamHubLink />
      </div>
      <div className="panel-card w-full max-w-md rounded-3xl p-8">
        <p className="font-display text-xl text-slate-900 dark:text-slate-50">
          {exam.filename}
        </p>
        <p
          className={`mt-3 text-sm ${isFailed ? 'text-rose-600' : 'text-slate-500'}`}
        >
          {STATUS_LABELS[exam.processingStatus]}
        </p>
        {isProcessing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
            <span className="loading loading-spinner loading-sm" />
            Questions are being extracted…
          </div>
        )}
        <div className="mt-6 flex justify-center">
          <BackToExamHubLink variant="muted" />
        </div>
      </div>
    </div>
  );
}

// ── Quiz Session ──────────────────────────────────────────────────────────────

function QuizSession({ exam, questions, examId, onExamUpdate }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('exam'); // 'exam' | 'normal'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState(() =>
    new Array(questions.length).fill(null),
  );
  const [flagged, setFlagged] = useState(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit/delete state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(exam.filename);
  const [editSubject, setEditSubject] = useState(exam.subject ?? '');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isProcessing =
    exam.processingStatus === 'processing' ||
    exam.processingStatus === 'pending';

  // Extend userAnswers when new questions arrive mid-session
  const questionsLenRef = useRef(questions.length);
  useEffect(() => {
    if (questions.length > questionsLenRef.current) {
      setUserAnswers((prev) => {
        const extra = new Array(questions.length - prev.length).fill(null);
        return [...prev, ...extra];
      });
      questionsLenRef.current = questions.length;
    }
  }, [questions.length]);

  const current = questions[currentIndex];
  const answeredCount = userAnswers.filter((a) => a !== null).length;

  function selectAnswer(optionIndex) {
    if (submitted) return;
    setUserAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  }

  function toggleFlag() {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  }

  async function submitQuiz() {
    setSubmitting(true);
    const res = analyzeAnswers(questions, userAnswers);
    setResults(res);
    setSubmitted(true);

    fetch(`/api/exams/${examId}/attempts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: userAnswers,
        flaggedQuestions: Array.from(flagged),
      }),
    }).catch(() => {});

    setSubmitting(false);
  }

  function restartQuiz() {
    setUserAnswers(new Array(questions.length).fill(null));
    setFlagged(new Set());
    setSubmitted(false);
    setResults(null);
    setCurrentIndex(0);
    setMobileNavOpen(false);
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: editTitle, subject: editSubject }),
      });
      const data = await readJsonOrThrow(res, 'Failed to update');
      onExamUpdate(data);
      setEditOpen(false);
      toast.success('Exam updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteExam() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Delete failed');
      }
      toast.success('Exam deleted');
      navigate(EXAMS_HUB_PATH);
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (submitted && results) {
    return (
      <ResultsScreen
        exam={exam}
        results={results}
        onRestart={restartQuiz}
        onReview={() => {
          setSubmitted(false);
          setCurrentIndex(0);
        }}
      />
    );
  }

  return (
    <div className="page-surface px-4 pb-10 pt-6 md:px-6 md:pt-8">
      {/* ── Exam header ─────────────────────────────────────────────────────── */}
      <div className="mx-auto mb-4 max-w-5xl">
        <div className="mb-3">
          <BackToExamHubLink />
        </div>
        <div className="panel-card fade-in-up rounded-3xl border border-slate-200/80 p-4 dark:border-slate-700 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
                Exam Practice
                {isProcessing && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/55 dark:text-amber-200">
                    <span className="loading loading-spinner loading-xs" />
                    Still extracting…
                  </span>
                )}
              </p>
              <h1
                className="mt-0.5 truncate font-display text-lg text-slate-900 dark:text-slate-50"
                title={exam.filename}
              >
                {exam.filename}
              </h1>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <div className="dropdown dropdown-end">
                <button
                  type="button"
                  tabIndex={0}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Options"
                >
                  ⋯
                </button>
                <ul className="menu menu-sm dropdown-content z-[999] mt-1 w-44 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitle(exam.filename);
                        setEditSubject(exam.subject ?? '');
                        setEditOpen(true);
                      }}
                      className="rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Edit details
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-900/70 dark:hover:bg-rose-950/35"
                    >
                      Delete exam
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {answeredCount} / {questions.length} answered
              </span>
              <span>
                Q {currentIndex + 1} of {questions.length}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-slate-800 transition-all duration-300"
                style={{
                  width: `${(answeredCount / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-slate-600">Mode:</span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="mode"
                value="exam"
                checked={mode === 'exam'}
                onChange={() => setMode('exam')}
                className="radio radio-xs radio-primary"
              />
              <span className="text-xs font-medium text-slate-700">Exam</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="radio"
                name="mode"
                value="normal"
                checked={mode === 'normal'}
                onChange={() => setMode('normal')}
                className="radio radio-xs radio-primary"
              />
              <span className="text-xs font-medium text-slate-700">
                Practice (show answers)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: sidebar + question ───────────────────────────── */}
      <div className="mx-auto flex max-w-5xl gap-4">
        {/* Left sidebar — desktop always visible, mobile hidden */}
        <aside className="hidden lg:flex lg:w-64 xl:w-72 lg:flex-col lg:gap-3">
          <QuestionNav
            questions={questions}
            userAnswers={userAnswers}
            flagged={flagged}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </aside>

        {/* Main question area */}
        <div className="flex-1 min-w-0">
          {/* Mobile: hamburger to open drawer */}
          <div className="mb-3 flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ☰ Questions ({answeredCount}/{questions.length})
            </button>
          </div>

          {/* Question card */}
          <div className="panel-card rounded-3xl p-5 md:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Question {currentIndex + 1}
              </span>
              <button
                type="button"
                onClick={toggleFlag}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  flagged.has(currentIndex)
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {flagged.has(currentIndex) ? '⚑ Flagged' : '⚐ Flag'}
              </button>
            </div>

            <p className="font-display text-lg leading-snug text-slate-900 md:text-xl">
              {current.question}
            </p>

            <div className="mt-5 space-y-2">
              {current.options.map((option, idx) => (
                <OptionButton
                  // biome-ignore lint/suspicious/noArrayIndexKey: options are positional — index IS the semantic key
                  key={`${currentIndex}-${idx}`}
                  option={option}
                  index={idx}
                  selected={userAnswers[currentIndex] === idx}
                  correct={current.correctAnswer}
                  showResult={
                    mode === 'normal' && userAnswers[currentIndex] !== null
                  }
                  submitted={submitted}
                  onSelect={() => selectAnswer(idx)}
                />
              ))}
            </div>

            {/* Explanation (normal mode only) */}
            {mode === 'normal' && userAnswers[currentIndex] !== null && (
              <ExplanationBlock question={current} navigate={navigate} />
            )}
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-40"
            >
              ← Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={submitQuiz}
                disabled={submitting}
                className="btn-primary bg-emerald-600 px-5 py-2.5 text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Quiz'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[9999] flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative z-10 flex h-full w-72 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-display text-base text-slate-900">
                All Questions
              </h3>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <QuestionNav
                questions={questions}
                userAnswers={userAnswers}
                flagged={flagged}
                currentIndex={currentIndex}
                onSelect={(i) => {
                  setCurrentIndex(i);
                  setMobileNavOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setEditOpen(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-slate-900">Edit Exam</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <label
              htmlFor="exam-edit-title"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Title
            </label>
            <input
              id="exam-edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-field mb-3 w-full text-sm"
            />
            <label
              htmlFor="exam-edit-subject"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Subject
            </label>
            <input
              id="exam-edit-subject"
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="e.g. Biology, Mathematics…"
              className="input-field mb-5 w-full text-sm"
            />
            <button
              type="button"
              onClick={saveEdit}
              disabled={editSaving}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setConfirmDelete(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h2 className="font-display text-lg text-slate-900">
              Delete exam?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              This will permanently delete the exam and all its questions. This
              action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={deleteExam}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Explanation block with "Explain further" button ───────────────────────────

function ExplanationBlock({ question, navigate }) {
  return (
    <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
        Explanation
      </p>
      <p className="mt-1 text-sm text-slate-700">{question.explanation}</p>
      <button
        type="button"
        onClick={() =>
          navigate('/liqu-ai/study-buddy', {
            state: {
              prefill: `Explain this exam question in detail:\n\nQuestion: ${question.question}\n\nCorrect Answer: ${question.options[question.correctAnswer]}\n\nOriginal Explanation: ${question.explanation}\n\nPlease provide a deeper explanation with examples.`,
            },
          })
        }
        className="mt-2 rounded-full border border-cyan-300 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition"
      >
        Explain further with Liqu AI →
      </button>
    </div>
  );
}

// ── Left sidebar question navigator ──────────────────────────────────────────

function QuestionNav({
  questions,
  userAnswers,
  flagged,
  currentIndex,
  onSelect,
}) {
  return (
    <div className="panel-card rounded-2xl p-4">
      <h3 className="mb-3 font-display text-sm text-slate-900">
        Questions ({questions.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {questions.map((_, i) => {
          let cls =
            'h-9 w-9 rounded-xl border text-xs font-semibold transition ';
          if (i === currentIndex) {
            cls += 'border-cyan-500 bg-cyan-500 text-white';
          } else if (userAnswers[i] !== null) {
            cls += 'border-emerald-300 bg-emerald-50 text-emerald-700';
          } else {
            cls +=
              'border-slate-200 bg-white text-slate-600 hover:border-cyan-300';
          }
          if (flagged.has(i)) cls += ' ring-2 ring-amber-400';

          return (
            <button
              key={questions[i]?.id ?? `q-nav-${i}`}
              type="button"
              className={cls}
              onClick={() => onSelect(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded border border-emerald-300 bg-emerald-100" />
          Answered
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded border border-slate-200 bg-white" />
          Unanswered
        </span>
        <span>
          <span className="mr-1 inline-block h-3 w-3 rounded border border-slate-200 bg-white ring-2 ring-amber-400" />
          Flagged
        </span>
      </div>
    </div>
  );
}

// ── Option Button ─────────────────────────────────────────────────────────────

function OptionButton({
  option,
  index,
  selected,
  correct,
  showResult,
  onSelect,
}) {
  let cls =
    'w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition cursor-pointer ';

  if (showResult) {
    if (index === correct) {
      cls += 'border-emerald-400 bg-emerald-50 text-emerald-800';
    } else if (selected && index !== correct) {
      cls += 'border-rose-400 bg-rose-50 text-rose-800';
    } else {
      cls += 'border-slate-200 bg-white text-slate-700';
    }
  } else if (selected) {
    cls += 'border-cyan-500 bg-cyan-50 text-cyan-900 shadow-sm';
  } else {
    cls +=
      'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50';
  }

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  return (
    <button type="button" className={cls} onClick={onSelect}>
      <span className="mr-3 font-semibold">{LETTERS[index]}.</span>
      {option}
    </button>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────

function ResultsScreen({ exam, results, onRestart, onReview }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const grade = getGrade(results.percentage);

  return (
    <div className="page-surface px-4 pb-10 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto mb-6 max-w-3xl">
        <BackToExamHubLink />
      </div>
      <div className="mx-auto max-w-3xl">
        {/* Score card */}
        <div className="panel-card fade-in-up mb-6 rounded-3xl p-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Results
          </p>
          <div className="mt-3 font-display text-6xl font-bold text-slate-900">
            {results.percentage}%
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-700">
            {grade}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {results.correctCount} correct · {results.incorrectCount} incorrect
            · {results.totalQuestions} total
          </p>
          <p
            className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500"
            title={exam.filename}
          >
            {exam.filename}
          </p>
          <ExamCatalogStrip
            exam={exam}
            className="mx-auto mt-3 max-w-lg justify-center"
          />

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onRestart}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onReview}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
              Review answers
            </button>
            <Link
              to={EXAMS_HUB_PATH}
              className="btn-secondary px-5 py-2.5 text-sm"
            >
              Exam studio
            </Link>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-3">
          {results.details.map((detail, i) => (
            <ResultItem
              key={detail.questionId ?? i}
              detail={detail}
              index={i}
              expanded={expandedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultItem({ detail, index, expanded, onToggle }) {
  return (
    <div
      className={`panel-card rounded-2xl border ${
        detail.isCorrect ? 'border-emerald-200' : 'border-rose-200'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            detail.isCorrect
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          {detail.isCorrect ? '✓' : '✗'}
        </span>
        <span className="flex-1 text-sm font-medium leading-snug text-slate-800">
          {index + 1}.{' '}
          {detail.question.length > 90
            ? `${detail.question.slice(0, 88)}…`
            : detail.question}
        </span>
        <span className="shrink-0 text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-100 px-4 pb-4 pt-3 text-sm">
          <p>
            <span className="font-semibold text-slate-600">Your answer: </span>
            <span
              className={
                detail.isCorrect ? 'text-emerald-700' : 'text-rose-700'
              }
            >
              {detail.userAnswerText}
            </span>
          </p>
          {!detail.isCorrect && (
            <p>
              <span className="font-semibold text-slate-600">
                Correct answer:{' '}
              </span>
              <span className="text-emerald-700">
                {detail.correctAnswerText}
              </span>
            </p>
          )}
          {detail.explanation && (
            <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                Explanation
              </p>
              <p className="mt-1 text-slate-700">{detail.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getGrade(pct) {
  if (pct >= 90) return 'Excellent';
  if (pct >= 75) return 'Good';
  if (pct >= 60) return 'Pass';
  if (pct >= 40) return 'Needs improvement';
  return 'Try again';
}

export default ExamPractice;
