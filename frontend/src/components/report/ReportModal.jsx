import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  reasonsForTargetType,
  reportModalTitle,
} from '../../utils/reportReasons';
import { submitContentReport } from '../../utils/reportApi';

const MAX_DESC = 500;

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   targetType: 'book'|'event'|'user',
 *   targetId: string,
 * }} props
 */
export default function ReportModal({ open, onClose, targetType, targetId }) {
  const [step, setStep] = useState('form');
  const [reasonCode, setReasonCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = useMemo(
    () => reasonsForTargetType(targetType),
    [targetType],
  );
  const title = useMemo(() => reportModalTitle(targetType), [targetType]);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setReasonCode(reasons[0]?.code || '');
    setDescription('');
    setSubmitting(false);
  }, [open, targetType, targetId, reasons]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!reasonCode || !targetId) {
      toast.error('Choose a reason to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await submitContentReport({
        targetType,
        targetId,
        reasonCode,
        description,
      });
      setStep('success');
      toast.success('Thanks — your report was submitted.');
    } catch (err) {
      toast.error(err?.message || 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close report dialog"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div
        className="relative z-[1] flex max-h-[min(92vh,640px)] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200/90 bg-white shadow-[0_-12px_48px_-12px_rgba(15,23,42,0.35)] dark:border-slate-600 dark:bg-slate-900 sm:rounded-3xl sm:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700">
          <div>
            <h2
              id="report-modal-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Help us understand the issue. Reports are reviewed by admins.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {step === 'success' ? (
          <div className="space-y-4 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              We received your report. Our team will review it as soon as
              possible.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="btn-primary w-full rounded-2xl px-4 py-3 text-sm font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label
                  htmlFor="report-reason"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"
                >
                  Reason
                </label>
                <select
                  id="report-reason"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="input-field w-full text-sm"
                  required
                >
                  {reasons.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="report-desc"
                  className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"
                >
                  Details (optional)
                </label>
                <textarea
                  id="report-desc"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value.slice(0, MAX_DESC))
                  }
                  rows={4}
                  maxLength={MAX_DESC}
                  placeholder="Add context that helps moderators…"
                  className="input-field w-full resize-y text-sm"
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {description.length}/{MAX_DESC}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="btn-secondary rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !reasonCode}
                className="btn-primary rounded-2xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
