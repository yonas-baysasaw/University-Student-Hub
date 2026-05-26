import { ENV } from "../config/env.js";
import User from "../models/User.js";

/** Promote listed ADMIN_EMAILS to administrators on startup (no demotion). */
export async function syncAdminEmailsFromEnv() {
  const emails = Array.isArray(ENV.ADMIN_EMAILS) ? ENV.ADMIN_EMAILS : [];
  if (!emails.length) return;

  const result = await User.updateMany(
    { email: { $in: emails } },
    { $set: { role: "admin" } },
  );

  console.log(
    `[admin-emails] ADMIN_EMAILS sync: matched ${result.matchedCount}, modified ${result.modifiedCount}`,
  );
}
