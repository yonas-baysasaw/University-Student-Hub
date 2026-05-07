import { Bookmark, Flag, MoreVertical, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import ReportModal from './ReportModal';

/**
 * Card / profile actions: Share (copy link) and Report for books, events, or users.
 * @param {{
 *   targetType: 'book'|'event'|'user',
 *   targetId: string | null | undefined,
 *   shareUrl: string,
 *   hideReport?: boolean,
 *   onToggleSave?: () => void,
 *   saved?: boolean,
 *   saveBusy?: boolean,
 *   showSave?: boolean,
 *   align?: 'left' | 'right',
 *   className?: string,
 * }} props
 */
export default function BookEventReportMenu({
  targetType,
  targetId,
  shareUrl,
  hideReport = false,
  onToggleSave,
  saved = false,
  saveBusy = false,
  showSave = false,
  align = 'right',
  className = '',
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!user || !targetId) return null;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard.');
      setOpen(false);
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const canReport = !hideReport;

  return (
    <div className={`relative shrink-0 ${className}`} ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-xl border p-2 shadow-sm transition ${
          open
            ? 'border-cyan-400 bg-cyan-50 text-cyan-900 ring-2 ring-cyan-400/30 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
            : 'border-slate-200/90 bg-white/95 text-slate-600 hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          className={`absolute top-[calc(100%+6px)] z-[60] min-w-[13rem] overflow-hidden rounded-2xl border border-slate-200/95 bg-white py-1.5 shadow-xl ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-black/40 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => void handleShare()}
          >
            <Share2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            Share
          </button>
          {showSave && onToggleSave ? (
            <button
              type="button"
              role="menuitem"
              disabled={saveBusy}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                onToggleSave();
                setOpen(false);
              }}
            >
              <Bookmark
                className={`h-4 w-4 shrink-0 ${saved ? 'fill-amber-500 text-amber-700' : 'text-amber-600'}`}
              />
              {saved ? 'Remove save' : 'Save'}
            </button>
          ) : null}
          {canReport ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
            >
              <Flag className="h-4 w-4 shrink-0" />
              Report
            </button>
          ) : null}
        </div>
      ) : null}

      {canReport ? (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType={targetType}
          targetId={String(targetId)}
        />
      ) : null}
    </div>
  );
}
