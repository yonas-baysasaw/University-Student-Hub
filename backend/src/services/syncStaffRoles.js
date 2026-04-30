import { ENV } from '../config/env.js';
import User from '../models/User.js';

/** Promote users whose email is listed in STAFF_EMAILS (no demotion). */
export async function syncStaffRolesFromEnv() {
  const emails = ENV.STAFF_EMAILS;
  if (!emails.length) return;

  const result = await User.updateMany(
    { email: { $in: emails } },
    { $set: { role: 'staff' } },
  );

  console.log(
    `[staff] STAFF_EMAILS sync: matched ${result.matchedCount}, modified ${result.modifiedCount}`,
  );
}
