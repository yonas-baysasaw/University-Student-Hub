import {
  ArrowDown,
  ArrowUp,
  BookMarked,
  Check,
  ChevronDown,
  FileStack,
  GraduationCap,
  GripHorizontal,
  Library,
  PencilLine,
  Plus,
  Shuffle,
  Sparkles,
  Upload,
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
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import { useAuth } from '../contexts/AuthContext';
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

function Exams() {
  const [tab, setTab] = useState('vault');

  return (
    <div className="liqu-ai-ambient page-surface px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto max-w-6xl">
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
          <VaultWorkspace />
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

function VaultWorkspace() {
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
  const [publishOrderIds, setPublishOrderIds] = useState([]);
  const [publishing, setPublishing] = useState(false);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizQs, setQuizQs] = useState([]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search your vault…"
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
        <div className="flex items-center justify-center py-20 text-slate-500">
          <span className="loading loading-spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="panel-card rounded-3xl px-8 py-12 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-cyan-600/70" />
          <p className="mt-3 font-display text-lg text-slate-900 dark:text-slate-50">
            Your vault is empty
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Compose your first MCQ—nothing leaves your account until you
            publish.
          </p>
          <button
            type="button"
            className="btn-primary mt-6 px-6 py-2 text-sm"
            onClick={openComposerNew}
          >
            Compose first MCQ
          </button>
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
                      chk ? 'ring-2 ring-cyan-500/35 dark:ring-cyan-400/30' : ''
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
                        <p className="mt-1 text-xs text-slate-500">
                          {[mc.subject, mc.topic].filter(Boolean).join(' · ')} ·{' '}
                          <span className="font-semibold">
                            Difficulty {mc.difficulty ?? '?'}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary py-1.5 px-3 text-xs"
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
          <p className="text-center text-xs text-slate-500">
            Showing {rows.length} of {total}
          </p>
        </>
      )}

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search papers…"
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
          <p className="font-display text-lg text-slate-700">No papers yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Import a PDF or publish from your vault.
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

          <p className="mt-2 text-xs text-slate-500">
            {exam.totalQuestions} question{exam.totalQuestions !== 1 ? 's' : ''}{' '}
            · <span>{exam.uploadedBy?.username ?? 'Unknown'}</span>
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

function PdfImportTab({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [privacyPrivate, setPrivacyPrivate] = useState(true);
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
      form.append('visibility', privacyPrivate ? 'private' : 'public');

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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="font-display text-xl text-slate-900 dark:text-white">
          Upload queued
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <strong>{success.filename}</strong> is processing privately until you
          open visibility on the Question bank tab.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to={`/exams/${success.id}`}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Open paper
          </Link>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              onUploaded?.();
            }}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            Browse bank
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-slate-900 dark:text-white">
            Bring a syllabus PDF or past paper
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Max 10 MB · OCR-friendly · AI chunked extraction stays reliable in
            the background.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/65">
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
          <span className="max-w-[9rem] font-semibold uppercase tracking-[0.05em] text-slate-600 dark:text-slate-400">
            {privacyPrivate ? 'Private import' : 'Share when ready'}
          </span>
        </div>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop requires event handlers on a container div; clickable action is on the inner <button> */}
      <div
        className={`mt-6 rounded-2xl border-2 border-dashed transition ${
          dragOver
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/35'
            : file
              ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/25'
              : 'border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/50'
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
          className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl p-10 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-slate-800/85"
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
              <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">
                {file.name}
              </p>
              <p className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                Drop your PDF here or tap to browse
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Locked to vault behavior by default—you stay in control.
              </p>
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900/55 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}

      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-slate-800 transition-all duration-300 dark:from-cyan-500 dark:to-cyan-800"
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
          {uploading ? 'Working…' : 'Upload & extract'}
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
