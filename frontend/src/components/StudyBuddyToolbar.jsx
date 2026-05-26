import { Menu, SquarePen } from 'lucide-react';
import { STUDY_MODES } from '../constants/studyBuddyCopy.js';

/**
 * Unified in-flow toolbar for Study Buddy — history, mode, chapter filter, new chat.
 */
function StudyBuddyToolbar({
  onOpenHistory,
  studyMode,
  onStudyModeChange,
  chapterFilter,
  onChapterFilterChange,
  ragChapterMap = [],
  onNewChat,
  showNewChat = true,
  dense = false,
  historyLabel = 'Chat history',
  historyButtonId,
  ragActionLabel,
  onRagAction,
  ragActionDisabled = false,
  ragActionTitle,
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        dense ? 'mb-1 px-0.5' : 'mb-2 px-0.5'
      }`}
    >
      <button
        type="button"
        id={historyButtonId}
        aria-controls={historyButtonId ? 'liqu-ai-rail-slide' : undefined}
        onClick={onOpenHistory}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label={historyLabel}
      >
        <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <label htmlFor="study-mode-select" className="sr-only">
          Study mode
        </label>
        <select
          id="study-mode-select"
          value={studyMode}
          onChange={(e) => onStudyModeChange?.(e.target.value)}
          className="min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:flex-none sm:min-w-[8.5rem]"
        >
          {STUDY_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        {Array.isArray(ragChapterMap) && ragChapterMap.length > 0 ? (
          <>
            <label htmlFor="chapter-filter" className="sr-only">
              Limit to chapter
            </label>
            <select
              id="chapter-filter"
              value={chapterFilter}
              onChange={(e) => onChapterFilterChange?.(e.target.value)}
              className="min-w-0 max-w-full flex-1 truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:max-w-[11rem]"
            >
              <option value="">Whole book</option>
              {ragChapterMap.map((ch) => (
                <option key={ch.title} value={ch.title}>
                  {ch.title}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {onRagAction ? (
          <button
            type="button"
            onClick={onRagAction}
            disabled={ragActionDisabled}
            title={ragActionTitle || ragActionLabel}
            className="h-9 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {ragActionLabel}
          </button>
        ) : null}
      </div>

      {showNewChat ? (
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="New chat"
        >
          <SquarePen className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

export default StudyBuddyToolbar;
