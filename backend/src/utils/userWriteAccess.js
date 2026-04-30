/** @param {import('mongoose').Document | Record<string, unknown> | null | undefined} user */
export function isUserWriteBlocked(user) {
  if (!user) return true;
  if (user.role === 'staff') return false;
  if (user.platformReadOnly === true) return true;
  if (
    user.accountType === 'instructor' &&
    user.instructorPostingSuspended === true
  ) {
    return true;
  }
  return false;
}

const readOnlyMessage = 'Account is read-only';

/** @param {import('mongoose').Document | Record<string, unknown> | null | undefined} user */
export function assertCanWrite(user) {
  if (!isUserWriteBlocked(user)) return;
  const err = new Error(readOnlyMessage);
  err.status = 403;
  throw err;
}

export function blockReadOnlyUser(req, res, next) {
  try {
    assertCanWrite(req.user);
    next();
  } catch (err) {
    next(err);
  }
}
