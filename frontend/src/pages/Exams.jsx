import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bookmark,
  BookMarked,
  Check,
  ChevronDown,
  FileStack,
  FileText,
  Globe2,
  GraduationCap,
  GripHorizontal,
  Heart,
  Library,
  Lock,
  PencilLine,
  Plus,
  Share2,
  Shuffle,
  Sparkles,
  ThumbsDown,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import { useAuth } from '../contexts/AuthContext';
import {
  ACADEMIC_TRACKS,
  COURSE_SUBJECT_SUGGESTIONS,
  DEPARTMENTS_BY_TRACK,
  academicTrackLabel,
  resolveDepartmentForSubmit,
} from '../utils/bookUploadMeta';
import {
  EXAM_PAPER_TYPE_OPTIONS,
  examPaperTypeLabel,
} from '../utils/examPaperLabels';
import { readJsonOrThrow } from '../utils/http';

const TABS = [
  {
    key: 'vault',
    label: 'My vault',
    sub: 'Private · only you',
    icon: BookMarked,
  },
  {
    key: 'bank',
    label: 'Question bank',
    sub: 'Community papers',
    icon: Library,
  },
  {
    key: 'import',
    label: 'Import PDF',
    sub: 'AI extraction',
    icon: Upload,
  },
];

const STATUS_LABELS = {
  pending: { label: 'Queued', cls: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Processing…', cls: 'bg-amber-100 text-amber-700' },
  complete: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', cls: 'bg-rose-100 text-rose-700' },
};

const DEFAULT_MCQ_FORM = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
  subject: '',
  topic: '',
  tagsStr: '',
  difficulty: 3,
});

