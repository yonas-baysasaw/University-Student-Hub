import {
  Archive,
  ArrowRight,
  CalendarClock,
  GraduationCap,
  MoreVertical,
  Pencil,
  RotateCcw,
  Share2,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Actions dropdown (“⋯”) for each classroom card.
 */
export default function ClassroomCardMenu({
  classroomId,
  classroomName,
  invitationCode,
  archived,
  canManage,
  canSchedule,
  onSchedule,
  onEdit,
  onArchiveToggle,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const handleShareClass = async () => {
    const origin = window.location.origin;
    try {
      let url;
      let message;
      const code =
        typeof invitationCode === 'string' ? invitationCode.trim() : '';
      if (code) {
        url = `${origin}/classroom?invite=${encodeURIComponent(code)}`;
        message =
          'Invite link copied — classmates open it, confirm the code, then join.';
      } else if (classroomId) {
        url = `${origin}/classroom/${classroomId}`;
        message = 'Classroom link copied (members must already belong).';
      } else {
        toast.error('Nothing to share yet.');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(message);
      setOpen(false);
    } catch {
      toast.error(
        'Could not copy automatically — copy the invite code from the card instead.',
      );
    }
  };

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

  const manageDisabled = !canManage;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Actions for ${classroomName}`}
        onClick={() => setOpen((v) => !v)}
        className={`rounded-xl border p-2 shadow-sm transition ${
          open
            ? 'border-cyan-400 bg-cyan-50 text-cyan-900 ring-2 ring-cyan-400/30 dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-100'
            : 'border-slate-200/90 bg-white/95 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50/90 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:bg-slate-700'
        }`}
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[60] min-w-[15.5rem] overflow-hidden rounded-2xl border border-slate-200/95 bg-white py-1.5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-black/40"
          role="menu"
        >
          <Link
            to={`/classroom/${classroomId}`}
            role="menuitem"
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <GraduationCap className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
            Open classroom
            <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={!classroomId}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => void handleShareClass()}
          >
            <Share2 className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
            Share class
          </button>

          {canSchedule ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false);
                onSchedule?.();
              }}
            >
              <CalendarClock className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
              Weekly schedule
            </button>
          ) : null}

          {!manageDisabled ? (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700/90" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                  onEdit?.();
                }}
              >
                <Pencil className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                Edit name
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                  onArchiveToggle?.();
                }}
              >
                {archived ? (
                  <>
                    <RotateCcw className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    Restore from archive
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                    Archive
                  </>
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                onClick={() => {
                  setOpen(false);
                  onDelete?.();
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                Delete classroom
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
