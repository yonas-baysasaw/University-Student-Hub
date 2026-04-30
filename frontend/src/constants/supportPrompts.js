/** Study buddy (no book) — horizontal quick-start pills (short labels). */
export const HUB_QUICK_PROMPTS = [
  'New announcements — catch me up.',
  "What's new in my resources?",
  'This week: deadlines & uploads.',
  'Did I miss anything important?',
];

/**
 * Support widget: short text sent to the API; shown as compact chips before the first user message.
 * @type {Array<{ text: string, chipClass: string }>}
 */
export const SUPPORT_QUICK_PROMPTS = [
  {
    text: 'New announcements—catch me up.',
    chipClass:
      'border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/80 text-amber-950 hover:from-amber-100/90 dark:border-amber-400/35 dark:from-amber-950/55 dark:to-orange-950/45 dark:text-amber-100 dark:hover:from-amber-900/65',
  },
  {
    text: "What's new in my resources?",
    chipClass:
      'border-cyan-200/90 bg-gradient-to-br from-cyan-50 to-sky-50/80 text-cyan-950 hover:from-cyan-100/90 dark:border-cyan-400/35 dark:from-cyan-950/55 dark:to-sky-950/45 dark:text-cyan-100 dark:hover:from-cyan-900/65',
  },
  {
    text: 'This week: deadlines & uploads.',
    chipClass:
      'border-violet-200/90 bg-gradient-to-br from-violet-50 to-fuchsia-50/80 text-violet-950 hover:from-violet-100/90 dark:border-violet-400/35 dark:from-violet-950/55 dark:to-fuchsia-950/45 dark:text-violet-100 dark:hover:from-violet-900/65',
  },
  {
    text: 'Did I miss anything important?',
    chipClass:
      'border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-950 hover:from-emerald-100/90 dark:border-emerald-400/35 dark:from-emerald-950/55 dark:to-teal-950/45 dark:text-emerald-100 dark:hover:from-emerald-900/65',
  },
];
