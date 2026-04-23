import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { readJsonOrThrow } from '../utils/http';

// Ported quiz logic from did-exit/js/quiz-manager.js and ai-integration.js (analyzeAnswers)

const STATUS_LABELS = {
  pending: 'Queued',
  processing: 'Processing questions…',
  complete: 'Ready',
  failed: 'Processing failed',
};

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

  // Poll while still processing
  useEffect(() => {
    if (
      exam?.processingStatus === 'processing' ||
      exam?.processingStatus === 'pending'
    ) {
      pollRef.current = setInterval(fetchExamData, 4000);
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
        <Link
          to="/exams"
          className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm"
        >
          Back to Exams
        </Link>
      </div>
    );
  }

  if (!exam) return null;

  const isProcessing =
    exam.processingStatus === 'processing' ||
    exam.processingStatus === 'pending';
  const isFailed = exam.processingStatus === 'failed';

  if (isProcessing || isFailed) {
    return (
      <div className="page-surface flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="panel-card w-full max-w-md rounded-3xl p-8">
          <p className="font-display text-xl text-slate-900">{exam.filename}</p>
          <p
            className={`mt-3 text-sm ${isFailed ? 'text-rose-600' : 'text-slate-500'}`}
          >
            {STATUS_LABELS[exam.processingStatus]}
          </p>
          {isProcessing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
              <span className="loading loading-spinner loading-sm" />
              Refreshing automatically…
            </div>
          )}
          <Link
            to="/exams"
            className="btn-secondary mt-6 inline-block px-5 py-2.5 text-sm"
          >
            Back to Exams
          </Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="page-surface flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="panel-card w-full max-w-md rounded-3xl p-8">
          <p className="font-display text-xl text-slate-900">
            No questions found
          </p>
          <p className="mt-2 text-sm text-slate-500">
            This exam has no extracted questions yet.
          </p>
          <Link
            to="/exams"
            className="btn-primary mt-6 inline-block px-5 py-2.5 text-sm"
          >
            Back to Exams
          </Link>
        </div>
      </div>
    );
  }

  return <QuizSession exam={exam} questions={questions} examId={examId} />;
}

// ── Quiz Session ──────────────────────────────────────────────────────────────

function QuizSession({ exam, questions, examId }) {
  const [mode, setMode] = useState('exam'); // 'exam' | 'normal'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState(() =>
    new Array(questions.length).fill(null),
  );
  const [flagged, setFlagged] = useState(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

    // Persist attempt to backend (fire & forget — don't block UI)
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
    setDrawerOpen(false);
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
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Exam header */}
        <div className="panel-card fade-in-up mb-4 rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Exam Practice
              </p>
              <h1
                className="mt-0.5 truncate font-display text-lg text-slate-900"
                title={exam.filename}
              >
                {exam.filename}
              </h1>
            </div>
            <Link
              to="/exams"
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              ← Back
            </Link>
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
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-slate-600 text-xs">Mode:</span>
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
            <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                Explanation
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {current.explanation}
              </p>
            </div>
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

          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            All questions
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

        {/* Question drawer */}
        {drawerOpen && (
          <QuestionDrawer
            questions={questions}
            userAnswers={userAnswers}
            flagged={flagged}
            currentIndex={currentIndex}
            onSelect={(i) => {
              setCurrentIndex(i);
              setDrawerOpen(false);
            }}
            onClose={() => setDrawerOpen(false)}
          />
        )}
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

// ── Question Drawer ───────────────────────────────────────────────────────────

function QuestionDrawer({
  questions,
  userAnswers,
  flagged,
  currentIndex,
  onSelect,
  onClose,
}) {
  return (
    <div className="mt-4 panel-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base text-slate-900">All Questions</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
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
            // biome-ignore lint/suspicious/noArrayIndexKey: question indices are positional — index IS the semantic key
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => onSelect(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span>
          <span className="inline-block mr-1 h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
          Answered
        </span>
        <span>
          <span className="inline-block mr-1 h-3 w-3 rounded bg-white border border-slate-200" />
          Unanswered
        </span>
        <span>
          <span className="inline-block mr-1 h-3 w-3 rounded ring-2 ring-amber-400 bg-white border border-slate-200" />
          Flagged
        </span>
      </div>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────

function ResultsScreen({ exam, results, onRestart, onReview }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const grade = getGrade(results.percentage);

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
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
            className="mt-1 truncate text-xs text-slate-400"
            title={exam.filename}
          >
            {exam.filename}
          </p>

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
            <Link to="/exams" className="btn-secondary px-5 py-2.5 text-sm">
              Back to Exams
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
          className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
            detail.isCorrect
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          {detail.isCorrect ? '✓' : '✗'}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-800 leading-snug">
          {index + 1}.{' '}
          {detail.question.length > 90
            ? `${detail.question.slice(0, 88)}…`
            : detail.question}
        </span>
        <span className="shrink-0 text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2 text-sm">
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
