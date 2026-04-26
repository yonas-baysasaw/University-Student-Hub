import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';
import User from '../models/User.js';

const MAX_BODY_CHARS = 4000;
const MAX_SUBJECT_CHARS = 180;

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {import('nodemailer').Transporter} transporter
 */
function getOrCreateTransporter(transporter) {
  if (transporter) return transporter;
  if (!ENV.EMAIL_USER || !ENV.EMAIL_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'Gmail',
    auth: { user: ENV.EMAIL_USER, pass: ENV.EMAIL_PASS },
  });
}

/**
 * Send one email per classroom member (except the author) who has a non-empty
 * email. Skips if SMTP is not configured. Swallows per-recipient errors.
 *
 * @param {object} params
 * @param {string} params.classroomName
 * @param {string} params.chatId
 * @param {import('mongoose').Types.ObjectId} params.authorUserId
 * @param {import('mongoose').Types.ObjectId[]} params.memberIds
 * @param {{ title: string, body: string, authorName: string }} params.announcement
 * @param {import('nodemailer').Transporter | null} [params._transporter] — for tests
 * @returns {Promise<void>}
 */
export async function notifyClassroomMembersOfAnnouncement({
  classroomName,
  chatId,
  authorUserId,
  memberIds,
  announcement,
  _transporter = null,
}) {
  const transport = getOrCreateTransporter(_transporter);
  if (!transport) {
    console.warn(
      '[announcement-email] EMAIL_USER/EMAIL_PASS not set — skipping member emails',
    );
    return;
  }

  const authorStr = String(authorUserId);
  const recipientIdSet = (Array.isArray(memberIds) ? memberIds : []).filter(
    (id) => id && String(id) !== authorStr,
  );
  if (recipientIdSet.length === 0) return;

  const users = await User.find({ _id: { $in: recipientIdSet } })
    .select('email')
    .lean();

  const emailSet = new Set();
  for (const u of users) {
    const e = u.email && String(u.email).trim().toLowerCase();
    if (e) emailSet.add(e);
  }
  if (emailSet.size === 0) return;

  const base = (ENV.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const appUrl = `${base}/classroom/${encodeURIComponent(String(chatId))}/announcements`;

  const body =
    announcement.body.length > MAX_BODY_CHARS
      ? `${announcement.body.slice(0, MAX_BODY_CHARS)}…`
      : announcement.body;

  const subject =
    `${classroomName}: New announcement — ${announcement.title}`.slice(
      0,
      MAX_SUBJECT_CHARS,
    );
  const text = `A new announcement was posted in "${classroomName}" by ${announcement.authorName}.

Title: ${announcement.title}

${body}

Open in the app: ${appUrl}
`;

  const html = `<p><strong>${escapeHtml(classroomName)}</strong> — new announcement by ${escapeHtml(announcement.authorName)}</p>
<h2 style="font-size:1.1em;margin:0.75em 0 0.5em;">${escapeHtml(announcement.title)}</h2>
<div style="white-space:pre-wrap;font-family:system-ui,sans-serif;">${escapeHtml(body)}</div>
<p style="margin-top:1em;"><a href="${escapeHtml(appUrl)}">View in app</a></p>`;

  const from = ENV.EMAIL_USER;
  const results = await Promise.allSettled(
    [...emailSet].map((to) =>
      transport.sendMail({ from, to, subject, text, html }),
    ),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(
      '[announcement-email] Some recipient sends failed',
      failed.map(
        (f) => (f.status === 'rejected' && f.reason?.message) || 'unknown',
      ),
    );
  }
}
