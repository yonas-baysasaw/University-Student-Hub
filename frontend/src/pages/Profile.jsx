import {
  ArrowRight,
  BookOpen,
  BookUp,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  GraduationCap,
  Heart,
  LayoutGrid,
  Library,
  MessageSquare,
  Settings,
  Sparkles,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import UploadBookModal from '../components/UploadBookModal.jsx';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';
import {
  formatLibraryDate,
  humanizeFormat,
  visibilityLabel,
  visibilityTone,
} from '../utils/formatLabels';
import {
  resolveDepartmentForSubmit,
  validateWizardStep,
} from '../utils/bookUploadMeta';

function formatRelativeShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return formatLibraryDate(iso) || d.toLocaleDateString();
}

function activityMeta(type) {
  switch (type) {
    case 'book_upload':
      return {
        label: 'Upload',
        Icon: BookUp,
        wrap:
          'bg-cyan-500/15 text-cyan-700 ring-cyan-500/25 dark:bg-cyan-500/12 dark:text-cyan-200 dark:ring-cyan-400/30',
      };
    case 'chat_create':
      return {
        label: 'Classroom',
        Icon: GraduationCap,
        wrap:
          'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:bg-violet-500/12 dark:text-violet-200 dark:ring-violet-400/30',
      };
    case 'message_send':
      return {
        label: 'Message',
        Icon: MessageSquare,
        wrap:
          'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:bg-sky-500/12 dark:text-sky-200 dark:ring-sky-400/30',
      };
    default:
      return {
        label: 'Activity',
        Icon: Sparkles,
        wrap:
          'bg-slate-500/15 text-slate-700 ring-slate-500/25 dark:bg-slate-500/12 dark:text-slate-200 dark:ring-slate-400/30',
      };
  }
}

function StatInteractiveCard({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  href,
  accent,
}) {
  const inner = (
    <>
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${accent}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="font-display text-3xl tabular-nums text-slate-900 dark:text-slate-50">
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        ) : null}
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-slate-600"
        aria-hidden
      />
    </>
  );

  const className =
    'group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-5 text-left shadow-sm transition hover:border-cyan-400/35 hover:shadow-md dark:border-slate-600/80 dark:bg-slate-900/40 dark:hover:border-cyan-500/35';

  if (href) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