function normalizeOptions(raw) {
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

/** All / Private / Public — works with `scope=browse` or `scope=mine` on GET /api/exams */
function PapersVisibilityControl({ value, onChange, className = '' }) {
  const opts = [
    {
      id: 'all',
      label: 'All',
      hint: 'Everything in view',
      Icon: FileStack,
    },
    {
      id: 'private',
      label: 'Private',
      hint: 'Only you',
      Icon: Lock,
    },
    {
      id: 'public',
      label: 'Public',
      hint: 'Discovery / bank',
      Icon: Globe2,
    },
  ];

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-900/65 ${className}`}
      role="group"
      aria-label="Paper visibility filter"
    >
      {opts.map(({ id, label, hint, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            title={hint}
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'bg-white text-cyan-900 shadow-sm ring-1 ring-cyan-500/25 dark:bg-slate-800 dark:text-cyan-100 dark:ring-cyan-500/35'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Exams() {
  const [tab, setTab] = useState('vault');

  return (
    <div className="liqu-ai-ambient page-surface px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <Link
            to="/liqu-ai"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-cyan-300/60 hover:text-cyan-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-cyan-700/50 dark:hover:text-cyan-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to Liqu AI
          </Link>
        </div>
        <header className="panel-card fade-in-up relative mb-6 overflow-hidden rounded-3xl p-6 md:p-8">
          <div
            className="workspace-hero-mesh pointer-events-none absolute inset-0 rounded-3xl opacity-70"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
              Liqu AI · Exam studio
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
              Vault &amp; shared papers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Author MCQs only you see in your vault, then publish snapshots to
              the community bank when you&apos;re ready. Import PDFs for fast AI
              extraction—all in one cohesive workspace.
            </p>
          </div>
        </header>

        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {TABS.map(({ key, label, sub, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`panel-card flex items-start gap-3 rounded-2xl p-4 text-left transition md:p-5 ${
                tab === key
                  ? 'ring-2 ring-cyan-500/50 shadow-md dark:ring-cyan-400/40'
                  : 'opacity-95 hover:border-cyan-200/70 dark:hover:border-cyan-800/50'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                  tab === key
                    ? 'from-cyan-500/25 to-indigo-500/20 ring-1 ring-cyan-500/30 dark:from-cyan-600/25 dark:to-indigo-900/30'
                    : 'from-slate-300/35 to-slate-400/20 dark:from-slate-600/30 dark:to-slate-700/25'
                }`}
              >
                <Icon className="h-5 w-5 text-slate-800 dark:text-slate-100" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {sub}
                </span>
              </span>
            </button>
          ))}
        </div>

        {tab === 'vault' ? (
          <VaultWorkspace onOpenImport={() => setTab('import')} />
        ) : tab === 'bank' ? (
          <BankTab />
        ) : (
          <PdfImportTab onUploaded={() => setTab('bank')} />
        )}
      </div>
    </div>
  );
}

// ── Vault (private questions + AI + publish + practice) ───────────────────────

function vaultDraftContextBloc(form) {
  const opts = normalizeOptions(form.options);
  const label = opts
    .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
    .join('\n');
  return `MCQ draft (not yet saved unless you confirm in the composer):

Stem: ${form.question || '(empty)'}

Options:
${label || '(no options)'}

Correct index (0-based): ${form.correctAnswer}
Explanation: ${form.explanation || '(none)'}

Subject/topic hints: ${form.subject || ''} / ${form.topic || ''}`;
}

function VaultWorkspace({ onOpenImport }) {
  const { user } = useAuth();
  const username = user?.username ?? 'you';

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  /** @type {[Set<string>, (s: Set<string> | ((p: Set<string>) => Set<string>)) => void]} */
  const [selSet, setSelSet] = useState(() => new Set());

  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_MCQ_FORM);

  const [publishOpen, setPublishOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubSubject, setPubSubject] = useState('');
  const [pubTopic, setPubTopic] = useState('');
  const [pubTrack, setPubTrack] = useState('engineering');
  const [pubDepartment, setPubDepartment] = useState('');
  const [pubCourse, setPubCourse] = useState('');
  const [pubPaperType, setPubPaperType] = useState('other');
  const [publishOrderIds, setPublishOrderIds] = useState([]);
  const [publishing, setPublishing] = useState(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizQs, setQuizQs] = useState([]);

  const [myPapers, setMyPapers] = useState([]);
  const [myPapersTotal, setMyPapersTotal] = useState(0);
  const [myPapersPage, setMyPapersPage] = useState(1);
  const [papersVisibility, setPapersVisibility] = useState('all');
  const [papersSearch, setPapersSearch] = useState('');
  const [myPapersLoading, setMyPapersLoading] = useState(true);
  const papersPollRef = useRef(null);

  const fetchVault = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '24',
        search,
      });
      const res = await fetch(`/api/vault/questions?${qs}`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Failed to load vault');
      setRows(data.questions ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  const fetchMyPapers = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setMyPapersLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(myPapersPage),
        limit: '18',
        scope: 'mine',
      });
      if (papersVisibility !== 'all') {
        params.set('visibility', papersVisibility);
      }
      const ps = papersSearch.trim();
      if (ps) params.set('search', ps);
      const res = await fetch(`/api/exams?${params}`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Failed to load your papers');
      setMyPapers(data.exams ?? []);
      setMyPapersTotal(Number(data.total) || 0);
    } catch (e) {
      toast.error(e.message);
      if (!silent) {
        setMyPapers([]);
        setMyPapersTotal(0);
      }
    } finally {
      if (!silent) setMyPapersLoading(false);
    }
  }, [myPapersPage, papersVisibility, papersSearch]);

  useEffect(() => {
    fetchMyPapers();
  }, [fetchMyPapers]);

  useEffect(() => {
    const busy = myPapers.some(
      (e) =>
        e.processingStatus === 'processing' ||
        e.processingStatus === 'pending',
    );
    if (busy) {
      papersPollRef.current = setInterval(() => {
        fetchMyPapers({ silent: true });
      }, 4000);
    } else {
      clearInterval(papersPollRef.current);
    }
    return () => clearInterval(papersPollRef.current);
  }, [myPapers, fetchMyPapers]);

  const selectedList = rows.filter((r) => selSet.has(r.id));
  /** Stable order list for publishing: reorder from publishOrderIds if set */

  function openComposerNew() {
    setEditingId(null);
    setForm(DEFAULT_MCQ_FORM());
    setComposerOpen(true);
  }

  function openComposerEdit(mc) {
    setEditingId(mc.id);
    setForm({
      question: mc.question,
      options: [...mc.options, '', '', '', ''].slice(0, 5),
      correctAnswer: mc.correctAnswer,
      explanation: mc.explanation ?? '',
      subject: mc.subject ?? '',
      topic: mc.topic ?? '',
      tagsStr: Array.isArray(mc.tags) ? mc.tags.join(', ') : '',
      difficulty: mc.difficulty ?? 3,
    });
    setComposerOpen(true);
  }

  async function saveMcq(e) {
    e.preventDefault();
    const opts = normalizeOptions(form.options);
    if (!form.question.trim()) {
      toast.error('Add a stem');
      return;
    }
    if (opts.length < 2) {
      toast.error('Keep at least two non-empty answer choices.');
      return;
    }
    if (form.correctAnswer < 0 || form.correctAnswer >= opts.length) {
      toast.error('Correct answer doesn’t match choices.');
      return;
    }

    const tags = form.tagsStr
      ? form.tagsStr
          .split(/[,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const body = {
      question: form.question.trim(),
      options: opts,
      correctAnswer: Number(form.correctAnswer),
      explanation: form.explanation.trim(),
      subject: form.subject.trim(),
      topic: form.topic.trim(),
      tags,
      difficulty: Number(form.difficulty),
    };

    try {
      const url =
        editingId != null
          ? `/api/vault/questions/${editingId}`
          : '/api/vault/questions';
      const res = await fetch(url, {
        method: editingId != null ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await readJsonOrThrow(res, 'Save failed');
      toast.success(editingId ? 'Updated' : 'Saved to vault');
      setComposerOpen(false);
      fetchVault();
      setEditingId(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteMc(id) {
    if (!confirm('Remove this MCQ from your vault?')) return;
    try {
      const res = await fetch(`/api/vault/questions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await readJsonOrThrow(res, 'Delete failed');
      setSelSet((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchVault();
      toast.success('Removed');
    } catch (err) {
      toast.error(err.message);
    }
  }

  function toggleSel(id, checked) {
    setSelSet((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openPublishWizard() {
    const idsFromSelection = [...selSet];
    if (idsFromSelection.length < 1) {
      toast.error('Pick at least one vault question.');
      return;
    }
    setPublishOrderIds(idsFromSelection);
    setPubSubject(selectedList[0]?.subject ?? '');
    setPubTopic(selectedList[0]?.topic ?? '');
    setPubTrack('engineering');
    setPubDepartment('');
    setPubCourse('');
    setPubPaperType('other');
    setPubTitle('');
    setPublishOpen(true);
  }

  async function publishSnapshot() {
    if (!pubTitle.trim()) {
      toast.error('Add a visible title');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch('/api/vault/questions/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pubTitle.trim(),
          subject: pubSubject.trim(),
          topic: pubTopic.trim(),
          questionIds: publishOrderIds,
          academicTrack: pubTrack,
          department: pubDepartment.trim(),
          courseSubject: pubCourse.trim(),
          paperType: pubPaperType,
        }),
      });
      const data = await readJsonOrThrow(res, 'Publish failed');
      if (Array.isArray(data.warnings)) {
        for (const w of data.warnings) {
          const msg = typeof w === 'object' ? w.message : String(w);
          if (msg) toast.message('Heads up', { description: msg });
        }
      }
      toast.success('Published to bank', {
        action: data.exam?.id
          ? {
              label: 'Open paper',
              onClick: () => {
                window.location.href = `/exams/${data.exam.id}`;
              },
            }
          : undefined,
      });
      setPublishOpen(false);
      setSelSet(new Set());
      fetchMyPapers();
      fetchVault();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  }

  function movePublishIndex(i, dir) {
    setPublishOrderIds((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const orderedPublishRows = useMemo(() => {
    const map = new Map(rows.map((r) => [r.id, r]));
    return publishOrderIds.map((id) => map.get(id)).filter(Boolean);
  }, [publishOrderIds, rows]);

  const vaultStarters = useMemo(() => {
    const bloc = vaultDraftContextBloc(form);
    return [
      `${bloc}

Task: Rewrite the distractors only so they are subtly wrong but pedagogically plausible. Keep exactly one decisive correct option. Preserve the discipline tone. Respond with Stem, Options labeled A-E, Correct letter, Explanation.`,
      `${bloc}

Task: Produce a shorter, clearer stem and keep the difficulty level unchanged. Preserve one correct answer. Respond with full MCQ.`,
      `${bloc}

Task: Rewrite this question to target application (Bloom taxonomy) rather than recall. Adapt options accordingly. Respond with full MCQ.`,
    ];
  }, [form]);

  async function startPractice() {
    try {
      const res = await fetch('/api/vault/questions/practice-batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 }),
      });
      const data = await readJsonOrThrow(res, 'Practice fetch failed');
      if (!data.questions?.length) {
        toast.error('Add at least one question to practice.');
        return;
      }
      setQuizQs(data.questions);
      setQuizOpen(true);
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-12">
      <section className="space-y-4" aria-labelledby="vault-papers-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 ring-1 ring-cyan-500/25 dark:from-cyan-600/25 dark:to-indigo-900/30">
                <FileStack className="h-4 w-4 text-slate-800 dark:text-slate-100" />
              </span>
              <h2
                id="vault-papers-heading"
                className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
              >
                Your papers
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Imported PDFs and snapshots you curated — same shelf as drafts, with
              a visibility lens so you see private imports, bank-ready papers, or
              everything together.
            </p>
          </div>
          <PapersVisibilityControl
            value={papersVisibility}
            onChange={(id) => {
              setPapersVisibility(id);
              setMyPapersPage(1);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Find a paper, course, or department…"
            value={papersSearch}
            onChange={(e) => {
              setPapersSearch(e.target.value);
              setMyPapersPage(1);
            }}
            className="input-field h-10 min-w-[220px] flex-1 text-sm"
          />
          {typeof onOpenImport === 'function' ? (
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm"
              onClick={onOpenImport}
            >
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
              Import PDF
            </button>
          ) : null}
          <span className="hidden whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 sm:inline">
            {myPapersTotal} · your uploads in this lens
          </span>
        </div>

        {myPapersLoading ? (
          <div className="flex items-center justify-center py-14 text-slate-500">
            <span className="loading loading-spinner" />
            <span className="ml-2 text-sm">Loading your papers…</span>
          </div>
        ) : myPapers.length === 0 ? (
          <div className="panel-card rounded-2xl border border-dashed border-slate-200/90 px-6 py-10 text-center dark:border-slate-700/90">
            <FileStack className="mx-auto h-9 w-9 text-slate-400 dark:text-slate-500" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              No papers in this lens
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {papersVisibility === 'private'
                ? 'No private extracts yet — try All or import a PDF (stays private until you switch to Community).'
                : papersVisibility === 'public'
                  ? 'Nothing listed on the bank from you yet — publish from drafts below or expose a PDF.'
                  : 'Import a syllabus or compose questions and publish — your shelf stays organized here.'}
            </p>
            {typeof onOpenImport === 'function' ? (
              <button
                type="button"
                className="btn-primary mt-4 px-5 py-2 text-sm"
                onClick={onOpenImport}
              >
                Go to Import PDF
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {myPapers.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  currentUserId={user?._id ?? user?.id}
                  onDelete={() => fetchMyPapers()}
                  onUpdate={(updated) =>
                    setMyPapers((prev) =>
                      prev.map((e) => (e.id === updated.id ? updated : e)),
                    )
                  }
                />
              ))}
            </div>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Showing {myPapers.length} of {myPapersTotal} ({papersVisibility})
            </p>
            {myPapersTotal > 18 ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={myPapersPage === 1}
                  onClick={() => setMyPapersPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Page {myPapersPage} of{' '}
                  {Math.max(1, Math.ceil(myPapersTotal / 18))}
                </span>
                <button
                  type="button"
                  disabled={myPapersPage >= Math.ceil(myPapersTotal / 18)}
                  onClick={() => setMyPapersPage((p) => p + 1)}
                  className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="vault-drafts-heading">
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200/80 pt-10 dark:border-slate-700/80">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-slate-300/25 ring-1 ring-slate-200/70 dark:from-indigo-900/35 dark:to-slate-700/35 dark:ring-slate-600/60">
                <GraduationCap className="h-4 w-4 text-slate-800 dark:text-slate-100" />
              </span>
              <h2
                id="vault-drafts-heading"
                className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
              >
                Question drafts
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
              Stem-and-option work in progress — stays on-device until you batch
              publish as a curated paper above.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search your vault drafts…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field h-10 flex-1 min-w-[180px] text-sm"
          />
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            onClick={openComposerNew}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add MCQ
          </button>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            onClick={startPractice}
          >
            <Shuffle className="h-4 w-4 shrink-0" />
            Practice
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <span className="loading loading-spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-card rounded-2xl border border-slate-200/70 px-6 py-10 text-center dark:border-slate-700/70">
            <GraduationCap className="mx-auto h-10 w-10 text-cyan-600/70" />
            <p className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-50">
              No drafts yet — only MCQs missing
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Papers you uploaded still appear above. Tap <strong>Add MCQ</strong>{' '}
              to sketch privately; stitch them together when publishing to the bank.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((mc) => {
                const chk = selSet.has(mc.id);
                return (
                  <li key={mc.id}>
                    <div
                      className={`panel-card flex flex-wrap items-start gap-3 rounded-2xl p-4 transition md:flex-nowrap md:items-center ${
                        chk
                          ? 'ring-2 ring-cyan-500/35 dark:ring-cyan-400/30'
                          : ''
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          checked={chk}
                          onChange={(e) => toggleSel(mc.id, e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
                          {mc.question.length > 200
                            ? `${mc.question.slice(0, 197)}…`
                            : mc.question}
                        </p>
                        {(mc.subject || mc.topic) && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {[mc.subject, mc.topic].filter(Boolean).join(' · ')}{' '}
                            ·{' '}
                            <span className="font-semibold">
                              Difficulty {mc.difficulty ?? '?'}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => openComposerEdit(mc)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-rose-200/80 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/45 dark:text-rose-400 dark:hover:bg-rose-950/35"
                          onClick={() => deleteMc(mc.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Showing {rows.length} of {total}
            </p>
          </>
        )}
      </section>

      {composerOpen ? (
        <div className="fixed inset-0 z-[2147483630] flex flex-col lg:flex-row">
          <button
            type="button"
            aria-label="Close composer"
            className="absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setComposerOpen(false)}
          />
          <div className="relative mt-auto flex max-h-[94vh] w-full flex-1 flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:mx-auto lg:my-auto lg:mt-8 lg:h-[82vh] lg:max-h-[840px] lg:max-w-6xl lg:rounded-3xl lg:shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 lg:rounded-t-3xl lg:py-4">
              <span className="font-display font-semibold text-slate-900 dark:text-white">
                {editingId ? 'Edit vault MCQ' : 'Compose vault MCQ'}
              </span>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 lg:grid-cols-5">
              <form
                onSubmit={saveMcq}
                className="flex min-h-0 flex-col border-slate-100 p-4 dark:border-slate-800 lg:col-span-3 lg:border-r lg:overflow-y-auto"
              >
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Stem
                  <textarea
                    value={form.question}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, question: e.target.value }))
                    }
                    rows={3}
                    required
                    className="mt-1 input-field w-full resize-y text-sm leading-relaxed"
                    placeholder="The question learners see."
                  />
                </label>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Options · mark correct inline
                </p>
                {form.options.slice(0, 5).map((opt, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Five fixed-choice slots keyed by letter index (A–E).
                  <Fragment key={`vault-opt-slot-${i}`}>
                    <label className="mt-2 flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`vault-correct-${editingId ?? 'new'}`}
                        checked={form.correctAnswer === i}
                        onChange={() =>
                          setForm((f) => ({ ...f, correctAnswer: i }))
                        }
                        className="mt-1 shrink-0"
                      />
                      <input
                        value={opt}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.options];
                            next[i] = e.target.value;
                            return { ...f, options: next };
                          })
                        }
                        className="input-field min-w-0 flex-1 text-sm"
                        placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                      />
                    </label>
                  </Fragment>
                ))}

                <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Explanation · optional but powerful
                  <textarea
                    value={form.explanation}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, explanation: e.target.value }))
                    }
                    rows={3}
                    className="mt-1 input-field w-full resize-y text-sm"
                  />
                </label>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Subject
                    <input
                      value={form.subject}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subject: e.target.value }))
                      }
                      className="mt-1 input-field w-full text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Topic
                    <input
                      value={form.topic}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, topic: e.target.value }))
                      }
                      className="mt-1 input-field w-full text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Tags comma-separated
                    <input
                      value={form.tagsStr}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tagsStr: e.target.value }))
                      }
                      className="mt-1 input-field w-full text-sm"
                      placeholder="e.g. kinematics, week 5"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Difficulty · 1 easy → 5 hard
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={1}
                      value={form.difficulty}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          difficulty: Number(e.target.value || 3),
                        }))
                      }
                      className="mt-1 input-field w-full text-sm"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="btn-primary px-5 py-2 text-sm"
                  >
                    {editingId ? 'Save changes' : 'Save to vault'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-sm"
                    onClick={() => setComposerOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>

              <div className="hidden min-h-0 flex-col lg:col-span-2 lg:flex">
                <LiquAiChatPanel
                  variant="gemini"
                  workspacePresentation="studyBuddy"
                  bookTitle=""
                  bookId=""
                  denseStudyChrome
                  contextBlurb={vaultDraftContextBloc(form)}
                  starterPrompts={vaultStarters}
                  showQuickPromptsEmptyState
                  className="min-h-[22rem] border-t border-slate-100 dark:border-slate-800 lg:min-h-0 lg:flex-1 lg:border-none"
                  sessionSidebarMode="rail"
                />
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 text-[11px] text-slate-500 dark:border-slate-800 lg:hidden dark:text-slate-400">
              Widen viewport for Liqu AI assistance alongside composer.
            </div>
          </div>
        </div>
      ) : null}

      {publishOpen ? (
        <div className="fixed inset-0 z-[2147483631] flex items-end justify-center p-0 lg:items-center lg:p-6">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/35 backdrop-blur-sm"
            onClick={() => setPublishOpen(false)}
          />
          <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:rounded-3xl dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2 font-display text-lg text-slate-900 dark:text-white">
                  <FileStack className="h-5 w-5 text-indigo-500" />
                  Publish snapshot
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Community users get an immutable snapshot of{' '}
                  <strong>{orderedPublishRows.length}</strong> question
                  {orderedPublishRows.length === 1 ? '' : 's'}. Attribution:{' '}
                  <strong>@{username}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Bank title · visible publicly
                <input
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  className="mt-1 input-field w-full text-sm"
                  placeholder="e.g. Week 12 practice — Mechanics"
                  required
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-500">
                  Subject · optional
                  <input
                    value={pubSubject}
                    onChange={(e) => setPubSubject(e.target.value)}
                    className="mt-1 input-field w-full text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Topic · optional
                  <input
                    value={pubTopic}
                    onChange={(e) => setPubTopic(e.target.value)}
                    className="mt-1 input-field w-full text-sm"
                  />
                </label>
              </div>

              <details className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/35">
                <summary className="cursor-pointer select-none text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Catalog · helps classmates discover your paper
                </summary>
                <div className="mt-3 space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Academic field
                    <select
                      value={pubTrack}
                      onChange={(e) => {
                        setPubTrack(e.target.value);
                        setPubDepartment('');
                      }}
                      className="mt-1 input-field h-10 w-full text-sm"
                    >
                      {ACADEMIC_TRACKS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Department / discipline
                    <select
                      value={pubDepartment}
                      onChange={(e) => setPubDepartment(e.target.value)}
                      className="mt-1 input-field h-10 w-full text-sm"
                    >
                      <option value="">Select…</option>
                      {(DEPARTMENTS_BY_TRACK[pubTrack] ?? []).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Course · subject title
                    <input
                      value={pubCourse}
                      onChange={(e) => setPubCourse(e.target.value)}
                      placeholder="e.g. Data Structures"
                      className="mt-1 input-field w-full text-sm"
                      list="pub-course-list"
                    />
                    <datalist id="pub-course-list">
                      {COURSE_SUBJECT_SUGGESTIONS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Paper classification
                    <select
                      value={pubPaperType}
                      onChange={(e) => setPubPaperType(e.target.value)}
                      className="mt-1 input-field h-10 w-full text-sm"
                    >
                      {EXAM_PAPER_TYPE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>

              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Ordering
              </p>
              <ul className="space-y-1.5">
                {orderedPublishRows.map((r, idx) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-xs dark:border-slate-700"
                  >
                    <span className="mt-2 text-slate-400">
                      <GripHorizontal className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        #{idx + 1}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                        {r.question}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                        aria-label="Move up"
                        onClick={() => movePublishIndex(idx, -1)}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                        aria-label="Move down"
                        onClick={() => movePublishIndex(idx, +1)}
                        disabled={idx === orderedPublishRows.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="rounded-xl border border-violet-200/70 bg-violet-50/80 px-3 py-2 text-[11px] leading-snug text-violet-950 dark:border-violet-900/55 dark:bg-violet-950/40 dark:text-violet-50">
                Deleting drafts in your vault never removes snapshots already on
                the bank—students keep their practice material stable.
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-5 dark:border-slate-800">
              <button
                type="button"
                disabled={publishing || !pubTitle.trim()}
                onClick={publishSnapshot}
                className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-45"
              >
                {publishing ? 'Publishing…' : 'Publish to bank'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <VaultQuizOverlay
        open={quizOpen}
        questions={quizQs}
        onClose={() => {
          setQuizOpen(false);
          setQuizQs([]);
        }}
      />

      {/* Sticky footer for multi-select */}
      {selSet.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-[2147483620] flex w-[min(100%-1.25rem,32rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-cyan-200/80 bg-white/96 px-4 py-3 shadow-xl backdrop-blur-md dark:border-cyan-800/50 dark:bg-slate-900/95">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {selSet.size} selected
          </span>
          <button
            type="button"
            className="btn-primary px-5 py-2 text-xs shadow-sm"
            onClick={openPublishWizard}
          >
            Compose paper…
          </button>
          <button
            type="button"
            className="text-xs text-slate-500 underline hover:no-underline"
            onClick={() => setSelSet(new Set())}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

/** Minimal vault-only quiz overlay (scores locally; attempts not synced). */
function VaultQuizOverlay({ open, questions, onClose }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open && questions.length) {
      setIndex(0);
      setAnswers(new Array(questions.length).fill(null));
      setSubmitted(false);
    }
  }, [open, questions]);

  if (!open || !questions.length) return null;

  const q = questions[index];
  const correctCount = submitted
    ? questions.reduce(
        (acc, mq, i) => acc + (answers[i] === mq.correctAnswer ? 1 : 0),
        0,
      )
    : null;

  const allAnswered =
    answers.length === questions.length && answers.every((a) => a != null);

  return (
    <div className="fixed inset-0 z-[2147483640] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close quiz"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Vault practice
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {submitted ? (
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {correctCount} / {questions.length}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Score stays on this device; refine drafts in composer.
              </p>
              <button
                type="button"
                className="btn-primary mt-8 w-full py-3 text-sm"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Question {index + 1} of {questions.length}
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-900 dark:text-slate-100">
                {q.question}
              </p>
              <ul className="mt-6 space-y-2">
                {q.options.map((opt, optIdx) => {
                  const sel = answers[index] === optIdx;
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: MCQ options are ordered and stable for this question instance.
                    <li key={`${String(q.id)}-opt-${optIdx}`}>
                      <button
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[index] = optIdx;
                            return next;
                          })
                        }
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          sel
                            ? 'border-cyan-500 bg-cyan-500/15 font-semibold text-cyan-950 dark:bg-cyan-950/35 dark:text-cyan-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="mr-2 font-mono text-xs text-slate-400">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        {!submitted ? (
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <button
              type="button"
              disabled={index < 1}
              className="btn-secondary flex-1 py-2 text-sm disabled:opacity-35"
              onClick={() =>
                setIndex((i) => {
                  const next = Math.max(i - 1, 0);
                  return next;
                })
              }
            >
              Previous
            </button>
            {index >= questions.length - 1 ? (
              <button
                type="button"
                disabled={!allAnswered}
                className="btn-primary flex-[1.2] py-2 text-sm disabled:opacity-45"
                onClick={() => setSubmitted(true)}
              >
                Submit
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary flex-[1.2] py-2 text-sm"
                onClick={() =>
                  setIndex((i) => Math.min(i + 1, questions.length - 1))
                }
              >
                Next
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Bank (community exams) ─────────────────────────────────────────────────────

function BankTab() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const pollRef = useRef(null);

  const fetchExams = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '18',
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (visibilityFilter !== 'all') {
        params.set('visibility', visibilityFilter);
      }

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
  }, [page, search, statusFilter, visibilityFilter]);

  useEffect(() => {
    setLoading(true);
    fetchExams();
  }, [fetchExams]);

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-[200px] flex-1">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Who can browse
          </span>
          <PapersVisibilityControl
            value={visibilityFilter}
            onChange={(id) => {
              setVisibilityFilter(id);
              setPage(1);
            }}
          />
        </div>
        <span className="hidden text-[11px] leading-snug text-slate-400 dark:text-slate-500 md:block md:max-w-xs">
          <strong className="text-slate-600 dark:text-slate-300">Public</strong>{' '}
          is the whole bank.&nbsp;
          <strong className="text-slate-600 dark:text-slate-300">
            Private
          </strong>{' '}
          is only drafts you uploaded.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search papers…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input-field h-9 max-w-none flex-1 min-w-[10rem] sm:max-w-md sm:min-w-[14rem]"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-field h-9 shrink-0 text-sm"
        >
          <option value="">All statuses</option>
          <option value="complete">Ready</option>
          <option value="processing">Processing</option>
          <option value="pending">Queued</option>
          <option value="failed">Failed</option>
        </select>
        <span className="ml-auto whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {total} paper{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <span className="loading loading-spinner" />
          <span className="ml-2 text-sm">Loading bank…</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && exams.length === 0 && (
        <div className="panel-card rounded-2xl p-8 text-center">
          <p className="font-display text-lg text-slate-700 dark:text-slate-200">
            No papers yet.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {visibilityFilter === 'private'
              ? 'Nothing private-import in this list — widen to All or add a PDF from your vault tab.'
              : visibilityFilter === 'public'
                ? 'No community papers match — invite classmates to publish or widen your lens.'
                : 'Import a PDF or publish from your vault.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <ExamCard
            key={exam.id}
            exam={exam}
            currentUserId={user?._id ?? user?.id}
            onDelete={(id) =>
              setExams((prev) => prev.filter((e) => e.id !== id))
            }
            onUpdate={(updated) =>
              setExams((prev) =>
                prev.map((e) => (e.id === updated.id ? updated : e)),
              )
            }
          />
        ))}
      </div>

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

// ── Question bank engagement (Library-inspired) ────────────────────────────────

function ExamPaperEngagement({ exam, currentUserId, onUpdate }) {
  const vs = exam.viewerState ?? {};
  const authorId =
    exam.uploadedBy?.id ?? exam.uploadedBy?._id ?? exam.uploadedBy;
  const [busy, setBusy] = useState(null);

  const userReaction =
    vs.liked === true ? 'like' : vs.disliked === true ? 'dislike' : 'none';

  async function toggleReaction(kind) {
    const nextReaction = kind === userReaction ? 'none' : kind;
    setBusy(kind);
    try {
      const res = await fetch(`/api/exams/${exam.id}/react`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: nextReaction }),
      });
      const data = await readJsonOrThrow(res, 'Could not update reaction');
      onUpdate?.(data);
      toast.success(
        nextReaction === 'none'
          ? 'Reaction cleared'
          : nextReaction === 'like'
            ? 'Marked helpful'
            : 'Feedback saved',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleShelf() {
    setBusy('save');
    try {
      const res = await fetch(`/api/exams/${exam.id}/save`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not update shelf');
      onUpdate?.(data);
      toast.success(
        data.viewerState?.saved ? 'Saved to your shelf' : 'Removed from shelf',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function sharePaper() {
    const url = `${window.location.origin}/exams/${exam.id}`;
    setBusy('share');
    try {
      if (navigator.share) {
        await navigator.share({
          title: exam.filename,
          text: `${exam.filename} · ${examPaperTypeLabel(exam.paperType)}`,
          url,
        });
        toast.success('Shared');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Practice link copied');
      } else {
        toast.error('Sharing not supported in this browser');
      }
    } catch {
      toast.message('Share cancelled');
    } finally {
      setBusy(null);
    }
  }

  async function toggleSubscribeAuthor() {
    if (!authorId || String(authorId) === String(currentUserId)) return;
    setBusy('sub');
    try {
      const res = await fetch(`/api/profile/public/${authorId}/subscribe`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not subscribe');
      const subscribed = Boolean(data?.subscribed);
      const ct = Number.isFinite(Number(data?.profile?.subscribersCount))
        ? Number(data.profile.subscribersCount)
        : exam.uploadedBy?.subscribersCount;
      onUpdate?.({
        ...exam,
        uploadedBy: {
          ...exam.uploadedBy,
          viewerSubscribed: subscribed,
          subscribersCount:
            ct ?? exam.uploadedBy?.subscribersCount ?? 0,
        },
      });
      toast.success(
        subscribed
          ? 'You\'ll see more from this curator'
          : 'Unfollowed creator',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  const canFollow =
    authorId && String(authorId) !== String(currentUserId ?? '');

  return (
    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-white/95 px-3 py-2.5 dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-950/65">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy != null && busy !== 'like'}
          onClick={() => toggleReaction('like')}
          title="Mark as helpful"
          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
            vs.liked
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border-slate-200/90 text-slate-600 hover:border-cyan-300/70 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <Heart
            className={`h-3.5 w-3.5 ${vs.liked ? 'fill-current' : ''}`}
            aria-hidden
          />
          {exam.likesCount ?? 0}
        </button>
        <button
          type="button"
          disabled={busy != null && busy !== 'dislike'}
          onClick={() => toggleReaction('dislike')}
          title="Not helpful"
          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
            vs.disliked
              ? 'border-slate-400 bg-slate-800 text-white dark:bg-slate-700'
              : 'border-slate-200/90 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <ThumbsDown
            className={`h-3.5 w-3.5 ${vs.disliked ? 'fill-current' : ''}`}
            aria-hidden
          />
          {exam.dislikesCount ?? 0}
        </button>
        <button
          type="button"
          disabled={busy === 'save'}
          onClick={toggleShelf}
          title="Save to shelf"
          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
            vs.saved
              ? 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-900/55 dark:bg-violet-950/40 dark:text-violet-100'
              : 'border-slate-200/90 text-slate-600 hover:border-violet-300/70 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${vs.saved ? 'fill-current' : ''}`}
            aria-hidden
          />
          Shelf
        </button>
        <button
          type="button"
          disabled={busy === 'share'}
          onClick={sharePaper}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-cyan-400/70 dark:border-slate-600 dark:text-slate-400"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          Share
        </button>
        {canFollow ? (
          <button
            type="button"
            disabled={busy === 'sub'}
            onClick={toggleSubscribeAuthor}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
              exam.uploadedBy?.viewerSubscribed
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/55 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-slate-200/90 text-slate-600 hover:border-emerald-300/70 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {exam.uploadedBy?.viewerSubscribed ? 'Following' : 'Follow'}{' '}
            <span className="font-normal opacity-75">
              · {exam.uploadedBy?.subscribersCount ?? 0}
            </span>
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
        Reactions steer discovery; saves keep papers one tap away in your profile
        rhythm.
      </p>
    </div>
  );
}

function ExamCard({ exam, currentUserId, onDelete, onUpdate }) {
  const status = STATUS_LABELS[exam.processingStatus] ?? STATUS_LABELS.pending;
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
  const [editTopic, setEditTopic] = useState(exam.topic ?? '');
  const [editVisibility, setEditVisibility] = useState(
    exam.visibility ?? 'private',
  );
  const [editTrack, setEditTrack] = useState(
    exam.academicTrack || 'engineering',
  );
  const [editDept, setEditDept] = useState(exam.department ?? '');
  const [editCourse, setEditCourse] = useState(exam.courseSubject ?? '');
  const [editPaperType, setEditPaperType] = useState(
    exam.paperType ?? 'other',
  );
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const examKind = exam.examKind ?? 'pdf';

  async function saveEdit() {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: editTitle,
          subject: editSubject,
          topic: editTopic,
          visibility: editVisibility,
          academicTrack: editTrack,
          department: editDept,
          courseSubject: editCourse,
          paperType: editPaperType,
        }),
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

  async function deleteExamFn() {
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
            <div className="min-w-0">
              <h3
                className="font-display text-base leading-snug text-slate-900 dark:text-slate-100"
                title={exam.filename}
              >
                {exam.filename.length > 40
                  ? `${exam.filename.slice(0, 38)}…`
                  : exam.filename}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}
                >
                  {status.label}
                </span>
                {examKind === 'vault_compiled' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200/70 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300">
                    <Sparkles className="h-3 w-3" aria-hidden /> Crafted
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    PDF paper
                  </span>
                )}
                {exam.visibility === 'private' && isOwner ? (
                  <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    Private
                  </span>
                ) : null}
                <span
                  className="rounded-full border border-teal-200/80 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-900 dark:border-teal-900/45 dark:bg-teal-950/40 dark:text-teal-100"
                  title={examPaperTypeLabel(exam.paperType)}
                >
                  {examPaperTypeLabel(exam.paperType)}
                </span>
              </div>
            </div>
            {isOwner && (
              <div className="dropdown dropdown-end">
                <button
                  type="button"
                  tabIndex={0}
                  className="rounded-full p-0.5 text-base leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  ⋯
                </button>
                <ul className="menu dropdown-content menu-sm z-[999] mt-1 w-40 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitle(exam.filename);
                        setEditSubject(exam.subject ?? '');
                        setEditTopic(exam.topic ?? '');
                        setEditVisibility(exam.visibility ?? 'private');
                        setEditTrack(exam.academicTrack || 'engineering');
                        setEditDept(exam.department ?? '');
                        setEditCourse(exam.courseSubject ?? '');
                        setEditPaperType(exam.paperType ?? 'other');
                        setEditOpen(true);
                      }}
                      className="rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
                    >
                      Edit / visibility…
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/35"
                    >
                      Delete
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {(exam.subject || exam.topic) && (
            <p className="mt-1 text-xs text-slate-500">
              {[exam.subject, exam.topic].filter(Boolean).join(' · ')}
            </p>
          )}

          {(exam.academicTrack || exam.department || exam.courseSubject) && (
            <p className="mt-2 text-[11px] font-medium leading-snug text-slate-600 dark:text-slate-400">
              {[
                academicTrackLabel(exam.academicTrack),
                exam.department,
                exam.courseSubject,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <Link
              to={`/users/${exam.uploadedBy?.id ?? exam.uploadedBy?._id ?? ''}`}
              className="font-medium text-cyan-700 hover:underline dark:text-cyan-400"
            >
              @{exam.uploadedBy?.username ?? 'curator'}
            </Link>
            {exam.uploadedBy?.subscribersCount != null &&
            Number(exam.uploadedBy.subscribersCount) > 0 ? (
              <span className="text-slate-400 dark:text-slate-500">
                · {exam.uploadedBy.subscribersCount} followers
              </span>
            ) : null}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {exam.totalQuestions} question{exam.totalQuestions !== 1 ? 's' : ''}
          </p>

          <ExamPaperEngagement
            exam={exam}
            currentUserId={currentUserId}
            onUpdate={onUpdate}
          />
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

      {editOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40"
            onClick={() => setEditOpen(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-slate-900 dark:text-white">
                Edit paper
              </h2>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <label
              htmlFor="exam-card-title"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Title
            </label>
            <input
              id="exam-card-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-field mb-3 w-full text-sm"
            />
            <label
              htmlFor="exam-card-subject"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Subject
            </label>
            <input
              id="exam-card-subject"
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="e.g. Biology, Mathematics…"
              className="input-field mb-3 w-full text-sm"
            />
            <label
              htmlFor="exam-card-topic"
              className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Topic
            </label>
            <input
              id="exam-card-topic"
              type="text"
              value={editTopic}
              onChange={(e) => setEditTopic(e.target.value)}
              className="input-field mb-3 w-full text-sm"
              placeholder="e.g. Unit 3 review"
            />
            <details className="mb-4 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/55">
              <summary className="cursor-pointer select-none text-xs font-semibold text-slate-800 dark:text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <ChevronDown className="inline h-3 w-3" /> Academic catalog
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Field
                  <select
                    value={editTrack}
                    onChange={(e) => {
                      setEditTrack(e.target.value);
                      setEditDept('');
                    }}
                    className="mt-1 input-field h-9 w-full text-sm"
                  >
                    {ACADEMIC_TRACKS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Department
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="mt-1 input-field h-9 w-full text-sm"
                  >
                    <option value="">Select…</option>
                    {(DEPARTMENTS_BY_TRACK[editTrack] ?? []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Course
                  <input
                    value={editCourse}
                    onChange={(e) => setEditCourse(e.target.value)}
                    className="mt-1 input-field w-full text-sm"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Paper type
                  <select
                    value={editPaperType}
                    onChange={(e) => setEditPaperType(e.target.value)}
                    className="mt-1 input-field h-9 w-full text-sm"
                  >
                    {EXAM_PAPER_TYPE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <details className="mb-5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
              <summary className="cursor-pointer select-none text-xs font-semibold text-slate-800 dark:text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <ChevronDown className="inline h-3 w-3" /> Visibility &
                  publishing
                </span>
              </summary>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                Private papers remain on your Browse list but never appear on
                other students&apos; dashboards. Toggle public when extraction
                succeeds to share broadly.
              </p>
              <div className="mt-3 flex rounded-xl border border-slate-200/80 bg-white p-1 dark:border-slate-700 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setEditVisibility('private')}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                    editVisibility === 'private'
                      ? 'bg-slate-900 text-white shadow dark:bg-slate-200 dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => setEditVisibility('public')}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                    editVisibility === 'public'
                      ? 'bg-cyan-700 text-white shadow dark:bg-cyan-600'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Community
                </button>
              </div>
            </details>
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

      {confirmDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40"
            onClick={() => setConfirmDelete(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h2 className="font-display text-lg text-slate-900 dark:text-white">
              Delete exam?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Permanently removes this paper from the hub and wipes stored
              questions.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={deleteExamFn}
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

// ── PDF import ─────────────────────────────────────────────────────────────────

function validatePdfCatalogForUpload(form) {
  const track = String(form.academicTrack || '').trim().toLowerCase();
  if (!['engineering', 'social', 'natural'].includes(track)) {
    return 'Choose a field: Engineering, Social sciences, or Natural sciences.';
  }
  const dept = resolveDepartmentForSubmit(form);
  if (!dept || dept.length > 160) {
    return 'Department or discipline is required.';
  }
  if (form.department === 'Other' && !String(form.departmentOther || '').trim()) {
    return 'Specify your department when selecting Other.';
  }
  if (!String(form.courseSubject || '').trim()) {
    return 'Course or subject is required (e.g. Operating Systems).';
  }
  const pt = String(form.paperType || '').trim();
  const allowed = EXAM_PAPER_TYPE_OPTIONS.map((o) => o.id);
  if (!allowed.includes(pt)) {
    return 'Select a paper type (exit, mock, model, final, midterm, etc.).';
  }
  if (String(form.displayTitle || '').trim().length > 200) {
    return 'Paper title is too long (max 200 characters).';
  }
  return null;
}

function PdfImportTab({ onUploaded }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [privacyPrivate, setPrivacyPrivate] = useState(true);
  const [importTrack, setImportTrack] = useState('engineering');
  const [importDept, setImportDept] = useState('');
  const [importDeptOther, setImportDeptOther] = useState('');
  const [importCourse, setImportCourse] = useState('');
  const [importPaperType, setImportPaperType] = useState('other');
  const [displayTitle, setDisplayTitle] = useState('');
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

    const catalogForm = {
      academicTrack: importTrack,
      department: importDept,
      departmentOther: importDeptOther,
      courseSubject: importCourse,
      paperType: importPaperType,
      displayTitle,
    };
    const catErr = validatePdfCatalogForUpload(catalogForm);
    if (catErr) {
      setError(catErr);
      return;
    }

    const resolvedDept = resolveDepartmentForSubmit(catalogForm);

    setUploading(true);
    setError('');
    setProgress(10);

    try {
      const form = new FormData();
      form.append('pdf', file);
      form.append('visibility', privacyPrivate ? 'private' : 'public');
      form.append('academicTrack', String(importTrack).trim().toLowerCase());
      form.append('department', resolvedDept);
      form.append('courseSubject', String(importCourse).trim());
      form.append('paperType', String(importPaperType).trim());
      const dt = String(displayTitle || '').trim();
      if (dt) form.append('displayTitle', dt);

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
      toast.success('PDF uploaded', {
        description: 'AI is extracting questions in the background.',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {success ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-import-success-title"
        >
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" aria-hidden />
          <div className="relative w-full max-w-xl overflow-hidden rounded-[1.85rem] border border-cyan-400/35 bg-gradient-to-b from-slate-900 via-[#0c1220] to-slate-950 p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.1),0_28px_90px_-24px_rgba(0,0,0,0.75)] md:p-8">
            <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-56 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="relative text-center">
              <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-400/15">
                <Check className="h-9 w-9 text-white" strokeWidth={2.5} aria-hidden />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">
                Extraction underway
              </p>
              <h2
                id="pdf-import-success-title"
                className="mt-2 font-display text-2xl font-bold tracking-tight text-white md:text-[1.65rem]"
              >
                Questions are being prepared
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-200">{success.filename}</span>{' '}
                is on our servers. Head to practice to track readiness, or continue curating
                more papers.
              </p>
            </div>
            <ul className="relative mt-7 grid list-none gap-3 sm:gap-4">
              <li>
                <button
                  type="button"
                  onClick={() => navigate(`/exams/${success.id}`)}
                  className="group flex w-full items-start gap-4 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-600/30 via-teal-600/15 to-transparent p-4 text-left transition hover:border-cyan-300/60 hover:shadow-lg hover:shadow-cyan-500/15"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40">
                    <GraduationCap className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold text-white">
                      Open practice workspace
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-400 group-hover:text-slate-300">
                      Start drills on these MCQs — the header shows extraction until every
                      question is ready.
                    </span>
                  </span>
                  <Sparkles className="mt-1 h-5 w-5 shrink-0 text-amber-300/90 opacity-90" aria-hidden />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setProgress(0);
                  }}
                  className="group flex w-full items-start gap-4 rounded-2xl border border-violet-500/25 bg-slate-800/45 p-4 text-left transition hover:border-violet-400/45 hover:bg-violet-500/10"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/30">
                    <Upload className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold text-white">
                      Import another PDF
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-400 group-hover:text-slate-300">
                      Run the upload flow again for a fresh paper while this one finishes.
                    </span>
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    onUploaded?.();
                  }}
                  className="group flex w-full items-start gap-4 rounded-2xl border border-emerald-500/25 bg-slate-800/45 p-4 text-left transition hover:border-emerald-400/40 hover:bg-emerald-500/10"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/30">
                    <Library className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold text-white">
                      Browse the question bank
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-slate-400 group-hover:text-slate-300">
                      Explore community papers — this upload stays in your vault privately.
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      <div
        className={`relative overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-gradient-to-br from-white via-cyan-50/50 to-indigo-50/40 p-6 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/70 dark:border-slate-200/80 dark:from-[#f8fafc] dark:via-[#f6fbff] dark:to-[#f0f9ff] dark:shadow-[0_20px_50px_-20px_rgba(15,23,42,0.12)] dark:ring-slate-200/60 md:p-8 ${
          success ? 'pointer-events-none opacity-[0.22] blur-[0.45px]' : ''
        }`}
        aria-hidden={success ? true : undefined}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden>
          <div className="absolute -left-24 top-8 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl dark:bg-cyan-200/40" />
          <div className="absolute -bottom-28 right-8 h-60 w-[18rem] rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-200/35" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_65%_-5%,rgba(34,211,238,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_90%_50%_at_55%_-8%,rgba(125,211,252,0.15),transparent_55%)]" />
        </div>

      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-gradient-to-r from-cyan-50 to-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-900 shadow-sm dark:border-cyan-300/50 dark:from-cyan-100/80 dark:to-sky-100/70 dark:text-cyan-950">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            PDF → MCQs in one lane
          </span>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-900 md:text-2xl">
            Bring a syllabus PDF or past paper
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-600">
            We upload to your vault privately, OCR & chunk the PDF, then auto-build practice
            questions — max <strong className="text-cyan-700 dark:text-cyan-700">10 MB</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/95 bg-white px-3 py-2 text-xs shadow-sm backdrop-blur-sm dark:border-slate-300/90 dark:bg-white/90">
          <PencilLine className="h-4 w-4 text-cyan-600" aria-hidden />
          <button
            type="button"
            role="switch"
            aria-checked={privacyPrivate}
            onClick={() => setPrivacyPrivate((p) => !p)}
            className={`relative h-8 w-[3.25rem] shrink-0 rounded-full transition ${
              privacyPrivate ? 'bg-slate-300 dark:bg-slate-700' : 'bg-cyan-600'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${
                privacyPrivate ? 'left-1' : 'left-[calc(100%-1.75rem)]'
              }`}
            />
          </button>
          <span className="max-w-[9rem] font-semibold uppercase tracking-[0.05em] text-slate-600 dark:text-slate-700">
            {privacyPrivate ? 'Private import' : 'Share when ready'}
          </span>
        </div>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop requires event handlers on a container div; clickable action is on the inner <button> */}
      <div
        className={`relative z-[1] mt-6 rounded-2xl border-2 border-dashed transition ${
          dragOver
            ? 'border-cyan-500 bg-cyan-100/90 shadow-lg shadow-cyan-500/15 dark:border-cyan-400 dark:bg-cyan-50/95'
            : file
              ? 'border-emerald-500/80 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md shadow-emerald-500/10 dark:border-emerald-400/70 dark:from-emerald-50 dark:to-teal-50'
              : 'border-slate-300/95 bg-white/90 shadow-inner shadow-slate-100/80 dark:border-slate-300 dark:bg-[#fdfefe]'
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
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-white to-slate-50/30 p-10 transition hover:from-cyan-50 hover:to-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:from-white dark:to-slate-50/50 dark:hover:from-sky-50"
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
              <p className="mt-3 font-semibold text-slate-800 dark:text-slate-800">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-semibold text-slate-700 dark:text-slate-800">
                Drop your PDF here or tap to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Locked to vault behavior by default—you stay in control.
              </p>
            </>
          )}
        </button>
      </div>

      <div className="relative z-[1] mt-6 overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white p-[1px] shadow-sm ring-1 ring-slate-200/60 dark:border-slate-300/85 dark:bg-slate-100 dark:shadow-slate-200/40 dark:ring-slate-300/70">
        <div className="rounded-[calc(1.35rem-1px)] bg-white p-5 dark:bg-[#fdfdfd]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/85 pb-3 dark:border-slate-200">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-900">
              Paper catalog
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-600">
              Required metadata — mirrors the library so classmates see who curated
              the paper, field, course, and whether it&apos;s exit, mock, final, or mid.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-900 dark:bg-cyan-100 dark:text-cyan-950">
            All required
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-700">
            Display title · optional rename
            <input
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              placeholder="Defaults to PDF filename without .pdf"
              className="mt-1 input-field w-full text-sm"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-700">
              Academic field
              <select
                value={importTrack}
                onChange={(e) => {
                  setImportTrack(e.target.value);
                  setImportDept('');
                  setImportDeptOther('');
                }}
                className="mt-1 input-field h-10 w-full text-sm"
              >
                {ACADEMIC_TRACKS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-700">
              Paper type
              <select
                value={importPaperType}
                onChange={(e) => setImportPaperType(e.target.value)}
                className="mt-1 input-field h-10 w-full text-sm"
              >
                {EXAM_PAPER_TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-700">
            Department / discipline
            <select
              value={importDept}
              onChange={(e) => {
                setImportDept(e.target.value);
                if (e.target.value !== 'Other') setImportDeptOther('');
              }}
              className="mt-1 input-field h-10 w-full text-sm"
            >
              <option value="">Select…</option>
              {(DEPARTMENTS_BY_TRACK[importTrack] ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {importDept === 'Other' ? (
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-700">
              Describe your department
              <input
                value={importDeptOther}
                onChange={(e) => setImportDeptOther(e.target.value)}
                placeholder="e.g. Architecture, Veterinary medicine…"
                className="mt-1 input-field w-full text-sm"
              />
            </label>
          ) : null}

          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-700">
            Course · subject line
            <input
              value={importCourse}
              onChange={(e) => setImportCourse(e.target.value)}
              placeholder="e.g. Data Structures & Algorithms"
              className="mt-1 input-field w-full text-sm"
              list="pdf-import-course-list"
            />
            <datalist id="pdf-import-course-list">
              {COURSE_SUBJECT_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <span className="w-full text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-800">
              Quick picks
            </span>
            {COURSE_SUBJECT_SUGGESTIONS.slice(0, 6).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setImportCourse(c)}
                className="rounded-full border border-cyan-200 bg-gradient-to-r from-white to-cyan-50 px-3 py-1.5 text-[10px] font-semibold text-cyan-950 shadow-sm transition hover:border-cyan-400 hover:to-cyan-100 dark:border-cyan-200 dark:from-white dark:to-cyan-50 dark:text-slate-900"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>

      {error && (
        <p className="relative z-[1] mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-900 shadow-sm dark:border-rose-200 dark:bg-rose-50 dark:text-rose-900">
          {error}
        </p>
      )}

      {uploading && (
        <div className="relative z-[1] mt-4">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-800 dark:text-cyan-900">
            <span>Upload &amp; extract…</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative z-[1] mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={upload}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 px-7 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/25 transition hover:shadow-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-cyan-500/15"
          title={
            file
              ? 'Upload requires catalog fields above'
              : 'Pick a PDF first'
          }
        >
          {uploading ? 'Working…' : (
            <>
              <Sparkles className="h-4 w-4 opacity-95" aria-hidden />
              Upload &amp; extract
            </>
          )}
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
    </>
  );
}

export default Exams;
