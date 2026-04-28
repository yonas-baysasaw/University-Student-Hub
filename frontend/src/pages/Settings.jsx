import { Cpu, Moon, Palette, Shield, Sparkles, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getStoredThemePreference, setThemePreference } from '../theme.js';
import { getPasswordStrength } from '../utils/passwordStrength';

function Settings() {
  const { user, refreshAuth } = useAuth();

  const [themeChoice, setThemeChoiceState] = useState(() =>
    getStoredThemePreference(),
  );

  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(user?.geminiModelId ?? '');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [testing, setTesting] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [byokMsg, setByokMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [resetEmail, setResetEmail] = useState(user?.email ?? '');
  const [resetStatus, setResetStatus] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const strength = useMemo(
    () => getPasswordStrength(newPassword),
    [newPassword],
  );

  const byokActive = !!user?.geminiConfigured;

  useEffect(() => {
    setModelId(user?.geminiModelId ?? '');
  }, [user?.geminiModelId]);

  useEffect(() => {
    setResetEmail(user?.email ?? '');
  }, [user?.email]);

  useEffect(() => {
    setThemeChoiceState(getStoredThemePreference());
  }, []);

  function applyTheme(choice) {
    setThemeChoiceState(choice);
    setThemePreference(choice);
  }

  async function testKey() {
    if (!apiKey.trim()) return;
    setTesting(true);
    setByokMsg('');
    try {
      const res = await fetch(
        `/api/ai/models?apiKey=${encodeURIComponent(apiKey.trim())}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to list models');
      setModels(data.models || []);
      setByokMsg('✓ Key is valid');
    } catch (err) {
      setByokMsg(`✗ ${err.message}`);
      setModels([]);
    } finally {
      setTesting(false);
    }
  }

  async function saveByok() {
    setSavingKey(true);
    setByokMsg('');
    try {
      const res = await fetch('/api/profile/api-key', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: apiKey.trim(),
          geminiModelId: modelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setByokMsg('Saved!');
      await refreshAuth();
    } catch (err) {
      setByokMsg(`✗ ${err.message}`);
    } finally {
      setSavingKey(false);
    }
  }

  async function clearByok() {
    setSavingKey(true);
    setByokMsg('');
    try {
      const res = await fetch('/api/profile/api-key', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to clear');
      setApiKey('');
      setModelId('');
      setModels([]);
      setByokMsg('Cleared.');
      await refreshAuth();
    } catch (err) {
      setByokMsg(`✗ ${err.message}`);
    } finally {
      setSavingKey(false);
    }
  }

  async function submitPasswordChange(event) {
    event.preventDefault();
    setPwMsg('');
    if (!newPassword || !confirmPassword || !currentPassword) {
      setPwMsg('Fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg('New password must be at least 8 characters.');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not update password');
      setPwMsg('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwMsg(err.message || 'Could not update password.');
    } finally {
      setPwSaving(false);
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    setResetError('');
    setResetStatus('');
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setResetError('Please enter your email.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to send reset link.');
      }
      setResetStatus('Check your inbox for a password reset link.');
    } catch (err) {
      setResetError(err.message || 'Unable to send reset email.');
    } finally {
      setResetLoading(false);
    }
  }

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Cpu },
  ];

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
              Account
            </p>
            <h1 className="font-display mt-2 text-3xl text-slate-900 dark:text-slate-100 md:text-4xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Appearance, Liqu AI, and security preferences.
            </p>
          </div>
          <Link
            to="/profile"
            className="btn-secondary shrink-0 px-4 py-2 text-sm"
          >
            Back to profile
          </Link>
        </div>

        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
              <Palette className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl text-slate-900 dark:text-slate-100">
                Appearance
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Choose how University Student Hub looks. System follows your OS.
              </p>
              <fieldset className="mt-4 inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-600 dark:bg-slate-800/50">
                <legend className="sr-only">Theme</legend>
                {themeOptions.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyTheme(id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      themeChoice === id
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </fieldset>
            </div>
          </div>
        </div>

        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl text-slate-900 dark:text-slate-100">
                  Liqu AI (Gemini)
                </h2>
                {byokActive ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                    BYOK active
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Optional API key
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Bring your own Gemini API key to reduce shared limits and pick a
                model. Your key is stored on the server; paste a new key here to
                replace it (we never show it back).
              </p>

              <label
                htmlFor="settings-api-key"
                className="mb-1 mt-5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Gemini API Key
              </label>
              <div className="mb-3 flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="settings-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza…"
                    autoComplete="off"
                    className="input-field w-full pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={testKey}
                  disabled={testing || !apiKey.trim()}
                  className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
                >
                  {testing ? '…' : 'Test'}
                </button>
              </div>

              <label
                htmlFor="settings-model"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Model
              </label>
              <select
                id="settings-model"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="input-field mb-4 w-full text-sm"
              >
                <option value="">Default (server model)</option>
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.displayName || m.name}
                  </option>
                ))}
              </select>

              {byokMsg ? (
                <p
                  className={`mb-3 text-xs font-medium ${
                    byokMsg.startsWith('✓') ||
                    byokMsg === 'Saved!' ||
                    byokMsg === 'Cleared.'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {byokMsg}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveByok}
                  disabled={savingKey}
                  className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50 sm:flex-none sm:min-w-[8rem]"
                >
                  {savingKey ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={clearByok}
                  disabled={savingKey}
                  className="btn-secondary px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/15 text-slate-700 dark:text-slate-300">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-8">
              <div>
                <h2 className="font-display text-xl text-slate-900 dark:text-slate-100">
                  Password
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Change your password if you sign in with email and password.
                </p>

                {user?.hasLocalPassword ? (
                  <form
                    className="mt-5 space-y-3"
                    onSubmit={submitPasswordChange}
                  >
                    <div>
                      <label
                        htmlFor="settings-current-pw"
                        className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Current password
                      </label>
                      <input
                        id="settings-current-pw"
                        type={showPw.current ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field text-sm"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs text-slate-500 underline dark:text-slate-400"
                        onClick={() =>
                          setShowPw((s) => ({
                            ...s,
                            current: !s.current,
                          }))
                        }
                      >
                        {showPw.current ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div>
                      <label
                        htmlFor="settings-new-pw"
                        className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        New password
                      </label>
                      <input
                        id="settings-new-pw"
                        type={showPw.next ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field text-sm"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs text-slate-500 underline dark:text-slate-400"
                        onClick={() =>
                          setShowPw((s) => ({ ...s, next: !s.next }))
                        }
                      >
                        {showPw.next ? 'Hide' : 'Show'}
                      </button>
                      {newPassword ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Strength: {strength.label}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label
                        htmlFor="settings-confirm-pw"
                        className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Confirm new password
                      </label>
                      <input
                        id="settings-confirm-pw"
                        type={showPw.confirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field text-sm"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs text-slate-500 underline dark:text-slate-400"
                        onClick={() =>
                          setShowPw((s) => ({
                            ...s,
                            confirm: !s.confirm,
                          }))
                        }
                      >
                        {showPw.confirm ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {pwMsg ? (
                      <p
                        className={`text-sm ${
                          pwMsg.includes('updated')
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {pwMsg}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={pwSaving}
                      className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
                    >
                      {pwSaving ? 'Updating…' : 'Update password'}
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                    Your account does not use a local password (for example,
                    Google sign-in only). Use “Reset via email” below if you
                    need to set a password via reset link.
                  </p>
                )}
              </div>

              <div className="border-t border-slate-200 pt-8 dark:border-slate-600">
                <h3 className="font-display text-lg text-slate-900 dark:text-slate-100">
                  Reset via email
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  We will send a secure link to reset your password (works while
                  signed in).
                </p>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={submitForgotPassword}
                >
                  <input
                    type="email"
                    placeholder="Email address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="input-field text-sm"
                    autoComplete="email"
                  />
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-secondary h-11 w-full max-w-sm text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resetLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                  {(resetError || resetStatus) && (
                    <p
                      className={`rounded-xl px-3 py-2 text-sm ${
                        resetError
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      }`}
                    >
                      {resetError || resetStatus}
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Settings;
