/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

/**
 * @param {{ windowMs: number, max: number, keyFn: (req: import('express').Request) => string }} opts
 */
export function createRateLimiter({ windowMs, max, keyFn }) {
  return function rateLimitMiddleware(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
      });
    }
    return next();
  };
}
