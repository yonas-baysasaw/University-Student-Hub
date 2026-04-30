const ATTEMPT_VER = 1;
const DRAFT_VER = 1;

/** Stable signature when question set/order matches cached data */
export function getQuestionsSignature(questions) {
  return questions.map((q) => q.id ?? '').join('|');
}

export function attemptStorageKey(examId) {
  return `liqu-exam-last-attempt:${examId}`;
}

export function draftStorageKey(examId) {
  return `liqu-exam-draft:${examId}`;
}

/**
 * @param {string} examId
 * @param {string} questionsSig
 * @returns {{ results: object, savedAt: number, examFilename: string } | null}
 */
export function loadSavedAttempt(examId, questionsSig) {
  try {
    const raw = localStorage.getItem(attemptStorageKey(examId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== ATTEMPT_VER || data.questionIdsSig !== questionsSig) {
      return null;
    }
    if (!data.results || typeof data.savedAt !== 'number') return null;
    return {
      results: data.results,
      savedAt: data.savedAt,
      examFilename: data.examFilename ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} examId
 * @param {string} questionsSig
 * @param {object} results from analyzeAnswers
 * @param {string} examFilename
 */
export function saveAttemptToDevice(examId, questionsSig, results, examFilename) {
  try {
    const payload = {
      v: ATTEMPT_VER,
      questionIdsSig: questionsSig,
      savedAt: Date.now(),
      examFilename,
      results,
    };
    localStorage.setItem(attemptStorageKey(examId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearSavedAttempt(examId) {
  try {
    localStorage.removeItem(attemptStorageKey(examId));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} examId
 * @param {string} questionsSig
 * @returns {{ userAnswers: (number|null)[], currentIndex: number, flaggedIndices: number[], mode: string } | null}
 */
export function loadSessionDraft(examId, questionsSig) {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(examId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== DRAFT_VER || data.questionIdsSig !== questionsSig) {
      return null;
    }
    return {
      userAnswers: data.userAnswers,
      currentIndex: data.currentIndex,
      flaggedIndices: data.flaggedIndices ?? [],
      mode: data.mode === 'normal' ? 'normal' : 'exam',
    };
  } catch {
    return null;
  }
}

export function saveSessionDraft(
  examId,
  questionsSig,
  { userAnswers, currentIndex, flaggedIndices, mode },
) {
  try {
    const payload = {
      v: DRAFT_VER,
      questionIdsSig: questionsSig,
      userAnswers,
      currentIndex,
      flaggedIndices,
      mode,
    };
    sessionStorage.setItem(draftStorageKey(examId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function clearSessionDraft(examId) {
  try {
    sessionStorage.removeItem(draftStorageKey(examId));
  } catch {
    /* ignore */
  }
}

export function formatSavedAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
