import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AuthInlineLink,
  AuthStatusPanel,
  CampusAuthLayout,
} from '../components/auth/campusAuth';
import { safeInternalPath } from '../utils/safeRedirect';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const nextParam = searchParams.get('next');
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const wantsAdminLogin = safeInternalPath(nextParam)?.startsWith('/admin');

  useEffect(() => {
    if (!token || !token.trim()) {
      setStatus('error');
      setMessage('Missing verification link. Open the link from your email.');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: token.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setMessage(
            data.message ||
              'This link is invalid or has expired. Request a new one from sign-in.',
          );
          return;
        }

        setStatus('ok');
        setMessage(
          data.message ||
            'Your email is verified. You can sign in with your campus password.',
        );
        const target = wantsAdminLogin ? '/admin/login' : '/login';

        if (!cancelled) {
          setTimeout(() => {
            navigate(target, { replace: true });
          }, 2200);
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Something went wrong. Try again later.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate, wantsAdminLogin]);

  return (
    <CampusAuthLayout
      mode="login"
      title="Verify email"
      subtitle="Confirming your University Student Hub account"
      showTabs={false}
    >
      <AuthStatusPanel
        status={status}
        title={
          status === 'loading'
            ? 'Verifying your email'
            : status === 'ok'
              ? 'Email verified'
              : 'Verification failed'
        }
        message={status === 'loading' ? 'Please wait a moment…' : message}
      >
        {status === 'ok' ? (
          <p className="auth-campus-hint">
            {wantsAdminLogin
              ? 'Redirecting to admin sign in…'
              : 'Redirecting to sign in…'}
          </p>
        ) : status === 'error' ? (
          <div className="mt-2 flex flex-col items-center gap-2 text-sm">
            <AuthInlineLink to="/login">Back to sign in</AuthInlineLink>
            {safeInternalPath(nextParam)?.startsWith('/admin') ? (
              <Link to="/admin/login" className="auth-campus-link">
                Admin portal sign-in
              </Link>
            ) : null}
          </div>
        ) : null}
      </AuthStatusPanel>
    </CampusAuthLayout>
  );
}

export default VerifyEmail;
