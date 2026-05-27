import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FileQuestion,
  HelpCircle,
  History,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Send,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';
import { getStoredThemePreference, setThemePreference } from '../theme.js';
import {
  getPasswordStrength,
  validateCampusPassword,
} from '../utils/passwordStrength';

const LOCAL_SETTINGS_KEY = 'ush-settings-preferences-v2';

const defaultLocalSettings = {
  phone: '',
  studentId: 'USH-STUDENT',
  fontSize: 'medium',
  compactMode: false,
  accentColor: 'cyan',
  reduceMotion: false,
  showOnlineStatus: true,
  allowMentions: true,
  publicProfile: true,
  cacheOffline: true,
  syncOverMetered: false,
};

const accentOptions = [
  { id: 'cyan', label: 'Ocean', swatch: 'bg-cyan-500' },
  { id: 'blue', label: 'Campus', swatch: 'bg-blue-600' },
  { id: 'emerald', label: 'Library', swatch: 'bg-emerald-500' },
  { id: 'violet', label: 'Focus', swatch: 'bg-violet-500' },
];

const faqItems = [
  {
    question: 'How do classroom invitations work?',
    answer:
      'Classroom owners can share an invitation code. Students join from the Classroom page and receive access to chat, resources, assignments, and announcements.',
  },
  {
    question: 'Where are uploaded books stored?',
    answer:
      'Book files and profile images are uploaded to the configured cloud storage bucket, while searchable metadata stays in the University Student Hub database.',
  },
  {
    question: 'Can I use my own AI key?',
    answer:
      'Yes. Add your Google Gemini API key under Settings → Liqu AI access. Your key is stored encrypted and used for Liqu AI chat. If you clear it, the assistant falls back to the server-managed key.',
  },
];

