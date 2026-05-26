import { ENV } from "../config/env.js";
import {
  createMailTransporter,
  getMailFrom,
} from "../services/mailTransporter.js";
import { safeInternalPath } from "../utils/safeRedirect.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ to: string, token: string, verifyNext?: string }} params
 */
export async function sendVerificationEmail({ to, token, verifyNext }) {
  const transport = createMailTransporter();
  const from = getMailFrom();
  if (!transport || !from) {
    const err = new Error("Email is not configured on the server");
    err.status = 503;
    throw err;
  }

  const base = (ENV.FRONTEND_URL).replace(/\/$/, "");
  const safeNext = safeInternalPath(verifyNext);
  const qs = new URLSearchParams({ token });
  if (safeNext) qs.set("next", safeNext);
  const verifyUrl = `${base}/verify-email?${qs.toString()}`;
  const subject = "Confirm your University Student Hub account";

  const text = `Welcome to University Student Hub.\n\nConfirm your email by opening this link (valid for 48 hours):\n${verifyUrl}\n\nIf you did not create an account, you can ignore this message.\n`;

  const html = `<p>Welcome to <strong>University Student Hub</strong>.</p>
<p>Confirm your email by clicking below (link valid for 48 hours):</p>
<p><a href="${escapeHtml(verifyUrl)}">Verify email address</a></p>
<p style="font-size:0.88em;color:#64748b;">If the button does not work, copy and paste this URL into your browser:<br />${escapeHtml(verifyUrl)}</p>
<p style="font-size:0.88em;color:#64748b;">If you did not create an account, you can ignore this message.</p>`;

  await transport.sendMail({
    to,
    from,
    subject,
    text,
    html,
  });
}