function Profile() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [sharedBooks, setSharedBooks] = useState([]);
  const [viewedBooks, setViewedBooks] = useState([]);
  const [likedBooks, setLikedBooks] = useState([]);
  const [subscribedChannels, setSubscribedChannels] = useState([]);
  const [activity, setActivity] = useState([]);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalChatsCreated: 0,
    totalMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mainTab, setMainTab] = useState('activity');
  const [sidebarTab, setSidebarTab] = useState('viewed');

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');

  const [uploadForm, setUploadForm] = useState(() => ({
    title: '',
    description: '',
    file: null,
    academicTrack: '',
    department: '',
    departmentOther: '',
    publishYear: new Date().getFullYear(),
    courseSubject: '',
  }));

  useEffect(() => {
    let active = true;

    const loadActivity = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('/api/profile/activity?limit=25', {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to load activity');
        }

        const data = await res.json();
        if (!active) return;

        setSharedBooks(Array.isArray(data.sharedBooks) ? data.sharedBooks : []);
        setViewedBooks(Array.isArray(data.viewedBooks) ? data.viewedBooks : []);
        setLikedBooks(Array.isArray(data.likedBooks) ? data.likedBooks : []);
        setSubscribedChannels(
          Array.isArray(data.subscribedChannels)
            ? data.subscribedChannels
            : [],
        );
        setActivity(Array.isArray(data.activity) ? data.activity : []);
        setStats(
          data.stats || {
            totalBooks: 0,
            totalChatsCreated: 0,
            totalMessages: 0,
          },
        );
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Could not load profile activity');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadActivity();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isUploadModalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isUploadModalOpen]);

  const displayName = user?.displayName ?? user?.username ?? 'Student';
  const email = user?.email ?? 'No email available';
  const avatar = user?.photo || defaultProfile;
  const usernameHandle = user?.username ? `@${user.username}` : null;

  const formattedLastSeen = useMemo(() => {
    if (!user?.lastSeen) return null;
    const date = new Date(user.lastSeen);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [user?.lastSeen]);

  const providerLabel = useMemo(() => {
    const p = String(user?.provider || '').toLowerCase();
    if (p === 'google') return 'Google';
    if (p === 'local' || p === 'email') return 'Email';
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : null;
  }, [user?.provider]);

  const formatDate = (value) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  const scrollToUploads = useCallback(() => {
    setMainTab('uploads');
    requestAnimationFrame(() => {
      document
        .getElementById('profile-shared-books')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadStep(1);
    setUploadError('');
    setDragActive(false);
    setUploadForm({
      title: '',
      description: '',
      file: null,
      academicTrack: '',
      department: '',
      departmentOther: '',
      publishYear: new Date().getFullYear(),
      courseSubject: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const goUploadNext = () => {
    const err = validateWizardStep(uploadStep, uploadForm);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError('');
    setUploadStep((s) => Math.min(3, s + 1));
  };

  const goUploadPrev = () => {
    setUploadError('');
    setUploadStep((s) => Math.max(1, s - 1));
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    const stepErr = validateWizardStep(3, uploadForm);
    if (stepErr) {
      setUploadError(stepErr);
      return;
    }

    const dept = resolveDepartmentForSubmit(uploadForm);
    if (!dept || dept === 'Other') {
      setUploadError('Complete department details.');
      setUploadStep(1);
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('academicTrack', uploadForm.academicTrack);
      formData.append('department', dept);
      formData.append('title', uploadForm.title.trim());
      formData.append('publishYear', String(Number(uploadForm.publishYear)));
      formData.append('courseSubject', uploadForm.courseSubject.trim());
      if (uploadForm.description.trim()) {
        formData.append('description', uploadForm.description.trim());
      }
      formData.append('file', uploadForm.file);

      const res = await fetch('/api/upload/file', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to upload book');
      }

      const newBook = {
        ...payload,
        _id: payload?._id || payload?.id || `${Date.now()}`,
      };

      setSharedBooks((prev) => [newBook, ...prev]);
      setActivity((prev) => [
        {
          id: `book-${newBook._id}`,
          type: 'book_upload',
          title: `Uploaded "${payload?.title || uploadForm.title || 'your book'}"`,
          subtitle: [
            payload?.department || dept,
            payload?.courseSubject || uploadForm.courseSubject,
          ]
            .filter(Boolean)
            .join(' · '),
          at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setStats((prev) => ({
        ...prev,
        totalBooks: (prev?.totalBooks || 0) + 1,
      }));

      setUploadSuccess('Book uploaded successfully.');
      closeUploadModal();
    } catch (err) {
      setUploadError(err?.message || 'Could not upload this book');
    } finally {
      setUploading(false);
    }
  };

  const onDropZoneDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const onDropFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      setUploadForm((prev) => ({ ...prev, file }));
      setUploadError('');
    }
  };

  const copyPublicLink = async () => {
    if (!user?.id) return;
    const url = `${window.location.origin}/users/${user.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyNotice('Could not copy automatically — copy from your browser.');
      window.setTimeout(() => setCopyNotice(''), 4500);
    }
  };

  const sidebarList = useMemo(() => {
    if (sidebarTab === 'viewed')
      return {
        title: 'Reading trail',
        empty: 'Books you open appear here so you can jump back in.',
        items: viewedBooks.slice(0, 8),
        renderItem: (book) => (
          <Link
            key={`viewed-${book._id}`}
            to={`/library/${book._id}`}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-700/80"
          >
            <Eye className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {book.title || 'Untitled'}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-slate-600" />
          </Link>
        ),
      };
    if (sidebarTab === 'channels')
      return {
        title: 'Creators you follow',
        empty: 'Subscribe to uploaders from book pages to see them here.',
        items: subscribedChannels.slice(0, 8),
        renderItem: (channel) => (
          <Link
            key={`channel-${channel.id}`}
            to={`/users/${channel.id}`}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-700/80"
          >
            <img
              src={channel.avatar || defaultProfile}
              alt=""
              className="h-9 w-9 rounded-full border border-slate-200 object-cover dark:border-slate-600"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {channel.name}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-slate-600" />
          </Link>
        ),
      };
    return {
      title: 'Saved titles',
      empty: 'Tap the heart on a book in the library to build this list.',
      items: likedBooks.slice(0, 8),
      renderItem: (book) => (
        <Link
          key={`liked-${book._id}`}
          to={`/library/${book._id}`}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-700/80"
        >
          <Heart className="h-4 w-4 shrink-0 text-rose-400" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {book.title || 'Untitled'}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-slate-600" />
        </Link>
      ),
    };
  }, [sidebarTab, viewedBooks, subscribedChannels, likedBooks]);

  const sidebarCounts = useMemo(
    () => ({
      viewed: viewedBooks.length,
      channels: subscribedChannels.length,
      liked: likedBooks.length,
    }),
    [viewedBooks, subscribedChannels, likedBooks],
  );

  const openUploadModal = useCallback(() => {
    setUploadSuccess('');
    setUploadError('');
    setUploadStep(1);
    setIsUploadModalOpen(true);
  }, []);

  return (
    <div className="library-ambient page-surface px-4 pb-14 pt-8 md:px-6">
      <section className="relative z-[1] mx-auto max-w-6xl space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/90 to-cyan-50/40 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.18)] dark:border-slate-600/70 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-900/80 dark:shadow-[0_28px_70px_-24px_rgba(0,0,0,0.55)]">
          <div className="workspace-hero-mesh pointer-events-none absolute inset-0 opacity-70 dark:opacity-50" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl dark:bg-cyan-500/15" />
          <div className="pointer-events-none absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/12" />

          <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between md:p-10">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <img
                  src={avatar}
                  alt=""
                  className="profile-avatar-ring h-24 w-24 rounded-[1.35rem] border border-white object-cover shadow-lg dark:border-slate-700 md:h-28 md:w-28"
                />
                <span
                  className="absolute bottom-1 right-1 flex h-4 w-4 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"
                  title="Active"
                  aria-hidden
                />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200">
                    Your workspace
                  </span>
                  {providerLabel ? (
                    <span className="rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/5 dark:text-slate-300 dark:ring-slate-600">
                      {providerLabel}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h1 className="font-display text-3xl leading-tight text-slate-900 dark:text-white md:text-4xl">
                    {displayName}
                  </h1>
                  <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
                    {email}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {usernameHandle ? (
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {usernameHandle}
                      </span>
                    ) : null}
                    {formattedLastSeen ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        Last seen {formattedLastSeen}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={openUploadModal}
                    className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    Upload book
                  </button>
                  <Link
                    to="/library"
                    className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <Library className="h-4 w-4" aria-hidden />
                    Browse library
                  </Link>
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-400/40 hover:bg-white dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Settings className="h-4 w-4" aria-hidden />
                    Settings
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[240px] md:items-end">
              {user?.id ? (
                <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/70 p-4 backdrop-blur-sm dark:border-slate-600/80 dark:bg-slate-900/50 md:items-stretch">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Public profile
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/users/${user.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                    >
                      View as visitor
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={copyPublicLink}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      title="Copy profile URL"
                    >
                      {copyFeedback ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copyFeedback ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                  {copyNotice ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      {copyNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatInteractiveCard
            icon={BookOpen}
            label="Books uploaded"
            value={loading ? '—' : stats.totalBooks}
            hint="Titles you share with campus"
            onClick={scrollToUploads}
            accent="bg-cyan-500/15 text-cyan-700 ring-cyan-500/25 dark:bg-cyan-500/12 dark:text-cyan-300 dark:ring-cyan-400/25"
          />
          <StatInteractiveCard
            icon={Users}
            label="Classrooms created"
            value={loading ? '—' : stats.totalChatsCreated}
            hint="Spaces you kicked off"
            href="/classroom"
            accent="bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:bg-violet-500/12 dark:text-violet-300 dark:ring-violet-400/25"
          />
          <StatInteractiveCard
            icon={MessageSquare}
            label="Messages sent"
            value={loading ? '—' : stats.totalMessages}
            hint="Across Study Buddy & classrooms"
            href="/liqu-ai/study-buddy"
            accent="bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:bg-sky-500/12 dark:text-sky-300 dark:ring-sky-400/25"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
          {/* Sidebar */}
          <aside className="panel-card flex flex-col overflow-hidden rounded-3xl lg:sticky lg:top-24">
            <div className="border-b border-slate-200/90 px-5 py-4 dark:border-slate-600/80">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <h2 className="font-display text-lg text-slate-900 dark:text-white">
                  Quick navigation
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Jump back to books and people you care about.
              </p>
            </div>

            <div className="flex gap-1 border-b border-slate-200/80 px-2 pt-2 dark:border-slate-600/70">
              {[
                { id: 'viewed', label: 'Trail', Icon: Eye, n: sidebarCounts.viewed },
                {
                  id: 'channels',
                  label: 'Following',
                  Icon: Users,
                  n: sidebarCounts.channels,
                },
                {
                  id: 'liked',
                  label: 'Saved',
                  Icon: Heart,
                  n: sidebarCounts.liked,
                },
              ].map(({ id, label, Icon, n }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSidebarTab(id)}
                  className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-t-xl px-2 py-2 text-[11px] font-semibold transition ${
                    sidebarTab === id
                      ? 'bg-white text-cyan-700 shadow-[0_-1px_0_0_rgba(6,182,212,0.35)_inset] dark:bg-slate-800 dark:text-cyan-300'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 sm:hidden" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label.slice(0, 4)}</span>
                  <span
                    className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${
                      sidebarTab === id
                        ? 'bg-cyan-500/15 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {n}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {sidebarList.title}
              </p>
              <div className="space-y-0.5">
                {sidebarList.items.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    {sidebarList.empty}
                  </p>
                ) : (
                  sidebarList.items.map((item) =>
                    sidebarList.renderItem(item),
                  )
                )}
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 p-1.5 shadow-sm dark:border-slate-600/80 dark:bg-slate-900/40">
              {[
                { id: 'activity', label: 'Recent activity', Icon: Zap },
                { id: 'uploads', label: 'Your uploads', Icon: BookOpen },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMainTab(id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition sm:flex-none sm:px-6 ${
                    mainTab === id
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md shadow-cyan-600/25'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
              <Link
                to="/library"
                className="ml-auto hidden items-center gap-1 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400 sm:inline-flex"
              >
                Open library
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {mainTab === 'activity' ? (
              <div className="panel-card rounded-3xl p-6 md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl text-slate-900 dark:text-white">
                      Activity timeline
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Uploads, classrooms, and messages in one place.
                    </p>
                  </div>
                </div>

                <div className="relative mt-8">
                  <div
                    className="pointer-events-none absolute left-[21px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-400/50 via-slate-200 to-transparent dark:from-cyan-500/35 dark:via-slate-600 md:left-[23px]"
                    aria-hidden
                  />
                  <ul className="space-y-6">
                    {loading ? (
                      <li className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                        Loading your timeline…
                      </li>
                    ) : error ? (
                      <li className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                        {error}
                      </li>
                    ) : activity.length === 0 ? (
                      <li className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-800/40">
                        <Sparkles className="mx-auto h-10 w-10 text-cyan-500/70" />
                        <p className="mt-3 font-display text-lg text-slate-800 dark:text-slate-100">
                          No activity yet
                        </p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
                          Upload a book or join a classroom—your milestones will
                          show up here.
                        </p>
                        <button
                          type="button"
                          onClick={openUploadModal}
                          className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2 text-sm"
                        >
                          <Upload className="h-4 w-4" />
                          Upload your first book
                        </button>
                      </li>
                    ) : (
                      activity.map((item) => {
                        const meta = activityMeta(item.type);
                        const AIcon = meta.Icon;
                        return (
                          <li key={item.id} className="relative flex gap-4 pl-1">
                            <div
                              className={`relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${meta.wrap}`}
                            >
                              <AIcon className="h-5 w-5" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-sm transition hover:border-cyan-300/60 hover:shadow-md dark:border-slate-600/70 dark:bg-slate-900/40 dark:hover:border-cyan-500/30">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  {meta.label}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                  {formatRelativeShort(item.at)}
                                </span>
                              </div>
                              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                                {item.title}
                              </p>
                              {item.subtitle ? (
                                <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                                  {item.subtitle}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
            ) : null}

            {mainTab === 'uploads' ? (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 md:text-left">
                Your shared books are below. Upload a new one anytime from the
                button in the hero or the card.
              </p>
            ) : null}

            <div
              id="profile-shared-books"
              className="panel-card scroll-mt-28 rounded-3xl p-6 md:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Library className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    <h2 className="font-display text-2xl text-slate-900 dark:text-white">
                      Shared books
                    </h2>
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
                    Everything you publish to the library—public or unlisted—with
                    quick access to detail pages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openUploadModal}
                  className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 self-start px-5 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" />
                  New upload
                </button>
              </div>

              {uploadSuccess ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200">
                  <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  {uploadSuccess}
                </div>
              ) : null}

              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/30">
                    Loading your books…
                  </div>
                ) : error ? (
                  <div className="col-span-full rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                    {error}
                  </div>
                ) : sharedBooks.length === 0 ? (
                  <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-cyan-50/40 px-8 py-16 text-center dark:border-slate-600 dark:from-slate-900/60 dark:to-slate-900/30">
                    <BookOpen className="mx-auto h-12 w-12 text-cyan-500/80" />
                    <p className="mt-4 font-display text-xl text-slate-900 dark:text-white">
                      No books shared yet
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                      Share readings, notes, or study packs with your class. PDFs
                      get a generated cover when possible.
                    </p>
                    <button
                      type="button"
                      onClick={openUploadModal}
                      className="btn-primary mt-6 inline-flex items-center gap-2 px-6 py-2.5 text-sm"
                    >
                      <Upload className="h-4 w-4" />
                      Upload a book
                    </button>
                  </div>
                ) : (
                  sharedBooks.map((book) => (
                    <article
                      key={book._id}
                      className="library-book-card group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:border-slate-600/80 dark:bg-slate-900/35"
                    >
                      <Link
                        to={`/library/${book._id}`}
                        className="relative block aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800"
                      >
                        {book.thumbnailUrl ? (
                          <img
                            src={book.thumbnailUrl}
                            alt=""
                            className="library-cover-img h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                            <BookOpen className="h-10 w-10 text-slate-400" />
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              No cover
                            </span>
                          </div>
                        )}
                        <div className="library-cover-shine pointer-events-none absolute inset-0" />
                      </Link>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                            {book.title || 'Untitled'}
                          </h3>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${visibilityTone(book.visibility)}`}
                          >
                            {visibilityLabel(book.visibility)}
                          </span>
                        </div>
                        {book.department ||
                        book.courseSubject ||
                        Number.isFinite(book.publishYear) ? (
                          <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {[
                              book.department,
                              book.courseSubject,
                              Number.isFinite(book.publishYear)
                                ? book.publishYear
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {humanizeFormat(book.format)} ·{' '}
                          {formatLibraryDate(book.createdAt) ||
                            formatDate(book.createdAt)}
                        </p>
                        {book.description ? (
                          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            {book.description}
                          </p>
                        ) : (
                          <div className="flex-1" />
                        )}
                        <Link
                          to={`/library/${book._id}`}
                          className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm"
                        >
                          Open detail
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upload modal — portaled above layout/nav stacking contexts */}
      <UploadBookModal
        open={isUploadModalOpen}
        uploadStep={uploadStep}
        uploadForm={uploadForm}
        setUploadForm={setUploadForm}
        uploading={uploading}
        uploadError={uploadError}
        setUploadError={setUploadError}
        dragActive={dragActive}
        fileInputRef={fileInputRef}
        onClose={closeUploadModal}
        onNext={goUploadNext}
        onPrev={goUploadPrev}
        onSubmit={handleUploadSubmit}
        onDropZoneDrag={onDropZoneDrag}
        onDropFile={onDropFile}
      />
    </div>
  );
}

export default Profile;
