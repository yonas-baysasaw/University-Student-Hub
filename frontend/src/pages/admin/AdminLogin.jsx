import { useMemo, useState } from 'react';
import { HiOutlineMail } from 'react-icons/hi';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../../components/AuthShell';
import { useAuth } from '../../contexts/AuthContext';
import { safeInternalPath } from '../../utils/safeRedirect';

const DEFAULT_NEXT = '/admin';

export default function AdminLogin() {
  const { refreshAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const nextRaw = searchParams.get('next');
  const nextSafe = useMemo(() => {
    const n = safeInternalPath(nextRaw);
    return n ?? DEFAULT_NEXT;
  }, [nextRaw]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const needsEmailVerify = error.startsWith('VERIFY_EMAIL:');
  const displayError = needsEmailVerify
    ? error.replace(/^VERIFY_EMAIL:\s*/, '')
    : error;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setResendMsg('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Enter your username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: trimmedIdentifier, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Invalid credentials');
      }

      if (!payload.user?.isAdmin) {
        await fetch('/api/auth/logout', {
          credentials: 'include',
          redirect: 'manual',
        });
        await refreshAuth();
        setError(
          'This portal is for administrators only. Use the main campus sign-in for student and instructor accounts.',
        );
        return;
      }

      setStatus('Signed in. Opening admin dashboard…');
      const target = nextSafe;
      setTimeout(() => {
        window.location.href = target;
      }, 400);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  async function handleResendVerification() {
    setResendMsg('');
    const raw = identifier.trim();
    const addr = raw.includes('@') ? raw.toLowerCase() : '';
    if (!addr) {
      setResendMsg(
        'Enter your email address in the first field, then try again.',
      );
      return;
    }
    setResendLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Could not send email.');
      }
      setResendMsg(data.message || 'Check your inbox.');
    } catch (e) {
      setResendMsg(e.message || 'Could not send email.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <AuthShell
      variant="admin"
      title="Admin portal"
      subtitle="Administrator sign-in"
    >
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="admin-login-identifier"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Username or email
          </label>
          <input
            id="admin-login-identifier"
            type="text"
            placeholder="example@university.edu"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            className="input-field text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="admin-login-password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Password
          </label>
          <input
            id="admin-login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="input-field text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary h-11 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in to admin'}
        </button>

        <div aria-live="polite" className="space-y-2">
          {(displayError || status) && (
            <p
              className={`rounded-xl px-3 py-2 text-center text-sm ${status && !displayError ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}
            >
              {status || displayError}
            </p>
          )}

          {needsEmailVerify ? (
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-orange-50/80 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:from-amber-950/40 dark:to-orange-950/25 dark:text-amber-50">
              <p className="font-semibold dark:text-amber-100">
                Verify your email
              </p>
              <p className="mt-1 text-xs opacity-90">
                Use the link we sent, or resend below.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-[13px] font-semibold text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/25 transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:from-cyan-500 dark:to-cyan-400 dark:text-slate-900 dark:ring-cyan-300/40"
              >
                <HiOutlineMail className="text-lg opacity-95" aria-hidden />
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </button>
              {resendMsg ? (
                <p className="mt-2 rounded-lg bg-white/60 px-2 py-2 text-xs dark:bg-black/25">
                  {resendMsg}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link
          to="/password/reset"
          className="font-medium transition hover:text-slate-700 hover:underline dark:hover:text-slate-200"
        >
          Forgot password?
        </Link>
        <Link
          to="/admin/signup"
          className="font-medium transition hover:text-slate-700 hover:underline dark:hover:text-slate-200"
        >
          Create admin account
        </Link>
      </div>

      <p className="mt-6 border-t border-slate-200/90 pt-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Student or instructor?{' '}
        <Link
          to={`/login?next=${encodeURIComponent(nextSafe)}`}
          className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400"
        >
          Campus sign in
        </Link>
      </p>
    </AuthShell>
  );
}
