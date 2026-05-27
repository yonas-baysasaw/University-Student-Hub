import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AuthAlert,
  AuthDivider,
  AuthField,
  AuthGoogleButton,
  AuthPrimaryButton,
  buildAuthHref,
  googleAuthHref,
  SignupVerifySuccess,
} from '../components/auth/campusAuth';
import { PasswordRequirements } from '../components/auth/PasswordRequirements';
import {
  getPasswordStrength,
  validateCampusPassword,
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
  const loginHref = buildAuthHref('/login', nextSafe);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (!department.trim()) {
      setError('Department is required.');
      return;
    }
    const y = Number(schoolYear);
    if (!Number.isFinite(y) || y < 1 || y > 7) {
      setError('Choose a valid school year (1–7).');
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

    const body = {
      username,
      email,
      password,
      accountType: 'student',
      department: department.trim(),
      schoolYear: Number(schoolYear),
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
          'Account created. Check your email to verify your address before signing in.',
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

  if (success) {
    return (
      <SignupVerifySuccess
        email={registeredEmail}
        onResend={handleResendSignupVerification}
        resendLoading={verifyResendLoading}
        resendMsg={verifyResendMsg}
        loginHref={loginHref}
      />
    );
  }

  return (
    <>
      <AuthGoogleButton href={googleAuthHref(nextSafe)} />
      <AuthDivider />

      <form className="auth-campus-form-grid" onSubmit={handleSubmit}>
        {error ? (
          <AuthAlert type="error" className="auth-campus-span-full">
            {error}
          </AuthAlert>
        ) : null}

        <AuthField
          id="signup-username"
          label="Username"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />

        <AuthField
          id="signup-email"
          label="Email address"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <AuthField
          id="signup-department"
          label="Department"
          placeholder="e.g. Computer Science"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />

        <div className="auth-campus-field">
          <label htmlFor="signup-year" className="auth-campus-label">
            School year
          </label>
          <select
            id="signup-year"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="auth-campus-input"
          >
            {YEAR_OPTIONS.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <AuthField
          id="signup-password"
          label="Password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          showToggle
          showSecret={showPassword}
          onToggle={() => setShowPassword((p) => !p)}
        />

        <AuthField
          id="signup-confirm"
          label="Confirm password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          showToggle
          showSecret={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((p) => !p)}
        />

        {password ? (
          <div className="auth-campus-span-full auth-campus-password-panel">
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

        <div className="auth-campus-span-full">
          <AuthPrimaryButton loading={loading}>
            {loading ? 'Creating account…' : 'Create an account'}
          </AuthPrimaryButton>
        </div>
      </form>
    </>
  );
}

export default Signup;
