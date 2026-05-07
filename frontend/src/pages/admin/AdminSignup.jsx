import { useEffect, useMemo, useState } from 'react';
import { HiOutlineMail } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import AuthShell from '../../components/AuthShell';
import {
  getPasswordStrength,
  getPasswordSuggestions,
} from '../../utils/passwordStrength';

export default function AdminSignup() {
  const [meta, setMeta] = useState({
    acceptingRegistrations: true,
    inviteKeyRequired: false,
  });
  const [metaLoading, setMetaLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminInviteKey, setAdminInviteKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verifyResendLoading, setVerifyResendLoading] = useState(false);
  const [verifyResendMsg, setVerifyResendMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/register-admin/meta');
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setMeta({
            acceptingRegistrations: !!data.acceptingRegistrations,
            inviteKeyRequired: !!data.inviteKeyRequired,
          });
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const suggestions = useMemo(
    () => getPasswordSuggestions(password),
    [password],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (meta.inviteKeyRequired && !adminInviteKey.trim()) {
      setError('An administrator invite key is required for registration.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    const body = {
      username: username.trim(),
      email: email.trim(),
      password,
      ...(adminInviteKey.trim()
        ? { adminInviteKey: adminInviteKey.trim() }
        : {}),
    };

    setLoading(true);
    try {
      const res = await fetch('/api/register-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message ||
            'Unable to create administrator account. Try again later.',
        );
      }
      setSuccess(
        data.message ||
          'Administrator account created. Verify your email before signing in.',
      );
      setRegisteredEmail(email.trim().toLowerCase());
      setVerifyResendMsg('');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAdminInviteKey('');
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.message || 'Something went wrong, try again.');
    } finally {
      setLoading(false);
    }
  };

  async function handleResendSignupVerification() {
    setVerifyResendMsg('');
    if (!registeredEmail) {
      setVerifyResendMsg('Missing email — try registering again.');
      return;
    }
    setVerifyResendLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Could not send email.');
      }
      setVerifyResendMsg(data.message || 'Check your inbox (and spam).');
    } catch (e) {
      setVerifyResendMsg(e.message || 'Could not send email.');
    } finally {
      setVerifyResendLoading(false);
    }
  }

  if (metaLoading) {
    return (
      <AuthShell
        variant="admin"
        title="Staff portal"
        subtitle="Loading registration options…"
      >
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          One moment.
        </p>
      </AuthShell>
    );
  }

  if (!meta.acceptingRegistrations) {
    return (
      <AuthShell
        variant="admin"
        title="Staff portal"
        subtitle="Administrator registration"
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200">
          <p className="font-semibold text-slate-900 dark:text-slate-50">
            Self-registration is closed
          </p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            An administrator account already exists and this server does not use
            an invite key. Ask an existing admin to promote your account, or set{' '}
            <code className="rounded bg-slate-200/80 px-1 py-0.5 text-xs dark:bg-slate-700">
              ADMIN_REGISTRATION_SECRET
            </code>{' '}
            on the server to enable keyed registration.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/admin/login"
              className="btn-primary inline-flex h-10 items-center px-4 text-sm"
            >
              Staff sign in
            </Link>
            <Link
              to="/login"
              className="btn-secondary inline-flex h-10 items-center px-4 text-sm"
            >
              Student / instructor sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      variant="admin"
      title="Create administrator"
      subtitle="Restricted portal — not for student or instructor signup"
    >
      <p className="rounded-xl border border-rose-200/70 bg-rose-50/90 px-3 py-2 text-[11px] leading-relaxed text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-100">
        Use the{' '}
        <Link
          to="/signup"
          className="font-semibold underline decoration-rose-400/80 underline-offset-2 hover:text-rose-900 dark:hover:text-white"
        >
          main registration
        </Link>{' '}
        for students and instructors.
      </p>

      <form className="mt-5 space-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="admin-signup-username"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Display name
          </label>
          <input
            id="admin-signup-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="name"
            className="input-field text-sm"
            placeholder="Your name"
          />
        </div>

        <div>
          <label
            htmlFor="admin-signup-email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Institutional email
          </label>
          <input
            id="admin-signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="input-field text-sm"
            placeholder="you@university.edu"
          />
        </div>

        {meta.inviteKeyRequired ? (
          <div>
            <label
              htmlFor="admin-invite-key"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
            >
              Administrator invite key
            </label>
            <input
              id="admin-invite-key"
              type="password"
              value={adminInviteKey}
              onChange={(e) => setAdminInviteKey(e.target.value)}
              autoComplete="off"
              className="input-field text-sm"
              placeholder="Provided by your deployment"
            />
          </div>
        ) : (
          <p className="rounded-lg bg-slate-100/90 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
            First administrator on this deployment — no invite key required.
          </p>
        )}

        <div>
          <label
            htmlFor="admin-signup-password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="admin-signup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="input-field pr-24 text-sm"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-400"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {password.length > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${strength.color}`}
                  style={{ width: `${Math.max(8, strength.score * 20)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {strength.label}
              </p>
              {suggestions.length > 0 ? (
                <ul className="list-inside list-disc text-[11px] text-slate-500 dark:text-slate-400">
                  {suggestions.slice(0, 3).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="admin-signup-confirm"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Confirm password
          </label>
          <input
            id="admin-signup-confirm"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="input-field text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary h-11 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create administrator account'}
        </button>

        <div aria-live="polite" className="space-y-2">
          {(error || success) && (
            <p
              className={`rounded-xl px-3 py-2 text-center text-sm ${success && !error ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}
            >
              {success || error}
            </p>
          )}
          {success ? (
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-orange-50/80 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:from-amber-950/40 dark:to-orange-950/25 dark:text-amber-50">
              <p className="font-semibold dark:text-amber-100">
                Verify your email
              </p>
              <p className="mt-1 text-xs opacity-90">
                Then use{' '}
                <Link
                  to="/admin/login"
                  className="font-semibold underline underline-offset-2"
                >
                  Staff sign in
                </Link>{' '}
                — not the main campus login.
              </p>
              <button
                type="button"
                onClick={handleResendSignupVerification}
                disabled={verifyResendLoading}
                className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-[13px] font-semibold text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/25 transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:from-cyan-500 dark:to-cyan-400 dark:text-slate-900 dark:ring-cyan-300/40"
              >
                <HiOutlineMail className="text-lg opacity-95" aria-hidden />
                {verifyResendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
              {verifyResendMsg ? (
                <p className="mt-2 rounded-lg bg-white/60 px-2 py-2 text-xs dark:bg-black/25">
                  {verifyResendMsg}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link
          to="/admin/login"
          className="font-medium transition hover:text-slate-700 hover:underline dark:hover:text-slate-200"
        >
          Staff sign in
        </Link>
        <Link
          to="/signup"
          className="font-medium transition hover:text-slate-700 hover:underline dark:hover:text-slate-200"
        >
          Student / instructor signup
        </Link>
      </div>
    </AuthShell>
  );
}
