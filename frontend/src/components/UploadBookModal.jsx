import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Cpu,
  Leaf,
  Upload,
  Users,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  ACADEMIC_TRACKS,
  COURSE_SUBJECT_SUGGESTIONS,
  DEPARTMENTS_BY_TRACK,
} from '../utils/bookUploadMeta';

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

const TRACK_ICONS = {
  engineering: Cpu,
  social: Users,
  natural: Leaf,
};

const STEP_META = [
  { n: 1, title: 'Field', subtitle: 'Track & department' },
  { n: 2, title: 'Book', subtitle: 'Details' },
  { n: 3, title: 'File', subtitle: 'Attach & publish' },
];

export default function UploadBookModal({
  open,
  uploadStep,
  uploadForm,
  setUploadForm,
  uploading,
  uploadError,
  setUploadError,
  dragActive,
  fileInputRef,
  onClose,
  onNext,
  onPrev,
  onSubmit,
  onDropZoneDrag,
  onDropFile,
}) {
  if (!open || typeof document === 'undefined') return null;

  const deptList =
    uploadForm.academicTrack &&
    DEPARTMENTS_BY_TRACK[uploadForm.academicTrack]
      ? DEPARTMENTS_BY_TRACK[uploadForm.academicTrack]
      : [];

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-book-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(94vh,920px)] w-full max-w-[34rem] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900 sm:max-w-[36rem]">
        <div className="relative shrink-0 overflow-hidden border-b border-slate-200/90 bg-gradient-to-br from-cyan-50 via-white to-indigo-50/60 px-5 py-5 dark:border-slate-600 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/95 md:px-7 md:py-6">
          <div className="workspace-hero-mesh pointer-events-none absolute inset-0 opacity-45 dark:opacity-35" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400">
                Library catalog
              </p>
              <h2
                id="upload-book-modal-title"
                className="font-display text-xl text-slate-900 dark:text-white md:text-2xl"
              >
                Upload a book
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Required metadata keeps the library searchable for everyone.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Close
            </button>
          </div>

          <nav
            className="relative mt-6 flex items-center gap-2"
            aria-label="Upload steps"
          >
            {STEP_META.map((step, idx) => {
              const active = uploadStep === step.n;
              const done = uploadStep > step.n;
              return (
                <div key={step.n} className="flex min-w-0 flex-1 items-center">
                  <div
                    className={`flex w-full flex-col rounded-2xl px-3 py-2.5 ring-1 transition md:flex-row md:items-center md:gap-3 md:px-4 ${
                      active
                        ? 'bg-white/95 shadow-md ring-cyan-500/35 dark:bg-slate-800 dark:ring-cyan-400/35'
                        : done
                          ? 'bg-emerald-50/90 ring-emerald-300/40 dark:bg-emerald-950/35 dark:ring-emerald-700/40'
                          : 'bg-white/40 ring-slate-200/80 dark:bg-slate-800/40 dark:ring-slate-600/80'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        active
                          ? 'bg-cyan-600 text-white dark:bg-cyan-500'
                          : done
                            ? 'bg-emerald-600 text-white dark:bg-emerald-600'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" aria-hidden /> : step.n}
                    </span>
                    <div className="min-w-0 pt-1 md:pt-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Step {step.n}
                      </p>
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {step.title}
                      </p>
                      <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
                        {step.subtitle}
                      </p>
                    </div>
                  </div>
                  {idx < STEP_META.length - 1 ? (
                    <div
                      className={`mx-1 hidden h-px w-6 shrink-0 md:block ${
                        uploadStep > step.n ? 'bg-emerald-400/70' : 'bg-slate-200 dark:bg-slate-600'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (uploadStep < 3) onNext();
            else onSubmit(e);
          }}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6">
            {uploadStep === 1 ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Academic field{' '}
                    <span className="text-rose-500">*</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Choose Engineering, Social sciences, or Natural sciences.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {ACADEMIC_TRACKS.map((t) => {
                      const Icon = TRACK_ICONS[t.id];
                      const sel = uploadForm.academicTrack === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setUploadForm((prev) => ({
                              ...prev,
                              academicTrack: t.id,
                              department: '',
                              departmentOther: '',
                            }))
                          }
                          className={`group flex flex-col rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                            sel
                              ? 'border-cyan-500 bg-cyan-50/90 shadow-lg shadow-cyan-600/10 ring-2 ring-cyan-500/40 dark:border-cyan-500 dark:bg-cyan-950/40 dark:ring-cyan-400/35'
                              : 'border-slate-200 bg-white/90 hover:border-cyan-300/80 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/60 dark:hover:border-cyan-500/40'
                          }`}
                        >
                          <Icon
                            className={`h-9 w-9 shrink-0 ${sel ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-400 group-hover:text-cyan-600 dark:text-slate-500'}`}
                            aria-hidden
                          />
                          <span className="mt-3 font-display text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                            {t.label}
                          </span>
                          <span className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                            {t.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {uploadForm.academicTrack ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Department / discipline{' '}
                      <span className="text-rose-500">*</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Tap one option — pick Other if yours is not listed.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {deptList.map((d) => {
                        const sel = uploadForm.department === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() =>
                              setUploadForm((prev) => ({
                                ...prev,
                                department: d,
                                departmentOther: '',
                              }))
                            }
                            className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
                              sel
                                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-600/25 ring-transparent'
                                : 'bg-white text-slate-700 ring-slate-200 hover:ring-cyan-400/60 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:ring-cyan-500/50'
                            }`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    {uploadForm.department === 'Other' ? (
                      <label className="mt-4 block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Specify department
                        </span>
                        <input
                          type="text"
                          className="input-field text-sm"
                          placeholder="e.g. Robotics & automation"
                          value={uploadForm.departmentOther}
                          onChange={(e) =>
                            setUploadForm((prev) => ({
                              ...prev,
                              departmentOther: e.target.value,
                            }))
                          }
                          autoComplete="off"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {uploadStep === 2 ? (
              <>
                <div>
                  <label
                    htmlFor="upload-book-name"
                    className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Book name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="upload-book-name"
                    type="text"
                    maxLength={120}
                    required
                    className="input-field text-sm"
                    placeholder="Title as it appears on the cover or syllabus"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {uploadForm.title.trim().length}/120 characters
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="upload-publish-year"
                      className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-white"
                    >
                      Publish year <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="upload-publish-year"
                      type="number"
                      min={1950}
                      max={2035}
                      required
                      className="input-field text-sm tabular-nums"
                      value={uploadForm.publishYear}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = Number.parseInt(raw, 10);
                        setUploadForm((prev) => ({
                          ...prev,
                          publishYear: Number.isFinite(v)
                            ? v
                            : prev.publishYear,
                        }));
                      }}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Use the edition year when known — estimates are OK for class
                      packs.
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="upload-course-subject"
                    className="mb-1.5 block text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Course / subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="upload-course-subject"
                    type="text"
                    required
                    maxLength={200}
                    className="input-field text-sm"
                    placeholder="e.g. Operating Systems, Java, Artificial Intelligence"
                    value={uploadForm.courseSubject}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        courseSubject: e.target.value,
                      }))
                    }
                  />
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Quick picks
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {COURSE_SUBJECT_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setUploadForm((prev) => ({
                              ...prev,
                              courseSubject: s,
                            }))
                          }
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-cyan-100 hover:text-cyan-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-cyan-950 dark:hover:text-cyan-100"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {uploadStep === 3 ? (
              <>
                <div
                  role="presentation"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={onDropZoneDrag}
                  onDragLeave={onDropZoneDrag}
                  onDragOver={onDropZoneDrag}
                  onDrop={onDropFile}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${
                    dragActive
                      ? 'border-cyan-500 bg-cyan-50/90 ring-4 ring-cyan-500/15 dark:border-cyan-400 dark:bg-cyan-950/40 dark:ring-cyan-400/20'
                      : uploadForm.file
                        ? 'border-emerald-400/70 bg-emerald-50/50 dark:border-emerald-600/60 dark:bg-emerald-950/25'
                        : 'border-slate-300 bg-slate-50/80 hover:border-cyan-400/70 hover:bg-cyan-50/40 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-cyan-500/50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    id="upload-book-file"
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setUploadForm((prev) => ({ ...prev, file }));
                      setUploadError('');
                    }}
                  />
                  <Upload className="mx-auto h-10 w-10 text-cyan-600 dark:text-cyan-400" />
                  <p className="mt-3 font-display text-lg text-slate-900 dark:text-white">
                    {uploadForm.file ? 'File ready' : 'Drop your file here'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    PDF recommended · server applies size limits
                  </p>
                  {uploadForm.file ? (
                    <div className="mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-white/95 px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-600">
                      <BookOpen className="h-4 w-4 shrink-0 text-cyan-600" />
                      <span className="max-w-[220px] truncate font-medium text-slate-900 dark:text-white sm:max-w-xs">
                        {uploadForm.file.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatBytes(uploadForm.file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setUploadForm((prev) => ({ ...prev, file: null }));
                          if (fileInputRef.current)
                            fileInputRef.current.value = '';
                        }}
                        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="upload-book-description"
                    className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Notes <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="upload-book-description"
                    className="input-field min-h-[96px] resize-y py-3 text-sm leading-relaxed"
                    placeholder="Edition, instructor, chapter range — helps classmates decide faster."
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            ) : null}

            {uploadError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                {uploadError}
              </div>
            ) : null}

            {uploading ? (
              <div className="space-y-2 rounded-2xl border border-cyan-200/90 bg-cyan-50/80 px-4 py-3 dark:border-cyan-900/40 dark:bg-cyan-950/30">
                <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">
                  Publishing to library…
                </p>
                <div className="profile-upload-progress-indeterminate h-2 overflow-hidden rounded-full bg-cyan-200/80 dark:bg-cyan-900/60">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500" />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200/90 bg-slate-50/95 px-5 py-4 dark:border-slate-600 dark:bg-slate-900/95 md:px-7">
            <div className="flex flex-wrap gap-2">
              {uploadStep > 1 ? (
                <button
                  type="button"
                  onClick={onPrev}
                  className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uploadStep < 3 ? (
                <button
                  type="submit"
                  className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <>Publishing…</>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" aria-hidden />
                      Publish to library
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
