/** Token-bucket rate limiter — 100 requests/minute per IP by default. */

function createTokenBucketLimiter({
  capacity = 100,
  refillIntervalMs = 60_000,
  message = { error: 'Rate limit exceeded.' },
} = {}) {
  const buckets = new Map();

  function refillBucket(bucket, now) {
    if (!bucket) {
      return { reportColors: capacity - 1, lastRefill: now };
    }
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= refillIntervalMs) {
      const periods = Math.floor(elapsed / refillIntervalMs);
      const refilled = Math.min(capacity, bucket.reportColors + periods * capacity);
      return { reportColors: refilled - 1, lastRefill: now };
    }
    if (bucket.reportColors <= 0) return null;
    return { reportColors: bucket.reportColors - 1, lastRefill: bucket.lastRefill };
  }

  return function tokenBucketRateLimit(req, res, next) {
    const ip =
      req.ip ||
      String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const current = buckets.get(ip);
    const updated = refillBucket(current, now);

    if (!updated) {
      res.setHeader('Retry-After', Math.ceil(refillIntervalMs / 1000));
      return res.status(429).json(message);
    }

    buckets.set(ip, updated);
    return next();
  };
}

module.exports = { createTokenBucketLimiter };
