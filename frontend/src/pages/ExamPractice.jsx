import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  Keyboard,
  MoreHorizontal,
  UserRound,
} from 'lucide-react';
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

  useEffect(() => {
    if (submitted) return undefined;

    function onKeyDown(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT')
      ) {
        return;
      }

      const q = questions[currentIndex];
      if (!q?.options?.length) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentIndex((i) => Math.max(0, i - 1));
          return;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
          return;
        case 'f':
        case 'F':
          e.preventDefault();
          setFlagged((prev) => {
            const next = new Set(prev);
            const idx = currentIndex;
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
          });
          return;
        default:
          break;
      }

      const k = e.key.toLowerCase();
      const ai = 'abcde'.indexOf(k);
      if (ai !== -1 && ai < q.options.length) {
        e.preventDefault();
        setUserAnswers((prev) => {
          const next = [...prev];
          next[currentIndex] = ai;
          return next;
        });
        return;
      }

      const digit = Number.parseInt(e.key, 10);
      if (
        digit >= 1 &&
        digit <= q.options.length &&
        e.code.startsWith('Digit')
      ) {
        e.preventDefault();
        setUserAnswers((prev) => {
          const next = [...prev];
          next[currentIndex] = digit - 1;
          return next;
        });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitted, currentIndex, questions]);

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
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100/80 px-4 pb-14 pt-5 dark:from-[#06080c] dark:via-[#0a0f14] dark:to-[#06080c] md:min-h-screen md:px-6 md:pb-16 md:pt-7">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(6,182,212,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(6,182,212,0.08),transparent)]"
        aria-hidden
      />

      {/* ── Exam header ─────────────────────────────────────────────────────── */}
      <div className="relative mx-auto mb-6 max-w-5xl">
        <div className="mb-4">
          <BackToExamHubLink />
        </div>
        <div className="panel-card fade-in-up rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-lg shadow-slate-200/40 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-none md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400">
                Exam practice
                {isProcessing && (
                  <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800 dark:text-amber-200">
                    <span className="loading loading-spinner loading-xs text-amber-600" />
                    Live extraction
                  </span>
                )}
              </p>
              <h1
                className="font-display text-xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-2xl"
                title={exam.filename}
              >
                {exam.filename}
              </h1>
              <ExamCatalogStrip exam={exam} className="mt-1 opacity-95" />
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <div className="dropdown dropdown-end">
                <button
                  type="button"
                  tabIndex={0}
                  className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Exam options"
                  aria-label="Exam options"
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
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

          {/* Progress */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="tabular-nums tracking-tight">
                {answeredCount} / {questions.length}{' '}
                <span className="font-normal text-slate-400 dark:text-slate-500">
                  answered
                </span>
              </span>
              <span className="tabular-nums tracking-tight text-cyan-800 dark:text-cyan-300/90">
                Q{currentIndex + 1}{' '}
                <span className="font-normal text-slate-400 dark:text-slate-500">
                  of {questions.length}
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/70">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 via-cyan-600 to-teal-600 shadow-[0_0_20px_-2px_rgba(34,211,238,0.45)] transition-all duration-500 ease-out dark:from-cyan-500 dark:via-cyan-400 dark:to-teal-400 dark:shadow-[0_0_28px_-4px_rgba(34,211,238,0.35)]"
                style={{
                  width: `${
                    questions.length
                      ? (answeredCount / questions.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Study mode */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Study mode
            </span>
            <div className="inline-flex rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 dark:border-slate-600/70 dark:bg-slate-950/80">
              <button
                type="button"
                onClick={() => setMode('exam')}
                aria-pressed={mode === 'exam'}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  mode === 'exam'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-600/80'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Exam
                <span className="hidden font-normal opacity-75 sm:inline">
                  stealth
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode('normal')}
                aria-pressed={mode === 'normal'}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  mode === 'normal'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-white dark:ring-slate-600/80'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Practice
                <span className="hidden font-normal opacity-75 sm:inline">
                  show answers
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="relative mx-auto flex max-w-5xl gap-6">
        {/* Left sidebar — desktop always visible, mobile hidden */}
        <aside className="hidden lg:flex lg:w-64 xl:w-72 lg:flex-col lg:gap-4">
          <QuestionNav
            questions={questions}
            userAnswers={userAnswers}
            flagged={flagged}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
        </aside>

        {/* Main question */}
        <div className="min-w-0 flex-1 lg:pb-2">
          <div className="mb-4 flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-slate-200/40 text-[13px] font-bold text-cyan-800 dark:from-cyan-500/15 dark:to-slate-700/50 dark:text-cyan-200">
                ☰
              </span>
              Questions · {answeredCount}/{questions.length}{' '}
              <ChevronRight className="ml-auto h-4 w-4 opacity-60" aria-hidden />
            </button>
          </div>

          <article className="panel-card rounded-[1.65rem] border border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-200/30 ring-1 ring-slate-100/90 md:p-10 dark:border-slate-600/55 dark:bg-gradient-to-br dark:from-[#12181f]/95 dark:via-[#0f151c]/98 dark:to-[#0d1218] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] dark:ring-cyan-500/10">
            <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100/90 pb-5 dark:border-slate-700/55">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500/15 to-teal-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-800 ring-1 ring-cyan-500/25 dark:from-cyan-500/20 dark:to-transparent dark:text-cyan-200 dark:ring-cyan-400/30">
                  Question {currentIndex + 1}
                </span>
                {flagged.has(currentIndex) ? (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-100">
                    Flagged
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={toggleFlag}
                aria-pressed={flagged.has(currentIndex)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 ${
                  flagged.has(currentIndex)
                    ? 'border-amber-400/60 bg-amber-500/10 text-amber-900 shadow-inner dark:bg-amber-500/15 dark:text-amber-100'
                    : 'border-slate-200/90 text-slate-600 hover:border-amber-300/70 hover:bg-amber-50/80 dark:border-slate-600 dark:text-slate-300 dark:hover:border-amber-500/35 dark:hover:bg-amber-950/25'
                }`}
              >
                <Flag
                  className={`h-3.5 w-3.5 ${flagged.has(currentIndex) ? 'fill-amber-500 text-amber-600 dark:text-amber-300' : ''}`}
                  aria-hidden
                />
                {flagged.has(currentIndex) ? 'Flagged' : 'Flag for review'}
              </button>
            </header>

            <div className="prose prose-slate prose-lg max-w-none dark:prose-invert dark:max-w-none">
              <p
                className="font-display text-lg font-medium leading-relaxed tracking-tight text-slate-900 dark:text-white md:text-xl md:leading-snug [&_strong]:font-semibold"
                style={{ WebkitFontSmoothing: 'antialiased' }}
              >
                {current.question}
              </p>
            </div>

            <fieldset className="mt-8 space-y-3 border-0 p-0">
              <legend className="sr-only">Answer choices</legend>
              {current.options.map((option, idx) => (
                <OptionButton
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional MCQ slots
                  key={`${currentIndex}-${idx}`}
                  option={option}
                  index={idx}
                  selected={userAnswers[currentIndex] === idx}
                  correct={current.correctAnswer}
                  showResult={
                    mode === 'normal' && userAnswers[currentIndex] !== null
                  }
                  onSelect={() => selectAnswer(idx)}
                />
              ))}
            </fieldset>

            {mode === 'normal' && userAnswers[currentIndex] !== null ? (
              <ExplanationBlock question={current} navigate={navigate} />
            ) : null}
          </article>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 lg:items-center lg:justify-between lg:gap-4">
            <div className="order-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 lg:order-2 lg:flex-1 lg:justify-center">
              <span className="inline-flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5 opacity-70" aria-hidden />
                ← → Navigate
              </span>
              <span className="hidden sm:inline opacity-60" aria-hidden>
                ·
              </span>
              <span className="hidden sm:inline">A–E Select</span>
              <span className="hidden sm:inline opacity-60" aria-hidden>
                ·
              </span>
              <span className="hidden sm:inline">F Flag</span>
            </div>
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="order-1 inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200/95 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="order-2 inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-500 hover:to-teal-500 hover:shadow-cyan-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 lg:order-3"
              >
                Next
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={submitQuiz}
                disabled={submitting}
                className="order-2 inline-flex shrink-0 items-center rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 lg:order-3"
              >
                {submitting ? 'Submitting…' : 'Submit exam'}
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
            className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm dark:bg-black/60"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative z-10 flex h-full w-[min(20rem,100vw)] flex-col border-r border-slate-200/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#111820] dark:shadow-[4px_0_40px_-10px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-700/80">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                All questions
              </h3>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
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
    <div className="mt-8 rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-50/95 to-white px-5 py-4 dark:border-cyan-500/20 dark:from-cyan-950/40 dark:to-slate-900/40">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-400">
        Explanation
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {question.explanation}
      </p>
      <button
        type="button"
        onClick={() =>
          navigate('/liqu-ai/study-buddy', {
            state: {
              prefill: `Explain this exam question in detail:\n\nQuestion: ${question.question}\n\nCorrect Answer: ${question.options[question.correctAnswer]}\n\nOriginal Explanation: ${question.explanation}\n\nPlease provide a deeper explanation with examples.`,
            },
          })
        }
        className="mt-3 rounded-xl border border-cyan-400/40 bg-white/90 px-4 py-2 text-xs font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50 dark:border-cyan-500/35 dark:bg-slate-800 dark:text-cyan-200 dark:hover:bg-slate-700/80"
      >
        Explain deeper with Liqu AI →
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
    <div className="panel-card rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-md shadow-slate-200/20 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/70 dark:shadow-none">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
          Questions
        </h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {questions.length}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
        {questions.map((_, i) => {
          let cls =
            'aspect-square min-h-9 rounded-xl border text-xs font-bold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ';
          if (i === currentIndex) {
            cls +=
              'border-cyan-500 bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-500/30';
          } else if (userAnswers[i] !== null) {
            cls +=
              'border-emerald-400/50 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-300';
          } else {
            cls +=
              'border-slate-200/90 bg-white text-slate-600 hover:border-cyan-300/80 hover:bg-cyan-50/50 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-cyan-500/35 dark:hover:bg-slate-700/70';
          }
          if (flagged.has(i)) cls += ' ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900';

          return (
            <button
              key={questions[i]?.id ?? `q-nav-${i}`}
              type="button"
              className={cls}
              onClick={() => onSelect(i)}
              aria-current={i === currentIndex ? 'true' : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded-md border border-emerald-400/70 bg-emerald-500/20 shadow-sm dark:bg-emerald-500/35" />
            Answered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded-md border border-slate-300 bg-white shadow-sm dark:border-slate-500 dark:bg-slate-700" />
            Unanswered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded-md border border-amber-400/80 bg-transparent ring-2 ring-amber-400/90 ring-offset-1 ring-offset-white dark:ring-offset-slate-900" />
            Flagged
          </span>
        </div>
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
    'group flex w-full items-start gap-3 rounded-2xl border px-5 py-4 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#12181f] ';

  if (showResult) {
    if (index === correct) {
      cls +=
        'border-emerald-500/70 bg-gradient-to-br from-emerald-50 to-teal-50/80 font-medium text-emerald-950 shadow-inner dark:border-emerald-700/75 dark:from-emerald-950/50 dark:to-emerald-900/35 dark:text-emerald-100';
    } else if (selected && index !== correct) {
      cls +=
        'border-rose-500/65 bg-gradient-to-br from-rose-50 to-rose-50/50 font-medium text-rose-950 dark:border-rose-800 dark:from-rose-950/40 dark:to-transparent dark:text-rose-50';
    } else {
      cls +=
        'border-slate-200/95 bg-white/95 text-slate-600 opacity-80 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400';
    }
  } else if (selected) {
    cls +=
      'border-cyan-500 bg-gradient-to-br from-cyan-50 to-white font-semibold text-slate-900 shadow-md shadow-cyan-500/15 ring-1 ring-cyan-500/30 dark:border-cyan-400 dark:from-cyan-950/45 dark:to-slate-900/70 dark:text-white dark:shadow-cyan-500/15';
  } else {
    cls +=
      'cursor-pointer border-slate-200/90 bg-white text-slate-800 hover:border-cyan-400/60 hover:bg-gradient-to-br hover:from-cyan-500/10 hover:to-white dark:border-slate-600 dark:bg-slate-800/85 dark:text-slate-100 dark:hover:border-cyan-500/50 dark:hover:from-cyan-500/10 dark:hover:to-slate-800/90';
  }

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  return (
    <button type="button" className={cls} onClick={onSelect}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums transition ${
          showResult && index === correct
            ? 'bg-emerald-600 text-white dark:bg-emerald-500'
            : showResult && selected && index !== correct
              ? 'bg-rose-600 text-white dark:bg-rose-500'
              : selected && !showResult
                ? 'bg-cyan-600 text-white dark:bg-cyan-500'
                : 'border border-slate-200/95 bg-slate-50 text-slate-700 group-hover:border-cyan-300/80 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:group-hover:border-cyan-500/55'
        }`}
      >
        {LETTERS[index]}
      </span>
      <span className="min-w-0 flex-1 leading-relaxed">{option}</span>
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
