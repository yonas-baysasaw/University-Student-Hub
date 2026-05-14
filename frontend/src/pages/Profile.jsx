import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  GraduationCap,
  KeyRound,
  Laptop,
  LayoutDashboard,
  Library,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Medal,
  MonitorSmartphone,
  MoreHorizontal,
  Phone,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import defaultProfile from "../assets/profile.png";
import BookEventReportMenu from "../components/report/BookEventReportMenu.jsx";
import { useAuth } from "../contexts/AuthContext";
import { academicTrackLabel } from "../utils/bookUploadMeta";
import {
  formatLibraryDate,
  humanizeFormat,
  visibilityLabel,
  visibilityTone,
} from "../utils/formatLabels";

const tabs = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "security", label: "Security", Icon: ShieldCheck },
  { id: "about", label: "About", Icon: UserRound },
];

const mockAcademic = {
  gpa: "3.72",
  currentSemester: "Spring 2026",
  enrolledCourses: 6,
  completedCourses: 38,
  attendance: 92,
  standing: "Good",
  credits: 114,
  graduationProgress: 78,
};

const mockSessions = [
  {
    id: "current",
    device: "Chrome on Windows",
    location: "Addis Ababa campus network",
    time: "Active now",
    current: true,
  },
  {
    id: "mobile",
    device: "Mobile app on Android",
    location: "Main campus Wi-Fi",
    time: "Today, 8:12 AM",
  },
  {
    id: "library",
    device: "Edge on Library PC",
    location: "Digital library lab",
    time: "Yesterday, 4:44 PM",
  },
  {
    id: "tablet",
    device: "Safari on iPad",
    location: "Remote",
    time: "Apr 30, 2026, 9:10 PM",
  },
  {
    id: "lab",
    device: "Firefox on Linux",
    location: "Computer science lab",
    time: "Apr 28, 2026, 2:25 PM",
  },
];

const mockActivities = [
  {
    id: "material-1",
    type: "Material",
    title: "Opened Data Structures lecture pack",
    meta: "Algorithms and Complexity",
    time: "18 min ago",
    Icon: BookOpen,
  },
  {
    id: "assignment-1",
    type: "Assignment",
    title: "Submitted Operating Systems lab report",
    meta: "Submitted before deadline",
    time: "2 hours ago",
    Icon: FileCheck2,
  },
  {
    id: "quiz-1",
    type: "Quiz",
    title: "Completed Database Systems quiz",
    meta: "Score pending instructor review",
    time: "Yesterday",
    Icon: Medal,
  },
  {
    id: "study-1",
    type: "Study",
    title: "Reached 74% progress in Liqu AI study plan",
    meta: "Machine Learning fundamentals",
    time: "Apr 30, 2026",
    Icon: Sparkles,
  },
];

const achievements = [
  { label: "Active Learner", detail: "14-day learning streak", Icon: Trophy },
  {
    label: "Top Contributor",
    detail: "Shared 12 study resources",
    Icon: Award,
  },
  { label: "Milestone", detail: "75% degree progress", Icon: Target },
  {
    label: "Certificate Ready",
    detail: "Future credential vault",
    Icon: FileText,
  },
];

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function initialsFor(name, username) {
  const source = String(name || username || "Student").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeActivity(item, index) {
  const title = item?.title || item?.action || "Student activity recorded";
  const meta =
    item?.subtitle ||
    item?.description ||
    item?.type ||
    "University Student Hub";
  return {
    id: item?.id || item?._id || `api-activity-${index}`,
    type: item?.type ? String(item.type).replace(/_/g, " ") : "Activity",
    title,
    meta,
    time: item?.at
      ? formatDateTime(item.at)
      : item?.createdAt
        ? formatDateTime(item.createdAt)
        : "Recently",
    Icon: Activity,
  };
}

function schoolYearToAcademicLevel(y) {
  if (typeof y !== "number" || !Number.isFinite(y)) return null;
  const yi = Math.round(y);
  if (yi === 7) return "Graduate";
  if (yi >= 1 && yi <= 6) return `Year ${yi}`;
  return null;
}

function academicLevelToSchoolYear(level) {
  const s = String(level ?? "").trim();
  const m = /^Year\s+(\d)$/i.exec(s);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : NaN;
  }
  if (/^graduate$/i.test(s)) return 7;
  return NaN;
}

/** Maps GET /api/profile/public payload → Profile.jsx row shape (peer view). */
function mapPeerApiToProfileRow(peer) {
  if (!peer) return null;
  const full =
    (peer.displayName && String(peer.displayName).trim()) ||
    (peer.name && String(peer.name).trim()) ||
    peer.username ||
    "Member";
  const level = schoolYearToAcademicLevel(peer.schoolYear ?? null);
  return {
    fullName: full,
    username: peer.username || "—",
    status:
      peer.accountType === "instructor" ? "Instructor" : "Student",
    department: peer.department?.trim() ? peer.department.trim() : "—",
    studentId: "",
    academicLevel: level || "—",
    email: "",
    phone: "",
    location: "",
    emergencyContact: "",
    bio: "",
    interests: "",
    careerGoals: "",
    skills: "",
  };
}

function formatPeerBookDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function PeerLibraryGrid({ sharedBooks }) {
  return (
    <div className="panel-card rounded-3xl p-6 shadow-xl shadow-slate-900/[0.06] md:p-8 dark:shadow-black/35">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-700/80">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:from-cyan-400/12 dark:to-indigo-400/8 dark:text-cyan-300 dark:ring-cyan-400/25">
            <Library className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
              Library contributions
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Public and unlisted materials they’ve shared — open a card for
              details, reactions, and Study Buddy.
            </p>
          </div>
        </div>
        <Link
          to="/liqu-ai/study-buddy"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/40"
        >
          <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          Liqu AI
        </Link>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {sharedBooks.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-cyan-50/30 px-8 py-16 text-center dark:border-slate-600 dark:from-slate-900/50 dark:to-slate-900/30">
            <BookOpen className="mx-auto h-14 w-14 text-cyan-500/75" />
            <p className="mt-4 font-display text-xl font-semibold text-slate-950 dark:text-white">
              Nothing on the shelf yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              When this member publishes books to the library, they’ll show up
              here for everyone who visits their profile.
            </p>
          </div>
        ) : (
          sharedBooks.map((book) => (
            <article
              key={book._id}
              className="library-book-card group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:border-slate-600/85 dark:bg-slate-900/40"
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
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
                    <BookOpen className="h-12 w-12 text-slate-400" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      No cover
                    </span>
                  </div>
                )}
                <div className="library-cover-shine pointer-events-none absolute inset-0" />
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-display text-base font-semibold text-slate-950 dark:text-white">
                    <Link
                      to={`/library/${book._id}`}
                      className="transition hover:text-cyan-700 dark:hover:text-cyan-400"
                    >
                      {book.title || "Untitled"}
                    </Link>
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${visibilityTone(book.visibility)}`}
                  >
                    {visibilityLabel(book.visibility)}
                  </span>
                </div>
                {book.academicTrack ||
                book.department ||
                book.courseSubject ||
                Number.isFinite(book.publishYear) ? (
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                    {[
                      book.academicTrack
                        ? academicTrackLabel(book.academicTrack)
                        : null,
                      book.department,
                      book.courseSubject,
                      Number.isFinite(book.publishYear) ? book.publishYear : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                  {humanizeFormat(book.format)} ·{" "}
                  {formatLibraryDate(book.createdAt) ||
                    formatPeerBookDate(book.createdAt)}
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
                  className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold"
                >
                  View details
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, progress, tone = "cyan" }) {
  const toneMap = {
    cyan: "bg-cyan-500/12 text-cyan-700 ring-cyan-500/20 dark:text-cyan-200",
    emerald:
      "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200",
    amber:
      "bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:text-amber-200",
    indigo:
      "bg-indigo-500/12 text-indigo-700 ring-indigo-500/20 dark:text-indigo-200",
  };

  return (
    <article className="dashboard-card-lift rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-white">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {hint}
            </p>
          ) : null}
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${toneMap[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      {typeof progress === "number" ? (
        <div
          className="mt-4"
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, progress))}
        >
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

function FieldRow({
  label,
  name,
  value,
  editing,
  type = "text",
  onChange,
  error,
  readOnly = false,
  icon: Icon,
  badge,
}) {
  return (
    <div className="block rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm transition focus-within:border-cyan-400 dark:border-slate-700/80 dark:bg-slate-900/60">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
        {label}
        {badge ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20">
            <BadgeCheck className="h-3 w-3" aria-hidden />
            {badge}
          </span>
        ) : null}
      </span>
      {editing && !readOnly ? (
        <input
          className="input-field mt-2"
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      ) : (
        <span className="mt-2 block min-h-[2.6rem] rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 dark:bg-slate-800/70 dark:text-slate-100">
          {value || "Not provided"}
        </span>
      )}
      {error ? (
        <span
          id={`${name}-error`}
          className="mt-1 block text-xs font-semibold text-rose-600"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}

function IdentityEditModal({
  open,
  title,
  draft,
  updateDraft,
  isStudent,
  saving,
  onClose,
  onSave,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-modal-title"
        className="fade-in-up max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-400/25">
            <Edit3 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="identity-modal-title"
              className="font-display text-xl font-bold text-slate-950 dark:text-white"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Update how you appear on your profile. Changes sync to your
              account.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Full name
            <input
              className="input-field normal-case font-semibold tracking-normal"
              name="fullName"
              value={draft.fullName}
              onChange={updateDraft}
              autoComplete="name"
              aria-label="Full name"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Username
            <input
              className="input-field normal-case font-semibold tracking-normal"
              name="username"
              value={draft.username}
              onChange={updateDraft}
              autoComplete="username"
              aria-label="Username"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:col-span-2">
            Department or major
            <input
              className="input-field normal-case font-semibold tracking-normal"
              name="department"
              value={draft.department}
              onChange={updateDraft}
              aria-label="Department or major"
            />
          </label>
          {isStudent ? (
            <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:col-span-2">
              Academic level
              <select
                className="input-field normal-case font-semibold tracking-normal"
                name="academicLevel"
                value={draft.academicLevel}
                onChange={updateDraft}
                aria-label="Academic level"
              >
                <option>Year 1</option>
                <option>Year 2</option>
                <option>Year 3</option>
                <option>Year 4</option>
                <option>Graduate</option>
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary gap-2 px-4 py-2 text-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary gap-2 px-4 py-2 text-sm"
            onClick={onSave}
            disabled={saving}
          >
            <Save className="h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  actionLabel,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="fade-in-up w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/20">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2
              id="confirm-title"
              className="font-display text-xl font-bold text-slate-950 dark:text-white"
            >
              {title}
            </h2>
            <p
              id="confirm-description"
              className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400"
            >
              {description}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary bg-none px-4 py-2 text-sm"
            onClick={onConfirm}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Profile({ viewMode = "owner" }) {
  const isPeerView = viewMode === "peer";
  const { userId: peerRouteUserId } = useParams();
  const peerUserId = isPeerView ? peerRouteUserId : null;

  const { user, setUser, logout, refreshAuth } = useAuth();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(!isPeerView);
  const [activities, setActivities] = useState(mockActivities);
  const [sessions, setSessions] = useState(mockSessions);
  const [confirm, setConfirm] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    user?.photo || defaultProfile,
  );

  const [peerLoading, setPeerLoading] = useState(isPeerView);
  const [peerError, setPeerError] = useState("");
  const [peerApiProfile, setPeerApiProfile] = useState(null);
  const [peerSharedBooks, setPeerSharedBooks] = useState([]);
  const [peerSubscribersCount, setPeerSubscribersCount] = useState(0);
  const [peerBooksSharedCount, setPeerBooksSharedCount] = useState(0);
  const [peerSubscribed, setPeerSubscribed] = useState(false);
  const [peerActionLoading, setPeerActionLoading] = useState(false);
  const [peerActionMessage, setPeerActionMessage] = useState("");

  const viewerIdStr = user ? String(user._id ?? user.id ?? "") : "";

  useEffect(() => {
    if (!isPeerView) return;
    if (!peerUserId) {
      setPeerError("Missing user id");
      setPeerLoading(false);
      return;
    }
    let active = true;

    const loadPeer = async () => {
      try {
        setPeerLoading(true);
        setPeerError("");
        const res = await fetch(`/api/profile/public/${peerUserId}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load profile");
        }
        if (!active) return;
        const loadedProfile = data?.profile || null;
        setPeerApiProfile(loadedProfile);
        const loadedBooks = Array.isArray(data?.sharedBooks)
          ? data.sharedBooks
          : [];
        setPeerSharedBooks(loadedBooks);
        setPeerSubscribed(Boolean(data?.viewerState?.subscribed));
        setPeerSubscribersCount(
          Number.isFinite(loadedProfile?.subscribersCount)
            ? loadedProfile.subscribersCount
            : 0,
        );
        setPeerBooksSharedCount(
          Number.isFinite(data?.stats?.sharedBooks)
            ? data.stats.sharedBooks
            : loadedBooks.length,
        );
      } catch (err) {
        if (!active) return;
        setPeerError(err?.message || "Could not load this profile");
        setPeerApiProfile(null);
      } finally {
        if (active) setPeerLoading(false);
      }
    };

    loadPeer();
    return () => {
      active = false;
    };
  }, [isPeerView, peerUserId]);

  const peerJoinedDate = useMemo(() => {
    if (!isPeerView || !peerApiProfile?.joinedAt) return null;
    const date = new Date(peerApiProfile.joinedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [isPeerView, peerApiProfile?.joinedAt]);

  const displayName =
    user?.displayName || user?.name || user?.username || "Amina Bekele";
  const username = user?.username || "amina.bekele";

  const initialProfile = useMemo(
    () => ({
      fullName: displayName,
      username,
      status: "Active Student",
      department: user?.department || "Computer Science",
      studentId:
        user?.studentId != null && user.studentId !== ""
          ? String(user.studentId)
          : user?.id != null
            ? String(user.id)
            : "USH-2026-0147",
      academicLevel:
        schoolYearToAcademicLevel(user?.schoolYear) ||
        user?.academicLevel ||
        "Year 3",
      email: user?.email || "student@university.edu",
      phone: user?.phone || "+251 91 234 5678",
      location: user?.campus || "Main Campus",
      emergencyContact:
        user?.emergencyContact || "Mekdes Bekele - +251 91 555 0182",
      bio:
        user?.bio ||
        "Computer science student focused on applied AI, distributed systems, and building helpful campus tools.",
      interests:
        user?.interests || "AI tutoring, systems design, academic communities",
      careerGoals:
        user?.careerGoals ||
        "Become a software engineer working on education technology.",
      skills:
        user?.skills ||
        "React, Node.js, Python, data structures, research writing",
    }),
    [displayName, user, username],
  );

  const [profile, setProfile] = useState(initialProfile);
  const [draft, setDraft] = useState(initialProfile);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isPeerView || !peerApiProfile) return;
    const row = mapPeerApiToProfileRow(peerApiProfile);
    if (!row) return;
    setProfile(row);
    setDraft(row);
    setAvatarPreview(peerApiProfile.avatar || defaultProfile);
  }, [isPeerView, peerApiProfile]);

  useEffect(() => {
    if (isPeerView) return;
    setProfile(initialProfile);
    setDraft(initialProfile);
    setAvatarPreview(user?.photo || defaultProfile);
  }, [initialProfile, user?.photo, isPeerView]);

  useEffect(() => {
    if (isPeerView) return;
    let active = true;

    const loadActivity = async () => {
      try {
        setLoadingActivity(true);
        const response = await fetch("/api/profile/activity?limit=10", {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Activity unavailable");
        const payload = await response.json();
        if (!active) return;
        const apiItems = Array.isArray(payload.activity)
          ? payload.activity
          : [];
        if (apiItems.length > 0) {
          setActivities(apiItems.slice(0, 6).map(normalizeActivity));
        }
      } catch {
        if (active) setActivities(mockActivities);
      } finally {
        if (active) setLoadingActivity(false);
      }
    };

    void loadActivity();
    return () => {
      active = false;
    };
  }, [isPeerView]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:"))
        URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const lastLogin = formatDateTime(user?.lastSeen) || "Today, 9:24 AM";
  const initials = initialsFor(profile.fullName, profile.username);
  const bioRemaining = 240 - draft.bio.length;

  const validateContact = () => {
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!/^[+()\-\s0-9]{7,20}$/.test(draft.phone)) {
      nextErrors.phone = "Enter a valid phone number.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateDraft = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  };

  const saveProfile = (scope) => {
    if (scope === "contact" && !validateContact()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const nextProfile = { ...profile, ...draft };
    setProfile(nextProfile);
    setUser?.((current) => ({
      ...current,
      displayName: nextProfile.fullName,
      username: nextProfile.username,
      email: nextProfile.email,
      phone: nextProfile.phone,
      department: nextProfile.department,
      photo: avatarPreview,
    }));
    setEditingContact(false);
    setEditingBio(false);
    setErrors({});
    toast.success("Profile updated");
  };

  const cancelEdit = () => {
    setDraft(profile);
    setErrors({});
    setEditingContact(false);
    setEditingBio(false);
  };

  const openIdentityModal = () => {
    setDraft((current) => ({
      ...current,
      fullName: profile.fullName,
      username: profile.username,
      department: profile.department,
      academicLevel: profile.academicLevel,
    }));
    setIdentityModalOpen(true);
  };

  const closeIdentityModal = () => {
    setDraft((current) => ({
      ...current,
      fullName: profile.fullName,
      username: profile.username,
      department: profile.department,
      academicLevel: profile.academicLevel,
    }));
    setIdentityModalOpen(false);
  };

  const saveIdentity = async () => {
    const displayName = draft.fullName.trim();
    const uname = draft.username.trim();
    const department = draft.department.trim();
    const schoolYear = academicLevelToSchoolYear(draft.academicLevel);

    if (!displayName || !uname) {
      toast.error("Full name and username are required.");
      return;
    }
    if (user?.accountType === "student") {
      if (!department) {
        toast.error("Department or major is required.");
        return;
      }
      if (!Number.isFinite(schoolYear) || schoolYear < 1 || schoolYear > 7) {
        toast.error("Choose a valid academic level.");
        return;
      }
    }

    setIdentitySaving(true);
    try {
      const body =
        user?.accountType === "student"
          ? { displayName, username: uname, department, schoolYear }
          : { displayName, username: uname, department };

      const res = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.message || "Could not save profile.");

      await refreshAuth();
      setIdentityModalOpen(false);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e.message || "Could not save profile.");
    } finally {
      setIdentitySaving(false);
    }
  };

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for your profile picture.");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setAvatarPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return nextUrl;
    });
    toast.success("Profile picture ready to save");
  };

  const removeSession = (sessionId) => {
    setSessions((current) =>
      current.filter((session) => session.id !== sessionId),
    );
    setConfirm(null);
    toast.success("Device session signed out");
  };

  const handleLogout = async () => {
    setConfirm(null);
    await logout();
    toast.success("Signed out");
  };

  const handlePeerSubscribe = async () => {
    if (!peerApiProfile?.id || peerActionLoading) return;
    setPeerActionLoading(true);
    setPeerActionMessage("");
    try {
      const res = await fetch(
        `/api/profile/public/${peerApiProfile.id}/subscribe`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please sign in to subscribe.");
        }
        throw new Error(data?.message || "Could not update subscription");
      }
      const subscribed = Boolean(data?.subscribed);
      const nextCount = Number.isFinite(data?.profile?.subscribersCount)
        ? data.profile.subscribersCount
        : peerSubscribersCount;
      setPeerSubscribed(subscribed);
      setPeerSubscribersCount(nextCount);
      setPeerApiProfile((prev) =>
        prev ? { ...prev, subscribersCount: nextCount } : prev,
      );
      setPeerActionMessage(
        subscribed ? "You’re following this member." : "Subscription removed.",
      );
      window.setTimeout(() => setPeerActionMessage(""), 3200);
    } catch (err) {
      setPeerActionMessage(err?.message || "Could not update subscription.");
      window.setTimeout(() => setPeerActionMessage(""), 4000);
    } finally {
      setPeerActionLoading(false);
    }
  };

  if (
    isPeerView &&
    viewerIdStr &&
    peerUserId &&
    viewerIdStr === String(peerUserId)
  ) {
    return <Navigate to="/profile" replace />;
  }

  const showPeerDashboard =
    isPeerView && !peerLoading && !peerError && peerApiProfile;
  const showOwnerDashboard = !isPeerView;

  return (
    <main className="dashboard-ambient min-h-screen pb-16">
      <section className="relative z-20 mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {isPeerView ? (
          <Link
            to="/library"
            className="group mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-cyan-400/45 hover:bg-white hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-900"
          >
            <ArrowLeft
              className="h-4 w-4 transition group-hover:-translate-x-0.5"
              aria-hidden
            />
            Campus library
          </Link>
        ) : null}

        {isPeerView && peerLoading ? (
          <div className="rounded-[2rem] border border-slate-200/90 bg-white p-10 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="animate-pulse space-y-6">
              <div className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-52 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        ) : null}

        {isPeerView && !peerLoading && peerError ? (
          <div className="rounded-[2rem] border border-rose-200/90 bg-gradient-to-br from-rose-50 to-white p-10 text-center shadow-inner dark:border-rose-900/40 dark:from-rose-950/50 dark:to-slate-900">
            <p className="font-display text-lg font-semibold text-rose-900 dark:text-rose-100">
              {peerError}
            </p>
            <Link
              to="/library"
              className="btn-primary mt-6 inline-flex px-6 py-2.5 text-sm"
            >
              Browse library
            </Link>
          </div>
        ) : null}

        {isPeerView && !peerLoading && !peerError && !peerApiProfile ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-10 text-center dark:border-slate-700 dark:bg-slate-900/70">
            <p className="font-medium text-slate-600 dark:text-slate-400">
              We couldn’t find this profile.
            </p>
            <Link
              to="/library"
              className="btn-primary mt-5 inline-flex px-6 py-2.5 text-sm"
            >
              Back to library
            </Link>
          </div>
        ) : null}

        {showOwnerDashboard || showPeerDashboard ? (
          <>
        <div className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-black/30">
          <div className="relative z-0 h-40 bg-gradient-to-r from-cyan-700 via-blue-700 to-indigo-700 sm:h-52">
            <div
              className="absolute inset-0 z-0 workspace-hero-mesh opacity-80"
              aria-hidden
            />
            {!isPeerView ? (
            <div className="absolute bottom-5 right-5 z-[1] hidden items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white ring-1 ring-white/25 backdrop-blur sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Student record synced
            </div>
            ) : null}
          </div>

          <div className="relative z-10 min-h-[10rem] bg-white px-4 pb-6 pt-8 sm:min-h-[11rem] sm:px-6 sm:pb-7 sm:pt-10 lg:px-8 dark:bg-slate-900">
            <div className="-mt-8 flex flex-col gap-5 sm:-mt-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end lg:items-start">
                {!isPeerView ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative z-10 h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-slate-100 text-left ring-2 ring-white/80 profile-avatar-ring dark:bg-slate-800 dark:ring-slate-700 sm:h-32 sm:w-32"
                  aria-label="Upload profile picture"
                  title="Change profile picture"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-cyan-800 dark:text-cyan-200">
                      {initials}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-950/65 py-2 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Camera className="h-4 w-4" aria-hidden />
                    Change
                  </span>
                </button>
                ) : (
                <div className="relative z-10 h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-slate-100 ring-2 ring-white/80 profile-avatar-ring dark:bg-slate-800 dark:ring-slate-700 sm:h-32 sm:w-32">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-cyan-800 dark:text-cyan-200">
                      {initials}
                    </span>
                  )}
                </div>
                )}
                {!isPeerView ? (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={uploadAvatar}
                />
                ) : null}

                <div className="relative z-10 min-w-0 pt-2 lg:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="relative z-10 max-w-full text-balance break-words font-display text-3xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                      {profile.fullName || profile.username || "Student"}
                    </h1>
                    <span className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      {profile.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                    @{profile.username} / {profile.department} /{" "}
                    {profile.academicLevel}
                  </p>
                  {!isPeerView ? (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Student ID:{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {profile.studentId}
                    </span>
                  </p>
                  ) : null}
                  {isPeerView && peerJoinedDate ? (
                    <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <span>
                        Member since{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {peerJoinedDate}
                        </span>
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="relative z-10 flex flex-wrap gap-2">
                {isPeerView ? (
                  <>
                    {user &&
                    peerApiProfile?.id &&
                    viewerIdStr !== String(peerApiProfile.id) ? (
                      <div className="flex w-full justify-end sm:w-auto sm:justify-start">
                        <BookEventReportMenu
                          targetType="user"
                          targetId={String(peerApiProfile.id)}
                          shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/users/${peerApiProfile.id}`}
                          align="left"
                        />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handlePeerSubscribe()}
                      disabled={peerActionLoading}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        peerSubscribed
                          ? "border-2 border-emerald-400/50 bg-emerald-50 text-emerald-900 shadow-emerald-900/10 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950/80"
                          : "btn-primary shadow-cyan-900/20"
                      }`}
                    >
                      <UserPlus className="h-5 w-5" aria-hidden />
                      {peerActionLoading
                        ? "Please wait…"
                        : peerSubscribed
                          ? "Following"
                          : "Follow"}
                    </button>
                  </>
                ) : (
                <Link
                  to="/settings"
                  className="btn-secondary gap-2 px-4 py-2 text-sm"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                  Settings
                </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isPeerView ? (
        <nav
          className="sticky top-[4.75rem] z-20 mt-5 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90"
          aria-label="Profile sections"
        >
          <div className="grid min-w-max grid-cols-4 gap-1 sm:min-w-0">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 ${
                  activeTab === id
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/20"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
                aria-current={activeTab === id ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </nav>
        ) : null}

        {activeTab === "overview" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              {!isPeerView ? (
              <>
              <section aria-labelledby="academic-title">
                <div className="mb-4 flex items-center gap-2">
                  <GraduationCap
                    className="h-6 w-6 text-cyan-700 dark:text-cyan-300"
                    aria-hidden
                  />
                  <h2
                    id="academic-title"
                    className="font-display text-2xl font-bold text-slate-950 dark:text-white"
                  >
                    Academic Overview
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard
                    icon={Medal}
                    label="GPA"
                    value={mockAcademic.gpa}
                    hint="Cumulative"
                    progress={93}
                    tone="cyan"
                  />
                  <StatCard
                    icon={CalendarDays}
                    label="Semester"
                    value={mockAcademic.currentSemester}
                    hint="Registration active"
                    tone="indigo"
                  />
                  <StatCard
                    icon={BookOpen}
                    label="Enrolled"
                    value={mockAcademic.enrolledCourses}
                    hint="Courses this term"
                    progress={67}
                    tone="emerald"
                  />
                  <StatCard
                    icon={FileCheck2}
                    label="Completed"
                    value={mockAcademic.completedCourses}
                    hint="Courses passed"
                    progress={mockAcademic.graduationProgress}
                    tone="cyan"
                  />
                  <StatCard
                    icon={Clock3}
                    label="Attendance"
                    value={`${mockAcademic.attendance}%`}
                    hint="Across current courses"
                    progress={mockAcademic.attendance}
                    tone="emerald"
                  />
                  <StatCard
                    icon={ShieldCheck}
                    label="Standing"
                    value={mockAcademic.standing}
                    hint="No academic holds"
                    progress={100}
                    tone="amber"
                  />
                </div>
              </section>

              <section aria-labelledby="contact-title">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Mail
                      className="h-6 w-6 text-cyan-700 dark:text-cyan-300"
                      aria-hidden
                    />
                    <h2
                      id="contact-title"
                      className="font-display text-2xl font-bold text-slate-950 dark:text-white"
                    >
                      Contact & Personal Information
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    {editingContact ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary gap-2 px-4 py-2 text-sm"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" aria-hidden />
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-primary gap-2 px-4 py-2 text-sm"
                          onClick={() => saveProfile("contact")}
                        >
                          <Save className="h-4 w-4" aria-hidden />
                          Save
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary gap-2 px-4 py-2 text-sm"
                        onClick={() => setEditingContact(true)}
                      >
                        <Edit3 className="h-4 w-4" aria-hidden />
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldRow
                    label="Email address"
                    name="email"
                    type="email"
                    value={draft.email}
                    editing={editingContact}
                    onChange={updateDraft}
                    error={errors.email}
                    icon={Mail}
                    badge="Verified"
                  />
                  <FieldRow
                    label="Phone number"
                    name="phone"
                    type="tel"
                    value={draft.phone}
                    editing={editingContact}
                    onChange={updateDraft}
                    error={errors.phone}
                    icon={Phone}
                  />
                  <FieldRow
                    label="Campus location"
                    name="location"
                    value={draft.location}
                    editing={editingContact}
                    onChange={updateDraft}
                    icon={MapPin}
                  />
                  <FieldRow
                    label="Emergency contact"
                    name="emergencyContact"
                    value={draft.emergencyContact}
                    editing={editingContact}
                    onChange={updateDraft}
                    icon={Bell}
                  />
                </div>
              </section>

              <section aria-labelledby="achievements-title">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy
                    className="h-6 w-6 text-cyan-700 dark:text-cyan-300"
                    aria-hidden
                  />
                  <h2
                    id="achievements-title"
                    className="font-display text-2xl font-bold text-slate-950 dark:text-white"
                  >
                    Achievements & Progress
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {achievements.map(({ label, detail, Icon }) => (
                    <article
                      key={label}
                      className="dashboard-card-lift rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <h3 className="mt-4 font-display text-lg font-bold text-slate-950 dark:text-white">
                        {label}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {detail}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
              </>
              ) : null}
              {isPeerView ? (
                <PeerLibraryGrid sharedBooks={peerSharedBooks} />
              ) : null}
            </div>

            <aside className="space-y-6">
              {!isPeerView ? (
              <>
              <section
                className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60"
                aria-labelledby="quick-actions-title"
              >
                <h2
                  id="quick-actions-title"
                  className="font-display text-xl font-bold text-slate-950 dark:text-white"
                >
                  Quick Actions
                </h2>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    className="btn-secondary justify-start gap-2 px-4 py-2.5 text-sm"
                    onClick={openIdentityModal}
                  >
                    <Edit3 className="h-4 w-4" aria-hidden />
                    Edit Profile
                  </button>
                  <Link
                    to="/settings"
                    className="btn-secondary justify-start gap-2 px-4 py-2.5 text-sm"
                  >
                    <Settings className="h-4 w-4" aria-hidden />
                    Settings page
                  </Link>
                  <Link
                    to="/password/reset"
                    className="btn-secondary justify-start gap-2 px-4 py-2.5 text-sm"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden />
                    Change password
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary justify-start gap-2 px-4 py-2.5 text-sm"
                    onClick={() => toast.success("Data export request queued")}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download my data
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-start gap-2 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    onClick={() =>
                      setConfirm({
                        title: "Log out of University Student Hub?",
                        description:
                          "You will need to sign in again to access classrooms, library materials, and AI study tools.",
                        actionLabel: "Logout",
                        onConfirm: handleLogout,
                      })
                    }
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Logout
                  </button>
                </div>
              </section>

              <section
                className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60"
                aria-labelledby="security-mini-title"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2
                    id="security-mini-title"
                    className="font-display text-xl font-bold text-slate-950 dark:text-white"
                  >
                    Security Summary
                  </h2>
                  <ShieldCheck
                    className="h-5 w-5 text-emerald-600 dark:text-emerald-300"
                    aria-hidden
                  />
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Email
                    </dt>
                    <dd className="font-bold text-emerald-700 dark:text-emerald-300">
                      Verified
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Password
                    </dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200">
                      Changed Apr 12
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">2FA</dt>
                    <dd className="font-bold text-amber-700 dark:text-amber-300">
                      Future ready
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Alerts
                    </dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200">
                      None
                    </dd>
                  </div>
                </dl>
              </section>
              </>
              ) : (
              <>
              <section className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
                <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                  Presence on the hub
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Follow for updates when they publish new library materials.
                </p>
                {peerActionMessage ? (
                  <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    {peerActionMessage}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3">
                  <StatCard
                    icon={Users}
                    label="Followers"
                    value={peerSubscribersCount}
                    tone="indigo"
                  />
                  <StatCard
                    icon={BookOpen}
                    label="Books shared"
                    value={peerBooksSharedCount}
                    tone="cyan"
                  />
                </div>
              </section>
              </>
              )}
            </aside>
          </div>
        ) : null}

        {!isPeerView && activeTab === "activity" ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <section aria-labelledby="student-activity-title">
              <div className="mb-4 flex items-center gap-2">
                <Activity
                  className="h-6 w-6 text-cyan-700 dark:text-cyan-300"
                  aria-hidden
                />
                <h2
                  id="student-activity-title"
                  className="font-display text-2xl font-bold text-slate-950 dark:text-white"
                >
                  Student Activity & Engagement
                </h2>
              </div>
              <div className="space-y-3">
                {loadingActivity
                  ? [
                      "activity-skeleton-1",
                      "activity-skeleton-2",
                      "activity-skeleton-3",
                      "activity-skeleton-4",
                    ].map((key) => (
                      <div
                        key={key}
                        className="h-24 animate-pulse rounded-2xl border border-slate-200/90 bg-white/70 dark:border-slate-700/80 dark:bg-slate-900/60"
                      />
                    ))
                  : activities.map(({ id, type, title, meta, time, Icon }) => (
                      <article
                        key={id}
                        className="dashboard-card-lift flex gap-4 rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-400/20">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {type}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {time}
                            </span>
                          </div>
                          <h3 className="mt-2 font-display text-lg font-bold text-slate-950 dark:text-white">
                            {title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {meta}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="h-9 w-9 shrink-0 rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label="Activity options"
                        >
                          <MoreHorizontal
                            className="mx-auto h-5 w-5"
                            aria-hidden
                          />
                        </button>
                      </article>
                    ))}
              </div>
            </section>

            <section aria-labelledby="account-activity-title">
              <div className="mb-4 flex items-center gap-2">
                <MonitorSmartphone
                  className="h-6 w-6 text-cyan-700 dark:text-cyan-300"
                  aria-hidden
                />
                <h2
                  id="account-activity-title"
                  className="font-display text-2xl font-bold text-slate-950 dark:text-white"
                >
                  Account Activity
                </h2>
              </div>
              <div className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60">
                <dl className="grid gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                    <dt className="font-bold text-slate-500 dark:text-slate-400">
                      Last login
                    </dt>
                    <dd className="mt-1 text-slate-950 dark:text-white">
                      {lastLogin}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                    <dt className="font-bold text-slate-500 dark:text-slate-400">
                      Last device
                    </dt>
                    <dd className="mt-1 text-slate-950 dark:text-white">
                      Chrome on Windows
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-slate-200/90 p-3 dark:border-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        <Laptop
                          className="mt-1 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-950 dark:text-white">
                            {session.device}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {session.location}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                            {session.time}
                          </p>
                        </div>
                        {!session.current ? (
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                            onClick={() =>
                              setConfirm({
                                title: "Logout this device?",
                                description: `This ends the active session for ${session.device}.`,
                                actionLabel: "Logout device",
                                onConfirm: () => removeSession(session.id),
                              })
                            }
                          >
                            Logout
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {!isPeerView && activeTab === "security" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Mail}
              label="Email verification"
              value="Verified"
              hint={profile.email}
              progress={100}
              tone="emerald"
            />
            <StatCard
              icon={Lock}
              label="Password"
              value="Apr 12"
              hint="Last changed"
              progress={80}
              tone="cyan"
            />
            <StatCard
              icon={ShieldCheck}
              label="2FA status"
              value="Planned"
              hint="Future-ready controls"
              progress={40}
              tone="amber"
            />
            <StatCard
              icon={AlertTriangle}
              label="Security alerts"
              value="0"
              hint="No open alerts"
              progress={100}
              tone="emerald"
            />
            <section className="rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm md:col-span-2 xl:col-span-4 dark:border-slate-700/80 dark:bg-slate-900/60">
              <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
                Security Actions
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/password/reset"
                  className="btn-primary gap-2 px-4 py-2 text-sm"
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Change password
                </Link>
                <Link
                  to="/settings"
                  className="btn-secondary gap-2 px-4 py-2 text-sm"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Go to security settings
                </Link>
              </div>
            </section>
          </div>
        ) : null}

        {!isPeerView && activeTab === "about" ? (
          <section
            className="mt-6 rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/60"
            aria-labelledby="about-title"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness
                  className="h-6 w-6 text-cyan-700 dark:text-cyan-300"
                  aria-hidden
                />
                <h2
                  id="about-title"
                  className="font-display text-2xl font-bold text-slate-950 dark:text-white"
                >
                  Bio & Student Goals
                </h2>
              </div>
              {editingBio ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary gap-2 px-4 py-2 text-sm"
                    onClick={cancelEdit}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary gap-2 px-4 py-2 text-sm"
                    onClick={() => saveProfile("bio")}
                  >
                    <Save className="h-4 w-4" aria-hidden />
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary gap-2 px-4 py-2 text-sm"
                  onClick={() => setEditingBio(true)}
                >
                  <Edit3 className="h-4 w-4" aria-hidden />
                  Edit
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Short bio
                </span>
                {editingBio ? (
                  <>
                    <textarea
                      className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:bg-slate-900"
                      name="bio"
                      value={draft.bio}
                      maxLength={240}
                      onChange={updateDraft}
                      aria-label="Short bio"
                    />
                    <span
                      className={`mt-1 block text-right text-xs font-semibold ${bioRemaining < 20 ? "text-amber-600" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      {bioRemaining} characters remaining
                    </span>
                  </>
                ) : (
                  <p className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                    {profile.bio}
                  </p>
                )}
              </div>
              <FieldRow
                label="Interests"
                name="interests"
                value={draft.interests}
                editing={editingBio}
                onChange={updateDraft}
                icon={Sparkles}
              />
              <FieldRow
                label="Career goals"
                name="careerGoals"
                value={draft.careerGoals}
                editing={editingBio}
                onChange={updateDraft}
                icon={Target}
              />
              <FieldRow
                label="Skills"
                name="skills"
                value={draft.skills}
                editing={editingBio}
                onChange={updateDraft}
                icon={Check}
              />
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Upload
                    className="h-4 w-4 text-cyan-700 dark:text-cyan-300"
                    aria-hidden
                  />
                  Certificates
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Credential uploads and verified certificates are ready for a
                  future backend endpoint.
                </p>
              </div>
            </div>
          </section>
        ) : null}
          </>
        ) : null}
      </section>

      {!isPeerView ? (
      <IdentityEditModal
        open={identityModalOpen}
        title="Edit profile"
        draft={draft}
        updateDraft={updateDraft}
        isStudent={user?.accountType !== "instructor"}
        saving={identitySaving}
        onClose={closeIdentityModal}
        onSave={() => void saveIdentity()}
      />
      ) : null}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        description={confirm?.description}
        actionLabel={confirm?.actionLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
      />

      {!isPeerView ? (
      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-white shadow-xl shadow-cyan-600/25 transition hover:-translate-y-0.5 hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Upload profile picture"
        title="Upload profile picture"
      >
        <Camera className="h-5 w-5" aria-hidden />
      </button>
      ) : null}
    </main>
  );
}

export default Profile;
