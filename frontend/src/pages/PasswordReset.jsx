import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AuthAlert,
  AuthField,
  AuthInlineLink,
  AuthPrimaryButton,
  CampusAuthLayout,
} from '../components/auth/campusAuth';
import { useAuth } from '../contexts/AuthContext';

function PasswordReset() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setSent(false);

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

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.message || 'Unable to send reset link.');
      }
      setSent(true);
      setStatus(
        payload.message ||
          'If an account exists for this email, we sent reset instructions.',
      );
    } catch (submitError) {
      setError(submitError.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CampusAuthLayout
      mode="reset"
      title="Reset password"
      subtitle="We'll email you a secure link to set a new password"
      showTabs={false}
      footer={
        <Link
          to={user ? '/' : '/login'}
          className="auth-campus-link"
        >
          {user ? 'Back to dashboard' : 'Back to sign in'}
        </Link>
      }
    >
      <p className="auth-campus-hint">
        Accounts that only use{' '}
        <strong>Continue with Google</strong> do not receive reset emails until
        you add a campus password via reset, or sign in with Google.
      </p>

      <form className="auth-campus-form-stack" onSubmit={handleSubmit}>
        {(error || status) && (
          <AuthAlert type={error ? 'error' : 'success'}>
            {error || status}
          </AuthAlert>
        )}

        {sent ? (
          <p className="auth-campus-hint">
            Check your inbox and spam folder. The link expires in one hour.
          </p>
        ) : null}

        <AuthField
          id="reset-email"
          label="Email address"
          type="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={sent}
        />

        <AuthPrimaryButton loading={loading} disabled={sent}>
          {loading ? 'Sending email…' : 'Email password reset link'}
        </AuthPrimaryButton>
      </form>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        Remember your password?{' '}
        <AuthInlineLink to="/login">Sign in</AuthInlineLink>
      </p>
    </CampusAuthLayout>
  );
}

export default PasswordReset;
