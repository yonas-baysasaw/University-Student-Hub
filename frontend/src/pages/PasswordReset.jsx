import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../contexts/AuthContext';

function PasswordReset() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to send reset link.');
      }
      setStatus('Check your inbox for a password reset link.');
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle="We will email you a secure reset link"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="btn-primary h-11 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Sending reset link...' : 'Send reset link'}
        </button>

        {(error || status) && (
          <p
            className={`rounded-xl px-3 py-2 text-center text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {error || status}
          </p>
        )}
      </form>

      <div className="mt-4 text-center text-sm">
        <Link
          to={user ? '/' : '/login'}
          className="font-medium text-slate-500 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
        >
          {user ? 'Back to dashboard' : 'Back to sign in'}
        </Link>
      </div>
    </AuthShell>
  );
}

export default PasswordReset;
