import { FaGoogle } from 'react-icons/fa';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';

function SignIn() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

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
        body: JSON.stringify({ identifier: trimmedIdentifier, password })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Invalid credentials');
      }

      setStatus('Signed in successfully. Redirecting...');
      setTimeout(() => {
        window.location.href = '/';
      }, 450);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to your workspace">
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Username or email</label>
          <input
            type="text"
            placeholder="example@university.edu"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="input-field text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field text-sm"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary h-11 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        {(error || status) && (
          <p className={`rounded-xl px-3 py-2 text-center text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {error || status}
          </p>
        )}
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <Link to="/password/reset" className="font-medium transition hover:text-slate-700 hover:underline">
          Forgot password?
        </Link>
        <Link to="/signup" className="font-medium transition hover:text-slate-700 hover:underline">
          Create account
        </Link>
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">or continue with</span>
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

export default SignIn;
