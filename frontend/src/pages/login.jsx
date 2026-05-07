import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { HiOutlineMail } from "react-icons/hi";
import { Link, useSearchParams } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { safeInternalPath } from "../utils/safeRedirect";

function SignIn() {
  const [searchParams] = useSearchParams();
  const nextRaw = searchParams.get("next");
  const nextSafe = safeInternalPath(nextRaw);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const needsEmailVerify = error.startsWith("VERIFY_EMAIL:");
  const displayError = needsEmailVerify
    ? error.replace(/^VERIFY_EMAIL:\s*/, "")
    : error;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setResendMsg("");

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError("Enter your username/email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: trimmedIdentifier, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Invalid credentials");
      }

      setStatus("Signed in successfully. Redirecting...");
      const target = nextSafe ?? "/";
      setTimeout(() => {
        window.location.href = target;
      }, 450);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  async function handleResendVerification() {
    setResendMsg("");
    const raw = identifier.trim();
    const email = raw.includes("@") ? raw.toLowerCase() : "";
    if (!email) {
      setResendMsg(
        "Enter your email address in the first field (not only username), then try again.",
      );
      return;
    }
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Could not send email.");
      }
      setResendMsg(data.message || "Check your inbox.");
    } catch (e) {
      setResendMsg(e.message || "Could not send email.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your workspace"
    >
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="login-identifier"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Username or email
          </label>
          <input
            id="login-identifier"
            type="text"
            placeholder="example@university.edu"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            className="input-field text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="input-field text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary h-11 w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div aria-live="polite" className="space-y-2">
          {(displayError || status) && (
            <p
              className={`rounded-xl px-3 py-2 text-center text-sm ${status && !displayError ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"}`}
            >
              {status || displayError}
            </p>
          )}

          {needsEmailVerify ? (
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-orange-50/80 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:from-amber-950/40 dark:to-orange-950/25 dark:text-amber-50">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Verify your email
              </p>
              <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/90">
                We sent a confirmation link — check spam too. Tap below to
                resend.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="btn-primary mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-[13px] font-semibold text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/25 transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:from-cyan-500 dark:to-cyan-400 dark:text-slate-900 dark:ring-cyan-300/40"
              >
                <HiOutlineMail className="text-lg opacity-95" aria-hidden />
                {resendLoading
                  ? "Sending email…"
                  : "Send verification email again"}
              </button>
              {resendMsg ? (
                <p className="mt-2 rounded-lg bg-white/60 px-2 py-2 text-xs text-amber-900 dark:bg-black/25 dark:text-amber-100/95">
                  {resendMsg}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <Link
          to="/password/reset"
          className="font-medium transition hover:text-slate-700 hover:underline dark:hover:text-slate-200"
        >
          Forgot password?
        </Link>
        <Link
          to={
            nextSafe
              ? `/signup?next=${encodeURIComponent(nextSafe)}`
              : "/signup"
          }
          className="font-medium transition hover:text-slate-700 hover:underline dark:hover:text-slate-200"
        >
          Create account
        </Link>
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          or continue with
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-600" />
      </div>

      <a
        href="/api/auth/google"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:border-cyan-300 hover:bg-slate-50 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:bg-slate-800"
        aria-label="Continue with Google"
      >
        <FaGoogle className="text-base" />
      </a>
    </AuthShell>
  );
}

export default SignIn;
