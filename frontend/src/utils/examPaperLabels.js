/** Labels for `paperType` stored on Exam documents (backend enum). */
export const EXAM_PAPER_TYPE_OPTIONS = [
  { id: 'exit_exam', label: 'Exit exam', short: 'Exit' },
  { id: 'mock_exit_exam', label: 'Mock exit exam', short: 'Mock exit' },
  { id: 'model_exit_exam', label: 'Model exit exam', short: 'Model exit' },
  { id: 'final_exam', label: 'Final exam', short: 'Final' },
  { id: 'midterm', label: 'Midterm', short: 'Midterm' },
  { id: 'other', label: 'Other / practice', short: 'Other' },
];

export function examPaperTypeLabel(id) {
  const raw = String(id || '').trim();
  const hit = EXAM_PAPER_TYPE_OPTIONS.find((o) => o.id === raw);
  return hit ? hit.label : 'Paper';
}
