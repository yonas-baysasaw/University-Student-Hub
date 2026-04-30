import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  GraduationCap,
  Library,
  Link2,
  Loader2,
  Menu,
  Mountain,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ClassroomHero from '../components/ClassroomHero';
import ClassroomParticipantsDrawer from '../components/ClassroomParticipantsDrawer';
import ClassroomTabs from '../components/ClassroomTabs';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import { useAuth } from '../contexts/AuthContext';
import {
  canManageClassroom,
  fetchClassroomMeta,
  isClassroomCreator,
} from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

const RESOURCE_CATEGORY_OPTIONS = [
  { id: 'syllabus', label: 'Syllabus', hint: 'Policies & calendar' },
  { id: 'reading', label: 'Reading', hint: 'Articles & chapters' },
  { id: 'lecture', label: 'Lecture', hint: 'Slides & notes' },
  { id: 'lab', label: 'Lab', hint: 'Hands-on material' },
  { id: 'reference', label: 'Reference', hint: 'Cheatsheets & datasets' },
  { id: 'other', label: 'Other', hint: 'Anything else' },
];

function categoryLabel(id) {
  return RESOURCE_CATEGORY_OPTIONS.find((c) => c.id === id)?.label ?? 'Other';
}

function guessKindFromFileName(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'image';
  if (/\.(zip|rar|7z)$/.test(n)) return 'archive';
  if (/\.(docx?|pptx?|xlsx?)$/.test(n)) return 'office';
  return 'file';
}

function formatDueSummary(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = d.getTime() - now;
  const days = Math.round(diff / 86400000);
  if (diff < 0) return 'Past due';
  if (diff < 3600000) return 'Due within an hour';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

const SUMMIT_MAX_BYTES = 22 * 1024 * 1024;

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pull likely checklist lines from free-form instructions (bullet / numbered). */
function parseSummitChecklist(instructions) {
  const lines = String(instructions || '').split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    let item = '';
    if (/^[-*•]\s+/.test(t)) item = t.replace(/^[-*•]\s+/, '').trim();
    else if (/^\d+[.)]\s+/.test(t))
      item = t.replace(/^\d+[.)]\s+/, '').trim();
    if (item && item.length <= 220) {
      out.push(item);
      if (out.length >= 8) break;
    }
  }
  return out;
}