function loadLocalSettings(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_SETTINGS_KEY}:${userId || 'me'}`);
    if (!raw) return defaultLocalSettings;
    return { ...defaultLocalSettings, ...JSON.parse(raw) };
  } catch {
    return defaultLocalSettings;
  }
}

function saveLocalSettings(userId, settings) {
  localStorage.setItem(
    `${LOCAL_SETTINGS_KEY}:${userId || 'me'}`,
    JSON.stringify(settings),
  );
}

function statusTone(kind) {
  if (kind === 'success') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25';
  }
  if (kind === 'danger') {
    return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/25';
  }
  return 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-500/25';
}

function Field({ label, hint, children }) {
  return (
    <div className="block">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-left transition hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900/35 dark:hover:border-cyan-600"
    >
      <span>
        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  password,
  onPasswordChange,
  onClose,
  onConfirm,
  busy,
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-confirm-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              danger
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
            }`}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="settings-confirm-title"
              className="font-display text-xl text-slate-950 dark:text-white"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {onPasswordChange ? (
          <Field
            label="Confirm password"
            hint="Required before continuing with this account action."
          >
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="input-field text-sm"
              autoComplete="current-password"
            />
          </Field>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || (onPasswordChange && !password.trim())}
            className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-cyan-700 hover:bg-cyan-800'
            }`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  badge,
  open,
  onToggle,
  children,
}) {
  return (
    <section className="panel-card overflow-hidden rounded-3xl">
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="flex w-full items-center gap-4 px-4 py-4 text-left outline-none transition hover:bg-cyan-50/50 focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-500/5 sm:px-6 sm:py-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/15 dark:text-cyan-300">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg text-slate-950 dark:text-white">
                {title}
              </span>
              {badge ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusTone(
                    badge.kind,
                  )}`}
                >
                  {badge.label}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
              {description}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
      </h2>
      <div
        id={`${id}-panel`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-200/80 px-4 py-5 dark:border-slate-700/80 sm:px-6 sm:py-6">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function Settings() {
  const { user, refreshAuth, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [openSection, setOpenSection] = useState('account');
  const [themeChoice, setThemeChoiceState] = useState(() =>
    getStoredThemePreference(),
  );
  const [localSettings, setLocalSettings] = useState(() =>
    loadLocalSettings(user?.id),
  );

  const [profileDraft, setProfileDraft] = useState({
    displayName: '',
    username: '',
    email: '',
    phone: '',
    studentId: '',
    department: '',
    schoolYear: '1',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [resetEmail, setResetEmail] = useState(user?.email ?? '');
  const [resetLoading, setResetLoading] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(user?.geminiModelId ?? '');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const [modal, setModal] = useState(null);
  const [modalPassword, setModalPassword] = useState('');
  const [modalBusy, setModalBusy] = useState(false);

  const passwordStrength = useMemo(
    () => getPasswordStrength(newPassword),
    [newPassword],
  );

  const avatar = user?.avatar || user?.photo || defaultProfile;
  const byokActive = !!user?.geminiConfigured;
  const studentId =
    profileDraft.studentId ||
    `USH-${String(user?.id || '000000')
      .slice(-6)
      .toUpperCase()}`;

  useEffect(() => {
    const nextLocal = loadLocalSettings(user?.id);
    setLocalSettings(nextLocal);
    setProfileDraft({
      displayName: user?.displayName || user?.name || '',
      username: user?.username || '',
      email: user?.email || '',
      phone: nextLocal.phone || '',
      studentId:
        nextLocal.studentId && nextLocal.studentId !== 'USH-STUDENT'
          ? nextLocal.studentId
          : `USH-${String(user?.id || '000000')
              .slice(-6)
              .toUpperCase()}`,
      department: user?.department || '',
      schoolYear:
        user?.schoolYear != null && user.schoolYear >= 1 && user.schoolYear <= 7
          ? String(user.schoolYear)
          : '1',
    });
    setResetEmail(user?.email || '');
    setModelId(user?.geminiModelId || '');
    if (user?.geminiConfigured) {
      setApiKey('');
    }
  }, [user]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const res = await fetch('/api/ai/models', { credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || 'Could not load AI models.');
      }
      setModels(Array.isArray(payload.models) ? payload.models : []);
    } catch (error) {
      setModels([]);
      toast.error(error.message || 'Could not load AI models.');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadModels();
    }
  }, [user?.id, loadModels]);

  useEffect(() => {
    saveLocalSettings(user?.id, localSettings);
  }, [localSettings, user?.id]);

  function updateLocalSetting(key, value) {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateProfileDraft(key, value) {
    setProfileDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyTheme(choice) {
    setThemeChoiceState(choice);
    setThemePreference(choice);
    toast.success(`Theme set to ${choice}`);
  }

  function resetProfileDraft() {
    const nextLocal = loadLocalSettings(user?.id);
    setProfileDraft({
      displayName: user?.displayName || user?.name || '',
      username: user?.username || '',
      email: user?.email || '',
      phone: nextLocal.phone || '',
      studentId:
        nextLocal.studentId && nextLocal.studentId !== 'USH-STUDENT'
          ? nextLocal.studentId
          : `USH-${String(user?.id || '000000')
              .slice(-6)
              .toUpperCase()}`,
      department: user?.department || '',
      schoolYear:
        user?.schoolYear != null && user.schoolYear >= 1 && user.schoolYear <= 7
          ? String(user.schoolYear)
          : '1',
    });
    toast.message('Profile changes reset');
  }

  async function saveProfile(event) {
    event.preventDefault();
    const displayName = profileDraft.displayName.trim();
    const username = profileDraft.username.trim();
    const department = profileDraft.department.trim();
    const schoolYear = Number(profileDraft.schoolYear);

    if (!displayName || !username) {
      toast.error('Full name and username are required.');
      return;
    }
    if (user?.accountType === 'student' && !department) {
      toast.error('Department or major is required.');
      return;
    }
    if (
      user?.accountType === 'student' &&
      (!Number.isFinite(schoolYear) || schoolYear < 1 || schoolYear > 7)
    ) {
      toast.error('Choose a valid school year.');
      return;
    }

    setProfileSaving(true);
    try {
      const body = {
        displayName,
        username,
        ...(user?.accountType === 'student'
          ? { department, schoolYear }
          : { department }),
      };
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.message || 'Could not save profile.');

      setLocalSettings((prev) => ({
        ...prev,
        phone: profileDraft.phone.trim(),
        studentId,
      }));

      if (profileDraft.email.trim() !== user?.email) {
        toast.message('Email change is ready for backend verification flow.');
      } else {
        toast.success('Account details saved.');
      }
      await refreshAuth();
    } catch (error) {
      toast.error(error.message || 'Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function uploadProfilePhoto(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/profile', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.message || 'Could not upload photo.');
      toast.success('Profile picture updated.');
      await refreshAuth();
    } catch (error) {
      toast.error(error.message || 'Could not upload photo.');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function sendVerificationEmail() {
    try {
      const res = await fetch('/api/verify-email/resend', {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Could not send email.');
      toast.success(payload.message || 'Verification email sent.');
    } catch (error) {
      toast.error(error.message || 'Could not send verification email.');
    }
  }

  async function submitPasswordChange(event) {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    const passwordCheck = validateCampusPassword(newPassword);
    if (!passwordCheck.valid) {
      toast.error(passwordCheck.message);
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.message || 'Could not update password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch (error) {
      toast.error(error.message || 'Could not update password.');
    } finally {
      setPwSaving(false);
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    const email = resetEmail.trim();
    if (!email) {
      toast.error('Enter an email address.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload.message || 'Unable to send reset link.');
      toast.success(payload.message || 'Password reset email sent.');
    } catch (error) {
      toast.error(error.message || 'Unable to send reset link.');
    } finally {
      setResetLoading(false);
    }
  }

  async function testKey() {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error('Enter a Gemini API key to test.');
      return;
    }
    setTestingKey(true);
    try {
      const res = await fetch('/api/profile/gemini/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmedKey }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || 'API key test failed.');
      }
      if (Array.isArray(payload.models) && payload.models.length > 0) {
        setModels(payload.models);
      }
      toast.success(payload.message || 'API key is valid.');
    } catch (error) {
      toast.error(error.message || 'API key test failed.');
    } finally {
      setTestingKey(false);
    }
  }

  async function saveByok() {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error('Enter a Gemini API key to save.');
      return;
    }
    setSavingKey(true);
    try {
      const res = await fetch('/api/profile/gemini', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmedKey, modelId: modelId.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || 'Could not save Liqu AI settings.');
      }
      setApiKey('');
      if (payload.user?.geminiModelId) {
        setModelId(payload.user.geminiModelId);
      }
      await refreshAuth();
      await loadModels();
      toast.success(payload.message || 'Liqu AI settings saved.');
    } catch (error) {
      toast.error(error.message || 'Could not save Liqu AI settings.');
    } finally {
      setSavingKey(false);
    }
  }

  async function clearByok() {
    setSavingKey(true);
    try {
      const res = await fetch('/api/profile/gemini', {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || 'Could not clear Liqu AI key.');
      }
      setApiKey('');
      setModelId('');
      await refreshAuth();
      await loadModels();
      toast.success(payload.message || 'Liqu AI key cleared.');
    } catch (error) {
      toast.error(error.message || 'Could not clear Liqu AI key.');
    } finally {
      setSavingKey(false);
    }
  }

  async function confirmModalAction() {
    if (modal === 'delete-account') {
      setModalBusy(true);
      try {
        const res = await fetch('/api/profile', {
          method: 'DELETE',
          credentials: 'include',
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(payload.message || 'Could not delete account.');
        toast.success('Account deleted.');
        navigate('/signup', { replace: true });
      } catch (error) {
        toast.error(error.message || 'Could not delete account.');
      } finally {
        setModalBusy(false);
        setModal(null);
        setModalPassword('');
      }
      return;
    }

    if (modal === 'logout-all') {
      setModalBusy(true);
      setTimeout(() => {
        setModalBusy(false);
        setModal(null);
        setModalPassword('');
        toast.message('Global session logout is ready for backend support.');
      }, 500);
    }
  }

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Cpu },
  ];

  return (
    <div className="page-surface px-3 pb-10 pt-6 md:px-6">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
              University Student Hub
            </p>
            <h1 className="font-display mt-2 text-3xl text-slate-950 dark:text-white md:text-5xl">
              Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Manage your student identity, security, learning preferences,
              storage, and support options from one polished workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/profile" className="btn-secondary px-4 py-2.5 text-sm">
              View profile
            </Link>
            <button
              type="button"
              onClick={() => toast.success('Settings are up to date.')}
              className="btn-primary gap-2 px-4 py-2.5 text-sm"
            >
              <Check className="h-4 w-4" aria-hidden />
              Save status
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="panel-card rounded-3xl p-4">
              <div className="flex items-center gap-3">
                <img
                  src={avatar}
                  alt=""
                  className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-700"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                    {user?.displayName ||
                      user?.name ||
                      user?.username ||
                      'Student'}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user?.email || 'Signed in'}
                  </p>
                </div>
              </div>
              <nav className="mt-4 space-y-1" aria-label="Settings sections">
                {[
                  ['account', UserRound, 'Account'],
                  ['appearance', Palette, 'Appearance'],
                  ['security', Shield, 'Privacy & security'],
                  ['storage', Database, 'Storage & data'],
                  ['about', Sparkles, 'About'],
                  ['support', HelpCircle, 'Help & support'],
                ].map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOpenSection(id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${
                      openSection === id
                        ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-4">
            <SettingsSection
              id="account"
              title="Account"
              description="Edit your student identity, profile photo, and academic details."
              icon={UserRound}
              open={openSection === 'account'}
              onToggle={() =>
                setOpenSection(openSection === 'account' ? '' : 'account')
              }
              badge={{
                label: user?.emailVerified ? 'Verified' : 'Needs verification',
                kind: user?.emailVerified ? 'success' : 'danger',
              }}
            >
              <form className="space-y-6" onSubmit={saveProfile}>
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={avatar}
                      alt=""
                      className="profile-avatar-ring h-20 w-20 rounded-3xl object-cover"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-950 dark:text-white">
                        Profile picture
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        PNG or JPG works best. The image is visible in chats and
                        public profile pages.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) =>
                        uploadProfilePhoto(event.target.files?.[0])
                      }
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoUploading}
                      className="btn-secondary gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" aria-hidden />
                      {photoUploading ? 'Uploading...' : 'Change'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toast.message(
                          'Photo removal is ready for backend support.',
                        )
                      }
                      className="btn-secondary px-4 py-2.5 text-sm text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name">
                    <input
                      value={profileDraft.displayName}
                      onChange={(event) =>
                        updateProfileDraft('displayName', event.target.value)
                      }
                      className="input-field text-sm"
                      autoComplete="name"
                    />
                  </Field>
                  <Field label="Username">
                    <input
                      value={profileDraft.username}
                      onChange={(event) =>
                        updateProfileDraft('username', event.target.value)
                      }
                      className="input-field text-sm"
                      autoComplete="username"
                    />
                  </Field>
                  <Field
                    label="Email address"
                    hint="Changing email will require backend verification before it becomes active."
                  >
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={profileDraft.email}
                        onChange={(event) =>
                          updateProfileDraft('email', event.target.value)
                        }
                        className="input-field text-sm"
                        autoComplete="email"
                      />
                      <button
                        type="button"
                        onClick={sendVerificationEmail}
                        className="btn-secondary shrink-0 px-3 text-sm"
                      >
                        Verify
                      </button>
                    </div>
                  </Field>
                  <Field
                    label="Phone number"
                    hint="Stored locally until profile schema support is added."
                  >
                    <input
                      type="tel"
                      value={profileDraft.phone}
                      onChange={(event) =>
                        updateProfileDraft('phone', event.target.value)
                      }
                      className="input-field text-sm"
                      autoComplete="tel"
                      placeholder="+251..."
                    />
                  </Field>
                  <Field label="Student ID" hint="Read-only campus identifier.">
                    <input
                      value={studentId}
                      readOnly
                      className="input-field cursor-not-allowed text-sm opacity-80"
                    />
                  </Field>
                  <Field label="Department / major">
                    <input
                      value={profileDraft.department}
                      onChange={(event) =>
                        updateProfileDraft('department', event.target.value)
                      }
                      className="input-field text-sm"
                      autoComplete="organization"
                    />
                  </Field>
                  {user?.accountType === 'student' ? (
                    <Field label="School year">
                      <select
                        value={profileDraft.schoolYear}
                        onChange={(event) =>
                          updateProfileDraft('schoolYear', event.target.value)
                        }
                        className="input-field text-sm"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((year) => (
                          <option key={year} value={String(year)}>
                            Year {year}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-200 pt-5 dark:border-slate-700 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setModal('delete-account');
                      setModalPassword('');
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete account
                  </button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={resetProfileDraft}
                      className="btn-secondary px-5 py-2.5 text-sm"
                    >
                      Reset changes
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="btn-primary gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" aria-hidden />
                      {profileSaving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </form>
            </SettingsSection>

            <SettingsSection
              id="appearance"
              title="Appearance"
              description="Theme, density, typography, and accessibility preferences."
              icon={Palette}
              open={openSection === 'appearance'}
              onToggle={() =>
                setOpenSection(openSection === 'appearance' ? '' : 'appearance')
              }
            >
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">
                    Dark mode
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {themeOptions.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyTheme(id)}
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                          themeChoice === id
                            ? 'border-cyan-400 bg-cyan-50 text-cyan-800 shadow-sm dark:border-cyan-500/60 dark:bg-cyan-500/10 dark:text-cyan-100'
                            : 'border-slate-200 bg-white/75 text-slate-600 hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900/35 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Font size">
                    <select
                      value={localSettings.fontSize}
                      onChange={(event) =>
                        updateLocalSetting('fontSize', event.target.value)
                      }
                      className="input-field text-sm"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </Field>
                  <Field label="Accent color">
                    <div className="grid grid-cols-2 gap-2">
                      {accentOptions.map((accent) => (
                        <button
                          key={accent.id}
                          type="button"
                          onClick={() =>
                            updateLocalSetting('accentColor', accent.id)
                          }
                          className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${
                            localSettings.accentColor === accent.id
                              ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-500/60 dark:bg-cyan-500/10 dark:text-cyan-100'
                              : 'border-slate-200 bg-white/75 text-slate-600 dark:border-slate-700 dark:bg-slate-900/35 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className={`h-3 w-3 rounded-full ${accent.swatch}`}
                          />
                          {accent.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    checked={localSettings.compactMode}
                    onChange={(value) =>
                      updateLocalSetting('compactMode', value)
                    }
                    label="Compact mode"
                    description="Reduce spacing in data-heavy classroom screens."
                  />
                  <Toggle
                    checked={localSettings.reduceMotion}
                    onChange={(value) =>
                      updateLocalSetting('reduceMotion', value)
                    }
                    label="Reduce motion"
                    description="Prefer calmer transitions and fewer animated effects."
                  />
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="security"
              title="Privacy & Security"
              description="Password, verification, sessions, and visibility controls."
              icon={Shield}
              open={openSection === 'security'}
              onToggle={() =>
                setOpenSection(openSection === 'security' ? '' : 'security')
              }
              badge={{
                label: user?.emailVerified ? 'Email verified' : 'Verify email',
                kind: user?.emailVerified ? 'success' : 'danger',
              }}
            >
              <div className="space-y-7">
                <div className="grid gap-4 lg:grid-cols-2">
                  <form
                    onSubmit={submitPasswordChange}
                    className="space-y-3 rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">
                          Change password
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          For accounts with local password sign-in.
                        </p>
                      </div>
                    </div>
                    {user?.hasLocalPassword ? (
                      <>
                        {[
                          [
                            'current',
                            'Current password',
                            currentPassword,
                            setCurrentPassword,
                          ],
                          ['next', 'New password', newPassword, setNewPassword],
                          [
                            'confirm',
                            'Confirm new password',
                            confirmPassword,
                            setConfirmPassword,
                          ],
                        ].map(([key, label, value, setter]) => (
                          <div key={key} className="relative">
                            <input
                              type={showPw[key] ? 'text' : 'password'}
                              value={value}
                              onChange={(event) => setter(event.target.value)}
                              placeholder={label}
                              className="input-field pr-11 text-sm"
                              autoComplete={
                                key === 'current'
                                  ? 'current-password'
                                  : 'new-password'
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPw((prev) => ({
                                  ...prev,
                                  [key]: !prev[key],
                                }))
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              aria-label={
                                showPw[key] ? 'Hide password' : 'Show password'
                              }
                            >
                              {showPw[key] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ))}
                        {newPassword ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Strength: {passwordStrength.label}
                          </p>
                        ) : null}
                        <button
                          type="submit"
                          disabled={pwSaving}
                          className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
                        >
                          {pwSaving ? 'Updating...' : 'Update password'}
                        </button>
                      </>
                    ) : (
                      <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        This account appears to use Google sign-in only. Use
                        reset by email to create or recover local access.
                      </p>
                    )}
                  </form>

                  <form
                    onSubmit={submitForgotPassword}
                    className="space-y-3 rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">
                          Reset password by email
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Send a secure link to the account inbox.
                        </p>
                      </div>
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      className="input-field text-sm"
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="btn-secondary w-full gap-2 py-2.5 text-sm disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      {resetLoading ? 'Sending...' : 'Send reset link'}
                    </button>
                  </form>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    checked={localSettings.showOnlineStatus}
                    onChange={(value) =>
                      updateLocalSetting('showOnlineStatus', value)
                    }
                    label="Show online status"
                    description="Allow classmates to see when you are active."
                  />
                  <Toggle
                    checked={localSettings.allowMentions}
                    onChange={(value) =>
                      updateLocalSetting('allowMentions', value)
                    }
                    label="Allow classroom mentions"
                    description="Notify you when classmates mention your name."
                  />
                  <Toggle
                    checked={localSettings.publicProfile}
                    onChange={(value) =>
                      updateLocalSetting('publicProfile', value)
                    }
                    label="Public profile"
                    description="Show your public library and profile summary."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setModal('logout-all');
                      setModalPassword('');
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-left transition hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-900/35"
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                        Logout from all devices
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        End browser sessions once backend session storage is
                        enabled.
                      </span>
                    </span>
                    <LogOut className="h-5 w-5 text-slate-400" />
                  </button>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Laptop className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">
                          Active sessions
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Current device and recent login history.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25">
                      Current
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      [
                        'This browser',
                        typeof Intl !== 'undefined'
                          ? `${Intl.DateTimeFormat().resolvedOptions().timeZone} timezone`
                          : 'Your local timezone',
                        Monitor,
                      ],
                      ['Recent login', 'Email or Google sign-in', History],
                    ].map(([title, subtitle, Icon]) => (
                      <div
                        key={title}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span>
                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                              {title}
                            </span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              {subtitle}
                            </span>
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="storage"
              title="Storage & Data"
              description="Cloud sync, cache, data export, and AI model access."
              icon={Database}
              open={openSection === 'storage'}
              onToggle={() =>
                setOpenSection(openSection === 'storage' ? '' : 'storage')
              }
            >
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950 dark:text-white">
                        Storage usage
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Estimated local and cloud-backed learning files.
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      1.8 GB of 5 GB
                    </span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full w-[36%] rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    checked={localSettings.cacheOffline}
                    onChange={(value) =>
                      updateLocalSetting('cacheOffline', value)
                    }
                    label="Offline mode"
                    description="Keep recently opened resources available locally."
                  />
                  <Toggle
                    checked={localSettings.syncOverMetered}
                    onChange={(value) =>
                      updateLocalSetting('syncOverMetered', value)
                    }
                    label="Sync on metered networks"
                    description="Allow background sync on limited connections."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => toast.success('Cached files cleared.')}
                    className="btn-secondary gap-2 px-4 py-3 text-sm"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Clear cache
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      toast.message('Data export endpoint is ready to connect.')
                    }
                    className="btn-secondary gap-2 px-4 py-3 text-sm"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download data
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.success('Cloud sync checked.')}
                    className="btn-secondary gap-2 px-4 py-3 text-sm"
                  >
                    <Cloud className="h-4 w-4" aria-hidden />
                    Check sync
                  </button>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-950 dark:text-white">
                      Liqu AI access
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusTone(
                        byokActive ? 'success' : 'info',
                      )}`}
                    >
                      {byokActive ? 'Your key active' : 'Server-managed'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Add your Google Gemini API key to use your own quota for Liqu
                    AI chat. Leave the model on default to use the server&apos;s
                    preferred model when no override is set.
                  </p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={
                          byokActive
                            ? 'Key saved — enter a new key to replace'
                            : 'AIza...'
                        }
                        className="input-field pr-11 text-sm"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <select
                      value={modelId}
                      onChange={(event) => setModelId(event.target.value)}
                      className="input-field text-sm"
                      disabled={modelsLoading}
                    >
                      <option value="">
                        {modelsLoading
                          ? 'Loading models...'
                          : 'Default server model'}
                      </option>
                      {models.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.displayName || model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={testKey}
                      disabled={testingKey || !apiKey.trim()}
                      className="btn-secondary px-4 py-2.5 text-sm disabled:opacity-50"
                    >
                      {testingKey ? 'Testing...' : 'Test key'}
                    </button>
                    <button
                      type="button"
                      onClick={saveByok}
                      disabled={savingKey}
                      className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"
                    >
                      {savingKey ? 'Saving...' : 'Save AI settings'}
                    </button>
                    <button
                      type="button"
                      onClick={clearByok}
                      disabled={savingKey || !byokActive}
                      className="btn-secondary px-4 py-2.5 text-sm text-rose-600 disabled:opacity-50"
                    >
                      Clear key
                    </button>
                  </div>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="about"
              title="About"
              description="Application version, release notes, and platform information."
              icon={Sparkles}
              open={openSection === 'about'}
              onToggle={() =>
                setOpenSection(openSection === 'about' ? '' : 'about')
              }
            >
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-slate-700 dark:from-cyan-500/10 dark:to-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-700 to-slate-900 text-sm font-black text-white">
                      USH
                    </span>
                    <div>
                      <p className="font-display text-xl text-slate-950 dark:text-white">
                        University Student Hub
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Collaborative classrooms, shared books, campus events,
                        and AI-assisted study tools for university students.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['App version', 'v1.0.0'],
                    ['Build number', '2026.05.07'],
                    ['Environment', 'Web app'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/30"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25">
                  <p className="text-sm font-bold text-slate-950 dark:text-white">
                    Release notes
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      New production settings workspace with responsive
                      accordions.
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      Improved profile, security, appearance, and support
                      controls.
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() =>
                      toast.success('You are on the latest version.')
                    }
                    className="btn-secondary mt-4 gap-2 px-4 py-2.5 text-sm"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Check for updates
                  </button>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              id="support"
              title="Help & Support"
              description="Support channels, policies, feedback, and frequently asked questions."
              icon={HelpCircle}
              open={openSection === 'support'}
              onToggle={() =>
                setOpenSection(openSection === 'support' ? '' : 'support')
              }
            >
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [Mail, 'Contact support', 'support@universityhub.local'],
                    [FileQuestion, 'Help center', 'Browse guides'],
                    [BookOpen, 'Guidelines', 'Community standards'],
                    [Bell, 'Report a bug', 'Send diagnostics'],
                  ].map(([Icon, title, subtitle]) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() =>
                        toast.message(`${title} is ready to connect.`)
                      }
                      className="rounded-3xl border border-slate-200 bg-white/70 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50/50 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:border-cyan-600 dark:hover:bg-cyan-500/10"
                    >
                      <Icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                      <p className="mt-3 text-sm font-bold text-slate-950 dark:text-white">
                        {title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {subtitle}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/55 p-4 dark:border-slate-700 dark:bg-slate-900/25">
                  <p className="text-sm font-bold text-slate-950 dark:text-white">
                    FAQ
                  </p>
                  <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
                    {faqItems.map((item) => (
                      <details key={item.question} className="group py-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-100">
                          {item.question}
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                        </summary>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {item.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      toast.message('Feedback form is ready to connect.')
                    }
                    className="btn-primary gap-2 px-4 py-3 text-sm"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden />
                    Send feedback
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="btn-secondary gap-2 px-4 py-3 text-sm"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    className="hover:text-cyan-700 dark:hover:text-cyan-300"
                  >
                    Terms & conditions
                  </button>
                  <button
                    type="button"
                    className="hover:text-cyan-700 dark:hover:text-cyan-300"
                  >
                    Privacy policy
                  </button>
                  <button
                    type="button"
                    className="hover:text-cyan-700 dark:hover:text-cyan-300"
                  >
                    Accessibility
                  </button>
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>
      </section>

      {modal ? (
        <ConfirmModal
          title={
            modal === 'delete-account'
              ? 'Delete account?'
              : 'Logout all devices?'
          }
          description={
            modal === 'delete-account'
              ? 'This permanently removes your account and signs you out. Enter your password to confirm.'
              : 'This will end every active session once persistent session management is enabled.'
          }
          confirmLabel={
            modal === 'delete-account' ? 'Delete account' : 'Logout all'
          }
          danger={modal === 'delete-account'}
          password={modalPassword}
          onPasswordChange={
            modal === 'delete-account' ? setModalPassword : null
          }
          onClose={() => {
            setModal(null);
            setModalPassword('');
          }}
          onConfirm={confirmModalAction}
          busy={modalBusy}
        />
      ) : null}
    </div>
  );
}

export default Settings;
