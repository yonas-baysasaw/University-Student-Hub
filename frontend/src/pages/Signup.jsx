import { useEffect, useMemo, useRef, useState } from 'react';
import { FaGoogle } from 'react-icons/fa';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { getPasswordStrength } from '../utils/passwordStrength';
import { safeInternalPath } from '../utils/safeRedirect';

function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextSafe = safeInternalPath(searchParams.get('next'));
  const successTimer = useRef();
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    },
    [],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !email || !password || !confirmPassword) {
      setError('All fields are required.');
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

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to create account.');
      }

      setSuccess('Account created. Redirecting to sign in...');
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      successTimer.current = setTimeout(() => {
        const loginTarget = nextSafe
          ? `/login?next=${encodeURIComponent(nextSafe)}`
          : '/login';
        navigate(loginTarget, { replace: true });
      }, 1200);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.message || 'Something went wrong, try again.');
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Set up your student workspace">
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        {(error || success) && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {error || success}
          </div>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input-field text-sm"
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field text-sm"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field pr-16 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${strength.color}`}
              style={{ width: `${Math.max(8, strength.score * 20)}%` }}
            />
          </div>
          <p className={`mt-1 text-xs font-semibold ${strength.text}`}>
            Password strength: {strength.label}
          </p>
        </div>

        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field pr-16 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            {showConfirmPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="submit" className="btn-primary h-11 w-full text-sm">
          Sign up
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Already have an account?</span>
        <Link
          to="/login"
          className="font-medium transition hover:text-slate-700 hover:underline"
        >
          Sign in
        </Link>
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          or continue with
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <a
        href="/api/auth/google"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:border-cyan-300 hover:bg-slate-50 hover:text-cyan-700"
        aria-label="Continue with Google"
      >
        <FaGoogle className="text-base" />
      </a>
    </AuthShell>
  );
}

export default Signup;