function summitTurnInMeta(assignment, now = new Date()) {
  const due = assignment?.dueAt ? new Date(assignment.dueAt) : null;
  const lateEnd = assignment?.allowLateUntil
    ? new Date(assignment.allowLateUntil)
    : null;
  if (!due || Number.isNaN(due.getTime())) {
    return {
      tone: 'muted',
      headline: 'Deadline',
      detail: 'Confirm timing with your instructor.',
      closed: Boolean(assignment?.isSubmissionClosed),
    };
  }
  const t = now.getTime();
  const dueT = due.getTime();
  const winEnd = lateEnd && !Number.isNaN(lateEnd.getTime())
    ? lateEnd.getTime()
    : dueT;
  const closed = Boolean(assignment?.isSubmissionClosed) || t > winEnd;
  const msToDue = dueT - t;
  const msToEnd = winEnd - t;
  let tone = 'ok';
  if (closed) tone = 'closed';
  else if (msToDue < 0 && msToEnd > 0) tone = 'late';
  else if (msToDue >= 0 && msToDue <= 36 * 3600000) tone = 'soon';

  let headline = formatDueSummary(assignment.dueAt);
  let detail = due.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (lateEnd && !Number.isNaN(lateEnd.getTime()) && lateEnd.getTime() > dueT) {
    detail = `${detail} · Late accepted until ${lateEnd.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }
  if (closed) {
    headline = 'Submission window closed';
    detail = 'Ask your instructor if you still need access.';
  }

  return { tone, headline, detail, closed, msToDue, msToEnd };
}

function ClassroomResourcesContent({ chatId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [chatName, setChatName] = useState('Class Resources');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [resourceCategory, setResourceCategory] = useState('other');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOverMaterials, setDragOverMaterials] = useState(false);
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState('all');

  const [resources, setResources] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');

  const [workspaceTab, setWorkspaceTab] = useState('materials');

  const [assignments, setAssignments] = useState([]);
  const [assignmentsMeta, setAssignmentsMeta] = useState({
    canManage: false,
    canSubmitAssignments: false,
  });
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentFormBusy, setAssignmentFormBusy] = useState(false);

  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentInstructions, setNewAssignmentInstructions] =
    useState('');
  const [newAssignmentDue, setNewAssignmentDue] = useState('');
  const [newAssignmentLate, setNewAssignmentLate] = useState('');
  const [newAssignmentPoints, setNewAssignmentPoints] = useState('100');
  const [newAssignmentPublish, setNewAssignmentPublish] = useState(true);
  const [newAssignmentFile, setNewAssignmentFile] = useState(null);

  const [submissionPanel, setSubmissionPanel] = useState(null);
  const [submitModal, setSubmitModal] = useState(null);
  const [submitFile, setSubmitFile] = useState(null);
  const [submitNote, setSubmitNote] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitAck, setSubmitAck] = useState(false);
  const [submitSummitPreview, setSubmitSummitPreview] = useState(false);
  const [summitDropHover, setSummitDropHover] = useState(false);

  const [gradeModal, setGradeModal] = useState(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeBusy, setGradeBusy] = useState(false);

  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [members, setMembers] = useState([]);
  const [creator, setCreator] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  const [liquDrawerOpen, setLiquDrawerOpen] = useState(false);
  const [liquFocusMaterialId, setLiquFocusMaterialId] = useState(null);
  const [assignmentPaste, setAssignmentPaste] = useState('');

  const liquContextBlurb = useMemo(() => {
    const parts = [];
    const focus = resources.find((r) => r.id === liquFocusMaterialId);
    if (focus) {
      const kind = focus.fileName
        ? guessKindFromFileName(focus.fileName)
        : focus.link
          ? 'link'
          : 'material';
      const nameBit = focus.fileName || focus.title || 'Resource';
      parts.push(
        `**Highlighted material:** ${nameBit} (${kind})`,
      );
      if (focus.description?.trim()) {
        parts.push(
          `Short description: ${focus.description.trim().slice(0, 500)}`,
        );
      }
    }
    const paste = assignmentPaste.trim();
    if (paste) {
      parts.push(
        `**Assignment / instructions (instructor paste):**\n${paste.slice(0, 4000)}`,
      );
    }
    return parts.join('\n\n');
  }, [resources, liquFocusMaterialId, assignmentPaste]);

  const viewerIsCreator = isClassroomCreator(user, { creator });
  const viewerCanManageClassroom = canManageClassroom(user, {
    creator,
    admins,
  });

  const resourceNamesContext = useMemo(() => {
    const names = resources
      .slice(0, 6)
      .map((r) => r.title || r.name)
      .filter(Boolean);
    if (!names.length) return '';
    return `Materials in this classroom include: ${names.join(', ')}.`;
  }, [resources]);

  const liquQuickPrompts = useMemo(
    () => [
      'Summarize for students',
      'Draft a class announcement',
      'Generate study questions',
    ],
    [],
  );

  const onLiquQuickPrompt = useCallback(
    (label) => {
      const mat = resources.find((r) => r.id === liquFocusMaterialId);
      const matLine = mat
        ? `Highlighted material: ${mat.fileName || mat.title} (${mat.fileName ? guessKindFromFileName(mat.fileName) : mat.link ? 'link' : 'material'}).\n`
        : '';
      const pasteBlock = assignmentPaste.trim()
        ? `Instructor pasted context:\n${assignmentPaste.trim().slice(0, 4000)}\n\n`
        : '';
      const ctx = `Class: ${chatName}. ${resourceNamesContext}\n${matLine}${pasteBlock}\n`;
      const map = {
        'Summarize for students':
          ctx +
          'Write a short, friendly summary of the key ideas students should take away from the current materials. Use clear bullet points.',
        'Draft a class announcement':
          ctx +
          'Draft a concise LMS-style announcement (2–4 sentences) highlighting what students should focus on this week.',
        'Generate study questions':
          ctx +
          'Suggest 8 thoughtful study or exam-style questions based on the materials described. Mix comprehension and application.',
      };
      const prefill = map[label] || `${ctx}${label}`;
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
        },
        { state: { prefill }, replace: true },
      );
    },
    [
      chatName,
      resourceNamesContext,
      resources,
      liquFocusMaterialId,
      assignmentPaste,
      navigate,
      location.pathname,
      location.search,
    ],
  );

  useEffect(() => {
    if (!liquFocusMaterialId) return;
    if (!resources.some((r) => r.id === liquFocusMaterialId)) {
      setLiquFocusMaterialId(null);
    }
  }, [resources, liquFocusMaterialId]);

  const closeSummitModal = useCallback(() => {
    setSubmitModal(null);
    setSubmitFile(null);
    setSubmitNote('');
    setSubmitAck(false);
    setSubmitSummitPreview(false);
    setSummitDropHover(false);
  }, []);

  const summitChecklistItems = useMemo(
    () => parseSummitChecklist(submitModal?.instructions),
    [submitModal?.id, submitModal?.instructions],
  );

  const summitMeta = useMemo(
    () => (submitModal ? summitTurnInMeta(submitModal) : null),
    [submitModal],
  );

  useEffect(() => {
    if (!submitModal) return undefined;
    const onDocKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeSummitModal();
    };
    document.addEventListener('keydown', onDocKey);
    return () => document.removeEventListener('keydown', onDocKey);
  }, [submitModal, closeSummitModal]);

  const refreshClassroomMetaAfterMutation = useCallback(async () => {
    if (!chatId) return;
    try {
      const chat = await fetchClassroomMeta(chatId);
      setChatName(chat?.name ?? 'Class Resources');
      setMembers(chat?.members ?? []);
      setCreator(chat?.creator ?? null);
      setAdmins(chat?.admins ?? []);
      setInvitationCode(
        typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
      );
      setMembersError('');
    } catch (_) {
      /* ignore */
    }
  }, [chatId]);

  const loadMaterials = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/resources`,
        { credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Failed to load materials');
      setResources(Array.isArray(data.resources) ? data.resources : []);
      setCanManage(Boolean(data.canManage));
    } catch (e) {
      setLoadError(e?.message || 'Failed to load materials');
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const loadAssignmentsList = useCallback(async () => {
    if (!chatId) return;
    setAssignmentsLoading(true);
    setLoadError('');
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/assignments`,
        { credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Failed to load assignments');
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setAssignmentsMeta({
        canManage: Boolean(data.canManage),
        canSubmitAssignments: Boolean(data.canSubmitAssignments),
      });
    } catch (e) {
      setLoadError(e?.message || 'Failed to load assignments');
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (workspaceTab === 'assignments') loadAssignmentsList();
  }, [workspaceTab, loadAssignmentsList]);

  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    const loadMeta = async () => {
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chat?.name ?? 'Class Resources');
        setMembers(chat?.members ?? []);
        setCreator(chat?.creator ?? null);
        setAdmins(chat?.admins ?? []);
        setInvitationCode(
          typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
        );
        setMembersError('');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setChatName('Class Resources');
          setMembersError(error?.message ?? 'Could not load roster');
        }
      }
    };
    loadMeta();
    return () => controller.abort();
  }, [chatId]);

  const unpublishedDraftCount = useMemo(
    () => assignments.filter((a) => !a.published).length,
    [assignments],
  );

  const filteredResources = useMemo(() => {
    let rows = resources;
    const q = query.trim().toLowerCase();
    if (q.length) {
      rows = rows.filter(
        (r) =>
          String(r.title || '')
            .toLowerCase()
            .includes(q) ||
          String(r.description || '')
            .toLowerCase()
            .includes(q),
      );
    }
    if (materialCategoryFilter !== 'all') {
      rows = rows.filter((r) => (r.category || 'other') === materialCategoryFilter);
    }
    return rows;
  }, [resources, query, materialCategoryFilter]);

  const submitResource = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const title = resourceTitle.trim();
    const link = resourceLink.trim();
    const description = resourceDescription.trim();
    if (!title || (!link && !selectedFile)) return;

    setSaving(true);
    setLoadError('');
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('link', link);
      fd.append('category', resourceCategory);
      fd.append('description', description);
      if (selectedFile) fd.append('file', selectedFile);

      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/resources`,
        {
          method: 'POST',
          credentials: 'include',
          body: fd,
        },
      );
      const data = await readJsonOrThrow(res, 'Failed to add material');
      if (data.resource) setResources((prev) => [data.resource, ...prev]);
      else await loadMaterials();
      setResourceTitle('');
      setResourceDescription('');
      setResourceLink('');
      setResourceCategory('other');
      setSelectedFile(null);
    } catch (e) {
      setLoadError(e?.message || 'Could not add material');
    } finally {
      setSaving(false);
    }
  };

  const deleteMaterial = async (id) => {
    if (!canManage) return;
    if (!window.confirm('Remove this material from the classroom?')) return;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/resources/${encodeURIComponent(id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Failed to delete');
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setLoadError(e?.message || 'Delete failed');
    }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    if (!assignmentsMeta.canManage) return;
    const title = newAssignmentTitle.trim();
    const instructions = newAssignmentInstructions.trim();
    if (!title || !instructions || !newAssignmentDue) return;

    setAssignmentFormBusy(true);
    setLoadError('');
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('instructions', instructions);
      fd.append('dueAt', new Date(newAssignmentDue).toISOString());
      if (newAssignmentLate.trim()) {
        fd.append(
          'allowLateUntil',
          new Date(newAssignmentLate).toISOString(),
        );
      }
      fd.append('points', String(Number(newAssignmentPoints) || 100));
      fd.append('published', newAssignmentPublish ? 'true' : 'false');
      if (newAssignmentFile) fd.append('file', newAssignmentFile);

      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/assignments`,
        { method: 'POST', credentials: 'include', body: fd },
      );
      await readJsonOrThrow(res, 'Could not create assignment');
      setNewAssignmentTitle('');
      setNewAssignmentInstructions('');
      setNewAssignmentDue('');
      setNewAssignmentLate('');
      setNewAssignmentPoints('100');
      setNewAssignmentPublish(true);
      setNewAssignmentFile(null);
      await loadAssignmentsList();
    } catch (err) {
      setLoadError(err?.message || 'Assignment failed');
    } finally {
      setAssignmentFormBusy(false);
    }
  };

  const deleteAssignment = async (assignmentId) => {
    if (!assignmentsMeta.canManage) return;
    if (!window.confirm('Delete this assignment and all submissions?')) return;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/assignments/${encodeURIComponent(assignmentId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Delete failed');
      setSubmissionPanel((p) =>
        p?.assignmentId === assignmentId ? null : p,
      );
      await loadAssignmentsList();
    } catch (err) {
      setLoadError(err?.message || 'Delete failed');
    }
  };

  const openSubmissionPanel = async (assignmentId) => {
    if (!assignmentsMeta.canManage) return;
    setSubmissionPanel({ assignmentId, loading: true, rows: [], meta: null });
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
        { credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Could not load submissions');
      setSubmissionPanel({
        assignmentId,
        loading: false,
        rows: Array.isArray(data.submissions) ? data.submissions : [],
        meta: data.assignment || null,
      });
    } catch (err) {
      setLoadError(err?.message || 'Could not load submissions');
      setSubmissionPanel(null);
    }
  };

  const submitAssignment = async () => {
    if (submitSummitPreview || !submitModal || !submitFile || !submitAck)
      return;
    if (submitFile.size > SUMMIT_MAX_BYTES) {
      toast.error(
        `Keep files under ${formatFileSize(SUMMIT_MAX_BYTES)} so uploads succeed.`,
      );
      return;
    }
    setSubmitBusy(true);
    setLoadError('');
    try {
      const fd = new FormData();
      fd.append('note', submitNote.trim());
      fd.append('file', submitFile);
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/assignments/${encodeURIComponent(submitModal.id)}/submissions`,
        { method: 'POST', credentials: 'include', body: fd },
      );
      await readJsonOrThrow(res, 'Upload failed');
      closeSummitModal();
      toast.success("Submission received — you're all set.");
      await loadAssignmentsList();
    } catch (err) {
      setLoadError(err?.message || 'Submit failed');
    } finally {
      setSubmitBusy(false);
    }
  };

  const openSummitStudent = (assignment) => {
    setSubmitSummitPreview(false);
    setSubmitFile(null);
    setSubmitNote('');
    setSubmitAck(false);
    setSummitDropHover(false);
    setSubmitModal(assignment);
  };

  const openSummitInstructorPreview = (assignment) => {
    setSubmitSummitPreview(true);
    setSubmitFile(null);
    setSubmitNote('');
    setSubmitAck(false);
    setSummitDropHover(false);
    setSubmitModal(assignment);
  };

  const saveGrade = async () => {
    if (!gradeModal?.assignmentId) return;
    setGradeBusy(true);
    setLoadError('');
    const assignmentIdForRefresh = gradeModal.assignmentId;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/assignments/${encodeURIComponent(gradeModal.assignmentId)}/submissions/${encodeURIComponent(gradeModal.submission.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: gradeScore === '' ? null : Number(gradeScore),
            feedback: gradeFeedback.trim(),
            status: 'graded',
          }),
        },
      );
      await readJsonOrThrow(res, 'Could not save grade');
      setGradeModal(null);
      setGradeScore('');
      setGradeFeedback('');
      if (submissionPanel?.assignmentId === assignmentIdForRefresh) {
        await openSubmissionPanel(assignmentIdForRefresh);
      }
      await loadAssignmentsList();
    } catch (err) {
      setLoadError(err?.message || 'Grading failed');
    } finally {
      setGradeBusy(false);
    }
  };

  const onMaterialsDrop = (e) => {
    e.preventDefault();
    setDragOverMaterials(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && canManage) setSelectedFile(f);
  };

  const headerActions = (
    <Link
      to="/classroom"
      className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide"
    >
      All classrooms
    </Link>
  );

  const eyebrowMeta = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <FolderOpen className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
      Materials & assignments
    </span>
  );

  const tabsTrailingParticipants = (
    <button
      type="button"
      onClick={() => setShowMembersDrawer(true)}
      className="inline-flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/95 bg-white text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-cyan-400 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-white hover:text-cyan-900 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/[0.06] dark:hover:border-cyan-500/70 dark:hover:from-slate-800 dark:hover:to-cyan-950/40 dark:hover:text-cyan-50"
      aria-label="Participants & classroom actions"
      title="Participants"
    >
      <Menu className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
    </button>
  );

  const tabBtn =
    'rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition';

  return (
    <div className="classroom-ambient relative page-surface flex justify-center px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(260px,34vh)] workspace-hero-mesh opacity-85 dark:opacity-55" />

      <div className="relative z-[2] w-full max-w-6xl">
        <div className="panel-card rounded-3xl p-4 sm:p-5 md:p-7">
          <ClassroomHero
            title={chatName}
            eyebrow="Workspace"
            meta={eyebrowMeta}
            actions={headerActions}
          />

          <ClassroomTabs trailing={tabsTrailingParticipants} />

          {loadError ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
              {loadError}
            </p>
          ) : null}

          <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-700 dark:bg-slate-900/40">
            <button
              type="button"
              className={`${tabBtn} ${
                workspaceTab === 'materials'
                  ? 'bg-gradient-to-r from-slate-900 to-cyan-900 text-white shadow-md ring-1 ring-white/10 dark:from-slate-800 dark:to-cyan-950'
                  : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              onClick={() => setWorkspaceTab('materials')}
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" aria-hidden />
                Materials
              </span>
            </button>
            <button
              type="button"
              className={`${tabBtn} ${
                workspaceTab === 'assignments'
                  ? 'bg-gradient-to-r from-slate-900 to-cyan-900 text-white shadow-md ring-1 ring-white/10 dark:from-slate-800 dark:to-cyan-950'
                  : 'text-slate-600 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              onClick={() => setWorkspaceTab('assignments')}
            >
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4" aria-hidden />
                Assignments
              </span>
            </button>
            {viewerCanManageClassroom ? (
              <button
                type="button"
                className={`${tabBtn} ml-auto inline-flex items-center gap-2 border border-cyan-500/35 bg-gradient-to-r from-cyan-600 to-indigo-800 text-white shadow-lg shadow-cyan-900/20 hover:brightness-110 dark:from-cyan-700 dark:to-indigo-950`}
                onClick={() => setLiquDrawerOpen(true)}
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                Liqu AI
              </button>
            ) : null}
          </div>

          {workspaceTab === 'materials' ? (
            <>
              {canManage ? (
                <section className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-indigo-50/35 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                        Share course materials
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                        Drop files, attach links, and tag by academic category so students scan faster.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={submitResource} className="mt-6 space-y-4">
                    <div
                      className={`relative rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                        dragOverMaterials
                          ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/30'
                          : 'border-slate-300 bg-white/70 dark:border-slate-600 dark:bg-slate-950/40'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverMaterials(true);
                      }}
                      onDragLeave={() => setDragOverMaterials(false)}
                      onDrop={onMaterialsDrop}
                    >
                      <Upload className="mx-auto h-10 w-10 text-cyan-600 dark:text-cyan-400" aria-hidden />
                      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Drag & drop a file, or browse
                      </p>
                      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-md hover:bg-slate-800 dark:bg-cyan-800 dark:hover:bg-cyan-700">
                        Choose file
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(ev) =>
                            setSelectedFile(ev.target.files?.[0] ?? null)
                          }
                          disabled={saving}
                        />
                      </label>
                      {selectedFile ? (
                        <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                          Selected: {selectedFile.name}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Title"
                        value={resourceTitle}
                        onChange={(e) => setResourceTitle(e.target.value)}
                        className="input-field text-sm md:col-span-2"
                        disabled={saving}
                      />
                      <textarea
                        placeholder="Short description (optional—not shown as body text)"
                        value={resourceDescription}
                        onChange={(e) => setResourceDescription(e.target.value)}
                        rows={2}
                        className="rounded-xl border border-slate-200 bg-white/95 p-3 text-sm dark:border-slate-600 dark:bg-slate-950/60 md:col-span-2"
                        disabled={saving}
                      />
                      <input
                        type="url"
                        placeholder="https://… (optional if uploading)"
                        value={resourceLink}
                        onChange={(e) => setResourceLink(e.target.value)}
                        className="input-field text-sm md:col-span-2"
                        disabled={saving}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="w-full text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Category
                      </span>
                      {RESOURCE_CATEGORY_OPTIONS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={saving}
                          onClick={() => setResourceCategory(c.id)}
                          title={c.hint}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-1 transition ${
                            resourceCategory === c.id
                              ? 'bg-cyan-600 text-white ring-cyan-500 dark:bg-cyan-700'
                              : 'bg-white text-slate-600 ring-slate-200 hover:ring-cyan-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="btn-primary px-8 py-3 text-sm disabled:opacity-50"
                    >
                      {saving ? 'Publishing…' : 'Publish material'}
                    </button>
                  </form>
                </section>
              ) : (
                <section
                  className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-cyan-50/25 to-indigo-50/40 p-5 shadow-sm ring-1 ring-slate-900/[0.03] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/90 dark:ring-white/[0.04] md:p-6"
                  aria-labelledby="course-library-heading"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 text-cyan-700 shadow-inner ring-1 ring-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/20">
                      <Library className="h-7 w-7" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        id="course-library-heading"
                        className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white"
                      >
                        Course library
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        Readings, slides, and files your instructors curate—updated here throughout the term.
                        Use search and category chips below to zero in fast.
                      </p>
                      {!loading ? (
                        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {resources.length}{' '}
                          {resources.length === 1 ? 'item' : 'items'} in this classroom
                        </p>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          Loading catalog…
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search materials…"
                    className="input-field h-11 border-slate-200/90 bg-white/90 pl-9 text-sm dark:border-slate-600 dark:bg-slate-950/70"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMaterialCategoryFilter('all')}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-1 transition ${
                      materialCategoryFilter === 'all'
                        ? 'bg-slate-900 text-white ring-slate-900 dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                    }`}
                  >
                    All
                  </button>
                  {RESOURCE_CATEGORY_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setMaterialCategoryFilter(c.id)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-1 transition ${
                        materialCategoryFilter === c.id
                          ? 'bg-cyan-600 text-white ring-cyan-500'
                          : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                  <div className="col-span-full flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-12 dark:border-slate-700 dark:bg-slate-900/40">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-600" aria-hidden />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Loading materials…
                    </p>
                  </div>
                ) : filteredResources.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-300/90 bg-white/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/50">
                    <FolderOpen className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="mx-auto mt-3 max-w-md text-sm font-medium text-slate-600 dark:text-slate-400">
                      {resources.length === 0
                        ? 'No materials yet—publish syllabus PDFs, readings, or starter datasets.'
                        : 'Nothing matches these filters.'}
                    </p>
                  </div>
                ) : (
                  filteredResources.map((item) => {
                    const kind = item.fileName
                      ? guessKindFromFileName(item.fileName)
                      : 'link';
                    return (
                      <article
                        key={item.id}
                        className={`fade-in-up flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-cyan-200/90 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-900 ${
                          viewerCanManageClassroom &&
                          liquFocusMaterialId === item.id
                            ? 'ring-2 ring-cyan-500/40'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/18 to-indigo-500/12 text-cyan-700 dark:text-cyan-300">
                            {kind === 'pdf' ? (
                              <FileText className="h-6 w-6" aria-hidden />
                            ) : kind === 'image' ? (
                              <BookOpen className="h-6 w-6" aria-hidden />
                            ) : (
                              <FolderOpen className="h-6 w-6" aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">
                              {categoryLabel(item.category)}
                            </span>
                            <h4 className="mt-2 font-display text-base font-bold leading-snug text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/80">
                          {viewerCanManageClassroom ? (
                            <button
                              type="button"
                              title={
                                liquFocusMaterialId === item.id
                                  ? 'Remove Liqu AI highlight'
                                  : 'Use this file in Liqu AI context'
                              }
                              onClick={() =>
                                setLiquFocusMaterialId((cur) =>
                                  cur === item.id ? null : item.id,
                                )
                              }
                              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide ring-1 transition min-[380px]:flex-none ${
                                liquFocusMaterialId === item.id
                                  ? 'bg-cyan-600 text-white ring-cyan-500'
                                  : 'bg-white text-cyan-800 ring-cyan-200/80 hover:bg-cyan-50 dark:bg-slate-800 dark:text-cyan-200 dark:ring-cyan-900'
                              }`}
                            >
                              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {liquFocusMaterialId === item.id
                                ? 'Liqu focus'
                                : 'For Liqu'}
                            </button>
                          ) : null}
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-900 ring-1 ring-cyan-200/80 transition hover:bg-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-100 dark:ring-cyan-900 min-[380px]:flex-none"
                            >
                              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Link
                            </a>
                          ) : null}
                          {item.fileUrl ? (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200/80 transition hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 min-[380px]:flex-none"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              File
                            </a>
                          ) : null}
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => deleteMaterial(item.id)}
                              className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {item.author} ·{' '}
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })}
                        </p>
                      </article>
                    );
                  })
                )}
              </section>
            </>
          ) : (
            <>
              {assignmentsMeta.canManage ? (
                <section className="rounded-2xl border border-violet-200/90 bg-gradient-to-br from-white via-violet-50/40 to-indigo-50/35 p-5 shadow-sm dark:border-violet-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/40 md:p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <GraduationCap className="h-8 w-8 text-violet-600 dark:text-violet-400" aria-hidden />
                    <div>
                      <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                        Create assignment
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Publish expectations, attach a brief, and collect uploads automatically.
                      </p>
                    </div>
                  </div>
                  <form onSubmit={createAssignment} className="mt-6 grid gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Assignment title"
                      value={newAssignmentTitle}
                      onChange={(e) => setNewAssignmentTitle(e.target.value)}
                      className="input-field text-sm md:col-span-2"
                      disabled={assignmentFormBusy}
                    />
                    <textarea
                      placeholder="Instructions for students (what to submit, naming, format)"
                      value={newAssignmentInstructions}
                      onChange={(e) => setNewAssignmentInstructions(e.target.value)}
                      rows={4}
                      className="rounded-xl border border-slate-200 bg-white/95 p-3 text-sm dark:border-slate-600 dark:bg-slate-950/60 md:col-span-2"
                      disabled={assignmentFormBusy}
                    />
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:col-span-2">
                      Due (local time)
                      <input
                        type="datetime-local"
                        value={newAssignmentDue}
                        onChange={(e) => setNewAssignmentDue(e.target.value)}
                        className="input-field mt-1 text-sm"
                        disabled={assignmentFormBusy}
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:col-span-2">
                      Late cutoff (optional)
                      <input
                        type="datetime-local"
                        value={newAssignmentLate}
                        onChange={(e) => setNewAssignmentLate(e.target.value)}
                        className="input-field mt-1 text-sm"
                        disabled={assignmentFormBusy}
                      />
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      placeholder="Points"
                      value={newAssignmentPoints}
                      onChange={(e) => setNewAssignmentPoints(e.target.value)}
                      className="input-field text-sm"
                      disabled={assignmentFormBusy}
                    />
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={newAssignmentPublish}
                        onChange={(e) => setNewAssignmentPublish(e.target.checked)}
                        disabled={assignmentFormBusy}
                      />
                      Published (visible to class)
                    </label>
                    <label className="md:col-span-2 flex cursor-pointer flex-col rounded-xl border border-dashed border-violet-300 bg-white/80 px-4 py-4 text-center dark:border-violet-800 dark:bg-slate-950/40">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Starter file (optional)
                      </span>
                      <span className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                        {newAssignmentFile?.name ?? 'Rubric or template'}
                      </span>
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) =>
                          setNewAssignmentFile(e.target.files?.[0] ?? null)
                        }
                        disabled={assignmentFormBusy}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={
                        assignmentFormBusy ||
                        !newAssignmentTitle.trim() ||
                        !newAssignmentInstructions.trim() ||
                        !newAssignmentDue
                      }
                      className="btn-primary px-8 py-3 text-sm md:col-span-2 md:w-fit md:justify-self-start disabled:opacity-50"
                    >
                      {assignmentFormBusy ? 'Publishing…' : 'Publish assignment'}
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Assignment queue
                  </h3>
                  {assignmentsLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-600" aria-hidden />
                  ) : null}
                </div>

                {assignmentsMeta.canManage && unpublishedDraftCount > 0 ? (
                  <div
                    className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-white px-4 py-3 shadow-sm dark:border-amber-900/50 dark:from-amber-950/35 dark:to-slate-900/60"
                    role="status"
                  >
                    <div className="flex gap-3">
                      <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-bold text-amber-950 dark:text-amber-50">
                          Students only see published assignments
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                          You have {unpublishedDraftCount} draft
                          {unpublishedDraftCount === 1 ? '' : 's'} still marked Draft.
                          Open each card and enable publishing when it should appear for the class.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {assignmentsLoading && assignments.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
                ) : assignments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center dark:border-slate-600 dark:bg-slate-900/50">
                    <ClipboardList className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                    <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
                      {assignmentsMeta.canManage
                        ? 'Create an assignment above, then keep Published (visible to class) checked so students see it here. Drafts stay instructor-only until you publish.'
                        : 'Your instructors have not posted assignments yet.'}
                    </p>
                  </div>
                ) : (
                  assignments.map((a) => {
                    const submitted = a.mySubmission?.status === 'submitted';
                    const graded = a.mySubmission?.status === 'graded';
                    const returned = a.mySubmission?.status === 'returned';
                    return (
                      <article
                        key={a.id}
                        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/75"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {!a.published ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                  Draft
                                </span>
                              ) : null}
                              {a.isSubmissionClosed ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  Closed
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                                  Open
                                </span>
                              )}
                              {a.mySubmission?.isLate ? (
                                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-900 dark:bg-orange-950 dark:text-orange-100">
                                  Late turn-in
                                </span>
                              ) : null}
                            </div>
                            <h4 className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                              {a.title}
                            </h4>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                              {a.instructions}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="h-4 w-4 text-cyan-600" aria-hidden />
                                {new Date(a.dueAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-4 w-4 text-violet-600" aria-hidden />
                                {formatDueSummary(a.dueAt)}
                              </span>
                              <span>{a.points ?? 100} pts</span>
                            </div>
                            {a.starterFileUrl ? (
                              <a
                                href={a.starterFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-900 ring-1 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-900"
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                Instructor file
                              </a>
                            ) : null}
                          </div>
                          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:max-w-[min(100%,20rem)]">
                            {assignmentsMeta.canSubmitAssignments ? (
                              <>
                                {graded || returned ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                                    Graded
                                  </span>
                                ) : submitted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase text-sky-900 dark:bg-sky-950 dark:text-sky-100">
                                    Submitted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    Not submitted
                                  </span>
                                )}
                                {graded || returned ? (
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                                    <p className="font-bold text-emerald-900 dark:text-emerald-100">
                                      Score:{' '}
                                      {a.mySubmission?.score != null
                                        ? `${a.mySubmission.score} / ${a.points ?? 100}`
                                        : '—'}
                                    </p>
                                    {a.mySubmission?.feedback ? (
                                      <p className="mt-1 text-slate-700 dark:text-slate-300">
                                        {a.mySubmission.feedback}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={!a.canSubmit}
                                  onClick={() => openSummitStudent(a)}
                                  title={
                                    a.canSubmit
                                      ? 'Guided turn-in with checklist and file checks'
                                      : 'Submission is not available for this assignment'
                                  }
                                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-violet-600 to-cyan-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-violet-600/25 ring-1 ring-white/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:shadow-violet-900/40"
                                >
                                  <Mountain className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                                  {submitted ? 'Summit · Replace' : 'Summit'}
                                </button>
                              </>
                            ) : null}
                            {assignmentsMeta.canManage ? (
                              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-slate-700 sm:border-t-0 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => openSummitInstructorPreview(a)}
                                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-violet-300/90 bg-gradient-to-br from-violet-50 to-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-violet-950 shadow-sm ring-1 ring-violet-200/80 transition hover:border-violet-400 dark:border-violet-800 dark:from-violet-950/40 dark:to-slate-900 dark:text-violet-100 dark:ring-violet-900 sm:flex-none"
                                  title="See the student Summit turn-in flow"
                                >
                                  <Mountain className="h-4 w-4 shrink-0" aria-hidden />
                                  Summit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (submissionPanel?.assignmentId === a.id) {
                                      setSubmissionPanel(null);
                                    } else {
                                      void openSubmissionPanel(a.id);
                                    }
                                  }}
                                  className="btn-secondary min-h-[44px] flex-1 px-4 py-2 text-xs sm:flex-none"
                                >
                                  {submissionPanel?.assignmentId === a.id
                                    ? 'Hide submissions'
                                    : 'View submissions'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteAssignment(a.id)}
                                  className="min-h-[44px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-bold uppercase text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 sm:flex-none"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {submissionPanel?.assignmentId === a.id ? (
                          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-700">
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                              Submissions ({submissionPanel.rows?.length ?? 0})
                            </h5>
                            {submissionPanel.loading ? (
                              <Loader2 className="mt-4 h-6 w-6 animate-spin text-cyan-600" aria-hidden />
                            ) : (
                              <div className="mt-3 overflow-x-auto">
                                <table className="w-full min-w-[520px] text-left text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
                                      <th className="py-2 pr-3">Student</th>
                                      <th className="py-2 pr-3">Submitted</th>
                                      <th className="py-2 pr-3">Note</th>
                                      <th className="py-2 pr-3">File</th>
                                      <th className="py-2">Grade</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(submissionPanel.rows ?? []).map((row) => (
                                      <tr
                                        key={row.id}
                                        className="border-b border-slate-100 dark:border-slate-800"
                                      >
                                        <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">
                                          {row.studentDisplay}
                                        </td>
                                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                                          {row.submittedAt
                                            ? new Date(row.submittedAt).toLocaleString()
                                            : '—'}
                                          {row.isLate ? (
                                            <span className="ml-1 text-orange-600 dark:text-orange-400">
                                              late
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="max-w-[180px] truncate py-2 pr-3 text-slate-600 dark:text-slate-400">
                                          {row.note || '—'}
                                        </td>
                                        <td className="py-2 pr-3">
                                          {row.fileUrl ? (
                                            <a
                                              href={row.fileUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="font-semibold text-cyan-700 underline dark:text-cyan-400"
                                            >
                                              Open
                                            </a>
                                          ) : (
                                            '—'
                                          )}
                                        </td>
                                        <td className="py-2">
                                          <button
                                            type="button"
                                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold uppercase dark:border-slate-600"
                                            onClick={() => {
                                              setGradeModal({
                                                assignmentId:
                                                  submissionPanel.assignmentId,
                                                submission: row,
                                                points:
                                                  submissionPanel.meta?.points ??
                                                  100,
                                              });
                                              setGradeScore(
                                                row.score != null
                                                  ? String(row.score)
                                                  : '',
                                              );
                                              setGradeFeedback(
                                                row.feedback || '',
                                              );
                                            }}
                                          >
                                            {row.status === 'graded'
                                              ? 'Edit grade'
                                              : 'Grade'}
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {submitModal ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-950/60 px-3 pb-0 pt-10 backdrop-blur-[10px] sm:items-center sm:p-6"
          onClick={closeSummitModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="summit-modal-title"
            className="fade-in-up max-h-[min(92vh,880px)] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`h-1.5 w-full rounded-t-[28px] bg-gradient-to-r sm:rounded-t-3xl ${
                summitMeta?.tone === 'closed'
                  ? 'from-slate-500 via-slate-600 to-slate-700'
                  : summitMeta?.tone === 'late'
                    ? 'from-amber-500 via-orange-500 to-rose-600'
                    : summitMeta?.tone === 'soon'
                      ? 'from-rose-500 via-violet-600 to-cyan-500'
                      : 'from-violet-600 via-fuchsia-500 to-cyan-500'
              }`}
            />
            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                    <Mountain className="h-4 w-4" aria-hidden />
                    Summit
                  </p>
                  <h3
                    id="summit-modal-title"
                    className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
                  >
                    Turn in your work
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {submitModal.title}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${
                        summitMeta?.tone === 'closed'
                          ? 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600'
                          : summitMeta?.tone === 'late'
                            ? 'bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900'
                            : summitMeta?.tone === 'soon'
                              ? 'bg-rose-50 text-rose-950 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900'
                              : 'bg-emerald-50 text-emerald-950 ring-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-900'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {summitMeta?.headline}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {summitMeta?.detail}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close Summit"
                  className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={closeSummitModal}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              {submitSummitPreview ? (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white px-4 py-3 text-sm font-semibold text-violet-950 shadow-inner ring-1 ring-violet-100 dark:border-violet-800 dark:from-violet-950/50 dark:to-slate-900 dark:text-violet-100 dark:ring-violet-900">
                  Instructor preview — you're seeing the exact Summit workspace students use.
                  Uploading is disabled here so roster submissions stay untouched.
                </div>
              ) : null}

              {!submitModal.canSubmit && !submitSummitPreview ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
                  This assignment isn’t accepting uploads right now (closed window or already graded).
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 lg:grid-cols-5">
                <div className="space-y-3 lg:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Progress
                  </p>
                  <ol className="space-y-2">
                    <li
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        submitFile
                          ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300'
                      }`}
                    >
                      <Paperclip className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      Attach final file
                    </li>
                    <li
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        submitAck
                          ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300'
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      Integrity acknowledgement
                    </li>
                    <li className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                      <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      Send to instructor (one tap)
                    </li>
                  </ol>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    PDFs, Office docs, images, ZIP archives · max{' '}
                    {formatFileSize(SUMMIT_MAX_BYTES)}
                  </p>
                  {submitModal.starterFileUrl ? (
                    <a
                      href={submitModal.starterFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200 transition hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-900"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Starter file from instructor
                    </a>
                  ) : null}
                </div>

                <div className="space-y-4 lg:col-span-3">
                  {summitChecklistItems.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-inner dark:border-slate-700 dark:from-slate-950/80 dark:to-slate-900/80">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Pulled from instructions
                      </p>
                      <ul className="mt-3 space-y-2">
                        {summitChecklistItems.map((item, idx) => (
                          <li
                            key={`${idx}-${item.slice(0, 28)}`}
                            className="flex gap-2 text-sm leading-snug text-slate-700 dark:text-slate-200"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                      Tip: ask instructors to use bullets in instructions — Summit turns them into a live checklist here.
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Your submission file
                    </p>
                    <label
                      className={`mt-2 flex cursor-pointer flex-col rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                        summitDropHover
                          ? 'border-violet-500 bg-violet-50/80 dark:border-violet-400 dark:bg-violet-950/30'
                          : 'border-slate-300 bg-white hover:border-violet-300 dark:border-slate-600 dark:bg-slate-950/40 dark:hover:border-violet-700'
                      } ${submitSummitPreview ? 'pointer-events-none opacity-60' : ''}`}
                      htmlFor="summit-file-input"
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (!submitSummitPreview) setSummitDropHover(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setSummitDropHover(false);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!submitSummitPreview) setSummitDropHover(true);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setSummitDropHover(false);
                        if (submitSummitPreview) return;
                        const f = e.dataTransfer?.files?.[0];
                        if (f) setSubmitFile(f);
                      }}
                    >
                      <Upload className="mx-auto h-10 w-10 text-violet-600 dark:text-violet-400" aria-hidden />
                      <span className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                        Drop your file or browse
                      </span>
                      <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Final version only — you can replace while the window stays open.
                      </span>
                      <input
                        id="summit-file-input"
                        type="file"
                        className="sr-only"
                        disabled={submitSummitPreview}
                        onChange={(e) =>
                          setSubmitFile(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                    {submitFile ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/80">
                        <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">
                          {submitFile.name}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {formatFileSize(submitFile.size)}
                          {submitFile.size > SUMMIT_MAX_BYTES ? (
                            <span className="ml-2 font-bold text-rose-600 dark:text-rose-400">
                              Over limit
                            </span>
                          ) : null}
                        </span>
                        {!submitSummitPreview ? (
                          <button
                            type="button"
                            className="text-[11px] font-bold uppercase tracking-wide text-rose-600 hover:underline dark:text-rose-400"
                            onClick={() => setSubmitFile(null)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Note to instructor (optional)
                    <textarea
                      value={submitNote}
                      onChange={(e) => setSubmitNote(e.target.value)}
                      rows={3}
                      disabled={submitSummitPreview}
                      placeholder="e.g. compiled report includes appendix B…"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950/60"
                    />
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
                    <input
                      type="checkbox"
                      checked={submitAck}
                      disabled={submitSummitPreview}
                      onChange={(e) => setSubmitAck(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                    />
                    <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      I confirm this submission is my own work. I understand late
                      turn-ins may be flagged when applicable.
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6 dark:border-slate-700">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Keyboard:{' '}
                  <kbd className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    Esc
                  </kbd>{' '}
                  closes Summit
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-5 py-2.5 text-sm"
                    onClick={closeSummitModal}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={
                      submitBusy ||
                      submitSummitPreview ||
                      !submitModal.canSubmit ||
                      !submitFile ||
                      !submitAck ||
                      (submitFile?.size ?? 0) > SUMMIT_MAX_BYTES
                    }
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:shadow-violet-900/30"
                    onClick={submitAssignment}
                  >
                    {submitBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Mountain className="h-4 w-4" aria-hidden />
                        Submit via Summit
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {gradeModal ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="fade-in-up w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Grade {gradeModal.submission.studentDisplay}
            </h3>
            <label className="mt-4 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              Score (max {gradeModal.points})
              <input
                type="number"
                min={0}
                value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)}
                className="input-field mt-1 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              Feedback
              <textarea
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-600 dark:bg-slate-950/60"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-5 py-2 text-sm"
                onClick={() => setGradeModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={gradeBusy}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
                onClick={saveGrade}
              >
                {gradeBusy ? 'Saving…' : 'Save grade'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerCanManageClassroom && liquDrawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[199] bg-slate-950/50 backdrop-blur-[2px]"
            aria-label="Close Liqu AI"
            onClick={() => setLiquDrawerOpen(false)}
          />
          <div
            className="fixed inset-y-0 right-0 z-[200] flex w-full max-w-lg flex-col border-l border-slate-200/90 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label="Liqu AI for instructors"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/90 px-4 py-3 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">
                  Instructor · {chatName}
                </p>
                <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Liqu AI
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLiquDrawerOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200/90 px-4 py-3 dark:border-slate-700">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Assignment context (optional paste)
              </label>
              <textarea
                value={assignmentPaste}
                onChange={(e) => setAssignmentPaste(e.target.value)}
                rows={3}
                placeholder="Paste assignment instructions or a rubric excerpt — included in Liqu context and quick actions."
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/90 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Use “For Liqu” on a material card to include that file in context
                and quick actions.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-2 pb-3 pt-2">
              <LiquAiChatPanel
                variant="gemini"
                className="h-[calc(100vh-8rem)] min-h-[420px]"
                bookTitle={`Classroom: ${chatName}`}
                contextBlurb={liquContextBlurb}
                starterPrompts={liquQuickPrompts}
                onQuickPrompt={onLiquQuickPrompt}
              />
            </div>
          </div>
        </>
      ) : null}

      <ClassroomParticipantsDrawer
        open={showMembersDrawer}
        onClose={() => setShowMembersDrawer(false)}
        chatId={chatId}
        chatName={chatName}
        members={members}
        creator={creator}
        admins={admins}
        membersError={membersError}
        invitationCode={invitationCode}
        user={user}
        viewerCanManageRoster={viewerIsCreator}
        viewerCanManageClassroom={viewerCanManageClassroom}
        viewerIsClassroomCreator={viewerIsCreator}
        onRefreshMeta={refreshClassroomMetaAfterMutation}
        showEditClassroomButton={false}
        showLeaveButton={false}
      />
    </div>
  );
}

function ClassroomResources() {
  const { chatId } = useParams();

  if (!chatId) {
    return (
      <div className="classroom-ambient relative page-surface flex justify-center px-4 py-10">
        <div className="relative z-[2] w-full max-w-6xl">
          <div className="panel-card rounded-3xl p-8">
            <p className="font-medium text-rose-600">Classroom not found.</p>
            <Link
              to="/classroom"
              className="mt-4 inline-block text-sm font-semibold text-cyan-700 underline dark:text-cyan-400"
            >
              ← Back to classrooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ClassroomResourcesContent key={chatId} chatId={chatId} />;
}

export default ClassroomResources;
