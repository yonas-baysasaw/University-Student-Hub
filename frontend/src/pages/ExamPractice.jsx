import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Flag,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Trophy,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSocket } from '../contexts/SocketContext';
import { academicTrackLabel } from '../utils/bookUploadMeta';
import { examPaperTypeLabel } from '../utils/examPaperLabels';
import {
  clearSessionDraft,
  formatSavedAgo,
  getQuestionsSignature,
  loadSavedAttempt,
  loadSessionDraft,
  saveAttemptToDevice,
  saveSessionDraft,
} from '../utils/examPracticeStorage';
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

const TIMER_PRESETS_MIN = [
  { label: '25m', min: 25 },
  { label: '30m', min: 30 },
  { label: '45m', min: 45 },
  { label: '1h', min: 60 },
  { label: '1:30', min: 90 },
  { label: '2h', min: 120 },
];

function formatTimerMs(ms) {
  if (ms == null || ms < 0) return '0:00';
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSessionClock(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compact ring for “last score” panel (exam header). */
function MiniScoreRing({ correct, total, size = 58 }) {
  const pct = total > 0 ? correct / total : 0;
  const cx = size / 2;
  const r = Math.max(size * 0.32, 14);
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const sw = Math.max(size * 0.08, 3.25);
  const id = `miniGrad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90 shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.25)]"
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        className="stroke-slate-200/95 dark:stroke-white/[0.12]"
        strokeWidth={sw}
      />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

/** Replaces legacy keyboard shortcut panel: leads to graded results when available. */
function LastAttemptScorePanel({ lastAttempt, onOpenResults }) {
  const r = lastAttempt?.results;

  if (!r) {
    return (
      <div className="flex min-h-[8.75rem] flex-col justify-center rounded-xl border border-dashed border-slate-300/80 bg-slate-50/50 px-4 py-3 dark:border-slate-600/60 dark:bg-slate-950/35">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/90 dark:bg-slate-800/90">
            <Trophy className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              Score preview
            </p>
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              Submit once to save a graded scorecard here. Tap it anytime to reopen
              your full breakdown — persists on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const wrong = r.totalQuestions - r.correctCount;
  const pct = Math.min(100, Math.max(0, r.percentage));

  return (
    <button
      type="button"
      onClick={onOpenResults}
      className="group relative w-full min-h-[8.75rem] overflow-hidden rounded-xl border border-cyan-500/35 bg-gradient-to-br from-white via-slate-50/95 to-cyan-50/35 p-px text-left shadow-md shadow-cyan-500/15 transition hover:border-cyan-500/50 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.993] dark:border-cyan-500/25 dark:bg-gradient-to-br dark:from-[#0c1824] dark:via-[#0f1c28] dark:to-[#0a121c] dark:shadow-lg dark:shadow-cyan-500/10 dark:hover:border-cyan-400/40 dark:hover:shadow-cyan-500/20 dark:focus-visible:ring-cyan-400/70 dark:focus-visible:ring-offset-[#070b10] md:min-h-0"
      aria-label={`Open saved results: ${pct} percent`}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-cyan-500/15 blur-2xl transition group-hover:bg-cyan-400/20" />
      <div className="pointer-events-none absolute -bottom-10 -left-4 h-28 w-40 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="relative flex h-full min-h-[8.75rem] items-center gap-3 rounded-[inherit] bg-white/85 px-3 pb-7 pt-3 backdrop-blur-[2px] dark:bg-slate-950/80 md:min-h-[7.5rem]">
        <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
          <MiniScoreRing
            correct={r.correctCount}
            total={r.totalQuestions}
            size={60}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold tabular-nums leading-none text-slate-800 dark:text-white">
            {pct}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/90">
            <Sparkles className="h-3 w-3" aria-hidden />
            Last scorecard
          </span>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-slate-900 drop-shadow-sm dark:text-white">
            {pct}%
          </p>
          <p className="mt-1 text-[10px] leading-snug text-slate-600 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400/95">{r.correctCount}</span>
            {' correct'}
            <span className="text-slate-500 dark:text-slate-500">
              {' · '}
              <span className="text-rose-600 dark:text-rose-400/95">{wrong}</span> miss
              {wrong !== 1 ? 'es' : ''}
              {' · '}
            </span>
            saved {formatSavedAgo(lastAttempt.savedAt)}
          </p>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-cyan-600 transition-transform group-hover:translate-x-1 group-hover:text-cyan-500 dark:text-cyan-400/70 dark:group-hover:text-cyan-300"
          aria-hidden
        />
      </div>
      <span className="pointer-events-none absolute bottom-2.5 left-4 text-[9px] font-semibold uppercase tracking-wider text-cyan-700/90 dark:text-cyan-400/65">
        Open report →
      </span>
    </button>
  );
}

/**
 * Circular progress focus timer — preset chips + optional custom minutes.
 */
function ExamFocusTimer({
  totalMs,
  remainingMs,
  paused,
  expired,
  onPause,
  onResume,
  onReset,
  onPresetMinutes,
  customMinStr,
  setCustomMinStr,
  onApplyCustom,
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct =
    totalMs > 0
      ? Math.max(0, Math.min(1, (remainingMs ?? 0) / totalMs))
      : 0;
  const offset = c * (1 - pct);

  return (
    <div className="rounded-xl border border-slate-200/85 bg-slate-50/70 p-2.5 dark:border-slate-700/70 dark:bg-slate-950/40">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2 dark:border-slate-700/55">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          <Timer className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
          Timer
        </span>
        {(totalMs ?? 0) > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <RotateCcw className="h-2.5 w-2.5" aria-hidden />
            Off
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-2.5">
        <div
          className={`relative h-14 w-14 shrink-0 ${expired ? 'animate-[pulse_1.2s_ease-in-out_infinite]' : ''}`}
          aria-hidden={false}
        >
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <title>Countdown progress</title>
            <circle
              cx="36"
              cy="36"
              r={r}
              fill="none"
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="5"
            />
            <circle
              cx="36"
              cy="36"
              r={r}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              className={
                expired
                  ? 'stroke-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.35)] dark:stroke-rose-400'
                  : 'stroke-cyan-500 transition-[stroke-dashoffset] duration-[240ms] ease-linear dark:stroke-cyan-400'
              }
              style={{
                strokeDasharray: c,
                strokeDashoffset: offset,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
            <span
              className={`font-mono text-[10px] font-bold leading-none tabular-nums ${
                expired
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {formatTimerMs(remainingMs ?? 0)}
            </span>
          </div>
        </div>

        {(totalMs ?? 0) > 0 && (
          <button
            type="button"
            onClick={paused ? onResume : onPause}
            title={paused ? 'Resume' : 'Pause'}
            className="flex h-14 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-cyan-700 shadow-sm transition hover:bg-cyan-50 dark:border-slate-600 dark:bg-slate-800 dark:text-cyan-300 dark:hover:bg-slate-700"
          >
            {paused ? (
              <Play className="h-5 w-5 fill-current" aria-hidden />
            ) : (
              <Pause className="h-5 w-5" aria-hidden />
            )}
          </button>
        )}

        <div className="min-w-[10rem] flex-1 space-y-2">
          <div className="flex flex-wrap gap-1">
            {TIMER_PRESETS_MIN.map(({ label, min }) => (
              <button
                key={label}
                type="button"
                onClick={() => onPresetMinutes(min)}
                className="rounded-lg border border-slate-200/85 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-cyan-400/60 hover:bg-cyan-50 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-600 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Custom
              <input
                inputMode="numeric"
                type="text"
                placeholder="min"
                value={customMinStr}
                onChange={(e) => setCustomMinStr(e.target.value.replace(/[^\d]/g, ''))}
                className="w-12 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-center font-mono text-[10px] text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </label>
            <button
              type="button"
              onClick={onApplyCustom}
              className="rounded-md bg-cyan-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-cyan-500"
            >
              Set
            </button>
          </div>
        </div>
      </div>
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

  const questionsSig = useMemo(
    () => getQuestionsSignature(questions),
    [questions],
  );

  const timerRemainingRef = useRef(0);
  const draftBootstrapped = useRef(false);

  const [lastOfflineAttempt, setLastOfflineAttempt] = useState(null);
  const [resultsSource, setResultsSource] = useState(null); // 'live' | 'saved'
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [resultsSavedAtTs, setResultsSavedAtTs] = useState(null);

  const [timerTotalMs, setTimerTotalMs] = useState(null);
  const [timerRemainingMs, setTimerRemainingMs] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [customMinStr, setCustomMinStr] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    setLastOfflineAttempt(loadSavedAttempt(examId, questionsSig));
  }, [examId, questionsSig]);

  useEffect(() => {
    if (draftBootstrapped.current) return;
    const d = loadSessionDraft(examId, questionsSig);
    if (
      Array.isArray(d?.userAnswers) &&
      d.userAnswers.length === questions.length &&
      questions.length > 0
    ) {
      setUserAnswers(d.userAnswers);
      if (typeof d.currentIndex === 'number') {
        setCurrentIndex(
          Math.min(Math.max(0, d.currentIndex), questions.length - 1),
        );
      }
      if (Array.isArray(d.flaggedIndices) && d.flaggedIndices.length) {
        setFlagged(new Set(d.flaggedIndices));
      }
      if (d.mode === 'normal' || d.mode === 'exam') setMode(d.mode);
      toast.message('Draft restored', {
        description: 'Answers were recovered in this browser.',
      });
    }
    draftBootstrapped.current = true;
  }, [examId, questionsSig, questions.length]);

  useEffect(() => {
    if (submitted) return;
    const t = window.setTimeout(() => {
      saveSessionDraft(examId, questionsSig, {
        userAnswers,
        currentIndex,
        flaggedIndices: [...flagged],
        mode,
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [
    submitted,
    examId,
    questionsSig,
    userAnswers,
    currentIndex,
    flagged,
    mode,
  ]);

  useEffect(() => {
    timerRemainingRef.current = timerRemainingMs ?? 0;
  }, [timerRemainingMs]);

  useEffect(() => {
    if (!timerRunning || timerPaused) return undefined;
    const id = window.setInterval(() => {
      timerRemainingRef.current -= 280;
      const next = timerRemainingRef.current;
      if (next <= 0) {
        timerRemainingRef.current = 0;
        setTimerRemainingMs(0);
        setTimerRunning(false);
        setTimerPaused(false);
        setTimerExpired(true);
        toast.warning("Time's up", {
          description: "Pause and submit when you're ready—or keep refining.",
        });
        return;
      }
      setTimerRemainingMs(next);
    }, 280);
    return () => window.clearInterval(id);
  }, [timerRunning, timerPaused]);

  useEffect(() => {
    if (submitted) return undefined;
    const id = window.setInterval(() => setElapsedSec((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [submitted]);

  function applyTimerPresetMinutes(minutes) {
    const capped = Math.min(Math.max(1, minutes), 600);
    const ms = capped * 60 * 1000;
    setTimerTotalMs(ms);
    timerRemainingRef.current = ms;
    setTimerRemainingMs(ms);
    setTimerExpired(false);
    setTimerPaused(false);
    setTimerRunning(true);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerPaused(false);
    setTimerExpired(false);
    setTimerTotalMs(null);
    timerRemainingRef.current = 0;
    setTimerRemainingMs(null);
  }

  function pauseTimer() {
    setTimerPaused(true);
  }

  function resumeTimer() {
    if ((timerRemainingMs ?? 0) <= 0) return;
    setTimerPaused(false);
    setTimerRunning(true);
  }

  function viewOfflineResults() {
    if (!lastOfflineAttempt?.results) return;
    setResults(lastOfflineAttempt.results);
    setSubmitted(true);
    setResultsSource('saved');
    setResultsSavedAtTs(lastOfflineAttempt.savedAt);
  }

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

  const jumpToNextUnanswered = useCallback(() => {
    for (let step = 1; step <= questions.length; step++) {
      const j = (currentIndex + step) % questions.length;
      if (userAnswers[j] === null) {
        setCurrentIndex(j);
        return;
      }
    }
    toast.message('All questions answered');
  }, [currentIndex, questions.length, userAnswers]);

  const clearCurrentSelection = useCallback(() => {
    setUserAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = null;
      return next;
    });
  }, [currentIndex]);

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

  function runSubmit(force = false) {
    const unanswered = userAnswers.filter((a) => a === null).length;
    if (unanswered > 0 && !force) {
      setSubmitConfirmOpen(true);
      return;
    }
    setSubmitConfirmOpen(false);
    setSubmitting(true);
    const res = analyzeAnswers(questions, userAnswers);
    setResults(res);
    setSubmitted(true);
    setResultsSource('live');
    const ts = Date.now();
    saveAttemptToDevice(examId, questionsSig, res, exam.filename);
    setResultsSavedAtTs(ts);
    setLastOfflineAttempt({
      results: res,
      savedAt: ts,
      examFilename: exam.filename,
    });
    clearSessionDraft(examId);

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
    setResultsSource(null);
    setResultsSavedAtTs(null);
    setCurrentIndex(0);
    setMobileNavOpen(false);
    resetTimer();
    setElapsedSec(0);
    clearSessionDraft(examId);
    setLastOfflineAttempt(loadSavedAttempt(examId, questionsSig));
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
        case 'Backspace':
        case 'Escape':
          e.preventDefault();
          clearCurrentSelection();
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
        case 'j':
        case 'J':
          e.preventDefault();
          jumpToNextUnanswered();
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

      const np = /^Numpad(\d)$/.exec(e.code);
      if (np) {
        const digit = Number(np[1], 10);
        if (digit >= 1 && digit <= q.options.length) {
          e.preventDefault();
          setUserAnswers((prev) => {
            const next = [...prev];
            next[currentIndex] = digit - 1;
            return next;
          });
        }
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
  }, [
    submitted,
    currentIndex,
    questions,
    jumpToNextUnanswered,
    clearCurrentSelection,
  ]);

  if (submitted && results) {
    return (
      <ResultsScreen
        exam={exam}
        results={results}
        savedAtTs={resultsSavedAtTs}
        fromArchive={resultsSource === 'saved'}
        onRestart={restartQuiz}
        onReview={() => {
          setSubmitted(false);
          setCurrentIndex(0);
          setResultsSource(null);
        }}
      />
    );
  }

  const unansweredCount =
    questions.length - userAnswers.filter((a) => a !== null).length;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100/80 px-3 pb-12 pt-4 dark:from-[#06080c] dark:via-[#0a0f14] dark:to-[#06080c] md:px-5 md:pb-14 md:pt-5">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_42%_at_50%_-15%,rgba(6,182,212,0.1),transparent)] dark:bg-[radial-gradient(ellipse_65%_40%_at_50%_-8%,rgba(6,182,212,0.07),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto mb-4 max-w-4xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackToExamHubLink />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/85 bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-900/85 dark:text-slate-300">
              <Clock className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <span className="font-mono tabular-nums">
                Session {formatSessionClock(elapsedSec)}
              </span>
            </span>
            {lastOfflineAttempt?.results ? (
              <button
                type="button"
                onClick={viewOfflineResults}
                className="inline-flex items-center gap-1 rounded-full border border-violet-400/45 bg-violet-500/12 px-2.5 py-1 text-[10px] font-bold text-violet-900 shadow-sm dark:text-violet-100"
              >
                <Trophy className="h-3 w-3" aria-hidden />
                {lastOfflineAttempt.results.percentage}% ·{' '}
                {formatSavedAgo(lastOfflineAttempt.savedAt)}
              </button>
            ) : null}
            {unansweredCount > 0 ? (
              <button
                type="button"
                onClick={jumpToNextUnanswered}
                className="rounded-full border border-amber-500/35 bg-amber-500/12 px-2.5 py-1 text-[10px] font-bold text-amber-950 dark:text-amber-50"
              >
                Next blank · {unansweredCount}
              </button>
            ) : null}
          </div>
        </div>

        <div className="panel-card fade-in-up rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 shadow-md shadow-slate-200/30 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-none md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
                Exam
                {isProcessing && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-px text-[9px] font-semibold normal-case tracking-normal text-amber-900 dark:text-amber-100">
                    <span className="loading loading-spinner loading-xs" />
                    Extracting
                  </span>
                )}
              </p>
              <h1
                className="font-display text-base font-semibold leading-snug tracking-tight text-slate-950 dark:text-white md:text-lg"
                title={exam.filename}
              >
                {exam.filename}
              </h1>
              <ExamCatalogStrip exam={exam} className="!text-[10px] opacity-95" />
            </div>
            <div className="flex shrink-0 items-start gap-0.5">
              <div className="dropdown dropdown-end">
                <button
                  type="button"
                  tabIndex={0}
                  className="rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Exam options"
                  aria-label="Exam options"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
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
                      className="rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                    >
                      Edit details
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-xl px-3 py-2 text-xs text-rose-600 dark:text-rose-400"
                    >
                      Delete exam
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:items-start">
            <ExamFocusTimer
              totalMs={timerTotalMs}
              remainingMs={timerRemainingMs ?? 0}
              paused={timerPaused}
              expired={timerExpired}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onReset={resetTimer}
              onPresetMinutes={applyTimerPresetMinutes}
              customMinStr={customMinStr}
              setCustomMinStr={setCustomMinStr}
              onApplyCustom={() => {
                const m = Number.parseInt(customMinStr, 10);
                if (!Number.isFinite(m) || m < 1 || m > 600) {
                  toast.error('Use 1–600 minutes');
                  return;
                }
                applyTimerPresetMinutes(m);
                setCustomMinStr('');
              }}
            />
            <LastAttemptScorePanel
              lastAttempt={lastOfflineAttempt}
              onOpenResults={viewOfflineResults}
            />
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">
                {answeredCount}/{questions.length}{' '}
                <span className="font-normal opacity-80">done</span>
              </span>
              <span className="tabular-nums text-cyan-800 dark:text-cyan-300">
                Q{currentIndex + 1}/{questions.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-600 transition-all duration-500 dark:from-cyan-500 dark:to-teal-500"
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Mode
            </span>
            <div className="inline-flex rounded-xl border border-slate-200/90 bg-slate-100/90 p-0.5 dark:border-slate-600/70 dark:bg-slate-950/80">
              <button
                type="button"
                onClick={() => setMode('exam')}
                aria-pressed={mode === 'exam'}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${
                  mode === 'exam'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Exam
              </button>
              <button
                type="button"
                onClick={() => setMode('normal')}
                aria-pressed={mode === 'normal'}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${
                  mode === 'normal'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Practice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div className="relative mx-auto flex max-w-4xl gap-4">
        {/* Left sidebar — desktop always visible, mobile hidden */}
        <aside className="hidden lg:flex lg:w-52 xl:w-56 lg:flex-col lg:gap-3">
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
          <div className="mb-3 flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-xs font-bold text-cyan-800 dark:text-cyan-200">
                ☰
              </span>
              Questions {answeredCount}/{questions.length}
              <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
            </button>
          </div>

          <article className="panel-card rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lg shadow-slate-200/25 ring-1 ring-slate-100/90 md:p-5 dark:border-slate-600/55 dark:bg-gradient-to-br dark:from-[#12181f]/95 dark:via-[#0f151c]/98 dark:to-[#0d1218] dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] dark:ring-cyan-500/10">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100/90 pb-3 dark:border-slate-700/55">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-cyan-500/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-900 ring-1 ring-cyan-500/25 dark:text-cyan-100">
                  Q{currentIndex + 1}
                </span>
                {flagged.has(currentIndex) ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-px text-[9px] font-bold uppercase text-amber-900 dark:text-amber-100">
                    Flagged
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {userAnswers[currentIndex] !== null ? (
                  <button
                    type="button"
                    onClick={clearCurrentSelection}
                    className="rounded-lg border border-slate-200/90 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleFlag}
                  aria-pressed={flagged.has(currentIndex)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${
                    flagged.has(currentIndex)
                      ? 'border-amber-400/60 bg-amber-500/10 text-amber-950 dark:text-amber-50'
                      : 'border-slate-200/90 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Flag
                    className={`h-3 w-3 ${flagged.has(currentIndex) ? 'fill-amber-500 text-amber-600 dark:text-amber-300' : ''}`}
                    aria-hidden
                  />
                  Flag
                </button>
              </div>
            </header>

            <div className="prose prose-slate prose-sm max-w-none dark:prose-invert">
              <p
                className="font-display text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100 md:text-[1.05rem] [&_strong]:font-semibold"
                style={{ WebkitFontSmoothing: 'antialiased' }}
              >
                {current.question}
              </p>
            </div>

            <fieldset className="mt-5 space-y-2 border-0 p-0">
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <details className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1 lg:justify-self-center">
              <summary className="cursor-pointer list-none text-center text-[9px] font-semibold text-slate-400 dark:text-slate-500 [&::-webkit-details-marker]:hidden">
                Shortcuts
              </summary>
              <p className="mt-1 text-center text-[9px] text-slate-400 dark:text-slate-500">
                ← → · A–E · 1–4 · numpad · F flag · J next blank · Esc clear
              </p>
            </details>
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="order-1 inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/95 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-35 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Prev
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="order-2 inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-500/20 lg:order-3"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runSubmit(false)}
                disabled={submitting}
                className="order-2 inline-flex shrink-0 items-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50 lg:order-3"
              >
                {submitting ? '…' : 'Submit'}
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

      {/* Submit with blanks confirmation */}
      {submitConfirmOpen && (
        <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
            onClick={() => setSubmitConfirmOpen(false)}
            aria-label="Dismiss"
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} unanswered
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Submit anyway — those items count as wrong. Or go back with J / Next
              blank.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSubmitConfirmOpen(false)}
                className="btn-secondary flex-1 rounded-xl py-2.5 text-xs font-semibold"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => runSubmit(true)}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white shadow hover:bg-amber-500"
              >
                Submit anyway
              </button>
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

function resultsGradeTheme(pct) {
  if (pct >= 90) {
    return {
      tag: 'Elite',
      chip: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100',
      blobA: 'bg-emerald-500/30',
      blobB: 'bg-cyan-400/20',
      scoreClass:
        'bg-gradient-to-br from-emerald-600 via-cyan-600 to-violet-700 bg-clip-text text-transparent dark:from-emerald-200 dark:via-cyan-100 dark:to-white',
      sub: 'text-emerald-800/90 dark:text-emerald-200/80',
    };
  }
  if (pct >= 75) {
    return {
      tag: 'Strong',
      chip: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-950 dark:text-cyan-50',
      blobA: 'bg-cyan-500/25',
      blobB: 'bg-teal-500/15',
      scoreClass:
        'bg-gradient-to-br from-cyan-600 to-slate-800 bg-clip-text text-transparent dark:from-cyan-200 dark:to-slate-100',
      sub: 'text-cyan-900/85 dark:text-cyan-100/75',
    };
  }
  if (pct >= 60) {
    return {
      tag: 'Pass',
      chip: 'border-amber-400/35 bg-amber-500/15 text-amber-950 dark:text-amber-50',
      blobA: 'bg-amber-500/20',
      blobB: 'bg-orange-500/12',
      scoreClass:
        'bg-gradient-to-br from-amber-600 to-orange-800 bg-clip-text text-transparent dark:from-amber-200 dark:to-slate-100',
      sub: 'text-amber-900/90 dark:text-amber-100/70',
    };
  }
  if (pct >= 40) {
    return {
      tag: 'Build',
      chip: 'border-orange-400/35 bg-orange-500/14 text-orange-950 dark:text-orange-50',
      blobA: 'bg-orange-500/18',
      blobB: 'bg-rose-500/12',
      scoreClass:
        'bg-gradient-to-br from-orange-600 to-rose-800 bg-clip-text text-transparent dark:from-orange-200 dark:to-slate-200',
      sub: 'text-orange-900/90 dark:text-orange-100/70',
    };
  }
  return {
    tag: 'Reset',
    chip: 'border-rose-400/40 bg-rose-500/15 text-rose-950 dark:text-rose-50',
    blobA: 'bg-rose-500/22',
    blobB: 'bg-fuchsia-500/12',
    scoreClass:
      'bg-gradient-to-br from-rose-600 to-fuchsia-900 bg-clip-text text-transparent dark:from-rose-200 dark:to-slate-200',
    sub: 'text-rose-900/90 dark:text-rose-100/75',
  };
}

function ResultsHeroRing({
  correct,
  total,
  gradientIdStroke,
  gradientIdGlow,
  className = '',
}) {
  const pct = total > 0 ? correct / total : 0;
  const size = 132;
  const cx = size / 2;
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const sw = 10;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 drop-shadow-[0_0_28px_rgba(34,211,238,0.22)]"
        aria-hidden
      >
        <defs>
          <linearGradient
            id={gradientIdStroke}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <radialGradient id={gradientIdGlow} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
        </defs>
        <circle
          cx={cx}
          cy={cx}
          r={r + 6}
          fill={`url(#${gradientIdGlow})`}
          className="opacity-90"
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          className="stroke-white/[0.08] dark:stroke-white/[0.1]"
          strokeWidth={sw}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={`url(#${gradientIdStroke})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold tabular-nums text-white drop-shadow-md md:text-2xl">
          <span className="text-white">{correct}</span>
          <span className="text-white/45">/</span>
          <span className="text-white/85">{total}</span>
        </span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-200/75">
          hits
        </span>
      </div>
    </div>
  );
}

function ResultsScreen({
  exam,
  results,
  savedAtTs,
  fromArchive,
  onRestart,
  onReview,
}) {
  const heroGradStroke = useId().replace(/:/g, '');
  const heroGradGlow = `${heroGradStroke}-glow`;
  const [detailFilter, setDetailFilter] = useState('all');
  const [expandedIndices, setExpandedIndices] = useState(() => new Set());
  const grade = getGrade(results.percentage);
  const theme = resultsGradeTheme(results.percentage);
  const savedLabel =
    typeof savedAtTs === 'number' ? formatSavedAgo(savedAtTs) : null;

  const wrongCount = results.incorrectCount;
  const correctCount = results.correctCount;

  const filteredRows = useMemo(() => {
    return results.details
      .map((detail, index) => ({ detail, index }))
      .filter(({ detail }) => {
        if (detailFilter === 'incorrect') return !detail.isCorrect;
        if (detailFilter === 'correct') return detail.isCorrect;
        return true;
      });
  }, [results.details, detailFilter]);

  const toggleExpand = useCallback((index) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const expandIncorrect = useCallback(() => {
    setDetailFilter('incorrect');
    const next = new Set();
    results.details.forEach((d, i) => {
      if (!d.isCorrect) next.add(i);
    });
    setExpandedIndices(next);
  }, [results.details]);

  const collapseAll = useCallback(() => {
    setExpandedIndices(new Set());
  }, []);

  const expandAll = useCallback(() => {
    const next = new Set(filteredRows.map(({ index }) => index));
    setExpandedIndices(next);
  }, [filteredRows]);

  async function copyScoreSummary() {
    const lines = [
      exam.filename,
      `Score: ${results.percentage}% (${results.correctCount}/${results.totalQuestions})`,
      grade,
      fromArchive ? `Archived result · saved ${savedLabel ?? ''}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Score summary copied');
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  return (
    <div className="page-surface relative min-h-[calc(100vh-3.5rem)] overflow-hidden px-4 pb-14 pt-5 md:px-6 md:pb-16 md:pt-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 dark:opacity-100"
        aria-hidden
      >
        <div
          className={`absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl ${theme.blobA}`}
        />
        <div
          className={`absolute -right-20 bottom-20 h-80 w-80 rounded-full blur-3xl ${theme.blobB}`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(6,182,212,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(6,182,212,0.14),transparent)]" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <BackToExamHubLink />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyScoreSummary}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition hover:border-cyan-400/45 hover:bg-cyan-50/90 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-cyan-500/35 dark:hover:bg-slate-800"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy summary
            </button>
          </div>
        </div>

        <div
          className="fade-in-up relative mb-8 overflow-hidden rounded-[1.75rem] border border-slate-200/85 bg-white/80 shadow-xl shadow-slate-300/40 backdrop-blur-md dark:border-cyan-500/15 dark:bg-gradient-to-br dark:from-[#0d161f]/95 dark:via-[#0a121c]/97 dark:to-[#06090e]/98 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)]"
        >
          {results.percentage >= 92 ? (
            <Sparkles className="absolute right-8 top-7 h-9 w-9 text-amber-300/90 animate-pulse" />
          ) : null}

          <div className="relative px-5 py-6 md:px-8 md:py-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8 lg:gap-10">
                <ResultsHeroRing
                  correct={results.correctCount}
                  total={results.totalQuestions}
                  gradientIdStroke={heroGradStroke}
                  gradientIdGlow={heroGradGlow}
                />
                <div className="max-w-xl text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400/90">
                      Results Lab
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${theme.chip}`}
                    >
                      {theme.tag}
                    </span>
                    {fromArchive ? (
                      <span className="rounded-full border border-violet-400/35 bg-violet-500/12 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-100">
                        Saved session
                      </span>
                    ) : null}
                    {!fromArchive && savedLabel ? (
                      <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                        Live · {savedLabel}
                      </span>
                    ) : null}
                  </div>
                  <h1
                    className={`font-display mt-3 text-5xl font-extrabold leading-none md:text-[3.75rem] ${theme.scoreClass}`}
                  >
                    {results.percentage}%
                  </h1>
                  <p className={`mt-2 text-lg font-semibold md:text-xl ${theme.sub}`}>
                    {grade}
                  </p>
                  <p className="mt-3 truncate text-[11px] text-slate-500 dark:text-slate-400" title={exam.filename}>
                    {exam.filename}
                  </p>
                  <ExamCatalogStrip
                    exam={exam}
                    className="mx-auto mt-2 justify-center !text-[10px] opacity-95 md:!justify-start md:mx-0"
                  />

                  {fromArchive && savedLabel ? (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Last stored {savedLabel} in this browser
                    </p>
                  ) : null}

                  <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/[0.07] px-3 py-2.5 text-center dark:bg-emerald-500/10">
                      <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {correctCount}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-800/85 dark:text-emerald-200/90">
                        Solid
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-400/35 bg-rose-500/[0.07] px-3 py-2.5 text-center dark:bg-rose-500/10">
                      <p className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        {wrongCount}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-rose-800/85 dark:text-rose-200/90">
                        To review
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/95 bg-slate-50/95 px-3 py-2.5 text-center dark:border-slate-600 dark:bg-slate-800/50">
                      <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {results.totalQuestions}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Total Q
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 lg:max-w-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Breakdown workspace
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailFilter('all')}
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                      detailFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                        : 'border border-slate-200/90 bg-white/80 text-slate-600 hover:border-cyan-400/40 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300'
                    }`}
                  >
                    All · {results.totalQuestions}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailFilter('correct')}
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                      detailFilter === 'correct'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'border border-slate-200/90 bg-white/80 text-slate-600 hover:border-emerald-400/45 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300'
                    }`}
                  >
                    Right · {correctCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailFilter('incorrect')}
                    className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                      detailFilter === 'incorrect'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                        : 'border border-slate-200/90 bg-white/80 text-slate-600 hover:border-rose-400/45 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300'
                    }`}
                  >
                    Miss · {wrongCount}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={expandIncorrect}
                    disabled={wrongCount === 0}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-900 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-35 dark:text-rose-100"
                  >
                    <Target className="h-3.5 w-3.5" aria-hidden />
                    Study misses
                  </button>
                  <button
                    type="button"
                    onClick={expandAll}
                    className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:border-cyan-400/40 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-200"
                  >
                    Expand list
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:border-slate-400/50 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-300"
                  >
                    Collapse
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onRestart}
                    className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg shadow-cyan-500/15"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={onReview}
                    className="btn-secondary flex-1 rounded-xl px-4 py-2.5 text-xs font-bold"
                  >
                    Back to paper
                  </button>
                  <Link
                    to={EXAMS_HUB_PATH}
                    className="btn-secondary inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-center text-xs font-bold"
                  >
                    Exam studio
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p className="mb-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nothing in this slice — switch filters above.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Question stream
              </h2>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {filteredRows.length} shown
              </span>
            </div>
            {filteredRows.map(({ detail, index }, seq) => (
              <ResultItem
                key={detail.questionId ?? index}
                detail={detail}
                index={index}
                expanded={expandedIndices.has(index)}
                onToggle={() => toggleExpand(index)}
                revealDelayMs={seq * 45}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultItem({ detail, index, expanded, onToggle, revealDelayMs = 0 }) {
  const correct = detail.isCorrect;
  const panelClass = correct
    ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/[0.08] via-white/50 to-transparent shadow-[0_0_0_1px_rgba(52,211,153,0.08)] dark:from-emerald-500/12 dark:via-slate-900/40 dark:to-transparent dark:shadow-[0_0_24px_-8px_rgba(52,211,153,0.15)]'
    : 'border-rose-400/45 bg-gradient-to-r from-rose-500/[0.1] via-white/50 to-transparent shadow-[0_0_0_1px_rgba(244,63,94,0.1)] dark:from-rose-500/14 dark:via-slate-900/40 dark:to-transparent dark:shadow-[0_0_28px_-8px_rgba(244,63,94,0.2)]';

  return (
    <div
      className={`group panel-card fade-in-up rounded-2xl border transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${panelClass} ${
        correct
          ? 'hover:shadow-emerald-500/10'
          : 'hover:shadow-rose-500/15'
      }`}
      style={{ animationDelay: `${revealDelayMs}ms` }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left md:px-5 md:py-4"
        onClick={onToggle}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-inner ${
            correct
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30'
              : 'bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/30'
          }`}
        >
          {correct ? '✓' : '✗'}
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100 md:text-[0.9375rem]">
          <span className="mr-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-slate-100 px-1.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {index + 1}
          </span>
          {detail.question.length > 100
            ? `${detail.question.slice(0, 98)}…`
            : detail.question}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 dark:text-slate-500 ${
            expanded ? 'rotate-180 text-cyan-500 dark:text-cyan-400' : 'group-hover:text-cyan-500/80'
          }`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-white/10 bg-gradient-to-b from-white/40 to-transparent px-4 pb-4 pt-4 dark:from-slate-800/30 dark:to-transparent md:px-5">
          <p className="text-sm">
            <span className="font-bold text-slate-500 dark:text-slate-400">
              Your answer{' '}
            </span>
            <span
              className={
                correct
                  ? 'font-semibold text-emerald-700 dark:text-emerald-300'
                  : 'font-semibold text-rose-700 dark:text-rose-300'
              }
            >
              {detail.userAnswerText}
            </span>
          </p>
          {!correct && (
            <p className="text-sm">
              <span className="font-bold text-slate-500 dark:text-slate-400">
                Key{' '}
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {detail.correctAnswerText}
              </span>
            </p>
          )}
          {detail.explanation ? (
            <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.12] via-sky-500/[0.06] to-fuchsia-500/[0.05] px-4 py-3 dark:from-cyan-500/15 dark:via-sky-500/10 dark:to-violet-500/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-700 dark:text-cyan-300">
                Why it matters
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {detail.explanation}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
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
