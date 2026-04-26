/** Study buddy (no book) — longer starters. */
export const HUB_QUICK_PROMPTS = [
  'Help me catch up: what to look for in new classroom announcements and what to do first.',
  'A new file or resource was added in class—how should I skim it, take notes, and what should I ask?',
  'Puzzle together announcements, new uploads, and due dates for my classes this week in one plan.',
  'I might have missed an update: what should I double-check in announcements, resources, and assignments?',
];

/**
 * Support widget: short text sent to the API; shown as compact chips before the first user message.
 * @type {Array<{ text: string, chipClass: string }>}
 */
export const SUPPORT_QUICK_PROMPTS = [
  {
    text: 'New announcements—catch me up.',
    chipClass:
      'border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/80 text-amber-950 hover:from-amber-100/90',
  },
  {
    text: "What's new in my resources?",
    chipClass:
      'border-cyan-200/90 bg-gradient-to-br from-cyan-50 to-sky-50/80 text-cyan-950 hover:from-cyan-100/90',
  },
  {
    text: 'This week: deadlines & uploads.',
    chipClass:
      'border-violet-200/90 bg-gradient-to-br from-violet-50 to-fuchsia-50/80 text-violet-950 hover:from-violet-100/90',
  },
  {
    text: 'Did I miss anything important?',
    chipClass:
      'border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-950 hover:from-emerald-100/90',
  },
];
