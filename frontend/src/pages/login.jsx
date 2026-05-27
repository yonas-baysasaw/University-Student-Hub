import { useState } from 'react';
import { HiOutlineMail } from 'react-icons/hi';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthGoogleButton,
  AuthPrimaryButton,
  googleAuthHref,
} from '../components/auth/campusAuth';
import { safeInternalPath } from '../utils/safeRedirect';

function SignIn() {
  const [searchParams] = useSearchParams();
  const nextSafe = safeInternalPath(searchParams.get('next'));

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const needsEmailVerify = error.startsWith('VERIFY_EMAIL:');
  const displayError = needsEmailVerify
    ? error.replace(/^VERIFY_EMAIL:\s*/, '')
    : error;
  const isGoogleOnlyHint =
    displayError &&
    /google|password/i.test(displayError) &&
    !needsEmailVerify;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setResendMsg('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Enter your username or email and password.');
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

      setStatus('Signed in successfully. Redirecting…');
      const target = nextSafe ?? '/';
      setTimeout(() => {
        window.location.href = target;
      }, 450);
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  async function handleResendVerification() {
    setResendMsg('');
    const raw = identifier.trim();
    const email = raw.includes('@') ? raw.toLowerCase() : '';
    if (!email) {
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
        body: JSON.stringify({ email }),
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
    <>
      <AuthGoogleButton href={googleAuthHref(nextSafe)} />
      <AuthDivider />

      <form className="auth-campus-form-stack" onSubmit={handleSubmit}>
        {(displayError || status) && (
          <AuthAlert type={status && !displayError ? 'success' : 'error'}>
            {status || displayError}
          </AuthAlert>
        )}

        {isGoogleOnlyHint ? (
          <p className="auth-campus-hint">
            This account may use Google sign-in. Try{' '}
            <strong>Continue with Google</strong> above, or use{' '}
            <Link to="/password/reset" className="auth-campus-link">
              forgot password
            </Link>{' '}
            to set a campus password.
          </p>
        ) : null}

        <AuthField
          id="login-identifier"
          label="E-mail or username"
          placeholder="example@university.edu"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
        />

        <AuthField
          id="login-password"
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          showToggle
          showSecret={showPassword}
          onToggle={() => setShowPassword((p) => !p)}
        />

        <div className="auth-campus-meta-row">
          <label className="auth-campus-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/password/reset" className="auth-campus-link">
            Forgot password?
          </Link>
        </div>

        <AuthPrimaryButton loading={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </AuthPrimaryButton>

        {needsEmailVerify ? (
          <div className="auth-campus-verify-box">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Verify your email
            </p>
            <p className="auth-campus-hint mt-1">
              We sent a confirmation link — check spam too.
            </p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="auth-campus-primary-btn mt-3"
            >
              {resendLoading ? (
                <span className="auth-campus-spinner" aria-hidden />
              ) : (
                <HiOutlineMail className="text-lg" aria-hidden />
              )}
              <span>
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </span>
            </button>
            {resendMsg ? (
              <p className="auth-campus-hint mt-2">{resendMsg}</p>
            ) : null}
          </div>
        ) : null}
      </form>
    </>
  );
}

export default SignIn;
