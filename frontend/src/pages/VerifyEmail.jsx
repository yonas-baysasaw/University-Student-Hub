import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { safeInternalPath } from "../utils/safeRedirect";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const nextParam = searchParams.get("next");
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const wantsAdminLogin = safeInternalPath(nextParam)?.startsWith("/admin");

  useEffect(() => {
    if (!token || !token.trim()) {
      setStatus("error");
      setMessage("Missing verification link. Open the link from your email.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: token.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(
            data.message ||
              "This link is invalid or has expired. Request a new one from sign-in.",
          );
          return;
        }

        setStatus("ok");
        setMessage(
          data.message ||
            "Your email has been verified successfully. You can now use your account.",
        );
        const target = wantsAdminLogin ? "/admin/login" : "/login";

        if (!cancelled) {
          setTimeout(() => {
            navigate(target, { replace: true });
          }, 1200);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Something went wrong. Try again later.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate, wantsAdminLogin]);

  return (
    <AuthShell
      title="Verify email"
      subtitle="Confirming your University Student Hub account"
    >
      <div aria-live="polite">
        {status === "loading" ? (
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Verifying your email...
          </p>
        ) : (
          <div
            className={`rounded-xl px-3 py-3 text-sm ${
              status === "ok"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            }`}
          >
            {message}
          </div>
        )}
      </div>

      {status === "ok" ? (
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          {wantsAdminLogin
            ? "Verification complete. Redirecting to admin sign in..."
            : "Verification complete. Redirecting to sign in..."}
        </p>
      ) : (
        <div className="mt-4 space-y-2 text-center text-sm">
          <Link
            to="/login"
            className="font-medium text-cyan-700 underline hover:text-cyan-600 dark:text-cyan-400"
          >
            Back to sign in
          </Link>
          {safeInternalPath(nextParam)?.startsWith("/admin") ? (
            <div>
              <Link
                to="/admin/login"
                className="font-medium text-violet-700 underline hover:text-violet-600 dark:text-violet-400"
              >
                Admin portal sign-in
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </AuthShell>
  );
}

export default VerifyEmail;
