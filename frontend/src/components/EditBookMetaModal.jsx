import { Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ACADEMIC_TRACKS,
  COURSE_SUBJECT_SUGGESTIONS,
  DEPARTMENTS_BY_TRACK,
  resolveDepartmentForSubmit,
  validateWizardStep,
} from '../utils/bookUploadMeta';

const TRACK_IDS = new Set(['engineering', 'social', 'natural']);

function buildFormFromBook(book) {
  if (!book) {
    return {
      academicTrack: '',
      department: '',
      departmentOther: '',
      title: '',
      publishYear: '',
      courseSubject: '',
    };
  }
  const rawTrack = String(book.academicTrack || '').trim().toLowerCase();
  const track = TRACK_IDS.has(rawTrack) ? rawTrack : '';
  const deptStored = String(book.department || '').trim();
  const list = track && DEPARTMENTS_BY_TRACK[track]
    ? DEPARTMENTS_BY_TRACK[track]
    : [];
  const inList = list.includes(deptStored);
  return {
    academicTrack: track,
    department: inList ? deptStored : deptStored ? 'Other' : '',
    departmentOther: inList ? '' : deptStored,
    title: String(book.title || '').trim(),
    publishYear:
      book.publishYear !== undefined && book.publishYear !== null
        ? String(book.publishYear)
        : '',
    courseSubject: String(book.courseSubject || '').trim(),
  };
}

export default function EditBookMetaModal({ open, book, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildFormFromBook(book));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && book) {
      setForm(buildFormFromBook(book));
      setError('');
    }
  }, [open, book]);

  const deptList = useMemo(() => {
    if (form.academicTrack && DEPARTMENTS_BY_TRACK[form.academicTrack]) {
      return DEPARTMENTS_BY_TRACK[form.academicTrack];
    }
    return [];
  }, [form.academicTrack]);

  const bookId = book?._id || book?.id;

  const validate = () => {
    const e1 = validateWizardStep(1, form);
    if (e1) return e1;
    const e2 = validateWizardStep(2, { ...form, file: true });
    if (e2) return e2;
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    if (!bookId) {
      setError('Missing book id');
      return;
    }
    const department = resolveDepartmentForSubmit(form);
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicTrack: form.academicTrack,
          department,
          title: String(form.title || '').trim(),
          publishYear: Number(form.publishYear),
          courseSubject: String(form.courseSubject || '').trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not save changes');
      }
      onSaved?.(data?.data);
      onClose();
    } catch (submitErr) {
      setError(submitErr?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === 'undefined' || !book) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-book-meta-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(94vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900">
        <div className="shrink-0 border-b border-slate-200/90 bg-gradient-to-br from-cyan-50 via-white to-indigo-50/60 px-5 py-5 dark:border-slate-600 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/95">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-md dark:bg-cyan-500">
                <Pencil className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400">
                  Your upload
                </p>
                <h2
                  id="edit-book-meta-title"
                  className="font-display text-lg text-slate-900 dark:text-white md:text-xl"
                >
                  Edit catalog details
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Same fields as upload—keeps search and filters accurate.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
            <fieldset className="space-y-3">
              <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Field
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {ACADEMIC_TRACKS.map((t) => (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer flex-col rounded-2xl border px-3 py-2.5 text-left transition ${
                      form.academicTrack === t.id
                        ? 'border-cyan-500 bg-cyan-50/90 ring-2 ring-cyan-400/25 dark:border-cyan-500 dark:bg-cyan-950/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="academicTrack"
                      value={t.id}
                      checked={form.academicTrack === t.id}
                      onChange={() =>
                        setForm((s) => ({
                          ...s,
                          academicTrack: t.id,
                          department: '',
                          departmentOther: '',
                        }))
                      }
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t.hint}
                    </span>
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Department or discipline
                </span>
                <select
                  value={form.department}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      department: e.target.value,
                      departmentOther:
                        e.target.value === 'Other' ? s.departmentOther : '',
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  disabled={!form.academicTrack}
                >
                  <option value="">
                    {form.academicTrack
                      ? 'Choose department…'
                      : 'Select a field first'}
                  </option>
                  {deptList.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              {form.department === 'Other' ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Describe department
                  </span>
                  <input
                    type="text"
                    value={form.departmentOther}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        departmentOther: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    placeholder="e.g. Urban planning"
                    autoComplete="off"
                  />
                </label>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Book
              </legend>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Title
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, title: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Publish year
                </span>
                <input
                  type="number"
                  min={1950}
                  max={2035}
                  value={form.publishYear}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, publishYear: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Course or subject
                </span>
                <input
                  type="text"
                  list="edit-book-course-subjects"
                  value={form.courseSubject}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, courseSubject: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <datalist id="edit-book-course-subjects">
                  {COURSE_SUBJECT_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
            </fieldset>

            {error ? (
              <p
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/90 bg-slate-50/90 px-5 py-4 dark:border-slate-600 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-500 disabled:opacity-60 dark:bg-cyan-500 dark:hover:bg-cyan-400"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
