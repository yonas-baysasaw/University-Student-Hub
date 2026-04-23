import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';

const TABS = ['Browse', 'Upload'];
const STATUS_LABELS = {
  pending: { label: 'Queued', cls: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Processing…', cls: 'bg-amber-100 text-amber-700' },
  complete: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-rose-100 text-rose-700' },
};

function Exams() {
  const [tab, setTab] = useState('Browse');

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <section className="panel-card fade-in-up mb-6 rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Exam Practice
          </p>
          <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">
            Exams
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload exam PDFs to generate practice questions with AI, or browse
            the shared question bank built by the community.
          </p>
        </section>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                tab === t
                  ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Browse' ? (
          <BrowseTab />
        ) : (
          <UploadTab onUploaded={() => setTab('Browse')} />
        )}
      </div>
    </div>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const pollRef = useRef(null);

  const fetchExams = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page, limit: 18 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/exams?${params}`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Failed to load exams');
      setExams(data.exams);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchExams();
  }, [fetchExams]);

  // Auto-refresh while any exam is still processing
  useEffect(() => {
    const hasProcessing = exams.some(
      (e) =>
        e.processingStatus === 'processing' || e.processingStatus === 'pending',
    );
    if (hasProcessing) {
      pollRef.current = setInterval(fetchExams, 4000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [exams, fetchExams]);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search exams…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input-field h-9 w-60 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-field h-9 text-sm"
        >
          <option value="">All statuses</option>
          <option value="complete">Ready</option>
          <option value="processing">Processing</option>
          <option value="pending">Queued</option>
          <option value="failed">Failed</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {total} exam{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <span className="loading loading-spinner" />
          <span className="ml-2 text-sm">Loading exams…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && exams.length === 0 && (
        <div className="panel-card rounded-2xl p-8 text-center">
          <p className="font-display text-lg text-slate-700">No exams found.</p>
          <p className="mt-1 text-sm text-slate-500">
            Be the first — upload a PDF using the Upload tab.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <ExamCard
            key={exam.id}
            exam={exam}
            currentUserId={user?._id ?? user?.id}
            onDelete={(id) => setExams((prev) => prev.filter((e) => e.id !== id))}
            onUpdate={(updated) =>
              setExams((prev) =>
                prev.map((e) => (e.id === updated.id ? updated : e)),
              )
            }
          />
        ))}
      </div>

      {/* Pagination */}
      {total > 18 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {Math.ceil(total / 18)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / 18)}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ExamCard({ exam, currentUserId, onDelete, onUpdate }) {
  const status = STATUS_LABELS[exam.processingStatus] ?? STATUS_LABELS.pending;
  // Allow practice as soon as any questions are available
  const canPractice = exam.totalQuestions > 0;
  const isProcessing =
    exam.processingStatus === 'processing' ||
    exam.processingStatus === 'pending';
  const isOwner =
    currentUserId &&
    (exam.uploadedBy?._id ?? exam.uploadedBy?.id ?? exam.uploadedBy) ===
      currentUserId;

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(exam.filename);
  const [editSubject, setEditSubject] = useState(exam.subject ?? '');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveEdit() {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: editTitle, subject: editSubject }),
      });
      const data = await readJsonOrThrow(res, 'Failed to update');
      onUpdate?.(data);
      setEditOpen(false);
      toast.success('Exam updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteExam() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Delete failed');
      }
      onDelete?.(exam.id);
      toast.success('Exam deleted');
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <article className="panel-card flex flex-col justify-between rounded-2xl p-5 transition hover:shadow-md">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-display text-base leading-snug text-slate-900"
              title={exam.filename}
            >
              {exam.filename.length > 40
                ? `${exam.filename.slice(0, 38)}…`
                : exam.filename}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}
              >
                {status.label}
              </span>
              {isOwner && (
                <div className="dropdown dropdown-end">
                  <button
                    type="button"
                    tabIndex={0}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-base leading-none"
                  >
                    ⋯
                  </button>
                  <ul className="menu menu-sm dropdown-content z-[999] mt-1 w-40 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setEditTitle(exam.filename);
                          setEditSubject(exam.subject ?? '');
                          setEditOpen(true);
                        }}
                        className="rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {(exam.subject || exam.topic) && (
            <p className="mt-1 text-xs text-slate-500">
              {[exam.subject, exam.topic].filter(Boolean).join(' · ')}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            {exam.totalQuestions} question{exam.totalQuestions !== 1 ? 's' : ''}{' '}
            · {exam.uploadedBy?.username ?? 'Unknown'}
          </p>
        </div>

        <div className="mt-4">
          {canPractice ? (
            <Link
              to={`/exams/${exam.id}`}
              className="btn-primary block w-full py-2 text-center text-sm"
            >
              {isProcessing ? 'Practice (extracting more…)' : 'Practice now'}
            </Link>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {isProcessing ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Extracting questions…
                </>
              ) : exam.processingStatus === 'failed' ? (
                <span className="text-rose-600">Processing failed</span>
              ) : (
                <span>Not yet available</span>
              )}
            </div>
          )}
        </div>
      </article>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setEditOpen(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-slate-900">Edit Exam</h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <label htmlFor="exam-card-title" className="mb-1 block text-xs font-semibold text-slate-700">
              Title
            </label>
            <input
              id="exam-card-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-field mb-3 w-full text-sm"
            />
            <label htmlFor="exam-card-subject" className="mb-1 block text-xs font-semibold text-slate-700">
              Subject
            </label>
            <input
              id="exam-card-subject"
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="e.g. Biology, Mathematics…"
              className="input-field mb-5 w-full text-sm"
            />
            <button
              type="button"
              onClick={saveEdit}
              disabled={editSaving}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={() => setConfirmDelete(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h2 className="font-display text-lg text-slate-900">
              Delete exam?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              This will permanently delete the exam and all its questions.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={deleteExam}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Upload Tab ────────────────────────────────────────────────────────────────

function UploadTab({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const inputRef = useRef(null);

  function pickFile(picked) {
    if (!picked) return;
    if (picked.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      setError('File must be smaller than 10 MB.');
      return;
    }
    setError('');
    setFile(picked);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError('');
    setProgress(10);

    try {
      const form = new FormData();
      form.append('pdf', file);

      // Simulate progress ticks while waiting
      const progressTimer = setInterval(() => {
        setProgress((p) => Math.min(p + 8, 85));
      }, 400);

      const res = await fetch('/api/exams/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      clearInterval(progressTimer);
      setProgress(100);

      const data = await readJsonOrThrow(res, 'Upload failed');
      setSuccess(data);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (success) {
    return (
      <div className="panel-card rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-3xl">✓</span>
        </div>
        <h2 className="font-display text-xl text-slate-900">
          Upload successful!
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong>{success.filename}</strong> has been uploaded. Questions are
          being extracted in the background — this can take a minute.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to={`/exams/${success.id}`}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            View exam
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              onUploaded?.();
            }}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            Browse all exams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card rounded-3xl p-6 md:p-8">
      <h2 className="font-display text-xl text-slate-900">Upload a PDF</h2>
      <p className="mt-1 text-sm text-slate-500">
        Max 10 MB · PDF only · Questions extracted automatically by AI
      </p>

      {/* Drop zone — drag events require a div; click is on the inner button */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop requires event handlers on a container div; clickable action is on the inner <button> */}
      <div
        className={`mt-6 rounded-2xl border-2 border-dashed transition ${
          dragOver
            ? 'border-cyan-500 bg-cyan-50'
            : file
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-slate-300 bg-slate-50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="flex w-full cursor-pointer flex-col items-center justify-center p-10 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-2xl"
          onClick={() => inputRef.current?.click()}
          aria-label="Click or drag to upload PDF"
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files[0])}
          />
          <div className="text-5xl">{file ? '📄' : '⬆'}</div>
          {file ? (
            <>
              <p className="mt-3 font-semibold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-semibold text-slate-700">
                Drop your PDF here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF files only, max 10 MB
              </p>
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-slate-800 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={upload}
          className="btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload & Extract Questions'}
        </button>
        {file && !uploading && (
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setError('');
            }}
            className="btn-secondary px-4 py-2.5 text-sm"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default Exams;
