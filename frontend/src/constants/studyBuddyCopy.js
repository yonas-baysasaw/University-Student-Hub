/** User-facing copy for Study Buddy — no technical jargon. */

export const STUDY_MODES = [
  { id: 'chat', label: 'Quick answer' },
  { id: 'beginner', label: 'Explain simply' },
  { id: 'study_notes', label: 'Study notes' },
  { id: 'summary', label: 'Chapter summary' },
  { id: 'exam_prep', label: 'Test me' },
];

export const RAG_PHASE_LABELS = {
  downloading: 'Opening your book',
  extracting: 'Reading the pages',
  chunking: 'Finding chapters',
  writing: 'Learning the content',
};

/** Stepper steps for book prep UI — phases map to backend ragIndexPhase values. */
export const PREP_STEPS = [
  { id: 1, label: 'Opening your book', phases: ['downloading'] },
  { id: 2, label: 'Reading the pages', phases: ['extracting'] },
  { id: 3, label: 'Finding chapters', phases: ['chunking'] },
  { id: 4, label: 'Learning the content', phases: ['writing', 'embedding'] },
];

export function prepStepIndex(phase) {
  const p = String(phase || '').toLowerCase();
  const idx = PREP_STEPS.findIndex((s) => s.phases.includes(p));
  return idx >= 0 ? idx : 0;
}

export function prepWritingSubtitle(done, total) {
  const d = Number(done) || 0;
  const t = Number(total) || 0;
  if (t <= 0) return '';
  return `Learning section ${Math.min(d, t)} of ${t}`;
}

export function prepReadyToast(title) {
  const t = String(title || '').trim();
  return t
    ? `I've read "${t}" — ask me anything from it.`
    : "I've read this book — ask me anything from it.";
}

export function prepFooterNote() {
  return 'You can still chat — answers from this book will get sharper as I finish reading.';
}

export function ragPhaseLabel(phase) {
  return RAG_PHASE_LABELS[String(phase || '').toLowerCase()] || 'Getting your book ready';
}

export function ragStatusSubtitle(status, chunkCount) {
  if (status?.ragIndexStatus === 'indexing') return 'Still reading your book…';
  if (status?.ragIndexStatus === 'failed') return 'Could not read this file';
  if ((chunkCount ?? status?.chunkCount ?? 0) > 0) return "I've read this book";
  return 'Not ready yet';
}

export function ragBannerMessage(status, chunkCount) {
  if (status?.ragIndexStatus === 'indexing') {
    return "I'm still reading this book — answers will get better in a moment.";
  }
  if (status?.ragIndexStatus === 'failed') {
    return status?.ragIndexError || "I couldn't read this file. Try a text-based PDF.";
  }
  if ((chunkCount ?? status?.chunkCount ?? 0) > 0) {
    return 'I can answer from this book and point you to the right pages.';
  }
  return 'Get this book ready so I can answer from the text.';
}

export function formatSourceLabel(source) {
  const parts = ['From your book'];
  if (source.chapter) parts.push(source.chapter);
  if (
    Number.isFinite(source.pageStart) &&
    Number.isFinite(source.pageEnd)
  ) {
    parts.push(
      source.pageStart === source.pageEnd
        ? `Page ${source.pageStart}`
        : `Pages ${source.pageStart}–${source.pageEnd}`,
    );
  }
  return parts.join(' · ');
}

export function groundingChip(references, grounding) {
  if (grounding !== 'book' && grounding !== 'library') return '';
  const first = Array.isArray(references) ? references[0] : null;
  if (!first) return grounding === 'library' ? 'From your library' : 'From your book';
  if (first.section === 'Chapter outline') return "From your book's chapter outline";
  if (first.chapter) return `Based on ${first.chapter}`;
  if (Number.isFinite(first.pageStart)) return `Based on page ${first.pageStart}`;
  return 'From your book';
}
