import { useMemo, useState } from 'react';
import { FaGoogle } from 'react-icons/fa';
import { HiOutlineMail } from 'react-icons/hi';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import {
  getPasswordStrength,
  getPasswordSuggestions,
} from '../utils/passwordStrength';
import { safeInternalPath } from '../utils/safeRedirect';

const YEAR_OPTIONS = [
  { value: 1, label: '1st year' },
  { value: 2, label: '2nd year' },
  { value: 3, label: '3rd year' },
  { value: 4, label: '4th year' },
  { value: 5, label: '5th year' },
  { value: 6, label: '6th year' },
  { value: 7, label: '7th year' },
];

function Signup() {
  const [accountType, setAccountType] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [schoolYear, setSchoolYear] = useState('1');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [verifyResendLoading, setVerifyResendLoading] = useState(false);
  const [verifyResendMsg, setVerifyResendMsg] = useState('');
  const [searchParams] = useSearchParams();
  const nextSafe = safeInternalPath(searchParams.get('next'));

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const suggestions = useMemo(
    () => getPasswordSuggestions(password),
    [password],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!accountType) {
      setError('Choose whether you are a student or instructor.');
      return;
    }

    if (!username || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (accountType === 'student') {
      if (!department.trim()) {
        setError('Department is required for students.');
        return;
      }
      const y = Number(schoolYear);
      if (!Number.isFinite(y) || y < 1 || y > 7) {
        setError('Choose a valid school year (1–7).');
        return;
      }
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
      username,
      email,
      password,
      accountType,
      ...(accountType === 'student'
        ? { department: department.trim(), schoolYear: Number(schoolYear) }
        : {}),
    };

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || 'Unable to create account. Try again later.',
        );
      }

      setSuccess(
        data.message ||
          'Account created. Check your email and verify your address before signing in.',
      );
      setRegisteredEmail(email.trim().toLowerCase());
      setVerifyResendMsg('');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDepartment('');
      setSchoolYear('1');
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.message || 'Something went wrong, try again.');
    } finally {
      setLoading(false);
    }
  };

  const loginHref = nextSafe
    ? `/login?next=${encodeURIComponent(nextSafe)}`
    : '/login';

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

  return (
    <>
      {accountType === null ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 px-4 py-8 backdrop-blur-sm"
          aria-hidden={false}
        >
          <div
            className="panel-card w-full max-w-md rounded-3xl p-6 shadow-xl md:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-role-title"
          >
            <p
              id="signup-role-title"
              className="font-display text-xl text-slate-900 dark:text-slate-100"
            >
              Are You Student or Instructor
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-2xl border-2 border-cyan-500/40 bg-cyan-500/10 px-4 py-4 text-left transition hover:border-cyan-500 hover:bg-cyan-500/15"
                onClick={() => setAccountType('student')}
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Student
                </span>
              </button>
              <button
                type="button"
                className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-cyan-400 hover:bg-white dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-cyan-500/50"
                onClick={() => setAccountType('instructor')}
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Instructor
                </span>
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Already registered?{' '}
              <Link
                to={loginHref}
                className="font-medium text-cyan-700 underline hover:text-cyan-600 dark:text-cyan-400"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <AuthShell
        title="Create account"
        subtitle={
          accountType === 'instructor'
            ? 'Instructor workspace'
            : 'Student workspace'
        }
      >
        {accountType ? (
          <button
            type="button"
            onClick={() => {
              setAccountType(null);
              setError('');
              setSuccess('');
              setRegisteredEmail('');
              setVerifyResendMsg('');
            }}
            className="mb-4 text-left text-xs font-semibold text-cyan-700 underline hover:text-cyan-600 dark:text-cyan-400"
          >
            Change account type
          </button>
        ) : null}

        <form className="space-y-3.5" onSubmit={handleSubmit}>
          <div aria-live="polite">
            {(error || success) && (
              <div
                className={`rounded-xl px-3 py-2 text-sm ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}
              >
                {error || success}
              </div>
            )}
          </div>

          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Open the link in your email to verify. After that you will be
                signed in automatically.
              </p>
              <div className="rounded-2xl border border-cyan-200/70 bg-gradient-to-b from-cyan-50/90 to-slate-50 px-4 py-4 shadow-sm dark:border-cyan-800/50 dark:from-cyan-950/35 dark:to-slate-900/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Didn&apos;t receive the email?
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Check spam, or resend the verification message to{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {registeredEmail}
                  </span>
                  .
                </p>
                <button
                  type="button"
                  onClick={handleResendSignupVerification}
                  disabled={verifyResendLoading}
                  className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-[13px] font-semibold text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/25 transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:from-cyan-500 dark:to-cyan-400 dark:text-slate-900 dark:ring-cyan-300/40"
                >
                  <HiOutlineMail className="text-lg opacity-95" aria-hidden />
                  {verifyResendLoading
                    ? 'Sending email…'
                    : 'Send verification email again'}
                </button>
                {verifyResendMsg ? (
                  <p className="mt-2 rounded-lg bg-white/70 px-2 py-2 text-xs text-slate-700 dark:bg-black/30 dark:text-slate-200">
                    {verifyResendMsg}
                  </p>
                ) : null}
              </div>
              <Link
                to={loginHref}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800/50"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="signup-username"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
                >
                  Username
                </label>
                <input
                  id="signup-username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="input-field text-sm"
                  disabled={!accountType}
                />
              </div>
              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
                >
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="input-field text-sm"
                  disabled={!accountType}
                />
              </div>

              {accountType === 'student' ? (
                <>
                  <div>
                    <label
                      htmlFor="signup-department"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
                    >
                      Department
                    </label>
                    <input
                      id="signup-department"
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="signup-year"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
                    >
                      School year
                    </label>
                    <select
                      id="signup-year"
                      value={schoolYear}
                      onChange={(e) => setSchoolYear(e.target.value)}
                      className="input-field text-sm"
                    >
                      {YEAR_OPTIONS.map((o) => (
                        <option key={o.value} value={String(o.value)}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div className="relative">
                <label
                  htmlFor="signup-password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
                >
                  Password
                </label>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-field pr-16 text-sm"
                  disabled={!accountType}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute bottom-2 right-3 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all ${strength.color}`}
                    style={{ width: `${Math.max(8, strength.score * 20)}%` }}
                  />
                </div>
                <p className={`mt-1 text-xs font-semibold ${strength.text}`}>
                  Password strength: {strength.label}
                </p>
                {password && suggestions.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-xs text-slate-600 dark:text-slate-400">
                    {suggestions.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="relative">
                <label
                  htmlFor="signup-confirm"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
                >
                  Confirm password
                </label>
                <input
                  id="signup-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input-field pr-16 text-sm"
                  disabled={!accountType}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute bottom-2 right-3 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !accountType}
                className="btn-primary h-11 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Creating account…' : 'Sign up'}
              </button>
            </>
          )}
        </form>

        {!success ? (
          <>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Already have an account?</span>
              <Link
                to={loginHref}
                className="font-medium text-cyan-700 transition hover:underline dark:text-cyan-400"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
              Need an admin account?{' '}
              <Link
                to="/admin/signup"
                className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
              >
                Admin portal registration
              </Link>
            </p>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                or continue with
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
            </div>

            <a
              href="/api/auth/google"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:border-cyan-300 hover:bg-slate-50 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:bg-slate-800"
              aria-label="Continue with Google"
            >
              <FaGoogle className="text-base" />
            </a>
          </>
        ) : null}
      </AuthShell>
    </>
  );
}

export default Signup;
