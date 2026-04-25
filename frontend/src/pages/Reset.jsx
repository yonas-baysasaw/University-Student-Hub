import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { getPasswordStrength } from '../utils/passwordStrength';

function Reset() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const successTimer = useRef();
  const { token } = useParams();
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

    if (!password || !confirmPassword) {
      setError('Please complete both password fields.');
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
      const res = await fetch(`/api/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Unable to reset password.');
      }

      setSuccess('Password changed. Redirecting to sign in...');
      setPassword('');
      setConfirmPassword('');
      successTimer.current = setTimeout(
        () => navigate('/login', { replace: true }),
        1200,
      );
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.message || 'Something went wrong, try again.');
    }
  };

  return (
    <AuthShell
      title="Set new password"
      subtitle="Create a strong password for your account"
    >
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        {(error || success) && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {error || success}
          </div>
        )}

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
          Update password
        </button>
      </form>
    </AuthShell>
  );
}

export default Reset;
