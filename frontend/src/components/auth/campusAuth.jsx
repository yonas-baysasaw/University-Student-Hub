import { FcGoogle } from 'react-icons/fc';
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineMail,
} from 'react-icons/hi';
import { Link } from 'react-router-dom';
import { safeInternalPath } from '../../utils/safeRedirect';

export const AUTH_ALERT_ERROR =
  'rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
export const AUTH_ALERT_SUCCESS =
  'rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';

export function buildAuthHref(path, nextSafe) {
  return nextSafe
    ? `${path}?next=${encodeURIComponent(nextSafe)}`
    : path;
}

export function googleAuthHref(nextSafe) {
  const base = '/api/auth/google';
  if (!nextSafe) return base;
  return `${base}?next=${encodeURIComponent(nextSafe)}`;
}

export function AuthAlert({ type = 'error', children, className = '' }) {
  if (!children) return null;
  const cls = type === 'success' ? AUTH_ALERT_SUCCESS : AUTH_ALERT_ERROR;
  const merged = className ? `${cls} ${className}` : cls;
  return (
    <div aria-live="polite" className={merged}>
      {children}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="auth-campus-divider" role="separator">
      <span>OR</span>
    </div>
  );
}

export function AuthGoogleButton({ href, className = '' }) {
  return (
    <a
      href={href}
      className={`auth-campus-social-btn ${className}`.trim()}
    >
      <FcGoogle className="shrink-0 text-[1.35rem]" aria-hidden />
      <span>Continue with Google</span>
    </a>
  );
}

export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  showToggle,
  onToggle,
  showSecret,
  className = '',
}) {
  const inputType =
    showToggle && showSecret !== undefined
      ? showSecret
        ? 'text'
        : 'password'
      : type;

  return (
    <div className={`auth-campus-field ${className}`.trim()}>
      {label ? (
        <label htmlFor={id} className="auth-campus-label">
          {label}
        </label>
      ) : null}
      <div className={showToggle ? 'relative' : undefined}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`auth-campus-input ${showToggle ? 'pr-11' : ''}`}
        />
        {showToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={showSecret ? 'Hide password' : 'Show password'}
            className="auth-campus-eye-btn"
          >
            {showSecret ? (
              <HiOutlineEyeOff className="text-lg" aria-hidden />
            ) : (
              <HiOutlineEye className="text-lg" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  disabled,
  type = 'submit',
  onClick,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="auth-campus-primary-btn"
    >
      {loading ? <span className="auth-campus-spinner" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}

export function SignupVerifySuccess({
  email,
  onResend,
  resendLoading,
  resendMsg,
  loginHref,
}) {
  return (
    <div className="auth-campus-verify-success">
      <div className="auth-campus-verify-success-icon" aria-hidden>
        <HiOutlineMail className="text-3xl" />
      </div>
      <h2 className="auth-campus-verify-success-title">Check your inbox</h2>
      <p className="auth-campus-hint text-center">
        We sent a verification link to{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {email}
        </span>
        . Open it to activate your account, then sign in.
      </p>
      <ol className="auth-campus-verify-steps">
        <li>
          <span className="auth-campus-step-num">1</span>
          Open the email from University Student Hub
        </li>
        <li>
          <span className="auth-campus-step-num">2</span>
          Tap <strong>Verify email address</strong>
        </li>
        <li>
          <span className="auth-campus-step-num">3</span>
          Return here and sign in with your password
        </li>
      </ol>
      <div className="auth-campus-verify-box">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Didn&apos;t receive it?
        </p>
        <p className="auth-campus-hint mt-1">
          Check spam or promotions, then resend the message.
        </p>
        <button
          type="button"
          onClick={onResend}
          disabled={resendLoading}
          className="auth-campus-primary-btn mt-3"
        >
          {resendLoading ? (
            <span className="auth-campus-spinner" aria-hidden />
          ) : (
            <HiOutlineMail className="text-lg" aria-hidden />
          )}
          <span>{resendLoading ? 'Sending…' : 'Resend verification email'}</span>
        </button>
        {resendMsg ? (
          <p className="auth-campus-hint mt-2">{resendMsg}</p>
        ) : null}
      </div>
      <Link to={loginHref} className="auth-campus-secondary-outline">
        Go to sign in
      </Link>
    </div>
  );
}

export function AuthStatusPanel({ status, title, message, children }) {
  const isOk = status === 'ok';
  const isLoading = status === 'loading';
  return (
    <div className="auth-campus-status-panel">
      <div
        className={`auth-campus-status-icon ${isOk ? 'is-success' : isLoading ? 'is-loading' : 'is-error'}`}
        aria-hidden
      >
        {isLoading ? (
          <span className="auth-campus-spinner auth-campus-spinner--lg" />
        ) : isOk ? (
          <HiOutlineCheckCircle className="text-4xl" />
        ) : (
          <span className="text-2xl font-bold">!</span>
        )}
      </div>
      {title ? (
        <h2 className="auth-campus-verify-success-title">{title}</h2>
      ) : null}
      {message ? <p className="auth-campus-hint text-center">{message}</p> : null}
      {children}
    </div>
  );
}

export function CampusAuthLayout({
  mode,
  title,
  subtitle,
  nextSafe: nextProp,
  children,
  footer,
  showTabs = true,
  wide = false,
  backTo = '/',
  compact = false,
}) {
  const nextSafe = safeInternalPath(nextProp);
  const loginHref = buildAuthHref('/login', nextSafe);
  const signupHref = buildAuthHref('/signup', nextSafe);

  const shellClass = [
    'auth-campus-shell',
    wide ? 'auth-campus-shell--wide' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const cardClass = [
    'auth-campus-card',
    'panel-card',
    wide ? 'auth-campus-card--wide' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const bodyClass = [
    'auth-campus-body',
    compact || wide ? 'auth-campus-body--compact' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="auth-campus-page">
      <div className={shellClass}>
        <div className={cardClass}>
          <div className="auth-campus-card-toolbar">
            <Link to={backTo} className="auth-campus-back" aria-label="Go back">
              <HiOutlineArrowLeft className="text-lg" aria-hidden />
              <span>Back</span>
            </Link>
            <span className="auth-campus-logo" aria-hidden>
              USH
            </span>
            <span className="auth-campus-toolbar-spacer" aria-hidden />
          </div>

          {showTabs ? (
            <nav
              className={`auth-campus-tabs auth-campus-tabs--${mode}`}
              aria-label="Authentication"
            >
              <Link
                to={loginHref}
                className={mode === 'login' ? 'is-active' : ''}
                aria-current={mode === 'login' ? 'page' : undefined}
              >
                Login
              </Link>
              <Link
                to={signupHref}
                className={mode === 'signup' ? 'is-active' : ''}
                aria-current={mode === 'signup' ? 'page' : undefined}
              >
                Sign up
              </Link>
            </nav>
          ) : null}

          <header
            className={`auth-campus-header ${compact ? 'auth-campus-header--compact' : ''}`}
          >
            <h1 className="auth-campus-title">{title}</h1>
            {subtitle ? (
              <p className="auth-campus-subtitle">{subtitle}</p>
            ) : null}
          </header>

          <div className={bodyClass}>{children}</div>

          {footer ? (
            <footer className="auth-campus-footer">{footer}</footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AuthInlineLink({ to, children }) {
  return (
    <Link to={to} className="auth-campus-link">
      {children}
    </Link>
  );
}
