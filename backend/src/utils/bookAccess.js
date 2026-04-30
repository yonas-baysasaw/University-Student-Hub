/**
 * Library browse: public titles only for guests; signed-in users also see their own
 * (including unlisted — they do not appear for others in the directory).
 */
export function browseListFilter(req) {
  const authed = req.isAuthenticated?.();

  if (!authed) {
    return { visibility: 'public' };
  }

  return {
    $or: [{ visibility: 'public' }, { userId: req.user?._id }],
  };
}

export function bookOwnerId(book) {
  if (!book?.userId) return null;
  const u = book.userId;
  return u._id != null ? String(u._id) : String(u);
}

/**
 * Direct link access: public + unlisted for anyone; private for owner only.
 * @returns {{ ok: true } | { ok: false, status: number, code: string, message: string }}
 */
export function directAccessOutcome(book, req) {
  if (!book) {
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Book not found',
    };
  }

  const vis = book.visibility || 'public';
  const owner = bookOwnerId(book);
  const viewer = req.user?._id ? String(req.user._id) : null;

  if (vis === 'public' || vis === 'unlisted') {
    return { ok: true };
  }

  if (vis === 'private') {
    if (!viewer) {
      return {
        ok: false,
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Sign in to view this resource.',
      };
    }
    if (owner && viewer === owner) {
      return { ok: true };
    }
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Book not found',
    };
  }

  return { ok: true };
}

export function sendBookAccessDenied(res, outcome) {
  return res.status(outcome.status).json({
    success: false,
    code: outcome.code,
    message: outcome.message,
  });
}
