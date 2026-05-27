import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AuthAlert,
  AuthField,
  AuthInlineLink,
  AuthPrimaryButton,
  CampusAuthLayout,
} from '../components/auth/campusAuth';
import { useAuth } from '../contexts/AuthContext';
import { PasswordRequirements } from '../components/auth/PasswordRequirements';
import {
  getPasswordStrength,
  validateCampusPassword,
} from '../utils/passwordStrength';

function Reset() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const navigate = useNavigate();
  const successTimer = useRef();
  const { token } = useParams();
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const { logout } = useAuth();

  useEffect(() => {
    void logout();
  }, [logout]);

  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!token) {
      setTokenInvalid(true);
    }
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setTokenInvalid(false);

    if (!password || !confirmPassword) {
      setError('Please complete both password fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const passwordCheck = validateCampusPassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'Unable to reset password.';
        if (/invalid|expired/i.test(msg)) {
          setTokenInvalid(true);
        }
        throw new Error(msg);
      }

      setSuccess('Password changed. Redirecting to sign in…');
      setPassword('');
      setConfirmPassword('');
      successTimer.current = setTimeout(
        () => navigate('/login', { replace: true }),
        1200,
      );
    } catch (submitError) {
      setError(submitError?.message || 'Something went wrong, try again.');
    } finally {
      setLoading(false);
    }
  };

  if (tokenInvalid && !success) {
    return (
      <CampusAuthLayout
        mode="reset"
        title="Link expired"
        subtitle="This reset link is invalid or has expired"
        showTabs={false}
      >
        <div className="auth-campus-form-stack">
        <AuthAlert type="error">
          Request a new password reset email and open the latest link.
        </AuthAlert>
        <AuthPrimaryButton
          type="button"
          onClick={() => navigate('/password/reset')}
        >
          Request new reset link
        </AuthPrimaryButton>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <AuthInlineLink to="/login">Back to sign in</AuthInlineLink>
        </p>
        </div>
      </CampusAuthLayout>
    );
  }

  return (
    <CampusAuthLayout
      mode="reset"
      title="Set new password"
      subtitle="Create a strong password for your account"
      showTabs={false}
      footer={
        <Link to="/login" className="auth-campus-link">
          Back to sign in
        </Link>
      }
    >
      <form className="auth-campus-form-stack" onSubmit={handleSubmit}>
        {(error || success) && (
          <AuthAlert type={error ? 'error' : 'success'}>
            {error || success}
          </AuthAlert>
        )}

        <AuthField
          id="reset-password"
          label="Password"
          placeholder="Enter new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          showToggle
          showSecret={showPassword}
          onToggle={() => setShowPassword((p) => !p)}
        />

        {password ? (
          <div className="auth-campus-password-panel">
            <div className="auth-campus-strength-compact">
              <div className="auth-campus-strength-bar">
                <div
                  className={`h-full rounded-full transition-all ${strength.color}`}
                  style={{ width: `${Math.max(8, strength.score * 20)}%` }}
                />
              </div>
              <span className={`auth-campus-strength-label ${strength.text}`}>
                {strength.label}
              </span>
            </div>
            <PasswordRequirements password={password} />
          </div>
        ) : null}

        <AuthField
          id="reset-confirm"
          label="Confirm password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          showToggle
          showSecret={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((p) => !p)}
        />

        <AuthPrimaryButton loading={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </AuthPrimaryButton>
      </form>
    </CampusAuthLayout>
  );
}

export default Reset;
